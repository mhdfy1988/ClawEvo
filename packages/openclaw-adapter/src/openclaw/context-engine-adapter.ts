import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve, dirname, isAbsolute } from 'node:path';

import {
  ContextEngine,
  analyzeTextMatch,
  annotateContextInputRoute,
  buildBundleContractSnapshot,
  buildContextSummaryContract,
  extractSearchTerms,
  isManualCorrectionTargetKind
} from '@openclaw-compact-context/runtime-core';
import { ContextEnginePlugin } from '../plugin/context-engine-plugin.js';
import type { ContextPluginMethod, ContextPluginRequest, ContextPluginResponse } from '../plugin/api.js';
import type {
  BundleContractSnapshot,
  ControlPlaneFacadeContract,
  ControlPlaneRuntimeSnapshotRef,
  ContextSummaryContract,
  ExplainRequest,
  GraphNodeFilter,
  GovernanceAuthority,
  GovernanceDecision,
  ImportSourceKind,
  ManualCorrectionRecord,
  ObservabilityAlertThresholds,
  RawContextInput,
  RawContextRecord,
  RawContextSourceType,
  RuntimeContextBundle,
  Scope,
  SessionCheckpoint
} from '@openclaw-compact-context/contracts';
import {
  buildCompressedToolResultMetadata,
  readCompressedToolResultContent,
  summarizeToolResultMessageContent
} from './tool-result-policy.js';
import { loadTranscriptContextInput, loadTranscriptMessages } from './transcript-loader.js';
import type {
  AgentMessageLike,
  OpenClawPromptAssemblyContract,
  OpenClawContextEngine,
  OpenClawGatewayHandlerOptions,
  OpenClawPluginLogger,
  OpenClawRuntimeContextWindowContract,
  OpenClawRuntimeMessageSummary,
  OpenClawRuntimeWindowLatestPointers,
  OpenClawRuntimeWindowSource,
  OpenClawToolCallResultPair
} from './types.js';

const PLUGIN_ID = 'compact-context';
const DEFAULT_DB_FILE = 'context-engine.sqlite';
const DEFAULT_TOKEN_BUDGET = 12000;
const DEFAULT_COMPILE_RATIO = 0.3;
const OWN_COMPACTION_TTL_MS = 5000;
const DEFAULT_GATEWAY_QUERY_EXPLAIN_LIMIT = 5;
const DEFAULT_INSPECT_BUNDLE_QUERY = 'inspect current context bundle';
const RUNTIME_CONTEXT_WINDOW_CONTRACT_VERSION = 'runtime_context_window.v1';
const PROMPT_ASSEMBLY_CONTRACT_VERSION = 'prompt_assembly.v1';
const RUNTIME_WINDOW_SNAPSHOT_DIR = 'runtime-window-snapshots';
const PROMPT_ASSEMBLY_PROVIDER_NEUTRAL_OUTPUTS = ['messages', 'systemPromptAddition', 'estimatedTokens'] as const;
const PROMPT_ASSEMBLY_HOST_RESPONSIBILITIES = [
  'merge systemPromptAddition into the host system/instructions layer',
  'assemble provider-specific system/messages/tools payloads',
  'preserve finalMessages ordering when sending the runtime window to the model'
] as const;
const PROMPT_ASSEMBLY_DEBUG_ONLY_FIELDS = [
  'runtimeWindow.inbound',
  'runtimeWindow.preferred',
  'runtimeWindow.latestPointers',
  'runtimeWindow.toolCallResultPairs'
] as const;

interface RuntimeWindowSnapshot {
  sessionId: string;
  capturedAt: string;
  query: string;
  totalBudget: number;
  recentRawMessageCount: number;
  compressedCount: number;
  preservedConversationCount: number;
  inboundMessages: AgentMessageLike[];
  preferredMessages: AgentMessageLike[];
  finalMessages: AgentMessageLike[];
  systemPromptAddition?: string;
  estimatedTokens?: number;
}

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
  private resolvedRuntimeSnapshotDir?: string;
  private readonly recentOwnCompactions = new Map<string, number>();
  private readonly runtimeWindowSnapshots = new Map<string, RuntimeWindowSnapshot>();
  private readonly resolvedSessionFiles = new Map<string, string>();

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

  async recordRuntimeWindowSnapshot(snapshot: RuntimeWindowSnapshot): Promise<void> {
    this.runtimeWindowSnapshots.set(snapshot.sessionId, snapshot);
    await this.persistRuntimeWindowSnapshot(snapshot);
  }

  getRuntimeWindowSnapshot(sessionId: string): RuntimeWindowSnapshot | undefined {
    return this.runtimeWindowSnapshots.get(sessionId);
  }

  async getPersistedRuntimeWindowSnapshot(sessionId: string): Promise<RuntimeWindowSnapshot | undefined> {
    const snapshotPath = join(this.resolveRuntimeSnapshotDir(), `${sessionId}.json`);

    try {
      const raw = await readFile(snapshotPath, 'utf8');
      const snapshot = parseRuntimeWindowSnapshot(raw);

      if (snapshot) {
        this.runtimeWindowSnapshots.set(sessionId, snapshot);
      }

      return snapshot;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'ENOENT') {
        return undefined;
      }

      this.logger.warn(`[${PLUGIN_ID}] failed to read persisted runtime window snapshot`, {
        sessionId,
        err: error instanceof Error ? error.message : String(error)
      });
      return undefined;
    }
  }

  async listPersistedRuntimeWindowSnapshots(limit?: number): Promise<RuntimeWindowSnapshot[]> {
    const snapshotDir = this.resolveRuntimeSnapshotDir();

    try {
      const entries = await readdir(snapshotDir, {
        withFileTypes: true
      });
      const snapshots = (
        await Promise.all(
          entries
            .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
            .map(async (entry) => {
              try {
                const raw = await readFile(join(snapshotDir, entry.name), 'utf8');
                return parseRuntimeWindowSnapshot(raw);
              } catch (error) {
                this.logger.warn(`[${PLUGIN_ID}] failed to read runtime window snapshot while listing`, {
                  snapshotPath: join(snapshotDir, entry.name),
                  err: error instanceof Error ? error.message : String(error)
                });
                return undefined;
              }
            })
        )
      )
        .filter((snapshot): snapshot is RuntimeWindowSnapshot => Boolean(snapshot))
        .sort((left, right) => (right.capturedAt ?? '').localeCompare(left.capturedAt ?? ''));

      if (limit && limit > 0) {
        return snapshots.slice(0, limit);
      }

      return snapshots;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'ENOENT') {
        return [];
      }

      this.logger.warn(`[${PLUGIN_ID}] failed to list persisted runtime window snapshots`, {
        snapshotDir,
        err: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  async listRuntimeWindowSnapshots(limit?: number): Promise<RuntimeWindowSnapshot[]> {
    const persisted = await this.listPersistedRuntimeWindowSnapshots();
    const bySessionId = new Map<string, RuntimeWindowSnapshot>();

    for (const snapshot of persisted) {
      bySessionId.set(snapshot.sessionId, snapshot);
    }

    for (const snapshot of this.runtimeWindowSnapshots.values()) {
      const existing = bySessionId.get(snapshot.sessionId);

      if (!existing || (snapshot.capturedAt ?? '') >= (existing.capturedAt ?? '')) {
        bySessionId.set(snapshot.sessionId, snapshot);
      }
    }

    const snapshots = [...bySessionId.values()].sort((left, right) =>
      (right.capturedAt ?? '').localeCompare(left.capturedAt ?? '')
    );

    if (limit && limit > 0) {
      return snapshots.slice(0, limit);
    }

    return snapshots;
  }

  async resolveSessionFile(sessionId: string): Promise<string | undefined> {
    const cached = this.resolvedSessionFiles.get(sessionId);

    if (cached) {
      return cached;
    }

    const hostStateDir = this.resolveHostStateDir();

    if (!hostStateDir) {
      return undefined;
    }

    const agentsDir = join(hostStateDir, 'agents');

    try {
      const agentEntries = await readdir(agentsDir, {
        withFileTypes: true
      });

      for (const agentEntry of agentEntries) {
        if (!agentEntry.isDirectory()) {
          continue;
        }

        const candidate = join(agentsDir, agentEntry.name, 'sessions', `${sessionId}.jsonl`);

        try {
          await access(candidate);
          this.resolvedSessionFiles.set(sessionId, candidate);
          return candidate;
        } catch {
          // Keep scanning other agents.
        }
      }
    } catch (error) {
      this.logger.warn(`[${PLUGIN_ID}] failed to resolve session file from host state`, {
        sessionId,
        err: error instanceof Error ? error.message : String(error)
      });
    }

    return undefined;
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

  private resolveRuntimeSnapshotDir(sessionFile?: string): string {
    if (this.resolvedRuntimeSnapshotDir) {
      return this.resolvedRuntimeSnapshotDir;
    }

    const dbPath = this.resolvedDbPath ?? this.resolveDbPath(sessionFile);
    this.resolvedRuntimeSnapshotDir = join(dirname(dbPath), RUNTIME_WINDOW_SNAPSHOT_DIR);
    return this.resolvedRuntimeSnapshotDir;
  }

  private async persistRuntimeWindowSnapshot(snapshot: RuntimeWindowSnapshot): Promise<void> {
    const snapshotDir = this.resolveRuntimeSnapshotDir();
    const snapshotPath = join(snapshotDir, `${snapshot.sessionId}.json`);

    try {
      await mkdir(snapshotDir, {
        recursive: true
      });
      await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (error) {
      this.logger.warn(`[${PLUGIN_ID}] failed to persist runtime window snapshot`, {
        sessionId: snapshot.sessionId,
        snapshotPath,
        err: error instanceof Error ? error.message : String(error)
      });
    }
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

    await this.runtime.recordRuntimeWindowSnapshot({
      sessionId: params.sessionId,
      capturedAt: new Date().toISOString(),
      query: extractQueryText(params.messages),
      totalBudget,
      recentRawMessageCount: this.config.recentRawMessageCount,
      compressedCount: finalCompressedCount,
      preservedConversationCount: finalPreservedRawCount,
      inboundMessages: params.messages,
      preferredMessages: messageCompression.preferredMessages,
      finalMessages: messages,
      systemPromptAddition,
      estimatedTokens: estimateMessagesTokens(messages) + estimateTextTokens(systemPromptAddition)
    });

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
  controlPlaneFacade: ControlPlaneFacadeContract,
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

  register(`${PLUGIN_ID}.inspect_runtime_window`, async ({ params, respond }) => {
    try {
      const payload = await buildInspectRuntimeWindowPayload(params, runtime, config);
      respond(true, payload);
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.inspect_observability_dashboard`, async ({ params, respond }) => {
    try {
      const payload = await buildInspectObservabilityDashboardPayload(params, runtime, controlPlaneFacade, config);
      respond(true, payload);
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.capture_observability_snapshot`, async ({ params, respond }) => {
    try {
      const payload = await buildInspectObservabilityDashboardPayload(params, runtime, controlPlaneFacade, config);
      const snapshot = controlPlaneFacade.recordDashboardSnapshot({
        stage: payload.stage,
        sessionIds: payload.sessionIds,
        windowCount: payload.windowCount,
        dashboard: payload.dashboard,
        capturedAt: readOptionalString(params.capturedAt)
      });
      respond(true, {
        snapshot,
        dashboard: payload.dashboard
      });
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.inspect_observability_history`, async ({ params, respond }) => {
    try {
      const snapshots = controlPlaneFacade.listDashboardSnapshots({
        stage: readOptionalString(params.stage),
        limit: readPositiveIntegerOrUndefined(params.limit)
      });
      respond(true, {
        history: controlPlaneFacade.buildDashboardHistory({
          snapshots
        }),
        snapshotCount: snapshots.length
      });
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.create_import_job`, async ({ params, respond }) => {
    try {
      const runtimeSnapshot = await resolveRuntimeSnapshotRefForSession(
        readRequiredString(params.sessionId, 'sessionId'),
        runtime
      );
      const job = await controlPlaneFacade.createImportJob({
        sessionId: readRequiredString(params.sessionId, 'sessionId'),
        ...(readOptionalString(params.workspaceId) ? { workspaceId: readOptionalString(params.workspaceId) } : {}),
        sourceKind: readImportSourceKind(params.sourceKind),
        ...(isPlainObject(params.source) ? { source: params.source as Record<string, unknown> } : {}),
        ...(isPlainObject(params.flow) ? { flow: params.flow as Record<string, unknown> } : {}),
        ...(isPlainObject(params.versionInfo) ? { versionInfo: params.versionInfo as Record<string, unknown> } : {}),
        ...(isPlainObject(params.incremental) ? { incremental: params.incremental as Record<string, unknown> } : {}),
        ...(readOptionalString(params.requestedBy) ? { requestedBy: readOptionalString(params.requestedBy) } : {}),
        ...(readOptionalString(params.createdAt) ? { createdAt: readOptionalString(params.createdAt) } : {}),
        ...(runtimeSnapshot ? { runtimeSnapshot } : {}),
        input: readRawContextInputPayload(params.input)
      });
      respond(true, {
        job
      });
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.run_import_job`, async ({ params, respond }) => {
    try {
      const engine = await runtime.get();
      const record = await controlPlaneFacade.getImportJob(readRequiredString(params.jobId, 'jobId'));
      const runtimeSnapshot = record
        ? await resolveRuntimeSnapshotRefForSession(record.job.sessionId, runtime)
        : undefined;
      const result = await controlPlaneFacade.runImportJob({
        jobId: readRequiredString(params.jobId, 'jobId'),
        ...(readOptionalString(params.completedAt) ? { completedAt: readOptionalString(params.completedAt) } : {}),
        ...(runtimeSnapshot ? { runtimeSnapshot } : {}),
        engine
      });
      respond(true, result);
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.retry_import_job`, async ({ params, respond }) => {
    try {
      const engine = await runtime.get();
      const record = await controlPlaneFacade.getImportJob(readRequiredString(params.jobId, 'jobId'));
      const runtimeSnapshot = record
        ? await resolveRuntimeSnapshotRefForSession(record.job.sessionId, runtime)
        : undefined;
      const result = await controlPlaneFacade.retryImportJob({
        jobId: readRequiredString(params.jobId, 'jobId'),
        ...(readOptionalString(params.completedAt) ? { completedAt: readOptionalString(params.completedAt) } : {}),
        ...(runtimeSnapshot ? { runtimeSnapshot } : {}),
        engine
      });
      respond(true, result);
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.rerun_import_job`, async ({ params, respond }) => {
    try {
      const engine = await runtime.get();
      const record = await controlPlaneFacade.getImportJob(readRequiredString(params.jobId, 'jobId'));
      const runtimeSnapshot = record
        ? await resolveRuntimeSnapshotRefForSession(record.job.sessionId, runtime)
        : undefined;
      const result = await controlPlaneFacade.rerunImportJob({
        jobId: readRequiredString(params.jobId, 'jobId'),
        ...(readOptionalString(params.completedAt) ? { completedAt: readOptionalString(params.completedAt) } : {}),
        ...(runtimeSnapshot ? { runtimeSnapshot } : {}),
        engine
      });
      respond(true, result);
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.schedule_import_job`, async ({ params, respond }) => {
    try {
      const schedule = await controlPlaneFacade.scheduleImportJob({
        jobId: readRequiredString(params.jobId, 'jobId'),
        dueAt: readRequiredString(params.dueAt, 'dueAt'),
        ...(readOptionalString(params.createdAt) ? { createdAt: readOptionalString(params.createdAt) } : {}),
        ...(readOptionalString(params.createdBy) ? { createdBy: readOptionalString(params.createdBy) } : {}),
        ...(readOptionalString(params.note) ? { note: readOptionalString(params.note) } : {})
      });
      respond(true, {
        schedule
      });
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.run_due_import_jobs`, async ({ params, respond }) => {
    try {
      const engine = await runtime.get();
      const result = await controlPlaneFacade.runDueImportJobs({
        engine,
        ...(readOptionalString(params.now) ? { now: readOptionalString(params.now) } : {}),
        ...(readPositiveIntegerOrUndefined(params.limit) ? { limit: readPositiveIntegerOrUndefined(params.limit) } : {})
      });
      respond(true, result);
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.get_import_job`, async ({ params, respond }) => {
    try {
      const record = await controlPlaneFacade.getImportJob(readRequiredString(params.jobId, 'jobId'));
      respond(true, {
        record
      });
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.list_import_jobs`, async ({ params, respond }) => {
    try {
      const jobs = await controlPlaneFacade.listImportJobs(readPositiveIntegerOrUndefined(params.limit));
      respond(true, {
        jobs
      });
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.list_import_job_history`, async ({ params, respond }) => {
    try {
      const history = await controlPlaneFacade.listImportJobHistory(
        readRequiredString(params.jobId, 'jobId'),
        readPositiveIntegerOrUndefined(params.limit)
      );
      respond(true, {
        history
      });
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.configure_import_scheduler_policy`, async ({ params, respond }) => {
    try {
      const job = await controlPlaneFacade.configureImportSchedulerPolicy({
        jobId: readRequiredString(params.jobId, 'jobId'),
        policy: isPlainObject(params.policy) ? (params.policy as Record<string, unknown>) : {}
      });
      respond(true, { job });
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.batch_run_import_jobs`, async ({ params, respond }) => {
    try {
      const engine = await runtime.get();
      const runtimeSnapshot = readOptionalString(params.sessionId)
        ? await resolveRuntimeSnapshotRefForSession(readRequiredString(params.sessionId, 'sessionId'), runtime)
        : undefined;
      const payload = await controlPlaneFacade.batchRunImportJobs({
        jobIds: readSessionIdList(params.jobIds),
        engine,
        ...(runtimeSnapshot ? { runtimeSnapshot } : {}),
        ...(readOptionalString(params.completedAt) ? { completedAt: readOptionalString(params.completedAt) } : {})
      });
      respond(true, payload);
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.stop_import_jobs`, async ({ params, respond }) => {
    try {
      const payload = await controlPlaneFacade.stopImportJobs(readSessionIdList(params.jobIds));
      respond(true, payload);
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.resume_import_jobs`, async ({ params, respond }) => {
    try {
      const payload = await controlPlaneFacade.resumeImportJobs({
        jobIds: readSessionIdList(params.jobIds),
        ...(readOptionalString(params.dueAt) ? { dueAt: readOptionalString(params.dueAt) } : {})
      });
      respond(true, payload);
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.list_import_dead_letters`, async ({ params, respond }) => {
    try {
      const deadLetters = await controlPlaneFacade.listImportDeadLetters(readPositiveIntegerOrUndefined(params.limit));
      respond(true, { deadLetters });
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.inspect_import_catalog`, async ({ respond }) => {
    try {
      respond(true, {
        catalog: controlPlaneFacade.buildSourceCatalog(),
        importers: controlPlaneFacade.listImporters()
      });
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.apply_corrections`, async ({ params, respond }) => {
    try {
      const engine = await runtime.get();
      const corrections = readManualCorrectionsPayload(params);
      await engine.applyManualCorrections(corrections);
      respond(true, {
        appliedCount: corrections.length
      });
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.list_corrections`, async ({ params, respond }) => {
    try {
      const engine = await runtime.get();
      const corrections = await engine.listManualCorrections(readPositiveIntegerOrUndefined(params.limit));
      respond(true, {
        corrections
      });
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.submit_correction_proposal`, async ({ params, respond }) => {
    try {
      const contextSessionId = readOptionalString(params.sessionId);
      const proposal = await controlPlaneFacade.submitProposal({
        targetScope: readGovernanceScope(params.targetScope),
        submittedBy: readRequiredString(params.submittedBy, 'submittedBy'),
        authority: readGovernanceAuthority(params.authority, params.targetScope),
        reason: readRequiredString(params.reason, 'reason'),
        corrections: readManualCorrectionsPayload(params),
        ...(contextSessionId ? { contextSessionId } : {}),
        ...(contextSessionId
          ? { runtimeSnapshot: await resolveRuntimeSnapshotRefForSession(contextSessionId, runtime) }
          : {}),
        submittedAt: readOptionalString(params.submittedAt)
      });
      respond(true, {
        proposal
      });
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.review_correction_proposal`, async ({ params, respond }) => {
    try {
      const contextSessionId = readOptionalString(params.sessionId);
      const proposal = await controlPlaneFacade.reviewProposal({
        proposalId: readRequiredString(params.proposalId, 'proposalId'),
        reviewedBy: readRequiredString(params.reviewedBy, 'reviewedBy'),
        authority: readGovernanceAuthority(params.authority, params.targetScope),
        decision: readGovernanceDecision(params.decision),
        ...(contextSessionId
          ? { runtimeSnapshot: await resolveRuntimeSnapshotRefForSession(contextSessionId, runtime) }
          : {}),
        reviewedAt: readOptionalString(params.reviewedAt),
        note: readOptionalString(params.note)
      });
      respond(true, {
        proposal
      });
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.apply_correction_proposal`, async ({ params, respond }) => {
    try {
      const engine = await runtime.get();
      const contextSessionId = readOptionalString(params.sessionId);
      const result = await controlPlaneFacade.applyProposal({
        proposalId: readRequiredString(params.proposalId, 'proposalId'),
        appliedBy: readRequiredString(params.appliedBy, 'appliedBy'),
        authority: readGovernanceAuthority(params.authority, params.targetScope),
        ...(contextSessionId
          ? { runtimeSnapshot: await resolveRuntimeSnapshotRefForSession(contextSessionId, runtime) }
          : {}),
        appliedAt: readOptionalString(params.appliedAt),
        engine
      });
      respond(true, result);
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.rollback_correction_proposal`, async ({ params, respond }) => {
    try {
      const engine = await runtime.get();
      const contextSessionId = readOptionalString(params.sessionId);
      const result = await controlPlaneFacade.rollbackProposal({
        proposalId: readRequiredString(params.proposalId, 'proposalId'),
        rolledBackBy: readRequiredString(params.rolledBackBy, 'rolledBackBy'),
        authority: readGovernanceAuthority(params.authority, params.targetScope),
        ...(contextSessionId
          ? { runtimeSnapshot: await resolveRuntimeSnapshotRefForSession(contextSessionId, runtime) }
          : {}),
        rolledBackAt: readOptionalString(params.rolledBackAt),
        note: readOptionalString(params.note),
        engine
      });
      respond(true, result);
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.list_correction_proposals`, async ({ params, respond }) => {
    try {
      const proposals = await controlPlaneFacade.listProposals(readPositiveIntegerOrUndefined(params.limit));
      respond(true, {
        proposals
      });
    } catch (error) {
      respond(false, undefined, {
        code: 'context_engine_error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  register(`${PLUGIN_ID}.list_correction_audit`, async ({ params, respond }) => {
    try {
      const audit = await controlPlaneFacade.listAuditRecords(readPositiveIntegerOrUndefined(params.limit));
      respond(true, {
        audit
      });
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
  engine: Pick<ContextEngine, 'explain'>,
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
  engine: Pick<ContextEngine, 'compileContext' | 'explain'>,
  config: NormalizedPluginConfig
): Promise<{
  bundle: RuntimeContextBundle;
  summaryContract: ContextSummaryContract;
  bundleContract: BundleContractSnapshot;
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
  const summaryContract = buildContextSummaryContract(bundle);
  const bundleContract = buildBundleContractSnapshot(bundle);

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
    summaryContract,
    bundleContract,
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

export async function buildInspectRuntimeWindowPayload(
  params: Record<string, unknown>,
  runtime: Pick<ContextEngineRuntimeManager, 'getRuntimeWindowSnapshot' | 'getPersistedRuntimeWindowSnapshot' | 'resolveSessionFile'>,
  config: NormalizedPluginConfig
): Promise<{
  source: OpenClawRuntimeWindowSource;
  sessionId: string;
  query: string;
  capturedAt?: string;
  totalBudget: number;
  recentRawMessageCount: number;
  compressedCount: number;
  preservedConversationCount: number;
  counts: {
    inbound: number;
    preferred: number;
    final: number;
    finalSystem: number;
    finalConversation: number;
  };
  inboundMessages: AgentMessageLike[];
  preferredMessages: AgentMessageLike[];
  finalMessages: AgentMessageLike[];
  inboundSummary: OpenClawRuntimeMessageSummary[];
  preferredSummary: OpenClawRuntimeMessageSummary[];
  finalSummary: OpenClawRuntimeMessageSummary[];
  latestPointers: OpenClawRuntimeWindowLatestPointers;
  toolCallResultPairs: OpenClawToolCallResultPair[];
  window: OpenClawRuntimeContextWindowContract;
  promptAssembly: OpenClawPromptAssemblyContract;
  systemPromptAddition?: string;
  estimatedTokens?: number;
}> {
  const sessionId = readOptionalString(params.sessionId);

  if (!sessionId) {
    throw new Error('inspect_runtime_window requires a sessionId');
  }

  const liveSnapshot = runtime.getRuntimeWindowSnapshot(sessionId);

  if (liveSnapshot) {
    return buildRuntimeWindowPayload('live_runtime', liveSnapshot);
  }

  const persistedSnapshot = await runtime.getPersistedRuntimeWindowSnapshot(sessionId);

  if (persistedSnapshot) {
    return buildRuntimeWindowPayload('persisted_snapshot', persistedSnapshot);
  }

  const explicitSessionFile = readOptionalString(params.sessionFile);
  const sessionFile = explicitSessionFile ?? (await runtime.resolveSessionFile(sessionId));

  if (!sessionFile) {
    throw new Error('inspect_runtime_window could not resolve a live snapshot or sessionFile');
  }

  const messages = await loadTranscriptMessages({
    sessionFile
  });
  const totalBudget = readPositiveIntegerOrUndefined(params.tokenBudget) ?? config.defaultTokenBudget;
  const messageCompression = planPromptMessages(messages, totalBudget, config.recentRawMessageCount);
  const finalMessages =
    messageCompression.compressedCount > 0
      ? trimMessagesToBudget(messageCompression.preferredMessages, totalBudget)
      : trimMessagesToBudget(messages, totalBudget);

  return buildRuntimeWindowPayload('transcript_fallback', {
    sessionId,
    capturedAt: new Date().toISOString(),
    query: extractQueryText(messages),
    totalBudget,
    recentRawMessageCount: config.recentRawMessageCount,
    compressedCount: messageCompression.compressedCount,
    preservedConversationCount: messageCompression.preservedConversationCount,
    inboundMessages: messages,
    preferredMessages: messageCompression.preferredMessages,
    finalMessages
  });
}

export async function buildInspectObservabilityDashboardPayload(
  params: Record<string, unknown>,
  runtime: Pick<
    ContextEngineRuntimeManager,
    | 'getRuntimeWindowSnapshot'
    | 'getPersistedRuntimeWindowSnapshot'
    | 'resolveSessionFile'
    | 'listRuntimeWindowSnapshots'
  >,
  controlPlaneFacade: ControlPlaneFacadeContract,
  config: NormalizedPluginConfig
): Promise<{
  stage: string;
  sessionIds: string[];
  windowCount: number;
  dashboard: ReturnType<ControlPlaneFacadeContract['buildDashboard']>;
  history: ReturnType<ControlPlaneFacadeContract['buildDashboardHistory']>;
}> {
  const stage = readOptionalString(params.stage) ?? 'stage-6-observability-dashboard';
  const requestedSessionIds = readSessionIdList(params.sessionIds);
  const sessionId = readOptionalString(params.sessionId);
  const sessionIds = dedupeStrings([...requestedSessionIds, ...(sessionId ? [sessionId] : [])]);
  const windows =
    sessionIds.length > 0
      ? (
          await Promise.all(
            sessionIds.map(async (currentSessionId) => {
              const payload = await buildInspectRuntimeWindowPayload(
                {
                  sessionId: currentSessionId,
                  ...(readOptionalString(params.sessionFile) ? { sessionFile: params.sessionFile } : {}),
                  ...(typeof params.tokenBudget === 'number' ? { tokenBudget: params.tokenBudget } : {})
                },
                runtime,
                config
              );
              return payload.window;
            })
          )
        ).filter((window): window is OpenClawRuntimeContextWindowContract => Boolean(window))
      : (
          await runtime.listRuntimeWindowSnapshots(readPositiveIntegerOrUndefined(params.limit) ?? 10)
        ).map((snapshot) => buildRuntimeContextWindowContract('persisted_snapshot', snapshot));

  const dashboard = controlPlaneFacade.buildDashboard({
    stage,
    reports: [],
    history: [],
    windows,
    thresholds: readObservabilityThresholdOverrides(params.thresholds)
  });
  const snapshots = controlPlaneFacade.listDashboardSnapshots({
    stage,
    limit: readPositiveIntegerOrUndefined(params.historyLimit) ?? readPositiveIntegerOrUndefined(params.limit)
  });

  return {
    stage,
    sessionIds: windows.map((window) => window.sessionId),
    windowCount: windows.length,
    dashboard,
    history: controlPlaneFacade.buildDashboardHistory({
      snapshots
    })
  };
}

async function resolveRuntimeSnapshotRefForSession(
  sessionId: string,
  runtime: Pick<ContextEngineRuntimeManager, 'getRuntimeWindowSnapshot' | 'getPersistedRuntimeWindowSnapshot' | 'resolveSessionFile'>
): Promise<ControlPlaneRuntimeSnapshotRef | undefined> {
  const liveSnapshot = runtime.getRuntimeWindowSnapshot(sessionId);

  if (liveSnapshot) {
    return {
      sessionId,
      source: 'live_runtime',
      ...(liveSnapshot.capturedAt ? { capturedAt: liveSnapshot.capturedAt } : {}),
      ...(liveSnapshot.query ? { query: liveSnapshot.query } : {})
    };
  }

  const persistedSnapshot = await runtime.getPersistedRuntimeWindowSnapshot(sessionId);

  if (persistedSnapshot) {
    return {
      sessionId,
      source: 'persisted_snapshot',
      ...(persistedSnapshot.capturedAt ? { capturedAt: persistedSnapshot.capturedAt } : {}),
      ...(persistedSnapshot.query ? { query: persistedSnapshot.query } : {})
    };
  }

  const sessionFile = await runtime.resolveSessionFile(sessionId);

  if (!sessionFile) {
    return undefined;
  }

  return {
    sessionId,
    source: 'transcript_fallback'
  };
}

function buildRuntimeWindowPayload(
  source: OpenClawRuntimeWindowSource,
  snapshot: RuntimeWindowSnapshot
): {
  source: OpenClawRuntimeWindowSource;
  sessionId: string;
  query: string;
  capturedAt?: string;
  totalBudget: number;
  recentRawMessageCount: number;
  compressedCount: number;
  preservedConversationCount: number;
  counts: {
    inbound: number;
    preferred: number;
    final: number;
    finalSystem: number;
    finalConversation: number;
  };
  inboundMessages: AgentMessageLike[];
  preferredMessages: AgentMessageLike[];
  finalMessages: AgentMessageLike[];
  inboundSummary: OpenClawRuntimeMessageSummary[];
  preferredSummary: OpenClawRuntimeMessageSummary[];
  finalSummary: OpenClawRuntimeMessageSummary[];
  latestPointers: OpenClawRuntimeWindowLatestPointers;
  toolCallResultPairs: OpenClawToolCallResultPair[];
  window: OpenClawRuntimeContextWindowContract;
  promptAssembly: OpenClawPromptAssemblyContract;
  systemPromptAddition?: string;
  estimatedTokens?: number;
} {
  const window = buildRuntimeContextWindowContract(source, snapshot);
  const promptAssembly = buildPromptAssemblyContract(window, snapshot);

  return {
    source: window.source,
    sessionId: window.sessionId,
    query: window.query,
    ...(window.capturedAt ? { capturedAt: window.capturedAt } : {}),
    totalBudget: window.totalBudget,
    recentRawMessageCount: window.compression.recentRawMessageCount,
    compressedCount: window.compression.compressedCount,
    preservedConversationCount: window.compression.preservedConversationCount,
    counts: {
      inbound: window.inbound.counts.total,
      preferred: window.preferred.counts.total,
      final: window.final.counts.total,
      finalSystem: window.final.counts.system,
      finalConversation: window.final.counts.conversation
    },
    inboundMessages: window.inbound.messages,
    preferredMessages: window.preferred.messages,
    finalMessages: window.final.messages,
    inboundSummary: window.inbound.summary,
    preferredSummary: window.preferred.summary,
    finalSummary: window.final.summary,
    latestPointers: window.latestPointers,
    toolCallResultPairs: window.toolCallResultPairs,
    window,
    promptAssembly,
    ...(snapshot.systemPromptAddition ? { systemPromptAddition: snapshot.systemPromptAddition } : {}),
    ...(typeof snapshot.estimatedTokens === 'number' ? { estimatedTokens: snapshot.estimatedTokens } : {})
  };
}

function buildRuntimeContextWindowContract(
  source: OpenClawRuntimeWindowSource,
  snapshot: RuntimeWindowSnapshot
): OpenClawRuntimeContextWindowContract {
  const inbound = buildRuntimeWindowLayer(snapshot.inboundMessages);
  const preferred = buildRuntimeWindowLayer(snapshot.preferredMessages);
  const final = buildRuntimeWindowLayer(snapshot.finalMessages);

  return {
    version: RUNTIME_CONTEXT_WINDOW_CONTRACT_VERSION,
    source,
    sessionId: snapshot.sessionId,
    query: snapshot.query,
    ...(snapshot.capturedAt ? { capturedAt: snapshot.capturedAt } : {}),
    totalBudget: snapshot.totalBudget,
    compression: {
      recentRawMessageCount: snapshot.recentRawMessageCount,
      compressedCount: snapshot.compressedCount,
      preservedConversationCount: snapshot.preservedConversationCount
    },
    latestPointers: buildLatestPointers(snapshot.inboundMessages, snapshot.finalMessages),
    toolCallResultPairs: buildToolCallResultPairs(snapshot.inboundMessages, snapshot.finalMessages),
    inbound,
    preferred,
    final
  };
}

function buildPromptAssemblyContract(
  window: OpenClawRuntimeContextWindowContract,
  snapshot: RuntimeWindowSnapshot
): OpenClawPromptAssemblyContract {
  return {
    version: PROMPT_ASSEMBLY_CONTRACT_VERSION,
    runtimeWindowVersion: window.version,
    providerNeutralOutputs: PROMPT_ASSEMBLY_PROVIDER_NEUTRAL_OUTPUTS,
    hostAssemblyResponsibilities: PROMPT_ASSEMBLY_HOST_RESPONSIBILITIES,
    debugOnlyFields: PROMPT_ASSEMBLY_DEBUG_ONLY_FIELDS,
    finalMessageCount: window.final.counts.total,
    includesSystemPromptAddition: typeof snapshot.systemPromptAddition === 'string' && snapshot.systemPromptAddition.length > 0,
    ...(typeof snapshot.estimatedTokens === 'number' ? { estimatedTokens: snapshot.estimatedTokens } : {})
  };
}

function buildRuntimeWindowLayer(messages: AgentMessageLike[]) {
  return {
    messages,
    summary: messages.map((message, index) => summarizeRuntimeMessage(message, index)),
    counts: {
      total: messages.length,
      system: messages.filter((message) => normalizeRole(message.role) === 'system').length,
      conversation: messages.filter((message) => normalizeRole(message.role) !== 'system').length
    }
  };
}

function summarizeRuntimeMessage(message: AgentMessageLike, index: number): OpenClawRuntimeMessageSummary {
  const contentItems = Array.isArray(message.content)
    ? message.content
    : message.content && typeof message.content === 'object'
      ? [message.content]
      : [];

  const contentTypes = contentItems
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return typeof item;
      }

      return typeof (item as { type?: unknown }).type === 'string'
        ? (item as { type: string }).type
        : 'object';
    })
    .filter((value): value is string => Boolean(value));

  const toolCalls = contentItems
    .filter((item): item is { id?: string; name?: string; arguments?: unknown; type?: string } =>
      Boolean(item) && typeof item === 'object' && (item as { type?: unknown }).type === 'toolCall'
    )
    .map((item) => ({
      ...(typeof item.id === 'string' ? { id: item.id } : {}),
      ...(typeof item.name === 'string' ? { name: item.name } : {})
    }));

  const preview = stringifyMessageContent(message.content).replace(/\s+/g, ' ').trim();
  const toolCallId = extractToolResultCallId(message);

  return {
    index,
    ...(typeof message.id === 'string' ? { id: message.id } : {}),
    ...(typeof message.timestamp === 'string' ? { timestamp: message.timestamp } : {}),
    role: normalizeRole(message.role),
    contentTypes,
    preview: preview.slice(0, 240),
    textLength: preview.length,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    ...(toolCallId ? { toolCallId } : {})
  };
}

function buildLatestPointers(
  inboundMessages: AgentMessageLike[],
  finalMessages: AgentMessageLike[]
): OpenClawRuntimeWindowLatestPointers {
  const finalIds = new Set(
    finalMessages
      .map((message) => (typeof message.id === 'string' && message.id.length > 0 ? message.id : undefined))
      .filter((value): value is string => Boolean(value))
  );

  const latestUserMessage = [...inboundMessages]
    .reverse()
    .find((message) => normalizeRole(message.role) === 'user');
  const latestAssistantMessage = [...inboundMessages]
    .reverse()
    .find((message) => normalizeRole(message.role) === 'assistant');
  const latestToolResultIds = collectLatestToolResultIds(inboundMessages);

  return {
    ...(typeof latestUserMessage?.id === 'string' ? { latestUserMessageId: latestUserMessage.id } : {}),
    ...(typeof latestAssistantMessage?.id === 'string' ? { latestAssistantMessageId: latestAssistantMessage.id } : {}),
    latestToolResultIds,
    latestUserInFinalWindow:
      typeof latestUserMessage?.id === 'string' ? finalIds.has(latestUserMessage.id) : false,
    latestAssistantInFinalWindow:
      typeof latestAssistantMessage?.id === 'string' ? finalIds.has(latestAssistantMessage.id) : false,
    latestToolResultIdsInFinalWindow: latestToolResultIds.filter((id) => finalIds.has(id))
  };
}

function buildToolCallResultPairs(
  inboundMessages: AgentMessageLike[],
  finalMessages: AgentMessageLike[]
): OpenClawToolCallResultPair[] {
  const finalIds = new Set(
    finalMessages
      .map((message) => (typeof message.id === 'string' && message.id.length > 0 ? message.id : undefined))
      .filter((value): value is string => Boolean(value))
  );
  const pendingCalls: Array<{
    assistantMessageId?: string;
    toolCallId?: string;
    toolName?: string;
  }> = [];
  const pairs: OpenClawToolCallResultPair[] = [];

  for (const message of inboundMessages) {
    const normalizedRole = normalizeRole(message.role);

    if (normalizedRole === 'assistant') {
      for (const toolCall of extractToolCalls(message)) {
        pendingCalls.push({
          ...(typeof message.id === 'string' ? { assistantMessageId: message.id } : {}),
          ...(toolCall.id ? { toolCallId: toolCall.id } : {}),
          ...(toolCall.name ? { toolName: toolCall.name } : {})
        });
      }
      continue;
    }

    if (normalizedRole !== 'tool') {
      continue;
    }

    const resultMessageId = typeof message.id === 'string' ? message.id : undefined;
    const explicitToolCallId = extractToolResultCallId(message);
    const matchedIndex =
      explicitToolCallId
        ? pendingCalls.findIndex((candidate) => candidate.toolCallId === explicitToolCallId)
        : pendingCalls.length > 0
          ? 0
          : -1;

    if (matchedIndex >= 0) {
      const matched = pendingCalls.splice(matchedIndex, 1)[0];

      pairs.push({
        ...(matched?.toolCallId || explicitToolCallId ? { toolCallId: matched?.toolCallId ?? explicitToolCallId } : {}),
        ...(matched?.toolName ? { toolName: matched.toolName } : {}),
        ...(matched?.assistantMessageId ? { assistantMessageId: matched.assistantMessageId } : {}),
        ...(resultMessageId ? { resultMessageId } : {}),
        matchKind: explicitToolCallId ? 'tool_call_id' : 'sequence_fallback',
        callInFinalWindow:
          typeof matched?.assistantMessageId === 'string' ? finalIds.has(matched.assistantMessageId) : false,
        resultInFinalWindow: resultMessageId ? finalIds.has(resultMessageId) : false
      });

      continue;
    }

    pairs.push({
      ...(explicitToolCallId ? { toolCallId: explicitToolCallId } : {}),
      ...(resultMessageId ? { resultMessageId } : {}),
      matchKind: 'tool_result_only',
      callInFinalWindow: false,
      resultInFinalWindow: resultMessageId ? finalIds.has(resultMessageId) : false
    });
  }

  for (const pending of pendingCalls) {
    pairs.push({
      ...(pending.toolCallId ? { toolCallId: pending.toolCallId } : {}),
      ...(pending.toolName ? { toolName: pending.toolName } : {}),
      ...(pending.assistantMessageId ? { assistantMessageId: pending.assistantMessageId } : {}),
      matchKind: 'tool_call_only',
      callInFinalWindow:
        typeof pending.assistantMessageId === 'string' ? finalIds.has(pending.assistantMessageId) : false,
      resultInFinalWindow: false
    });
  }

  return pairs;
}

function collectLatestToolResultIds(messages: AgentMessageLike[]): string[] {
  const collected: string[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (!message) {
      continue;
    }

    const normalizedRole = normalizeRole(message.role);

    if (normalizedRole === 'tool') {
      if (typeof message.id === 'string' && message.id.length > 0) {
        collected.unshift(message.id);
      }
      continue;
    }

    if (collected.length > 0) {
      break;
    }
  }

  if (collected.length > 0) {
    return collected;
  }

  const latestToolMessage = [...messages]
    .reverse()
    .find((message) => normalizeRole(message.role) === 'tool');

  return typeof latestToolMessage?.id === 'string' ? [latestToolMessage.id] : [];
}

function extractToolCalls(message: AgentMessageLike): Array<{ id?: string; name?: string }> {
  const contentItems = Array.isArray(message.content)
    ? message.content
    : message.content && typeof message.content === 'object'
      ? [message.content]
      : [];

  return contentItems
    .filter((item): item is { id?: string; name?: string; type?: string } =>
      Boolean(item) && typeof item === 'object' && (item as { type?: unknown }).type === 'toolCall'
    )
    .map((item) => ({
      ...(typeof item.id === 'string' ? { id: item.id } : {}),
      ...(typeof item.name === 'string' ? { name: item.name } : {})
    }));
}

function extractToolResultCallId(message: AgentMessageLike): string | undefined {
  if (typeof message.toolCallId === 'string' && message.toolCallId.length > 0) {
    return message.toolCallId;
  }

  const compressed = readCompressedToolResultContent(message.content);

  if (compressed?.toolCallId) {
    return compressed.toolCallId;
  }

  const contentItems = Array.isArray(message.content)
    ? message.content
    : message.content && typeof message.content === 'object'
      ? [message.content]
      : [];

  for (const item of contentItems) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const record = item as Record<string, unknown>;

    if (typeof record.toolCallId === 'string' && record.toolCallId.length > 0) {
      return record.toolCallId;
    }

    if (typeof record.callId === 'string' && record.callId.length > 0) {
      return record.callId;
    }
  }

  return undefined;
}

function parseRuntimeWindowSnapshot(raw: string): RuntimeWindowSnapshot | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }

    const record = parsed as Record<string, unknown>;

    if (
      typeof record.sessionId !== 'string' ||
      typeof record.query !== 'string' ||
      typeof record.totalBudget !== 'number' ||
      !Array.isArray(record.inboundMessages) ||
      !Array.isArray(record.preferredMessages) ||
      !Array.isArray(record.finalMessages)
    ) {
      return undefined;
    }

    return parsed as RuntimeWindowSnapshot;
  } catch {
    return undefined;
  }
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

  return annotateContextInputRoute({
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
  });
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
  const summaryContract = buildContextSummaryContract(bundle);
  const lines: string[] = ['[Compact Context Engine]'];

  if ((compression?.compressedCount ?? 0) > 0) {
    lines.push(
      `Earlier turns compressed: ${compression?.compressedCount ?? 0} | Raw turns kept: ${compression?.preservedRawCount ?? 0}`
    );
  }

  if (summaryContract.goal) {
    lines.push(`Goal: ${summaryContract.goal.label}`);
  }

  if (summaryContract.intent) {
    lines.push(`Intent: ${summaryContract.intent.label}`);
  }

  if (summaryContract.activeRules.length > 0) {
    lines.push(`Active rules: ${summaryContract.activeRules.map((item) => item.label).join(' | ')}`);
  }

  if (summaryContract.activeConstraints.length > 0) {
    lines.push(`Constraints: ${summaryContract.activeConstraints.map((item) => item.label).join(' | ')}`);
  }

  if (summaryContract.currentProcess) {
    lines.push(`Current step: ${summaryContract.currentProcess.label}`);
  }

  if (summaryContract.recentDecisions.length > 0) {
    lines.push(`Recent decisions: ${summaryContract.recentDecisions.map((item) => item.label).join(' | ')}`);
  }

  if (summaryContract.recentStateChanges.length > 0) {
    lines.push(`State changes: ${summaryContract.recentStateChanges.map((item) => item.label).join(' | ')}`);
  }

  if (summaryContract.relevantEvidence.length > 0) {
    lines.push(`Evidence: ${summaryContract.relevantEvidence.map((item) => item.label).join(' | ')}`);
  }

  if (summaryContract.candidateSkills.length > 0) {
    lines.push(`Skills: ${summaryContract.candidateSkills.map((item) => item.label).join(' | ')}`);
  }

  if (summaryContract.openRisks.length > 0) {
    lines.push(`Open risks: ${summaryContract.openRisks.map((item) => item.label).join(' | ')}`);
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
  const summaryContract = buildContextSummaryContract(bundle);
  const bundleContract = buildBundleContractSnapshot(bundle);
  const fixedSelected = bundle.diagnostics.fixed.selected.length;
  const fixedSkipped = bundle.diagnostics.fixed.skipped.length;

  if (fixedSelected > 0 || fixedSkipped > 0) {
    lines.push(`Fixed context: selected ${fixedSelected} | skipped ${fixedSkipped}`);
  }

  lines.push(
    `Summary contract: goal=${Boolean(summaryContract.goal)} intent=${Boolean(summaryContract.intent)} currentProcess=${Boolean(summaryContract.currentProcess)} rules=${summaryContract.activeRules.length} constraints=${summaryContract.activeConstraints.length} risks=${summaryContract.openRisks.length} evidence=${summaryContract.relevantEvidence.length} skills=${summaryContract.candidateSkills.length}`
  );
  lines.push(
    `Bundle contract: fixed=${Object.values(bundleContract.fixedSlotCoverage).filter(Boolean).length}/${bundleContract.requiredFixedSlots.length} categories=${Object.values(bundleContract.categoryCounts).reduce((total, count) => total + Number(count > 0), 0)}/${bundleContract.requiredCategories.length}`
  );

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

  if ((bundle.diagnostics.topicAdmissions?.length ?? 0) > 0) {
    lines.push(
      `topicAdmissions: admitted ${bundle.diagnostics.topicAdmissions?.length} summary-only topic/context hint(s)`
    );
  }

  if (bundle.diagnostics.relationRetrieval) {
    const relation = bundle.diagnostics.relationRetrieval;
    lines.push(
      `relationRetrieval: ${relation.strategy} edge=${relation.edgeLookupCount} node=${relation.nodeLookupCount} hop=${relation.maxHopCount ?? 1} paths=${relation.pathCount ?? 0} candidates=${relation.candidatePathCount ?? 0} admitted=${relation.admittedPathCount ?? 0} pruned=${relation.prunedPathCount ?? 0}` +
        `${relation.prunedByScoreCount ? ` score=${relation.prunedByScoreCount}` : ''}` +
        `${relation.prunedBySourceCount ? ` source=${relation.prunedBySourceCount}` : ''}` +
        `${relation.prunedByExpansionCount ? ` expand=${relation.prunedByExpansionCount}` : ''}`
    );
  }

  if (bundle.diagnostics.learning) {
    const learning = bundle.diagnostics.learning;

    lines.push(
      `Learning signals: failure=${learning.failureSignals.length} procedures=${learning.procedureCandidates.length} criticalSteps=${learning.criticalStepNodeIds.length}`
    );

    if (learning.failureSignals.length > 0) {
      lines.push(
        `Failure signals: ${learning.failureSignals
          .map((item) => `${truncateText(item.label, 48)}(${item.severity})`)
          .join(' | ')}`
      );
    }

    if (learning.procedureCandidates.length > 0) {
      lines.push(
        `Procedure candidates: ${learning.procedureCandidates
          .map((item) => `${truncateText(item.label, 48)}[${item.status}]`)
          .join(' | ')}`
      );
    }

    if (learning.criticalStepLabels.length > 0) {
      lines.push(`Critical steps: ${learning.criticalStepLabels.map((item) => truncateText(item, 48)).join(' | ')}`);
    }
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

function normalizeRole(role: unknown): Exclude<RawContextRecord['role'], undefined> {
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

function readRequiredString(value: unknown, field: string): string {
  const resolved = readOptionalString(value);

  if (!resolved) {
    throw new Error(`${field} is required`);
  }

  return resolved;
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

function readManualCorrectionsPayload(params: Record<string, unknown>): ManualCorrectionRecord[] {
  const corrections = Array.isArray(params.corrections) ? params.corrections : [];

  return corrections.filter(isManualCorrectionRecord);
}

function readSessionIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupeStrings(value.map((item) => readOptionalString(item)).filter((item): item is string => Boolean(item)));
}

function readObservabilityThresholdOverrides(
  value: unknown
): Partial<ObservabilityAlertThresholds> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const next: Partial<ObservabilityAlertThresholds> = {};

  assignRatioOverride(candidate.minLiveRuntimeRatio, 'minLiveRuntimeRatio', next);
  assignRatioOverride(candidate.maxTranscriptFallbackRatio, 'maxTranscriptFallbackRatio', next);
  assignRatioOverride(candidate.maxRecallNoiseRate, 'maxRecallNoiseRate', next);
  assignRatioOverride(candidate.minPromotionQuality, 'minPromotionQuality', next);
  assignRatioOverride(candidate.maxKnowledgePollutionRate, 'maxKnowledgePollutionRate', next);
  assignRatioOverride(candidate.minHighScopeReuseBenefit, 'minHighScopeReuseBenefit', next);
  assignRatioOverride(candidate.maxHighScopeReuseIntrusion, 'maxHighScopeReuseIntrusion', next);
  assignRatioOverride(candidate.minMultiSourceCoverage, 'minMultiSourceCoverage', next);

  return Object.keys(next).length > 0 ? next : undefined;
}

function assignRatioOverride(
  value: unknown,
  key: keyof ObservabilityAlertThresholds,
  target: Partial<ObservabilityAlertThresholds>
): void {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1) {
    target[key] = value;
  }
}

function readGovernanceScope(value: unknown): Scope {
  if (value === 'session' || value === 'workspace' || value === 'global') {
    return value;
  }

  return 'session';
}

function readGovernanceAuthority(value: unknown, fallbackScopeValue: unknown): GovernanceAuthority {
  if (value === 'session_operator' || value === 'workspace_reviewer' || value === 'global_reviewer') {
    return value;
  }

  const fallbackScope = readGovernanceScope(fallbackScopeValue);

  switch (fallbackScope) {
    case 'global':
      return 'global_reviewer';
    case 'workspace':
      return 'workspace_reviewer';
    case 'session':
    default:
      return 'session_operator';
  }
}

function readGovernanceDecision(value: unknown): GovernanceDecision {
  if (value === 'approve' || value === 'reject') {
    return value;
  }

  throw new Error('decision must be "approve" or "reject"');
}

function readImportSourceKind(value: unknown): ImportSourceKind {
  if (value === 'document' || value === 'repo_structure' || value === 'structured_input') {
    return value;
  }

  return 'structured_input';
}

function readRawContextInputPayload(value: unknown): RawContextInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('input is required');
  }

  const candidate = value as Record<string, unknown>;
  const sessionId = readRequiredString(candidate.sessionId, 'input.sessionId');
  const records = Array.isArray(candidate.records) ? candidate.records : [];

  if (records.length === 0) {
    throw new Error('input.records must contain at least one record');
  }

  return {
    sessionId,
    ...(readOptionalString(candidate.workspaceId) ? { workspaceId: readOptionalString(candidate.workspaceId) } : {}),
    records: records as RawContextRecord[]
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isManualCorrectionRecord(value: unknown): value is ManualCorrectionRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    isManualCorrectionTargetKind(record.targetKind) &&
    typeof record.targetId === 'string' &&
    (record.action === 'apply' || record.action === 'rollback') &&
    typeof record.reason === 'string' &&
    typeof record.author === 'string' &&
    typeof record.createdAt === 'string'
  );
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

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
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
