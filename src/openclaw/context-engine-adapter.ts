import { createHash, randomUUID } from 'node:crypto';
import { join, resolve, dirname, isAbsolute } from 'node:path';

import { ContextEngine } from '../engine/context-engine.js';
import { ContextEnginePlugin } from '../plugin/context-engine-plugin.js';
import type { ContextPluginMethod, ContextPluginRequest, ContextPluginResponse } from '../plugin/api.js';
import type { ExplainRequest, GraphNodeFilter, RawContextInput, RawContextRecord, RawContextSourceType } from '../types/io.js';
import type { RuntimeContextBundle, SessionCheckpoint } from '../types/core.js';
import { analyzeTextMatch, extractSearchTerms } from '../core/text-search.js';
import {
  buildCompressedToolResultMetadata,
  readCompressedToolResultContent,
  summarizeToolResultMessageContent
} from './tool-result-policy.js';
import { loadTranscriptContextInput } from './transcript-loader.js';
import type {
  AgentMessageLike,
  OpenClawContextEngine,
  OpenClawGatewayHandlerOptions,
  OpenClawPluginLogger
} from './types.js';

const PLUGIN_ID = 'compact-context';
const DEFAULT_DB_FILE = 'context-engine.sqlite';
const DEFAULT_TOKEN_BUDGET = 12000;
const DEFAULT_COMPILE_RATIO = 0.3;
const OWN_COMPACTION_TTL_MS = 5000;
const DEFAULT_GATEWAY_QUERY_EXPLAIN_LIMIT = 5;
const DEFAULT_INSPECT_BUNDLE_QUERY = 'inspect current context bundle';

export interface NormalizedPluginConfig {
  dbPath?: string;
  defaultTokenBudget: number;
  compileBudgetRatio: number;
  enableGatewayMethods: boolean;
  recentRawMessageCount: number;
}

export class ContextEngineRuntimeManager {
  private enginePromise?: Promise<ContextEngine>;
  private resolvedDbPath?: string;
  private readonly recentOwnCompactions = new Map<string, number>();

  constructor(
    private readonly config: NormalizedPluginConfig,
    private readonly logger: OpenClawPluginLogger,
    private readonly resolvePath?: (input: string) => string,
    private readonly resolveStateDir?: () => string | undefined
  ) {}

  async get(sessionFile?: string): Promise<ContextEngine> {
    if (!this.enginePromise) {
      const dbPath = this.resolveDbPath(sessionFile);
      this.resolvedDbPath = dbPath;
      this.logger.info(`[${PLUGIN_ID}] opening sqlite store at ${dbPath}`);
      this.enginePromise = ContextEngine.openSqlite({ dbPath });
    }

    return this.enginePromise;
  }

  async close(): Promise<void> {
    if (!this.enginePromise) {
      return;
    }

    const engine = await this.enginePromise;
    await engine.close();
    this.enginePromise = undefined;
  }

  markOwnCompaction(sessionId: string): void {
    this.recentOwnCompactions.set(sessionId, Date.now());
  }

  wasRecentlyCompactedByPlugin(sessionId: string, withinMs = OWN_COMPACTION_TTL_MS): boolean {
    const timestamp = this.recentOwnCompactions.get(sessionId);

    if (!timestamp) {
      return false;
    }

    if (Date.now() - timestamp > withinMs) {
      this.recentOwnCompactions.delete(sessionId);
      return false;
    }

    return true;
  }

  private resolveDbPath(sessionFile?: string): string {
    const hostStateDir = this.resolveHostStateDir();

    if (this.config.dbPath) {
      return resolveConfiguredPath(this.config.dbPath, {
        stateDir: hostStateDir,
        resolvePath: this.resolvePath
      });
    }

    if (hostStateDir) {
      return join(hostStateDir, 'plugins', PLUGIN_ID, DEFAULT_DB_FILE);
    }

    if (sessionFile) {
      return join(dirname(sessionFile), DEFAULT_DB_FILE);
    }

    return resolve(process.cwd(), '.openclaw', DEFAULT_DB_FILE);
  }

  private resolveHostStateDir(): string | undefined {
    try {
      return this.resolveStateDir?.();
    } catch (error) {
      this.logger.warn(
        `[${PLUGIN_ID}] failed to resolve OpenClaw state dir; falling back to local path resolution`,
        { err: error instanceof Error ? error.message : String(error) }
      );
      return undefined;
    }
  }
}

export class OpenClawContextEngineAdapter implements OpenClawContextEngine {
  readonly info = {
    id: PLUGIN_ID,
    name: 'Compact Context Engine',
    version: '0.1.0',
    ownsCompaction: true
  } as const;

  constructor(
    private readonly runtime: ContextEngineRuntimeManager,
    private readonly config: NormalizedPluginConfig,
    private readonly logger: OpenClawPluginLogger
  ) {}

  async bootstrap(params: { sessionId: string; sessionFile: string }): Promise<{
    bootstrapped: boolean;
    importedMessages?: number;
    reason?: string;
  }> {
    const engine = await this.runtime.get(params.sessionFile);
    const latest = await engine.getLatestCheckpoint(params.sessionId);

    if (latest) {
      return {
        bootstrapped: true,
        importedMessages: 0,
        reason: 'existing checkpoint found'
      };
    }

    const transcriptInput = await loadTranscriptContextInput({
      sessionId: params.sessionId,
      sessionFile: params.sessionFile
    });

    if (transcriptInput.records.length === 0) {
      return {
        bootstrapped: true,
        importedMessages: 0,
        reason: 'no parseable history found'
      };
    }

    const result = await engine.ingest(transcriptInput);
    return {
      bootstrapped: true,
      importedMessages: transcriptInput.records.length
    };
  }

  async ingest(params: {
    sessionId: string;
    message: AgentMessageLike;
    isHeartbeat?: boolean;
  }): Promise<{ ingested: boolean }> {
    const engine = await this.runtime.get();
    const result = await engine.ingest(buildRawContextInput(params.sessionId, [params.message], params.isHeartbeat));
    return {
      ingested: result.persistedNodeIds.length > 0
    };
  }

  async ingestBatch(params: {
    sessionId: string;
    messages: AgentMessageLike[];
    isHeartbeat?: boolean;
  }): Promise<{ ingestedCount: number }> {
    const engine = await this.runtime.get();
    const result = await engine.ingest(buildRawContextInput(params.sessionId, params.messages, params.isHeartbeat));
    return {
      ingestedCount: result.persistedNodeIds.length
    };
  }

  async afterTurn(params: {
    sessionId: string;
    sessionFile: string;
    messages: AgentMessageLike[];
    prePromptMessageCount: number;
    autoCompactionSummary?: string;
    isHeartbeat?: boolean;
    tokenBudget?: number;
    runtimeContext?: Record<string, unknown>;
  }): Promise<void> {
    const engine = await this.runtime.get(params.sessionFile);
    const deltaMessages = params.messages.slice(Math.max(0, params.prePromptMessageCount));
    const records = buildRawRecords(params.sessionId, deltaMessages, params.isHeartbeat);

    if (params.autoCompactionSummary?.trim()) {
      const summaryId = hashId(params.sessionId, 'auto_compaction', params.autoCompactionSummary);
      records.push({
        id: summaryId,
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: params.autoCompactionSummary,
        provenance: {
          originKind: 'compressed',
          sourceStage: 'runtime_bundle',
          producer: 'compact-context',
          rawSourceId: summaryId,
          rawContentHash: createHash('sha256').update(params.autoCompactionSummary).digest('hex'),
          compressionRunId: summaryId
        },
        metadata: {
          nodeType: 'Decision',
          emittedBy: 'openclaw:auto-compaction'
        }
      });
    }

    if (records.length > 0) {
      await engine.ingest({
        sessionId: params.sessionId,
        records
      });
    }

    const bundle = await engine.compileContext({
      sessionId: params.sessionId,
      query: extractQueryText(params.messages),
      tokenBudget: resolveCompileBudget(params.tokenBudget, this.config)
    });

    const checkpointResult = await engine.createCheckpoint({
      sessionId: params.sessionId,
      bundle
    });
    await engine.crystallizeSkills({
      sessionId: params.sessionId,
      bundle,
      checkpointId: checkpointResult.checkpoint.id
    });
  }

  async assemble(params: {
    sessionId: string;
    messages: AgentMessageLike[];
    tokenBudget?: number;
  }): Promise<{
    messages: AgentMessageLike[];
    estimatedTokens: number;
    systemPromptAddition?: string;
  }> {
    const engine = await this.runtime.get();
    await engine.ingest(buildRawContextInput(params.sessionId, params.messages));

    const totalBudget = params.tokenBudget ?? this.config.defaultTokenBudget;
    const messageCompression = planPromptMessages(
      params.messages,
      totalBudget,
      this.config.recentRawMessageCount
    );

    const bundle = await engine.compileContext({
      sessionId: params.sessionId,
      query: extractQueryText(params.messages),
      tokenBudget: resolveCompileBudget(totalBudget, this.config)
    });

    if (messageCompression.compressedCount > 0) {
      const latestCheckpoint = await engine.getLatestCheckpoint(params.sessionId);

      if (shouldPersistBundleAsCheckpoint(bundle, latestCheckpoint)) {
        const checkpointResult = await engine.createCheckpoint({
          sessionId: params.sessionId,
          bundle,
          previousCheckpoint: latestCheckpoint
        });
        await engine.crystallizeSkills({
          sessionId: params.sessionId,
          bundle,
          checkpointId: checkpointResult.checkpoint.id
        });
      }
    }

    const provisionalSystemPromptAddition = formatBundle(bundle, {
      compressedCount: messageCompression.compressedCount,
      preservedRawCount: messageCompression.preservedConversationCount
    }, {
      diagnosticsMode: 'prompt'
    });
    const remainingBudget = Math.max(totalBudget - estimateTextTokens(provisionalSystemPromptAddition), 0);
    const provisionalMessages =
      messageCompression.compressedCount > 0
        ? trimMessagesToBudget(messageCompression.preferredMessages, remainingBudget)
        : trimMessagesToBudget(params.messages, remainingBudget);
    const finalPreservedRawCount = provisionalMessages.filter((message) => normalizeRole(message.role) !== 'system').length;
    const finalCompressedCount =
      messageCompression.compressedCount > 0
        ? Math.max(countConversationMessages(params.messages) - finalPreservedRawCount, 0)
        : 0;
    const systemPromptAddition = formatBundle(bundle, {
      compressedCount: finalCompressedCount,
      preservedRawCount: finalPreservedRawCount
    }, {
      diagnosticsMode: 'prompt'
    });
    const finalRemainingBudget = Math.max(totalBudget - estimateTextTokens(systemPromptAddition), 0);
    const messages =
      messageCompression.compressedCount > 0
        ? trimMessagesToBudget(messageCompression.preferredMessages, finalRemainingBudget)
        : trimMessagesToBudget(params.messages, finalRemainingBudget);

    return {
      messages,
      estimatedTokens: estimateMessagesTokens(messages) + estimateTextTokens(systemPromptAddition),
      systemPromptAddition
    };
  }

  async compact(params: {
    sessionId: string;
    sessionFile: string;
    tokenBudget?: number;
    force?: boolean;
    currentTokenCount?: number;
    compactionTarget?: 'budget' | 'threshold';
    customInstructions?: string;
    runtimeContext?: Record<string, unknown>;
  }): Promise<{
    ok: boolean;
    compacted: boolean;
    reason?: string;
    result?: {
      summary?: string;
      firstKeptEntryId?: string;
      tokensBefore: number;
      tokensAfter?: number;
      details?: unknown;
    };
  }> {
    const engine = await this.runtime.get(params.sessionFile);
    const latestCheckpoint = await engine.getLatestCheckpoint(params.sessionId);
    const targetBudget = params.tokenBudget ?? this.config.defaultTokenBudget;
    const tokensBefore = params.currentTokenCount ?? latestCheckpoint?.tokenEstimate ?? targetBudget;

    if (!params.force && latestCheckpoint && latestCheckpoint.tokenEstimate <= targetBudget) {
      return {
        ok: true,
        compacted: false,
        reason: 'latest checkpoint already fits within budget',
        result: {
          summary: formatCheckpoint(latestCheckpoint),
          tokensBefore,
          tokensAfter: latestCheckpoint.tokenEstimate
        }
      };
    }

    const bundle = await engine.compileContext({
      sessionId: params.sessionId,
      query: params.customInstructions?.trim() || 'compact active session context',
      tokenBudget: resolveCompileBudget(targetBudget, this.config)
    });
    const checkpointResult = await engine.createCheckpoint({
      sessionId: params.sessionId,
      bundle
    });
    this.runtime.markOwnCompaction(params.sessionId);

    await engine.crystallizeSkills({
      sessionId: params.sessionId,
      bundle,
      checkpointId: checkpointResult.checkpoint.id
    });

    return {
      ok: true,
      compacted: true,
      result: {
        summary: formatBundle(bundle, undefined, {
          diagnosticsMode: 'summary'
        }),
        tokensBefore,
        tokensAfter: checkpointResult.checkpoint.tokenEstimate,
        details: {
          checkpointId: checkpointResult.checkpoint.id,
          deltaId: checkpointResult.delta.id,
          compactionTarget: params.compactionTarget ?? 'budget'
        }
      }
    };
  }

  async dispose(): Promise<void> {
    await this.runtime.close();
  }
}

export function normalizePluginConfig(value: Record<string, unknown> | undefined): NormalizedPluginConfig {
  return {
    dbPath: readOptionalString(value?.dbPath),
    defaultTokenBudget: readPositiveInteger(value?.defaultTokenBudget, DEFAULT_TOKEN_BUDGET),
    compileBudgetRatio: readRatio(value?.compileBudgetRatio, DEFAULT_COMPILE_RATIO),
    enableGatewayMethods: typeof value?.enableGatewayMethods === 'boolean' ? value.enableGatewayMethods : true,
    recentRawMessageCount: readPositiveInteger(value?.recentRawMessageCount, 8)
  };
}

export function registerGatewayDebugMethods(
  runtime: ContextEngineRuntimeManager,
  config: NormalizedPluginConfig,
  logger: OpenClawPluginLogger,
  register: (method: string, handler: (options: OpenClawGatewayHandlerOptions) => Promise<void>) => void
): void {
  if (!config.enableGatewayMethods) {
    logger.info(`[${PLUGIN_ID}] gateway debug methods disabled by config`);
    return;
  }

  const methods: readonly ContextPluginMethod[] = [
    'health',
    'ingest_context',
    'compile_context',
    'create_checkpoint',
    'query_nodes',
    'query_edges',
    'get_latest_checkpoint',
    'list_checkpoints',
    'crystallize_skills',
    'list_skill_candidates',
    'explain'
  ] as const;

  for (const method of methods) {
    register(`${PLUGIN_ID}.${method}`, async ({ params, respond }) => {
      try {
        const engine = await runtime.get();
        const plugin = new ContextEnginePlugin(engine);
        const response = await plugin.handle({
          requestId: randomUUID(),
          method,
          payload: normalizeGatewayPayload(method, params, config)
        } as ContextPluginRequest);

        const payload = response.ok ? await buildGatewaySuccessPayload(method, params, response.data, engine, config) : undefined;
        respondFromPluginResponse(response, respond, payload);
      } catch (error) {
        respond(false, undefined, {
          code: 'context_engine_error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  register(`${PLUGIN_ID}.inspect_bundle`, async ({ params, respond }) => {
    try {
      const engine = await runtime.get();
      const payload = await buildInspectBundlePayload(params, engine, config);
      respond(true, payload);
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

export function normalizeGatewayPayload(
  method: ContextPluginMethod,
  params: Record<string, unknown>,
  config: NormalizedPluginConfig
): unknown {
  if (method === 'explain') {
    return normalizeGatewayExplainPayload(params, config);
  }

  if (method === 'query_nodes') {
    return normalizeGatewayQueryNodesPayload(params);
  }

  return params;
}

function respondFromPluginResponse(
  response: ContextPluginResponse,
  respond: OpenClawGatewayHandlerOptions['respond'],
  payloadOverride?: unknown
): void {
  if (response.ok) {
    respond(true, payloadOverride ?? response.data);
    return;
  }

  respond(false, undefined, response.error);
}

function normalizeGatewayExplainPayload(
  params: Record<string, unknown>,
  config: NormalizedPluginConfig
): ExplainRequest {
  const selectionContext = resolveGatewayExplainSelectionContext(params, config);

  return {
    nodeId: readOptionalString(params.nodeId) ?? '',
    ...(selectionContext ? { selectionContext } : {})
  };
}

function normalizeGatewayQueryNodesPayload(params: Record<string, unknown>): { filter?: GraphNodeFilter } {
  return {
    filter: readGraphNodeFilter(params.filter)
  };
}

export async function buildGatewaySuccessPayload(
  method: ContextPluginMethod,
  params: Record<string, unknown>,
  data: unknown,
  engine: ContextEngine,
  config: NormalizedPluginConfig
): Promise<unknown> {
  if (method !== 'query_nodes') {
    return data;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }

  const nodes = Array.isArray((data as { nodes?: unknown }).nodes) ? (data as { nodes: unknown[] }).nodes : undefined;

  if (!nodes) {
    return data;
  }

  const filter = readGraphNodeFilter(params.filter);
  const matchQuery = readOptionalString(filter?.text);
  const includeExplain = readBoolean(params.explain) || readBoolean(params.includeExplain);
  const queryMatch = matchQuery ? buildQueryMatchPayload(nodes, matchQuery) : undefined;

  if (!includeExplain && !queryMatch) {
    return data;
  }

  const payload: Record<string, unknown> = {
    ...(data as Record<string, unknown>),
    ...(queryMatch ? { queryMatch } : {})
  };

  if (!includeExplain) {
    return payload;
  }

  const selectionContext = resolveGatewayExplainSelectionContext(params, config);
  const explainLimit = Math.min(readPositiveIntegerOrUndefined(params.explainLimit) ?? DEFAULT_GATEWAY_QUERY_EXPLAIN_LIMIT, nodes.length);
  const explainTargets = nodes.slice(0, explainLimit);
  const explanations = (
    await Promise.all(
      explainTargets.map(async (node) => {
        if (!node || typeof node !== 'object' || Array.isArray(node) || typeof (node as { id?: unknown }).id !== 'string') {
          return undefined;
        }

        return engine.explain({
          nodeId: (node as { id: string }).id,
          ...(selectionContext ? { selectionContext } : {})
        });
      })
    )
  ).filter((value): value is Awaited<ReturnType<ContextEngine['explain']>> => Boolean(value));

  return {
    ...payload,
    explain: {
      enabled: true,
      explainLimit,
      explainedCount: explanations.length,
      totalNodeCount: nodes.length,
      truncated: explainLimit < nodes.length,
      ...(selectionContext ? { selectionContext } : {}),
      explanations
    }
  };
}

export async function buildInspectBundlePayload(
  params: Record<string, unknown>,
  engine: ContextEngine,
  config: NormalizedPluginConfig
): Promise<{
  bundle: RuntimeContextBundle;
  summary: string;
  promptPreview: string;
  selectionContext: NonNullable<ExplainRequest['selectionContext']>;
  explain?: {
    enabled: boolean;
    explainLimit: number;
    explainedCount: number;
    totalCandidateCount: number;
    explanations: Awaited<ReturnType<ContextEngine['explain']>>[];
  };
}> {
  const selectionContext = resolveInspectBundleSelectionContext(params, config);

  if (!selectionContext) {
    throw new Error('inspect_bundle requires a sessionId');
  }

  const bundle = await engine.compileContext({
    sessionId: selectionContext.sessionId,
    ...(selectionContext.workspaceId ? { workspaceId: selectionContext.workspaceId } : {}),
    query: selectionContext.query ?? DEFAULT_INSPECT_BUNDLE_QUERY,
    tokenBudget: selectionContext.tokenBudget ?? resolveCompileBudget(undefined, config),
    ...(readOptionalString(params.goalLabel) ? { goalLabel: readOptionalString(params.goalLabel) } : {}),
    ...(readOptionalString(params.intentLabel) ? { intentLabel: readOptionalString(params.intentLabel) } : {})
  });

  const includeExplain = params.includeExplain !== false;
  const explainLimit = readPositiveIntegerOrUndefined(params.explainLimit) ?? DEFAULT_GATEWAY_QUERY_EXPLAIN_LIMIT;
  const selectedNodeIds = collectBundleNodeIds(bundle);
  const explanations = includeExplain
    ? await Promise.all(
        selectedNodeIds.slice(0, explainLimit).map((nodeId) =>
          engine.explain({
            nodeId,
            selectionContext
          })
        )
      )
    : [];

  return {
    bundle,
    summary: formatBundle(bundle, undefined, {
      diagnosticsMode: 'summary'
    }),
    promptPreview: formatBundle(bundle, undefined, {
      diagnosticsMode: 'prompt'
    }),
    selectionContext,
    ...(includeExplain
      ? {
          explain: {
            enabled: true,
            explainLimit,
            explainedCount: explanations.length,
            totalCandidateCount: selectedNodeIds.length,
            explanations
          }
        }
      : {})
  };
}

function resolveGatewayExplainSelectionContext(
  params: Record<string, unknown>,
  config: NormalizedPluginConfig
): ExplainRequest['selectionContext'] | undefined {
  const explicitSelectionContext = readExplainSelectionContext(params.selectionContext);
  const filter = readGraphNodeFilter(params.filter);
  const topLevelSessionId = readOptionalString(params.sessionId) ?? readOptionalString(filter?.sessionId);
  const topLevelWorkspaceId = readOptionalString(params.workspaceId) ?? readOptionalString(filter?.workspaceId);
  const topLevelQuery = readOptionalString(params.query) ?? readOptionalString(filter?.text);
  const topLevelCompileTokenBudget = readPositiveIntegerOrUndefined(params.compileTokenBudget);
  const topLevelTokenBudget = readPositiveIntegerOrUndefined(params.tokenBudget);

  const sessionId = explicitSelectionContext?.sessionId ?? topLevelSessionId;
  const workspaceId = explicitSelectionContext?.workspaceId ?? topLevelWorkspaceId;
  const query = explicitSelectionContext?.query ?? topLevelQuery;
  const tokenBudget =
    explicitSelectionContext?.tokenBudget ??
    topLevelCompileTokenBudget ??
    (topLevelTokenBudget ? resolveCompileBudget(topLevelTokenBudget, config) : undefined);

  if (!sessionId) {
    return undefined;
  }

  return {
    sessionId,
    ...(workspaceId ? { workspaceId } : {}),
    ...(query ? { query } : {}),
    ...(tokenBudget ? { tokenBudget } : {})
  };
}

function resolveInspectBundleSelectionContext(
  params: Record<string, unknown>,
  config: NormalizedPluginConfig
): NonNullable<ExplainRequest['selectionContext']> | undefined {
  const sessionId = readOptionalString(params.sessionId);

  if (!sessionId) {
    return undefined;
  }

  return {
    sessionId,
    ...(readOptionalString(params.workspaceId) ? { workspaceId: readOptionalString(params.workspaceId) } : {}),
    query: readOptionalString(params.query) ?? DEFAULT_INSPECT_BUNDLE_QUERY,
    tokenBudget:
      readPositiveIntegerOrUndefined(params.compileTokenBudget) ??
      (readPositiveIntegerOrUndefined(params.tokenBudget)
        ? resolveCompileBudget(readPositiveIntegerOrUndefined(params.tokenBudget), config)
        : resolveCompileBudget(undefined, config))
  };
}

function buildQueryMatchPayload(nodes: unknown[], query: string): {
  enabled: true;
  query: string;
  queryTerms: string[];
  matchedNodeCount: number;
  diagnostics: Array<{
    nodeId: string;
    type?: string;
    label?: string;
    bestField: 'label' | 'payload' | 'none';
    matchedTerms: string[];
    coverage: number;
    exactPhrase: boolean;
    labelMatch: {
      matchedTerms: string[];
      coverage: number;
      exactPhrase: boolean;
    };
    payloadMatch: {
      matchedTerms: string[];
      coverage: number;
      exactPhrase: boolean;
    };
  }>;
} {
  const queryTerms = extractSearchTerms(query);
  const diagnostics = nodes
    .map((node) => buildNodeQueryMatchDiagnostic(node, query, queryTerms))
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  return {
    enabled: true,
    query,
    queryTerms,
    matchedNodeCount: diagnostics.filter((item) => item.matchedTerms.length > 0).length,
    diagnostics
  };
}

function buildNodeQueryMatchDiagnostic(
  node: unknown,
  query: string,
  queryTerms: string[]
):
  | {
      nodeId: string;
      type?: string;
      label?: string;
      bestField: 'label' | 'payload' | 'none';
      matchedTerms: string[];
      coverage: number;
      exactPhrase: boolean;
      labelMatch: {
        matchedTerms: string[];
        coverage: number;
        exactPhrase: boolean;
      };
      payloadMatch: {
        matchedTerms: string[];
        coverage: number;
        exactPhrase: boolean;
      };
    }
  | undefined {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return undefined;
  }

  const record = node as { id?: unknown; type?: unknown; label?: unknown; payload?: unknown };

  if (typeof record.id !== 'string') {
    return undefined;
  }

  const label = typeof record.label === 'string' ? record.label : undefined;
  const payloadText = JSON.stringify(record.payload ?? {});
  const labelFeatures = analyzeTextMatch(label ?? '', query);
  const payloadFeatures = analyzeTextMatch(payloadText, query);
  const matchedTerms = queryTerms.filter(
    (term) => labelFeatures.matchedTerms.includes(term) || payloadFeatures.matchedTerms.includes(term)
  );
  const coverage = queryTerms.length > 0 ? matchedTerms.length / queryTerms.length : 0;

  return {
    nodeId: record.id,
    ...(typeof record.type === 'string' ? { type: record.type } : {}),
    ...(label ? { label } : {}),
    bestField: pickBestMatchField(labelFeatures, payloadFeatures),
    matchedTerms,
    coverage: roundCoverage(coverage),
    exactPhrase: labelFeatures.exactPhrase || payloadFeatures.exactPhrase,
    labelMatch: {
      matchedTerms: labelFeatures.matchedTerms,
      coverage: roundCoverage(labelFeatures.coverage),
      exactPhrase: labelFeatures.exactPhrase
    },
    payloadMatch: {
      matchedTerms: payloadFeatures.matchedTerms,
      coverage: roundCoverage(payloadFeatures.coverage),
      exactPhrase: payloadFeatures.exactPhrase
    }
  };
}

function pickBestMatchField(
  labelFeatures: ReturnType<typeof analyzeTextMatch>,
  payloadFeatures: ReturnType<typeof analyzeTextMatch>
): 'label' | 'payload' | 'none' {
  const labelScore = Number(labelFeatures.exactPhrase) * 10 + labelFeatures.coverage + labelFeatures.matchedTerms.length;
  const payloadScore = Number(payloadFeatures.exactPhrase) * 10 + payloadFeatures.coverage + payloadFeatures.matchedTerms.length;

  if (labelScore === 0 && payloadScore === 0) {
    return 'none';
  }

  return labelScore >= payloadScore ? 'label' : 'payload';
}

function roundCoverage(value: number): number {
  return Number(value.toFixed(3));
}

function buildRawContextInput(
  sessionId: string,
  messages: AgentMessageLike[],
  isHeartbeat?: boolean
): RawContextInput {
  return {
    sessionId,
    records: buildRawRecords(sessionId, messages, isHeartbeat)
  };
}

function buildRawRecords(sessionId: string, messages: AgentMessageLike[], isHeartbeat?: boolean): RawContextRecord[] {
  return messages
    .map((message) => mapAgentMessageToRecord(sessionId, message, isHeartbeat))
    .filter((record): record is RawContextRecord => Boolean(record));
}

function mapAgentMessageToRecord(
  sessionId: string,
  message: AgentMessageLike,
  isHeartbeat?: boolean
): RawContextRecord | undefined {
  const role = normalizeRole(message.role);
  const compressedToolResult = role === 'tool' ? readCompressedToolResultContent(message.content) : undefined;
  const content =
    (role === 'tool' ? summarizeToolResultMessageContent(message.content) : undefined) ?? stringifyMessageContent(message.content);

  if (!content) {
    return undefined;
  }

  const sourceType = roleToSourceType(role);
  const recordId = message.id ? `${sessionId}:${message.id}` : hashId(sessionId, JSON.stringify(message));

  return {
    id: recordId,
    scope: 'session',
    sourceType,
    role,
    content,
    createdAt: readOptionalString(message.timestamp),
    provenance: compressedToolResult
      ? {
          ...compressedToolResult.provenance,
          rawSourceId: compressedToolResult.provenance.rawSourceId ?? recordId,
          rawContentHash:
            compressedToolResult.provenance.rawContentHash ??
            createHash('sha256').update(JSON.stringify(message.content)).digest('hex')
        }
      : {
          originKind: 'raw',
          sourceStage: role === 'tool' ? 'tool_output_raw' : 'hook_message_snapshot',
          producer: 'openclaw',
          rawSourceId: recordId,
          rawContentHash: createHash('sha256').update(content).digest('hex')
        },
    metadata: {
      ...(isHeartbeat ? { isHeartbeat: true } : {}),
      ...(role === 'user' ? { nodeType: 'Intent' } : {}),
      ...(role === 'assistant' ? { nodeType: 'Decision' } : {}),
      ...(role === 'tool' ? { nodeType: 'State' } : {}),
      ...(compressedToolResult ? buildCompressedToolResultMetadata(compressedToolResult) : {})
    }
  };
}

function extractQueryText(messages: AgentMessageLike[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (!message) {
      continue;
    }

    const role = normalizeRole(message.role);
    const content = stringifyMessageContent(message.content);

    if ((role === 'user' || role === 'assistant') && content) {
      return content.slice(0, 600);
    }
  }

  return 'continue current task';
}

export function formatBundle(
  bundle: RuntimeContextBundle,
  compression?: {
    compressedCount?: number;
    preservedRawCount?: number;
  },
  options?: {
    diagnosticsMode?: 'none' | 'prompt' | 'summary';
  }
): string {
  const lines: string[] = ['[Compact Context Engine]'];

  if ((compression?.compressedCount ?? 0) > 0) {
    lines.push(
      `Earlier turns compressed: ${compression?.compressedCount ?? 0} | Raw turns kept: ${compression?.preservedRawCount ?? 0}`
    );
  }

  if (bundle.goal) {
    lines.push(`Goal: ${bundle.goal.label}`);
  }

  if (bundle.intent) {
    lines.push(`Intent: ${bundle.intent.label}`);
  }

  if (bundle.activeRules.length > 0) {
    lines.push(`Active rules: ${bundle.activeRules.map((item) => item.label).join(' | ')}`);
  }

  if (bundle.activeConstraints.length > 0) {
    lines.push(`Constraints: ${bundle.activeConstraints.map((item) => item.label).join(' | ')}`);
  }

  if (bundle.currentProcess) {
    lines.push(`Current step: ${bundle.currentProcess.label}`);
  }

  if (bundle.recentDecisions.length > 0) {
    lines.push(`Recent decisions: ${bundle.recentDecisions.map((item) => item.label).join(' | ')}`);
  }

  if (bundle.recentStateChanges.length > 0) {
    lines.push(`State changes: ${bundle.recentStateChanges.map((item) => item.label).join(' | ')}`);
  }

  if (bundle.relevantEvidence.length > 0) {
    lines.push(`Evidence: ${bundle.relevantEvidence.map((item) => item.label).join(' | ')}`);
  }

  if (bundle.candidateSkills.length > 0) {
    lines.push(`Skills: ${bundle.candidateSkills.map((item) => item.label).join(' | ')}`);
  }

  if (bundle.openRisks.length > 0) {
    lines.push(`Open risks: ${bundle.openRisks.map((item) => item.label).join(' | ')}`);
  }

  lines.push(`Budget used: ${bundle.tokenBudget.used}/${bundle.tokenBudget.total}`);
  lines.push(...formatBundleDiagnostics(bundle, options?.diagnosticsMode ?? 'none'));
  return lines.join('\n');
}

function formatBundleDiagnostics(
  bundle: RuntimeContextBundle,
  mode: 'none' | 'prompt' | 'summary'
): string[] {
  if (mode === 'none' || !bundle.diagnostics) {
    return [];
  }

  if (mode === 'prompt') {
    const skippedFixed = bundle.diagnostics.fixed.skipped;

    if (skippedFixed.length === 0) {
      return [];
    }

    return [
      `Selection note: omitted ${skippedFixed.map((item) => item.type).join(' | ')} because the current budget was too small`
    ];
  }

  const lines: string[] = ['[Selection Diagnostics]'];
  const fixedSelected = bundle.diagnostics.fixed.selected.length;
  const fixedSkipped = bundle.diagnostics.fixed.skipped.length;

  if (fixedSelected > 0 || fixedSkipped > 0) {
    lines.push(`Fixed context: selected ${fixedSelected} | skipped ${fixedSkipped}`);
  }

  if (fixedSkipped > 0) {
    lines.push(
      `Fixed skips: ${bundle.diagnostics.fixed.skipped.map((item) => `${item.type}:${truncateText(item.label, 64)}`).join(' | ')}`
    );
  }

  for (const category of bundle.diagnostics.categories) {
    if (category.inputCount === 0) {
      continue;
    }

    lines.push(
      `${category.category}: selected ${category.selectedCount}/${category.inputCount}, skipped ${category.skippedCount}, budget ${category.allocatedBudget}, refill ${category.refillSelectedCount}`
    );
  }

  if ((bundle.diagnostics.topicHints?.length ?? 0) > 0) {
    lines.push(
      `topicHints: reserved ${bundle.diagnostics.topicHints?.length} hint(s) for future topic-aware recall`
    );
  }

  return lines;
}

function formatCheckpoint(checkpoint: SessionCheckpoint): string {
  return [
    '[Compact Context Checkpoint]',
    checkpoint.summary.goal ? `Goal: ${checkpoint.summary.goal}` : undefined,
    checkpoint.summary.intent ? `Intent: ${checkpoint.summary.intent}` : undefined,
    checkpoint.summary.currentProcessId ? `Current process: ${checkpoint.summary.currentProcessId}` : undefined,
    `Active rules: ${checkpoint.summary.activeRuleIds.length}`,
    `Constraints: ${checkpoint.summary.activeConstraintIds.length}`,
    `Recent decisions: ${checkpoint.summary.recentDecisionIds.length}`,
    `Recent states: ${checkpoint.summary.recentStateIds.length}`,
    `Open risks: ${checkpoint.summary.openRiskIds.length}`,
    `Tokens: ${checkpoint.tokenEstimate}`
  ]
    .filter(isPresent)
    .join('\n');
}

function trimMessagesToBudget(messages: AgentMessageLike[], budget: number): AgentMessageLike[] {
  if (budget <= 0 || messages.length === 0) {
    return [];
  }

  const systemMessages = messages.filter((message) => normalizeRole(message.role) === 'system');
  const conversationMessages = messages.filter((message) => normalizeRole(message.role) !== 'system');
  const selected: AgentMessageLike[] = [];
  let used = 0;

  for (const message of systemMessages) {
    const cost = estimateMessageTokens(message);

    if (used + cost > budget) {
      break;
    }

    selected.push(message);
    used += cost;
  }

  const tail: AgentMessageLike[] = [];
  for (let index = conversationMessages.length - 1; index >= 0; index -= 1) {
    const message = conversationMessages[index];

    if (!message) {
      continue;
    }

    const cost = estimateMessageTokens(message);

    if (used + cost > budget) {
      break;
    }

    tail.push(message);
    used += cost;
  }

  tail.reverse();
  return selected.concat(tail);
}

function planPromptMessages(
  messages: AgentMessageLike[],
  totalBudget: number,
  recentRawMessageCount: number
): {
  preferredMessages: AgentMessageLike[];
  compressedCount: number;
  preservedConversationCount: number;
} {
  if (messages.length === 0) {
    return {
      preferredMessages: [],
      compressedCount: 0,
      preservedConversationCount: 0
    };
  }

  const systemMessages = messages.filter((message) => normalizeRole(message.role) === 'system');
  const conversationMessages = messages.filter((message) => normalizeRole(message.role) !== 'system');

  if (conversationMessages.length <= recentRawMessageCount) {
    return {
      preferredMessages: messages,
      compressedCount: 0,
      preservedConversationCount: conversationMessages.length
    };
  }

  const preservedConversation = conversationMessages.slice(-recentRawMessageCount);
  const preferredMessages = trimMessagesToBudget(systemMessages.concat(preservedConversation), totalBudget);
  const preservedConversationCount = preferredMessages.filter((message) => normalizeRole(message.role) !== 'system').length;

  return {
    preferredMessages,
    compressedCount: Math.max(conversationMessages.length - recentRawMessageCount, 0),
    preservedConversationCount
  };
}

function countConversationMessages(messages: AgentMessageLike[]): number {
  return messages.filter((message) => normalizeRole(message.role) !== 'system').length;
}

function estimateMessagesTokens(messages: AgentMessageLike[]): number {
  return messages.reduce((total, message) => total + estimateMessageTokens(message), 0);
}

function estimateMessageTokens(message: AgentMessageLike): number {
  return estimateTextTokens(stringifyMessageContent(message.content) || JSON.stringify(message));
}

function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function stringifyMessageContent(content: unknown): string {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => stringifyContentItem(item))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  if (content && typeof content === 'object') {
    return stringifyContentItem(content);
  }

  return '';
}

function stringifyContentItem(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return String(value ?? '');
  }

  const record = value as Record<string, unknown>;

  if (typeof record.text === 'string') {
    return record.text;
  }

  if (typeof record.content === 'string') {
    return record.content;
  }

  return JSON.stringify(record);
}

function roleToSourceType(role: RawContextRecord['role']): RawContextSourceType {
  if (role === 'system') {
    return 'system';
  }

  if (role === 'tool') {
    return 'tool_output';
  }

  return 'conversation';
}

function normalizeRole(role: unknown): RawContextRecord['role'] {
  if (role === 'assistant' || role === 'system' || role === 'tool') {
    return role;
  }

  if (role === 'toolResult') {
    return 'tool';
  }

  return 'user';
}

function resolveConfiguredPath(
  configuredPath: string,
  options: {
    stateDir?: string;
    resolvePath?: (input: string) => string;
  }
): string {
  if (isAbsolute(configuredPath)) {
    return configuredPath;
  }

  if (options.stateDir) {
    return resolve(options.stateDir, 'plugins', PLUGIN_ID, configuredPath);
  }

  if (options.resolvePath) {
    return options.resolvePath(configuredPath);
  }

  return resolve(process.cwd(), configuredPath);
}

export function resolveCompileBudget(tokenBudget: number | undefined, config: NormalizedPluginConfig): number {
  const total = tokenBudget ?? config.defaultTokenBudget;
  return Math.max(256, Math.floor(total * config.compileBudgetRatio));
}

function shouldPersistBundleAsCheckpoint(
  bundle: RuntimeContextBundle,
  latestCheckpoint: SessionCheckpoint | undefined
): boolean {
  if (!latestCheckpoint) {
    return true;
  }

  const nextSummary = {
    goal: bundle.goal?.label,
    intent: bundle.intent?.label,
    activeRuleIds: bundle.activeRules.map((item) => item.nodeId),
    activeConstraintIds: bundle.activeConstraints.map((item) => item.nodeId),
    currentProcessId: bundle.currentProcess?.nodeId,
    recentDecisionIds: bundle.recentDecisions.map((item) => item.nodeId),
    recentStateIds: bundle.recentStateChanges.map((item) => item.nodeId),
    openRiskIds: bundle.openRisks.map((item) => item.nodeId)
  };

  return (
    latestCheckpoint.tokenEstimate !== bundle.tokenBudget.used ||
    latestCheckpoint.summary.goal !== nextSummary.goal ||
    latestCheckpoint.summary.intent !== nextSummary.intent ||
    latestCheckpoint.summary.currentProcessId !== nextSummary.currentProcessId ||
    !arrayEquals(latestCheckpoint.summary.activeRuleIds, nextSummary.activeRuleIds) ||
    !arrayEquals(latestCheckpoint.summary.activeConstraintIds, nextSummary.activeConstraintIds) ||
    !arrayEquals(latestCheckpoint.summary.recentDecisionIds, nextSummary.recentDecisionIds) ||
    !arrayEquals(latestCheckpoint.summary.recentStateIds, nextSummary.recentStateIds) ||
    !arrayEquals(latestCheckpoint.summary.openRiskIds, nextSummary.openRiskIds)
  );
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function readRatio(value: unknown, fallback: number): number {
  return typeof value === 'number' && value > 0 && value < 1 ? value : fallback;
}

function readPositiveIntegerOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readGraphNodeFilter(value: unknown): GraphNodeFilter | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as GraphNodeFilter;
}

function readExplainSelectionContext(value: unknown): ExplainRequest['selectionContext'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const sessionId = readOptionalString(candidate.sessionId);

  if (!sessionId) {
    return undefined;
  }

  const workspaceId = readOptionalString(candidate.workspaceId);
  const query = readOptionalString(candidate.query);
  const tokenBudget = readPositiveIntegerOrUndefined(candidate.tokenBudget);

  return {
    sessionId,
    ...(workspaceId ? { workspaceId } : {}),
    ...(query ? { query } : {}),
    ...(tokenBudget ? { tokenBudget } : {})
  };
}

function hashId(...parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function arrayEquals(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function collectBundleNodeIds(bundle: RuntimeContextBundle): string[] {
  return Array.from(
    new Set(
      [
        bundle.goal?.nodeId,
        bundle.intent?.nodeId,
        bundle.currentProcess?.nodeId,
        ...bundle.activeRules.map((item) => item.nodeId),
        ...bundle.activeConstraints.map((item) => item.nodeId),
        ...bundle.openRisks.map((item) => item.nodeId),
        ...bundle.recentDecisions.map((item) => item.nodeId),
        ...bundle.recentStateChanges.map((item) => item.nodeId),
        ...bundle.relevantEvidence.map((item) => item.nodeId),
        ...bundle.candidateSkills.map((item) => item.nodeId)
      ].filter((value): value is string => Boolean(value))
    )
  );
}

function truncateText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(maxLength - 3, 1))}...`;
}
