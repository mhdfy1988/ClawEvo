import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve, dirname, isAbsolute } from 'node:path';

import {
  ContextEngine,
  analyzeTextMatch,
  annotateContextInputRoute,
  buildBundleContractSnapshot,
  buildContextSummaryContract,
  buildRuntimeContextBundleMetadata,
  collectBundleRecalledNodes,
  extractSearchTerms,
  isManualCorrectionTargetKind
} from '@openclaw-compact-context/runtime-core';
import { ContextEnginePlugin } from '../plugin/context-engine-plugin.js';
import type { ContextPluginMethod, ContextPluginRequest, ContextPluginResponse } from '../plugin/api.js';
import type {
  BundleContractSnapshot,
  BundleRecalledNodeView,
  CompressionDiagnostics,
  ContextCompressionMode,
  ControlPlaneFacadeContract,
  ControlPlaneRuntimeSnapshotRef,
  ContextSummaryContract,
  DerivedArtifactTriggerSource,
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
  RuntimeCompressionPolicy,
  RuntimeContextBundle,
  Scope,
  SessionCompressionBaselineState,
  SessionCompressionState,
  SessionCheckpoint
} from '@openclaw-compact-context/contracts';
import {
  applyToolResultPolicy,
  buildCompressedToolResultMetadata,
  readCompressedToolResultContent,
  summarizeToolResultMessageContent
} from './tool-result-policy.js';
import { loadTranscriptContextInput, loadTranscriptMessages } from './transcript-loader.js';
import type {
  AgentMessageLike,
  OpenClawContextEngine,
  OpenClawGatewayHandlerOptions,
  OpenClawPluginLogger,
  OpenClawPromptAssemblyContract,
  OpenClawPromptAssemblySnapshot,
  OpenClawRuntimeCompressionCompactionView,
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
const PROMPT_ASSEMBLY_SNAPSHOT_VERSION = 'prompt_assembly_snapshot.v1';
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
const DEFAULT_RAW_TAIL_TURN_COUNT = 2;
const DEFAULT_FULL_COMPACTION_THRESHOLD_RATIO = 0.5;
const DEFAULT_MAX_BASELINE_COUNT = 4;
const DEFAULT_MAX_BASELINE_ROLLUP_RATIO = 0.2;
const MAX_COMPRESSION_SUMMARY_LINES = 8;
const MAX_COMPRESSION_SUMMARY_CHARS = 1200;
const LIVE_RECENT_MESSAGES_FALLBACK_REASON = 'live_recent_messages_fallback';

interface RuntimeWindowSnapshot {
  sessionId: string;
  capturedAt: string;
  query: string;
  totalBudget: number;
  recentRawMessageCount: number;
  recentRawTurnCount: number;
  compressedCount: number;
  preservedConversationCount: number;
  compressionMode: ContextCompressionMode;
  compressionReason?: string;
  inboundMessages: AgentMessageLike[];
  preferredMessages: AgentMessageLike[];
  finalMessages: AgentMessageLike[];
  systemPromptAddition?: string;
  estimatedTokens?: number;
  compressionDiagnostics?: CompressionDiagnostics;
  promptAssemblySnapshot?: OpenClawPromptAssemblySnapshot;
  compaction?: OpenClawRuntimeCompressionCompactionView;
  compressionPolicy?: RuntimeCompressionPolicy;
}

export interface NormalizedPluginConfig {
  dbPath?: string;
  runtimeSnapshotDir?: string;
  toolResultArtifactDir?: string;
  defaultTokenBudget: number;
  compileBudgetRatio: number;
  enableGatewayMethods: boolean;
  recentRawMessageCount: number;
  rawTailTurnCount: number;
  fullCompactionThresholdRatio: number;
  maxBaselineCount: number;
  maxBaselineRollupRatio: number;
  configBaseDir?: string;
}

interface ResolvedConversationMessage {
  id: string;
  role: Exclude<RawContextRecord['role'], undefined>;
  message: AgentMessageLike;
  originalIndex: number;
}

interface ConversationTurnBlock {
  turnId: string;
  messageIds: string[];
  messages: AgentMessageLike[];
}

interface AssemblyCompressionPlan {
  nextState: SessionCompressionState;
  rawTailMessages: AgentMessageLike[];
  promptVisibleRawTailMessages: AgentMessageLike[];
  rawTailTurnCount: number;
  rawTailMessageCount: number;
  compressedCount: number;
  preservedConversationCount: number;
  compressionMode: ContextCompressionMode;
  compressionReason?: string;
}

interface BaselineRollupResult {
  baselines?: SessionCompressionBaselineState[];
  diagnostics?: CompressionDiagnostics;
}

interface DerivedArtifactSyncResult {
  persisted: boolean;
  reason: string;
  checkpointId?: string;
  deltaId?: string;
  candidateCount?: number;
}

export class ContextEngineRuntimeManager {
  private enginePromise?: Promise<ContextEngine>;
  private resolvedDbPath?: string;
  private resolvedRuntimeSnapshotDir?: string;
  private readonly recentOwnCompactions = new Map<string, number>();
  private readonly runtimeWindowSnapshots = new Map<string, RuntimeWindowSnapshot>();
  private readonly resolvedSessionFiles = new Map<string, string>();
  private readonly sessionTaskTails = new Map<string, Promise<void>>();

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

  async runInSessionQueue<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
    const previousTail = this.sessionTaskTails.get(sessionId) ?? Promise.resolve();
    let releaseCurrentTail: (() => void) | undefined;
    const currentTail = new Promise<void>((resolve) => {
      releaseCurrentTail = resolve;
    });
    const chainedTail = previousTail.catch(() => undefined).then(() => currentTail);
    this.sessionTaskTails.set(sessionId, chainedTail);

    try {
      await previousTail.catch(() => undefined);
      return await task();
    } finally {
      releaseCurrentTail?.();

      if (this.sessionTaskTails.get(sessionId) === chainedTail) {
        this.sessionTaskTails.delete(sessionId);
      }
    }
  }

  private resolveDbPath(sessionFile?: string): string {
    const hostStateDir = this.resolveHostStateDir();

    if (this.config.dbPath) {
      return resolveConfiguredPath(this.config.dbPath, {
        baseDir: this.config.configBaseDir,
        stateDir: hostStateDir,
        resolvePath: this.resolvePath
      });
    }

    if (this.config.configBaseDir) {
      return resolve(this.config.configBaseDir, DEFAULT_DB_FILE);
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

    if (this.config.runtimeSnapshotDir) {
      this.resolvedRuntimeSnapshotDir = resolveConfiguredPath(this.config.runtimeSnapshotDir, {
        baseDir: this.config.configBaseDir,
        stateDir: this.resolveHostStateDir(),
        resolvePath: this.resolvePath
      });
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
    return runInSessionQueue(this.runtime, params.sessionId, async () => {
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

      await engine.ingest(transcriptInput);
      return {
        bootstrapped: true,
        importedMessages: transcriptInput.records.length
      };
    });
  }

  async ingest(params: {
    sessionId: string;
    message: AgentMessageLike;
    isHeartbeat?: boolean;
  }): Promise<{ ingested: boolean }> {
    return runInSessionQueue(this.runtime, params.sessionId, async () => {
      const engine = await this.runtime.get();
      const result = await engine.ingest(buildRawContextInput(params.sessionId, [params.message], params.isHeartbeat));
      return {
        ingested: result.persistedNodeIds.length > 0
      };
    });
  }

  async ingestBatch(params: {
    sessionId: string;
    messages: AgentMessageLike[];
    isHeartbeat?: boolean;
  }): Promise<{ ingestedCount: number }> {
    return runInSessionQueue(this.runtime, params.sessionId, async () => {
      const engine = await this.runtime.get();
      const result = await engine.ingest(buildRawContextInput(params.sessionId, params.messages, params.isHeartbeat));
      return {
        ingestedCount: result.persistedNodeIds.length
      };
    });
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
    await runInSessionQueue(this.runtime, params.sessionId, async () => {
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

      if (!params.autoCompactionSummary?.trim()) {
        return;
      }

      const bundle = withBundleMetadata(
        await engine.compileContext({
          sessionId: params.sessionId,
          query: extractQueryText(params.messages),
          tokenBudget: resolveCompileBudget(params.tokenBudget, this.config)
        })
      );
      const latestCheckpoint = await engine.getLatestCheckpoint(params.sessionId);

      await syncDerivedArtifactsForBundle({
        engine,
        sessionId: params.sessionId,
        bundle,
        latestCheckpoint,
        triggerSource: 'after_turn',
        forcePersist: true,
        reason: 'after_turn_auto_compaction_summary'
      });
    });
  }

  // assemble() 是当前自动上下文治理主入口：
  // - 先摄入本轮原始消息
  // - 再编译 bundle / recent raw window
  // - 最后返回 provider-neutral 的 messages/systemPromptAddition/estimatedTokens
  // 当前版本不再把 hook 当作上下文治理主链前提。
  async assemble(params: {
    sessionId: string;
    messages: AgentMessageLike[];
    tokenBudget?: number;
  }): Promise<{
    messages: AgentMessageLike[];
    estimatedTokens: number;
    systemPromptAddition?: string;
  }> {
    return runInSessionQueue(this.runtime, params.sessionId, async () => {
      const totalBudget = params.tokenBudget ?? this.config.defaultTokenBudget;
      const compressionPolicy = buildRuntimeCompressionPolicy(this.config);

      try {
        const engine = await this.runtime.get();
        await engine.ingest(buildRawContextInput(params.sessionId, params.messages));

        const previousCompressionState = await engine.getCompressionState(params.sessionId);
        const compressionPlan = buildAssemblyCompressionPlan({
          sessionId: params.sessionId,
          messages: params.messages,
          totalBudget,
          previousState: previousCompressionState,
          compressionPolicy
        });

        const bundle = withBundleMetadata(
          await engine.compileContext({
            sessionId: params.sessionId,
            query: extractQueryText(params.messages),
            tokenBudget: resolveCompileBudget(totalBudget, this.config)
          }),
          {
            compressionMode: compressionPlan.compressionMode,
            baselineId: latestCompressionBaselineId(compressionPlan.nextState)
          }
        );

        if (compressionPlan.compressionMode !== 'none') {
          const latestCheckpoint = await engine.getLatestCheckpoint(params.sessionId);
          await syncDerivedArtifactsForBundle({
            engine,
            sessionId: params.sessionId,
            bundle,
            latestCheckpoint,
            triggerSource: 'assemble',
            triggerCompressionMode: compressionPlan.compressionMode,
            forcePersist: compressionPlan.compressionMode === 'full',
            reason: resolveAssembleArtifactSyncReason(compressionPlan.compressionMode)
          });
        }

        const bundlePromptSection = formatBundle(
          bundle,
          {
            compressedCount: compressionPlan.compressedCount,
            preservedRawCount: compressionPlan.preservedConversationCount
          },
          {
            diagnosticsMode: 'prompt'
          }
        );
        const compressionPromptSection = formatCompressionStateForPrompt(compressionPlan.nextState);
        const provisionalSystemPromptAddition = joinPromptSections([
          compressionPromptSection,
          bundlePromptSection
        ]);
        const remainingBudget = Math.max(totalBudget - estimateTextTokens(provisionalSystemPromptAddition), 0);
        const preferredMessages = buildPreferredRawTailMessages(params.messages, compressionPlan.promptVisibleRawTailMessages);
        const provisionalMessages = trimMessagesToBudget(preferredMessages, remainingBudget);
        const finalPreservedRawCount = provisionalMessages.filter((message) => normalizeRole(message.role) !== 'system').length;
        const systemPromptAddition = joinPromptSections([
          compressionPromptSection,
          formatBundle(
            bundle,
            {
              compressedCount: compressionPlan.compressedCount,
              preservedRawCount: finalPreservedRawCount
            },
            {
              diagnosticsMode: 'prompt'
            }
          )
        ]);
        const finalRemainingBudget = Math.max(totalBudget - estimateTextTokens(systemPromptAddition), 0);
        const messages = trimMessagesToBudget(preferredMessages, finalRemainingBudget);

        if (shouldFallbackToLiveRecentMessages(params.messages, messages)) {
          this.logger.warn(`[${PLUGIN_ID}] assemble produced incomplete coverage; falling back to live recent messages`, {
            sessionId: params.sessionId,
            totalBudget
          });
          const fallbackState = applyCompressionFallbackLevel(compressionPlan.nextState, 'live_recent_messages');

          if (!areCompressionStatesEquivalent(previousCompressionState, fallbackState)) {
            await engine.saveCompressionState(fallbackState);
          }

          return this.finishAssembleWithLiveFallback({
            sessionId: params.sessionId,
            inboundMessages: params.messages,
            totalBudget,
            compressionPlan,
            compactionState: fallbackState,
            compressionPolicy,
            reason: LIVE_RECENT_MESSAGES_FALLBACK_REASON
          });
        }

        const estimatedTokens = estimateMessagesTokens(messages) + estimateTextTokens(systemPromptAddition);
        const promptAssemblySnapshot = buildPromptAssemblySnapshot({
          inboundMessages: params.messages,
          finalMessages: messages,
          systemPromptAddition,
          estimatedTokens,
          compressionMode: compressionPlan.compressionMode,
          compressionReason: compressionPlan.compressionReason,
          compressionDiagnostics: compressionPlan.nextState.compressionDiagnostics,
          compressionPolicy
        });

        if (!areCompressionStatesEquivalent(previousCompressionState, compressionPlan.nextState)) {
          await engine.saveCompressionState(compressionPlan.nextState);
        }

        await this.runtime.recordRuntimeWindowSnapshot({
          sessionId: params.sessionId,
          capturedAt: new Date().toISOString(),
          query: extractQueryText(params.messages),
          totalBudget,
          recentRawMessageCount: compressionPlan.rawTailMessageCount,
          recentRawTurnCount: compressionPlan.rawTailTurnCount,
          compressedCount: compressionPlan.compressedCount,
          preservedConversationCount: compressionPlan.preservedConversationCount,
          compressionMode: compressionPlan.compressionMode,
          ...(compressionPlan.compressionReason
            ? { compressionReason: compressionPlan.compressionReason }
            : {}),
          inboundMessages: params.messages,
          preferredMessages,
          finalMessages: messages,
          ...(compressionPlan.nextState.compressionDiagnostics
            ? { compressionDiagnostics: cloneCompressionDiagnostics(compressionPlan.nextState.compressionDiagnostics) }
            : {}),
          compaction: buildCompressionCompactionPayload(compressionPlan.nextState, compressionPolicy),
          promptAssemblySnapshot,
          compressionPolicy,
          systemPromptAddition,
          estimatedTokens
        });

        return {
          messages,
          estimatedTokens,
          systemPromptAddition
        };
      } catch (error) {
        this.logger.warn(`[${PLUGIN_ID}] assemble failed; falling back to live recent messages`, {
          sessionId: params.sessionId,
          err: error instanceof Error ? error.message : String(error)
        });

        return this.finishAssembleWithLiveFallback({
          sessionId: params.sessionId,
          inboundMessages: params.messages,
          totalBudget,
          compressionPolicy,
          reason: LIVE_RECENT_MESSAGES_FALLBACK_REASON
        });
      }
    });
  }

  // compact() 保留为手动 / 兼容 / 调试入口。
  // 日常自动压缩主路径仍以 assemble() 为准，而不是依赖宿主额外触发 compact。
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
    return runInSessionQueue(this.runtime, params.sessionId, async () => {
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

      const bundle = withBundleMetadata(
        await engine.compileContext({
          sessionId: params.sessionId,
          query: params.customInstructions?.trim() || 'compact active session context',
          tokenBudget: resolveCompileBudget(targetBudget, this.config)
        }),
        {
          compressionMode: 'full'
        }
      );
      const latestCheckpointForCompact = await engine.getLatestCheckpoint(params.sessionId);
      const syncResult = await syncDerivedArtifactsForBundle({
        engine,
        sessionId: params.sessionId,
        bundle,
        latestCheckpoint: latestCheckpointForCompact,
        triggerSource: 'compact',
        triggerCompressionMode: 'full',
        forcePersist: true,
        reason: 'manual_compact'
      });
      this.runtime.markOwnCompaction(params.sessionId);

      return {
        ok: true,
        compacted: true,
        result: {
          summary: formatBundle(bundle, undefined, {
            diagnosticsMode: 'summary'
          }),
          tokensBefore,
          tokensAfter: bundle.tokenBudget.used,
          details: {
            checkpointId: syncResult.checkpointId,
            deltaId: syncResult.deltaId,
            compactionTarget: params.compactionTarget ?? 'budget'
          }
        }
      };
    });
  }

  async dispose(): Promise<void> {
    await this.runtime.close();
  }

  private async finishAssembleWithLiveFallback(options: {
    sessionId: string;
    inboundMessages: AgentMessageLike[];
    totalBudget: number;
    reason: string;
    compressionPolicy: RuntimeCompressionPolicy;
    compressionPlan?: AssemblyCompressionPlan;
    compactionState?: SessionCompressionState;
  }): Promise<{
    messages: AgentMessageLike[];
    estimatedTokens: number;
    systemPromptAddition?: string;
  }> {
    const messages = buildLiveFallbackMessages(options.inboundMessages, options.totalBudget);
    const estimatedTokens = estimateMessagesTokens(messages);
    const compressionDiagnostics: CompressionDiagnostics = {
      ...(cloneCompressionDiagnostics(options.compressionPlan?.nextState.compressionDiagnostics) ?? {}),
      fallbackLevel: 'live_recent_messages'
    };
    const promptAssemblySnapshot = buildPromptAssemblySnapshot({
      inboundMessages: options.inboundMessages,
      finalMessages: messages,
      estimatedTokens,
      compressionMode: 'none',
      compressionReason: options.reason,
      compressionDiagnostics,
      compressionPolicy: options.compressionPolicy
    });

    await this.runtime.recordRuntimeWindowSnapshot({
      sessionId: options.sessionId,
      capturedAt: new Date().toISOString(),
      query: extractQueryText(options.inboundMessages),
      totalBudget: options.totalBudget,
      recentRawMessageCount: options.compressionPlan?.rawTailMessageCount ?? countConversationMessages(options.inboundMessages),
      recentRawTurnCount: options.compressionPlan?.rawTailTurnCount ?? countConversationTurns(options.sessionId, options.inboundMessages),
      compressedCount: 0,
      preservedConversationCount: countConversationMessages(messages),
      compressionMode: 'none',
      compressionReason: options.reason,
      inboundMessages: options.inboundMessages,
      preferredMessages: messages,
      finalMessages: messages,
      compressionDiagnostics,
      ...(options.compactionState
        ? { compaction: buildCompressionCompactionPayload(options.compactionState, options.compressionPolicy) }
        : {}),
      promptAssemblySnapshot,
      compressionPolicy: options.compressionPolicy,
      estimatedTokens
    });

    return {
      messages,
      estimatedTokens
    };
  }
}

async function runInSessionQueue<T>(
  runtime: {
    runInSessionQueue?<TResult>(sessionId: string, task: () => Promise<TResult>): Promise<TResult>;
  },
  sessionId: string,
  task: () => Promise<T>
): Promise<T> {
  if (typeof runtime.runInSessionQueue === 'function') {
    return runtime.runInSessionQueue(sessionId, task);
  }

  return task();
}

export function normalizePluginConfig(
  value: Record<string, unknown> | undefined,
  options: {
    configBaseDir?: string;
  } = {}
): NormalizedPluginConfig {
  return {
    dbPath: readOptionalString(value?.dbPath),
    runtimeSnapshotDir: readOptionalString(value?.runtimeSnapshotDir),
    toolResultArtifactDir: readOptionalString(value?.toolResultArtifactDir),
    defaultTokenBudget: readPositiveInteger(value?.defaultTokenBudget, DEFAULT_TOKEN_BUDGET),
    compileBudgetRatio: readRatio(value?.compileBudgetRatio, DEFAULT_COMPILE_RATIO),
    enableGatewayMethods: typeof value?.enableGatewayMethods === 'boolean' ? value.enableGatewayMethods : true,
    recentRawMessageCount: readPositiveInteger(value?.recentRawMessageCount, 8),
    rawTailTurnCount: readPositiveInteger(value?.rawTailTurnCount, DEFAULT_RAW_TAIL_TURN_COUNT),
    fullCompactionThresholdRatio: readRatio(
      value?.fullCompactionThresholdRatio,
      DEFAULT_FULL_COMPACTION_THRESHOLD_RATIO
    ),
    maxBaselineCount: Math.max(2, readPositiveInteger(value?.maxBaselineCount, DEFAULT_MAX_BASELINE_COUNT)),
    maxBaselineRollupRatio: readRatio(value?.maxBaselineRollupRatio, DEFAULT_MAX_BASELINE_ROLLUP_RATIO),
    ...(options.configBaseDir ? { configBaseDir: options.configBaseDir } : {})
  };
}

export function buildRuntimeCompressionPolicy(
  config: Pick<
    NormalizedPluginConfig,
    'rawTailTurnCount' | 'fullCompactionThresholdRatio' | 'maxBaselineCount' | 'maxBaselineRollupRatio'
  >
): RuntimeCompressionPolicy {
  return {
    rawTailTurnCount: config.rawTailTurnCount,
    fullCompactionThresholdRatio: config.fullCompactionThresholdRatio,
    maxBaselineCount: config.maxBaselineCount,
    maxBaselineRollupRatio: config.maxBaselineRollupRatio
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
  engine: Pick<ContextEngine, 'compileContext' | 'explain' | 'getCompressionState'>,
  config: NormalizedPluginConfig
): Promise<{
  bundle: RuntimeContextBundle;
  summaryContract: ContextSummaryContract;
  bundleContract: BundleContractSnapshot;
  summary: string;
  promptPreview: string;
  selectionContext: NonNullable<ExplainRequest['selectionContext']>;
  recalledNodes: BundleRecalledNodeView[];
  compaction?: {
    mode: ContextCompressionMode;
    reason?: string;
    baselineId?: string;
    baselineIds?: string[];
    rawTailStartMessageId?: string;
    retainedRawTurnCount: number;
    retainedRawTurns: Array<{
      turnId: string;
      messageIds: string[];
    }>;
    diagnostics?: CompressionDiagnostics;
  };
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

  const compressionState = await engine.getCompressionState(selectionContext.sessionId);
  const bundle = withBundleMetadata(
    await engine.compileContext({
      sessionId: selectionContext.sessionId,
      ...(selectionContext.workspaceId ? { workspaceId: selectionContext.workspaceId } : {}),
      query: selectionContext.query ?? DEFAULT_INSPECT_BUNDLE_QUERY,
      tokenBudget: selectionContext.tokenBudget ?? resolveCompileBudget(undefined, config),
      ...(readOptionalString(params.goalLabel) ? { goalLabel: readOptionalString(params.goalLabel) } : {}),
      ...(readOptionalString(params.intentLabel) ? { intentLabel: readOptionalString(params.intentLabel) } : {})
    }),
    {
      compressionMode: compressionState?.compressionMode,
      baselineId: latestCompressionBaselineId(compressionState)
    }
  );
  const summaryContract = buildContextSummaryContract(bundle);
  const bundleContract = buildBundleContractSnapshot(bundle);
  const recalledNodes = collectBundleRecalledNodes(bundle);

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
    recalledNodes,
    ...(compressionState
      ? {
          compaction: buildCompressionCompactionPayload(compressionState, buildRuntimeCompressionPolicy(config))
        }
      : {}),
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

function withBundleMetadata(
  bundle: RuntimeContextBundle,
  options?: {
    compressionMode?: ContextCompressionMode;
    baselineId?: string;
  }
): RuntimeContextBundle {
  return {
    ...bundle,
    metadata: buildRuntimeContextBundleMetadata(bundle, options)
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
  recentRawTurnCount?: number;
  compressedCount: number;
  preservedConversationCount: number;
  compressionMode?: ContextCompressionMode;
  compressionReason?: string;
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
  promptAssemblySnapshot: OpenClawPromptAssemblySnapshot;
  compaction?: OpenClawRuntimeCompressionCompactionView;
  systemPromptAddition?: string;
  estimatedTokens?: number;
}> {
  const sessionId = readOptionalString(params.sessionId);

  if (!sessionId) {
    throw new Error('inspect_runtime_window requires a sessionId');
  }

  // 运行时真相源优先级固定为：
  // 1. assemble() 刚刚产出的 live runtime
  // 2. 持久化 runtime snapshot
  // 3. transcript/session file 回放结果
  // inspect 链路必须沿用这条顺序，避免把 transcript fallback 误当成当前轮最终真相。
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
  const compressionPolicy = buildRuntimeCompressionPolicy(config);
  const messageCompression = buildAssemblyCompressionPlan({
    sessionId,
    messages,
    totalBudget,
    compressionPolicy
  });
  const preferredMessages = buildPreferredRawTailMessages(messages, messageCompression.promptVisibleRawTailMessages);
  const finalMessages = trimMessagesToBudget(preferredMessages, totalBudget);

  return buildRuntimeWindowPayload('transcript_fallback', {
    sessionId,
    capturedAt: new Date().toISOString(),
    query: extractQueryText(messages),
    totalBudget,
    recentRawMessageCount: messageCompression.rawTailMessageCount,
    recentRawTurnCount: messageCompression.rawTailTurnCount,
    compressedCount: messageCompression.compressedCount,
    preservedConversationCount: messageCompression.preservedConversationCount,
    compressionMode: messageCompression.compressionMode,
    ...(messageCompression.compressionReason
      ? { compressionReason: messageCompression.compressionReason }
      : {}),
    inboundMessages: messages,
    preferredMessages,
    finalMessages,
    compressionPolicy,
    compaction: buildCompressionCompactionPayload(messageCompression.nextState, compressionPolicy),
    ...(messageCompression.nextState.compressionDiagnostics
      ? { compressionDiagnostics: cloneCompressionDiagnostics(messageCompression.nextState.compressionDiagnostics) }
      : {})
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
  promptAssemblySnapshot: OpenClawPromptAssemblySnapshot;
  compaction?: OpenClawRuntimeCompressionCompactionView;
  systemPromptAddition?: string;
  estimatedTokens?: number;
} {
  const window = buildRuntimeContextWindowContract(source, snapshot);
  const promptAssembly = buildPromptAssemblyContract(window, snapshot);
  const promptAssemblySnapshot =
    snapshot.promptAssemblySnapshot ??
    buildPromptAssemblySnapshot({
      inboundMessages: snapshot.inboundMessages,
      finalMessages: snapshot.finalMessages,
      systemPromptAddition: snapshot.systemPromptAddition,
      estimatedTokens: snapshot.estimatedTokens,
      compressionMode: snapshot.compressionMode,
      compressionReason: snapshot.compressionReason,
      compressionDiagnostics: snapshot.compressionDiagnostics,
      compressionPolicy: snapshot.compressionPolicy
    });

  return {
    source: window.source,
    sessionId: window.sessionId,
    query: window.query,
    ...(window.capturedAt ? { capturedAt: window.capturedAt } : {}),
    totalBudget: window.totalBudget,
    recentRawMessageCount: window.compression.recentRawMessageCount,
    ...(typeof window.compression.recentRawTurnCount === 'number'
      ? { recentRawTurnCount: window.compression.recentRawTurnCount }
      : {}),
    compressedCount: window.compression.compressedCount,
    preservedConversationCount: window.compression.preservedConversationCount,
    ...(window.compression.compressionMode ? { compressionMode: window.compression.compressionMode } : {}),
    ...(window.compression.compressionReason ? { compressionReason: window.compression.compressionReason } : {}),
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
    promptAssemblySnapshot,
    ...(snapshot.compaction ? { compaction: cloneRuntimeCompressionCompactionView(snapshot.compaction) } : {}),
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
      recentRawTurnCount: snapshot.recentRawTurnCount,
      compressedCount: snapshot.compressedCount,
      preservedConversationCount: snapshot.preservedConversationCount,
      compressionMode: snapshot.compressionMode,
      ...(snapshot.compressionReason ? { compressionReason: snapshot.compressionReason } : {}),
      ...(snapshot.compressionPolicy ? { policy: cloneRuntimeCompressionPolicy(snapshot.compressionPolicy) } : {})
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
  // Context engine 只返回 provider-neutral 的送模合同。
  // 真正的 provider-specific payload 仍由宿主负责组装。
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

function buildPromptAssemblySnapshot(options: {
  inboundMessages: AgentMessageLike[];
  finalMessages: AgentMessageLike[];
  systemPromptAddition?: string;
  estimatedTokens?: number;
  compressionMode?: ContextCompressionMode;
  compressionReason?: string;
  compressionDiagnostics?: CompressionDiagnostics;
  compressionPolicy?: RuntimeCompressionPolicy;
}): OpenClawPromptAssemblySnapshot {
  const toolCallResultPairs = buildToolCallResultPairs(options.inboundMessages, options.finalMessages);

  return {
    version: PROMPT_ASSEMBLY_SNAPSHOT_VERSION,
    messages: options.finalMessages.map((message) => cloneAgentMessage(message)),
    messageSummary: options.finalMessages.map((message, index) => summarizeRuntimeMessage(message, index)),
    ...(options.systemPromptAddition ? { systemPromptAddition: options.systemPromptAddition } : {}),
    ...(typeof options.estimatedTokens === 'number' ? { estimatedTokens: options.estimatedTokens } : {}),
    toolCallResultPairs,
    sidecarReferences: buildPromptAssemblySidecarReferences(options.finalMessages),
    compression: {
      ...(options.compressionMode ? { mode: options.compressionMode } : {}),
      ...(options.compressionReason ? { reason: options.compressionReason } : {}),
      ...(options.compressionDiagnostics
        ? { diagnostics: cloneCompressionDiagnostics(options.compressionDiagnostics) }
        : {}),
      ...(options.compressionPolicy ? { policy: cloneRuntimeCompressionPolicy(options.compressionPolicy) } : {})
    }
  };
}

function buildPromptAssemblySidecarReferences(messages: AgentMessageLike[]) {
  return messages.flatMap((message) => {
    const compressed = readCompressedToolResultContent(message.content);

    if (!compressed) {
      return [];
    }

    const artifact = compressed.artifact;

    if (!artifact?.path) {
      return [];
    }

    return [
      {
        ...(typeof message.id === 'string' ? { messageId: message.id } : {}),
        ...(typeof compressed.toolCallId === 'string' ? { toolCallId: compressed.toolCallId } : {}),
        ...(typeof compressed.toolName === 'string' ? { toolName: compressed.toolName } : {}),
        summary: compressed.summary,
        ...(typeof compressed.status === 'string' ? { status: compressed.status } : {}),
        ...(typeof compressed.resultKind === 'string' ? { resultKind: compressed.resultKind } : {}),
        ...(artifact?.path ? { artifactPath: artifact.path } : {}),
        ...(artifact?.sourcePath ? { sourcePath: artifact.sourcePath } : {}),
        ...(artifact?.sourceUrl ? { sourceUrl: artifact.sourceUrl } : {}),
        ...(artifact?.contentHash ? { contentHash: artifact.contentHash } : {}),
        droppedSections: [...compressed.truncation.droppedSections]
      }
    ];
  });
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

  const compressedToolResult = normalizeRole(message.role) === 'tool' ? readCompressedToolResultContent(message.content) : undefined;
  const previewSource = compressedToolResult
    ? summarizeToolResultMessageContent(message.content) ?? stringifyMessageContent(message.content)
    : stringifyMessageContent(message.content);
  const preview = previewSource.replace(/\s+/g, ' ').trim();
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
    ...(toolCallId ? { toolCallId } : {}),
    ...(compressedToolResult
      ? {
          toolResultCompression: {
            compressed: true,
            summary: compressedToolResult.summary,
            ...(compressedToolResult.status ? { status: compressedToolResult.status } : {}),
            ...(compressedToolResult.resultKind ? { resultKind: compressedToolResult.resultKind } : {}),
            ...(compressedToolResult.artifact?.path ? { artifactPath: compressedToolResult.artifact.path } : {}),
            ...(compressedToolResult.artifact?.sourcePath ? { sourcePath: compressedToolResult.artifact.sourcePath } : {}),
            ...(compressedToolResult.artifact?.sourceUrl ? { sourceUrl: compressedToolResult.artifact.sourceUrl } : {}),
            droppedSections: [...compressedToolResult.truncation.droppedSections]
          }
        }
      : {})
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

function buildLiveFallbackMessages(messages: AgentMessageLike[], budget: number): AgentMessageLike[] {
  const trimmed = trimMessagesToBudget(messages, budget);

  if (!shouldFallbackToLiveRecentMessages(messages, trimmed)) {
    return trimmed;
  }

  const latestConversationMessage = [...messages].reverse().find((message) => normalizeRole(message.role) !== 'system');
  return latestConversationMessage ? [latestConversationMessage] : trimmed;
}

function shouldFallbackToLiveRecentMessages(
  inboundMessages: readonly AgentMessageLike[],
  assembledMessages: readonly AgentMessageLike[]
): boolean {
  return countConversationMessages(inboundMessages) > 0 && countConversationMessages(assembledMessages) === 0;
}

function applyCompressionFallbackLevel(
  state: SessionCompressionState,
  fallbackLevel: 'live_recent_messages'
): SessionCompressionState {
  return {
    ...state,
    compressionDiagnostics: {
      ...(state.compressionDiagnostics ?? {}),
      fallbackLevel
    }
  };
}

function countConversationTurns(sessionId: string, messages: readonly AgentMessageLike[]): number {
  return buildConversationTurns(resolveConversationMessages(sessionId, [...messages])).length;
}

function buildAssemblyCompressionPlan(options: {
  sessionId: string;
  messages: AgentMessageLike[];
  totalBudget: number;
  previousState?: SessionCompressionState;
  compressionPolicy: RuntimeCompressionPolicy;
}): AssemblyCompressionPlan {
  const conversationMessages = resolveConversationMessages(options.sessionId, options.messages);
  // 第一版 recent raw tail 默认固定为最近 2 个对话 turn block，
  // 现在允许通过 compressionPolicy.rawTailTurnCount 做最小调参。
  // - turn block 由 user 起始，并连带后续 assistant / toolResult
  // - system message 不进入 rawTail state，而是在 buildPreferredRawTailMessages() 里单独保留
  // 这样可以同时保证：
  // 1. 最近关键 tool result 不会和所属 user / assistant 被拆开
  // 2. system 指令不和 baseline / incremental / rawTail 三层混在一起
  const rawTailTurns = buildConversationTurns(conversationMessages).slice(
    -Math.max(1, options.compressionPolicy.rawTailTurnCount)
  );
  const rawTailMessages = rawTailTurns.flatMap((turn) => turn.messages);
  const promptVisibleRawTailMessages = rawTailMessages.map((message) => normalizePromptVisibleRawTailMessage(message));
  const rawTailMessageIds = new Set(rawTailTurns.flatMap((turn) => turn.messageIds));
  const rawTailStartMessageId = rawTailTurns[0]?.messageIds[0];
  const rawTailStartIndex = rawTailStartMessageId
    ? findConversationMessageIndex(conversationMessages, rawTailStartMessageId)
    : conversationMessages.length;
  const baselineStartIndex = resolveBaselineStartIndex(conversationMessages, options.previousState);
  const incrementalStartIndex = Math.min(baselineStartIndex, rawTailStartIndex);
  const incrementalMessages = conversationMessages.slice(incrementalStartIndex, rawTailStartIndex);
  const now = new Date().toISOString();
  const incrementalBlock = buildIncrementalState({
    messages: incrementalMessages,
    now
  });
  const fullCompaction = shouldTriggerFullCompaction({
    conversationMessages,
    totalBudget: options.totalBudget,
    baselineStartIndex,
    rawTailStartIndex,
    thresholdRatio: options.compressionPolicy.fullCompactionThresholdRatio
  });
  const conversationOnlyTokens = estimateMessagesTokens(conversationMessages.map((message) => message.message));
  const totalConversationCount = conversationMessages.length;
  const compressedCount = Math.max(totalConversationCount - rawTailMessages.length, 0);
  const sidecarReferenceCount = countCompressedToolResultArtifactReferences(promptVisibleRawTailMessages);
  const rawTailTokenEstimate = estimateMessagesTokens(promptVisibleRawTailMessages);
  const occupancyRatioBefore = normalizeCompressionRatio(conversationOnlyTokens, options.totalBudget);
  const previousBaselines = getCompressionBaselines(options.previousState);
  const appendedBaseline = fullCompaction
    ? buildNextBaselineState({
        sessionId: options.sessionId,
        previousState: options.previousState,
        messages: incrementalMessages,
        now
      })
    : undefined;
  const baselineRollup = fullCompaction
    ? rollupBaselineBlocks({
        sessionId: options.sessionId,
        previousBaselines,
        appendedBaseline,
        totalBudget: options.totalBudget,
        now,
        baselineVersionSeed: options.previousState?.baselineVersion ?? 0,
        occupancyRatioBefore,
        sealedIncrementalId: buildCompressionIncrementalBlockId(options.sessionId, incrementalBlock),
        incrementalTokenEstimate: incrementalBlock?.summary.tokenEstimate ?? 0,
        maxBaselineCount: options.compressionPolicy.maxBaselineCount,
        maxBaselineRollupRatio: options.compressionPolicy.maxBaselineRollupRatio
      })
    : previousBaselines.length > 0
      ? {
          baselines: previousBaselines.map((baseline) => cloneCompressionBaselineState(baseline))
        }
      : {};
  const nextBaselines = baselineRollup.baselines;
  const latestBaseline = nextBaselines?.[nextBaselines.length - 1];
  const nextIncremental =
    !fullCompaction && incrementalBlock
      ? incrementalBlock
      : undefined;
  const baselineTokenEstimate = nextBaselines?.reduce((sum, baseline) => sum + baseline.summary.tokenEstimate, 0) ?? 0;
  const occupancyRatioAfter = normalizeCompressionRatio(
    baselineTokenEstimate + (nextIncremental?.summary.tokenEstimate ?? 0) + rawTailTokenEstimate,
    options.totalBudget
  );
  const compressionDiagnostics =
    fullCompaction || nextIncremental
      ? {
          occupancyRatioBefore,
          occupancyRatioAfter,
          ...(fullCompaction
            ? {
                sealedIncrementalId: buildCompressionIncrementalBlockId(options.sessionId, incrementalBlock)
              }
            : {}),
          rawTailTokenEstimate,
          incrementalTokenEstimate: incrementalBlock?.summary.tokenEstimate ?? 0,
          baselineTokenEstimate,
          baselineCount: nextBaselines?.length ?? 0,
          sidecarReferenceCount,
          fallbackLevel: 'none' as const,
          ...cloneCompressionDiagnostics(baselineRollup.diagnostics)
        }
      : undefined;
  const nextStateDraft: SessionCompressionState = {
    id: '',
    sessionId: options.sessionId,
    compressionMode: fullCompaction ? 'full' : nextIncremental ? 'incremental' : 'none',
    ...(nextBaselines ? { baselines: nextBaselines } : {}),
    ...(nextIncremental ? { incremental: nextIncremental } : {}),
    rawTail: {
      turnCount: rawTailTurns.length,
      turns: rawTailTurns.map((turn) => ({
        turnId: turn.turnId,
        messageIds: [...turn.messageIds]
      })),
      derivedFrom: [...rawTailMessageIds],
      createdAt: now
    },
    ...(latestBaseline ? { baselineCoveredUntilMessageId: lastMessageId(latestBaseline.derivedFrom) } : {}),
    ...(nextIncremental ? { incrementalCoveredUntilMessageId: lastMessageId(nextIncremental.derivedFrom) } : {}),
    ...(rawTailStartMessageId ? { rawTailStartMessageId } : {}),
    baselineVersion: latestBaseline?.baselineVersion ?? 0,
    ...(compressionDiagnostics ? { compressionDiagnostics } : {}),
    derivedFrom: conversationMessages.map((message) => message.id),
    createdAt: options.previousState?.createdAt ?? now,
    updatedAt: now
  };

  assertCompressionStateInvariants(nextStateDraft);

  const nextState = areCompressionStatesEquivalent(options.previousState, nextStateDraft)
    ? options.previousState
    : {
        ...nextStateDraft,
        id: buildCompressionStateId(nextStateDraft)
      };

  if (!nextState) {
    throw new Error('failed to build compression state');
  }

  return {
    nextState,
    rawTailMessages,
    promptVisibleRawTailMessages,
    rawTailTurnCount: rawTailTurns.length,
    rawTailMessageCount: rawTailMessages.length,
    compressedCount,
    preservedConversationCount: rawTailMessages.length,
    compressionMode: nextState.compressionMode,
    compressionReason: resolveCompressionReason(nextState.compressionMode)
  };
}

function buildPreferredRawTailMessages(
  messages: AgentMessageLike[],
  rawTailMessages: AgentMessageLike[]
): AgentMessageLike[] {
  // system message 当前不纳入 rawTail 的持久化边界；它们始终作为宿主系统层输入保留，
  // recent raw tail 只负责最近 2 个 conversation turn block（user / assistant / tool）。
  const systemMessages = messages.filter((message) => normalizeRole(message.role) === 'system');
  return systemMessages.concat(rawTailMessages);
}

function normalizePromptVisibleRawTailMessage(message: AgentMessageLike): AgentMessageLike {
  if (normalizeRole(message.role) !== 'tool') {
    return message;
  }

  const decision = applyToolResultPolicy(message);

  if (!decision.changed) {
    return message;
  }

  // 这里的压缩只作用于 prompt-visible rawTail，不改写宿主原始 turn 结构和消息角色。
  return {
    ...decision.message,
    role: message.role
  };
}

function resolveConversationMessages(
  sessionId: string,
  messages: AgentMessageLike[]
): ResolvedConversationMessage[] {
  return messages
    .map((message, originalIndex) => ({
      id: resolveMessageId(sessionId, message, originalIndex),
      role: normalizeRole(message.role),
      message,
      originalIndex
    }))
    .filter((message) => message.role !== 'system');
}

function buildConversationTurns(messages: ResolvedConversationMessage[]): ConversationTurnBlock[] {
  if (messages.length === 0) {
    return [];
  }

  const turns: ConversationTurnBlock[] = [];
  let currentTurn: ResolvedConversationMessage[] = [];

  for (const message of messages) {
    // 一个 turn block 从 user 开始，到下一个 user 之前结束；
    // assistant 与 toolResult 会和所属 user 保持在同一个 raw tail 块里，避免只保留 tool result
    // 或只保留 assistant 而打断最近原文窗口的语义连续性。
    if (message.role === 'user' && currentTurn.length > 0) {
      turns.push(materializeConversationTurn(currentTurn));
      currentTurn = [];
    }

    currentTurn.push(message);
  }

  if (currentTurn.length > 0) {
    turns.push(materializeConversationTurn(currentTurn));
  }

  return turns;
}

function materializeConversationTurn(messages: ResolvedConversationMessage[]): ConversationTurnBlock {
  return {
    turnId: `turn:${messages[0]?.id ?? 'unknown'}`,
    messageIds: messages.map((message) => message.id),
    messages: messages.map((message) => message.message)
  };
}

function resolveBaselineStartIndex(
  messages: ResolvedConversationMessage[],
  previousState?: SessionCompressionState
): number {
  if (!previousState?.baselineCoveredUntilMessageId) {
    return 0;
  }

  const boundaryIndex = findConversationMessageIndex(messages, previousState.baselineCoveredUntilMessageId);
  return boundaryIndex >= 0 ? boundaryIndex + 1 : 0;
}

function findConversationMessageIndex(
  messages: ResolvedConversationMessage[],
  messageId: string
): number {
  return messages.findIndex((message) => message.id === messageId);
}

function shouldTriggerFullCompaction(options: {
  conversationMessages: ResolvedConversationMessage[];
  totalBudget: number;
  baselineStartIndex: number;
  rawTailStartIndex: number;
  thresholdRatio: number;
}): boolean {
  if (options.rawTailStartIndex <= options.baselineStartIndex || options.totalBudget <= 0) {
    return false;
  }

  const conversationOnlyTokens = estimateMessagesTokens(options.conversationMessages.map((message) => message.message));
  return conversationOnlyTokens / options.totalBudget > options.thresholdRatio;
}

function buildNextBaselineState(options: {
  sessionId: string;
  previousState?: SessionCompressionState;
  messages: ResolvedConversationMessage[];
  now: string;
}): SessionCompressionBaselineState | undefined {
  if (options.messages.length === 0) {
    return undefined;
  }

  const summary = buildCompressionSummaryBlock('baseline', options.messages);
  const previousBaseline = getLatestCompressionBaseline(options.previousState);
  const previousMatches =
    previousBaseline?.summary.summaryText === summary.summaryText &&
    lastMessageId(previousBaseline.derivedFrom) === lastMessageId(options.messages.map((message) => message.id));
  const baselineVersion = previousMatches
    ? previousBaseline.baselineVersion
    : Math.max(options.previousState?.baselineVersion ?? 0, 0) + 1;

  return previousMatches
    ? previousBaseline
    : {
        baselineId: hashId(
          options.sessionId,
          'baseline',
          String(baselineVersion),
          lastMessageId(options.messages.map((message) => message.id)) ?? 'empty',
          summary.summaryText
        ),
        baselineVersion,
        generation: 0,
        summary,
        derivedFrom: options.messages.map((message) => message.id),
        createdAt: options.now
      };
}

function buildIncrementalState(options: {
  messages: ResolvedConversationMessage[];
  now: string;
}): SessionCompressionState['incremental'] | undefined {
  if (options.messages.length === 0) {
    return undefined;
  }

  return {
    summary: buildCompressionSummaryBlock('incremental', options.messages),
    derivedFrom: options.messages.map((message) => message.id),
    createdAt: options.now
  };
}

function buildCompressionIncrementalBlockId(
  sessionId: string,
  incremental: SessionCompressionState['incremental'] | undefined
): string | undefined {
  if (!incremental) {
    return undefined;
  }

  return hashId(
    sessionId,
    'incremental',
    lastMessageId(incremental.derivedFrom) ?? 'empty',
    incremental.summary.summaryText
  );
}

function buildCompressionSummaryBlock(
  label: 'baseline' | 'incremental',
  messages: ResolvedConversationMessage[]
): SessionCompressionBaselineState['summary'] {
  const previewLines = messages
    .slice(-MAX_COMPRESSION_SUMMARY_LINES)
    .map((message) => `${formatMessageRoleLabel(message.role)}: ${truncateText(messagePreview(message.message), 120)}`);
  const omittedCount = Math.max(messages.length - previewLines.length, 0);
  const summaryText = [
    `[${label === 'baseline' ? 'Conversation Baseline' : 'Recent Incremental Compression'}]`,
    `覆盖消息数: ${messages.length}`,
    omittedCount > 0 ? `更早消息已折叠: ${omittedCount}` : undefined,
    ...previewLines
  ]
    .filter(isPresent)
    .join('\n');
  const compactText = truncateText(summaryText, MAX_COMPRESSION_SUMMARY_CHARS);

  return {
    summaryText: compactText,
    tokenEstimate: estimateTextTokens(compactText)
  };
}

function appendBaselineBlock(
  baselines: readonly SessionCompressionBaselineState[],
  baseline: SessionCompressionBaselineState | undefined
): SessionCompressionBaselineState[] | undefined {
  if (!baseline) {
    return baselines.length > 0 ? baselines.map((item) => cloneCompressionBaselineState(item)) : undefined;
  }

  return baselines.map((item) => cloneCompressionBaselineState(item)).concat(cloneCompressionBaselineState(baseline));
}

function rollupBaselineBlocks(options: {
  sessionId: string;
  previousBaselines: readonly SessionCompressionBaselineState[];
  appendedBaseline: SessionCompressionBaselineState | undefined;
  totalBudget: number;
  now: string;
  baselineVersionSeed: number;
  occupancyRatioBefore?: number;
  sealedIncrementalId?: string;
  incrementalTokenEstimate: number;
  maxBaselineCount: number;
  maxBaselineRollupRatio: number;
}): BaselineRollupResult {
  let workingBaselines = appendBaselineBlock(options.previousBaselines, options.appendedBaseline) ?? [];
  let currentBaselineVersion = Math.max(
    options.baselineVersionSeed,
    ...workingBaselines.map((baseline) => baseline.baselineVersion)
  );
  const diagnostics: CompressionDiagnostics = {
    trigger: 'occupancy',
    ...(typeof options.occupancyRatioBefore === 'number' ? { occupancyRatioBefore: options.occupancyRatioBefore } : {}),
    ...(options.sealedIncrementalId ? { sealedIncrementalId: options.sealedIncrementalId } : {}),
    ...(options.appendedBaseline ? { appendedBaselineId: options.appendedBaseline.baselineId } : {}),
    incrementalTokenEstimate: options.incrementalTokenEstimate,
    baselineCount: workingBaselines.length,
    baselineTokenEstimate: workingBaselines.reduce((sum, baseline) => sum + baseline.summary.tokenEstimate, 0),
    fallbackLevel: 'none'
  };

  while (workingBaselines.length > options.maxBaselineCount) {
    if (workingBaselines.length < 2) {
      break;
    }

    const attempt = tryMergeOldestBaselineHalf({
      sessionId: options.sessionId,
      baselines: workingBaselines,
      totalBudget: options.totalBudget,
      now: options.now,
      nextBaselineVersion: currentBaselineVersion + 1,
      maxBaselineRollupRatio: options.maxBaselineRollupRatio
    });

    if (attempt.accepted) {
      workingBaselines = attempt.baselines;
      currentBaselineVersion = Math.max(currentBaselineVersion, attempt.mergedBaseline.baselineVersion);
      diagnostics.trigger = 'baseline_rollup';
      diagnostics.mergedBaselineIds = [...attempt.sourceBaselineIds];
      diagnostics.mergedBaselineResultId = attempt.mergedBaseline.baselineId;
      diagnostics.baselineCount = workingBaselines.length;
      diagnostics.baselineTokenEstimate = workingBaselines.reduce((sum, baseline) => sum + baseline.summary.tokenEstimate, 0);
      continue;
    }

    diagnostics.rollback = true;
    diagnostics.mergedBaselineIds = [...attempt.sourceBaselineIds];
    workingBaselines = evictOldestBaselineFromPromptHistory(workingBaselines);
    diagnostics.evictedBaselineId = attempt.sourceBaselineIds[0];
    diagnostics.baselineCount = workingBaselines.length;
    diagnostics.baselineTokenEstimate = workingBaselines.reduce((sum, baseline) => sum + baseline.summary.tokenEstimate, 0);
    break;
  }

  return {
    ...(workingBaselines.length > 0 ? { baselines: workingBaselines } : {}),
    diagnostics
  };
}

function countCompressedToolResultArtifactReferences(messages: readonly AgentMessageLike[]): number {
  return messages.reduce((count, message) => {
    if (normalizeRole(message.role) !== 'tool') {
      return count;
    }

    const compressed = readCompressedToolResultContent(message.content);

    return compressed?.artifact ? count + 1 : count;
  }, 0);
}

function normalizeCompressionRatio(used: number, total: number): number | undefined {
  if (total <= 0) {
    return undefined;
  }

  return used / total;
}

function cloneCompressionDiagnostics(
  diagnostics: CompressionDiagnostics | undefined
): CompressionDiagnostics | undefined {
  if (!diagnostics) {
    return undefined;
  }

  return {
    ...diagnostics,
    ...(diagnostics.mergedBaselineIds ? { mergedBaselineIds: [...diagnostics.mergedBaselineIds] } : {})
  };
}

function cloneRuntimeCompressionPolicy(
  policy: RuntimeCompressionPolicy | undefined
): RuntimeCompressionPolicy | undefined {
  if (!policy) {
    return undefined;
  }

  return {
    rawTailTurnCount: policy.rawTailTurnCount,
    fullCompactionThresholdRatio: policy.fullCompactionThresholdRatio,
    maxBaselineCount: policy.maxBaselineCount,
    maxBaselineRollupRatio: policy.maxBaselineRollupRatio
  };
}

function cloneRuntimeCompressionCompactionView(
  compaction: OpenClawRuntimeCompressionCompactionView | undefined
): OpenClawRuntimeCompressionCompactionView | undefined {
  if (!compaction) {
    return undefined;
  }

  return {
    ...compaction,
    ...(compaction.baselineIds ? { baselineIds: [...compaction.baselineIds] } : {}),
    retainedRawTurns: compaction.retainedRawTurns.map((turn) => ({
      turnId: turn.turnId,
      messageIds: [...turn.messageIds]
    })),
    ...(compaction.diagnostics ? { diagnostics: cloneCompressionDiagnostics(compaction.diagnostics) } : {}),
    ...(compaction.policy ? { policy: cloneRuntimeCompressionPolicy(compaction.policy) } : {})
  };
}

function cloneAgentMessage(message: AgentMessageLike): AgentMessageLike {
  return structuredClone(message);
}

function tryMergeOldestBaselineHalf(options: {
  sessionId: string;
  baselines: readonly SessionCompressionBaselineState[];
  totalBudget: number;
  now: string;
  nextBaselineVersion: number;
  maxBaselineRollupRatio: number;
}):
  | {
      accepted: true;
      baselines: SessionCompressionBaselineState[];
      sourceBaselineIds: string[];
      mergedBaseline: SessionCompressionBaselineState;
    }
  | {
      accepted: false;
      sourceBaselineIds: string[];
    } {
  const mergeCount = Math.max(2, Math.floor(options.baselines.length / 2));
  const sourceBaselines = options.baselines.slice(0, mergeCount);
  const remainingBaselines = options.baselines.slice(mergeCount).map((baseline) => cloneCompressionBaselineState(baseline));
  const mergedBaseline = buildMergedBaselineState({
    sessionId: options.sessionId,
    baselines: sourceBaselines,
    now: options.now,
    baselineVersion: options.nextBaselineVersion
  });

  if (mergedBaseline.summary.tokenEstimate > options.totalBudget * options.maxBaselineRollupRatio) {
    return {
      accepted: false,
      sourceBaselineIds: sourceBaselines.map((baseline) => baseline.baselineId)
    };
  }

  return {
    accepted: true,
    baselines: [mergedBaseline].concat(remainingBaselines),
    sourceBaselineIds: sourceBaselines.map((baseline) => baseline.baselineId),
    mergedBaseline
  };
}

function buildMergedBaselineState(options: {
  sessionId: string;
  baselines: readonly SessionCompressionBaselineState[];
  now: string;
  baselineVersion: number;
}): SessionCompressionBaselineState {
  const generation = Math.max(0, ...options.baselines.map((baseline) => baseline.generation ?? 0)) + 1;
  const sourceBaselineIds = options.baselines.map((baseline) => baseline.baselineId);
  const previewLines = options.baselines.slice(-MAX_COMPRESSION_SUMMARY_LINES).map((baseline) => {
    const sourceHints = [baseline.summary.sourceCheckpointId, baseline.summary.sourceBundleId]
      .filter(isPresent)
      .join(' | ');
    return [
      `v${baseline.baselineVersion}/g${baseline.generation ?? 0}`,
      sourceHints ? `[${sourceHints}]` : undefined,
      truncateText(baseline.summary.summaryText.replace(/\s+/g, ' '), 120)
    ]
      .filter(isPresent)
      .join(' ');
  });
  const summaryText = truncateText(
    [
      '[Conversation Baseline Rollup]',
      `合并 baseline 数: ${options.baselines.length}`,
      `来源 baseline: ${sourceBaselineIds.join(', ')}`,
      ...previewLines
    ].join('\n'),
    MAX_COMPRESSION_SUMMARY_CHARS
  );

  return {
    baselineId: hashId(
      options.sessionId,
      'baseline_rollup',
      String(options.baselineVersion),
      sourceBaselineIds.join('|'),
      summaryText
    ),
    baselineVersion: options.baselineVersion,
    generation,
    sourceBaselineIds,
    summary: {
      summaryText,
      tokenEstimate: estimateTextTokens(summaryText),
      ...(options.baselines[options.baselines.length - 1]?.summary.sourceBundleId
        ? { sourceBundleId: options.baselines[options.baselines.length - 1]?.summary.sourceBundleId }
        : {}),
      ...(options.baselines[options.baselines.length - 1]?.summary.sourceCheckpointId
        ? { sourceCheckpointId: options.baselines[options.baselines.length - 1]?.summary.sourceCheckpointId }
        : {})
    },
    derivedFrom: Array.from(new Set(options.baselines.flatMap((baseline) => baseline.derivedFrom))),
    createdAt: options.now
  };
}

function evictOldestBaselineFromPromptHistory(
  baselines: readonly SessionCompressionBaselineState[]
): SessionCompressionBaselineState[] {
  return baselines.slice(1).map((baseline) => cloneCompressionBaselineState(baseline));
}

function formatCompressionStateForPrompt(state: SessionCompressionState): string | undefined {
  const baselines = getCompressionBaselines(state);

  if (baselines.length === 0 && !state.incremental) {
    return undefined;
  }

  return [
    '[Conversation Compression State]',
    `Mode: ${state.compressionMode}`,
    ...(baselines.length === 1
      ? [`Baseline v${baselines[0]?.baselineVersion}:\n${baselines[0]?.summary.summaryText}`]
      : baselines.map(
          (baseline, index) => `Baseline ${index + 1} v${baseline.baselineVersion}:\n${baseline.summary.summaryText}`
        )),
    state.incremental ? `Incremental:\n${state.incremental.summary.summaryText}` : undefined,
    `Recent raw tail turns: ${state.rawTail.turnCount}`
  ]
    .filter(isPresent)
    .join('\n');
}

function buildCompressionCompactionPayload(
  state: SessionCompressionState,
  compressionPolicy?: RuntimeCompressionPolicy
): {
  mode: ContextCompressionMode;
  reason?: string;
  baselineId?: string;
  baselineIds?: string[];
  rawTailStartMessageId?: string;
  retainedRawTurnCount: number;
  retainedRawTurns: Array<{
    turnId: string;
    messageIds: string[];
  }>;
  diagnostics?: CompressionDiagnostics;
  policy?: RuntimeCompressionPolicy;
} {
  const baselineIds = getCompressionBaselines(state).map((baseline) => baseline.baselineId);

  return {
    mode: state.compressionMode,
    ...(resolveCompressionReason(state.compressionMode)
      ? { reason: resolveCompressionReason(state.compressionMode) }
      : {}),
    ...(baselineIds.length > 0 ? { baselineId: baselineIds[baselineIds.length - 1], baselineIds } : {}),
    ...(state.rawTailStartMessageId ? { rawTailStartMessageId: state.rawTailStartMessageId } : {}),
    retainedRawTurnCount: state.rawTail.turnCount,
    retainedRawTurns: state.rawTail.turns.map((turn) => ({
      turnId: turn.turnId,
      messageIds: [...turn.messageIds]
    })),
    ...(state.compressionDiagnostics ? { diagnostics: cloneCompressionDiagnostics(state.compressionDiagnostics) } : {}),
    ...(compressionPolicy ? { policy: cloneRuntimeCompressionPolicy(compressionPolicy) } : {})
  };
}

function joinPromptSections(sections: Array<string | undefined>): string {
  return sections
    .map((section) => section?.trim())
    .filter((section): section is string => Boolean(section))
    .join('\n\n')
    .trim();
}

function resolveCompressionReason(mode: ContextCompressionMode): string | undefined {
  if (mode === 'full') {
    return 'budget_over_50_percent';
  }

  if (mode === 'incremental') {
    return 'history_before_recent_raw_tail';
  }

  return 'within_recent_raw_tail_window';
}

function resolveMessageId(sessionId: string, message: AgentMessageLike, originalIndex: number): string {
  const explicitId = readOptionalString(message.id);

  if (explicitId) {
    return explicitId;
  }

  return hashId(
    sessionId,
    'message',
    String(originalIndex),
    normalizeRole(message.role),
    readOptionalString(message.timestamp) ?? '',
    messagePreview(message)
  );
}

function messagePreview(message: AgentMessageLike): string {
  return stringifyMessageContent(message.content) || JSON.stringify(message);
}

function formatMessageRoleLabel(role: Exclude<RawContextRecord['role'], undefined>): string {
  switch (role) {
    case 'assistant':
      return 'Assistant';
    case 'tool':
      return 'Tool';
    case 'system':
      return 'System';
    case 'user':
    default:
      return 'User';
  }
}

function buildCompressionStateId(state: SessionCompressionState): string {
  const baselineIds = getCompressionBaselines(state).map((baseline) => baseline.baselineId).join('|');

  return hashId(
    state.sessionId,
    'compression_state',
    state.compressionMode,
    baselineIds || 'no-baseline',
    state.incremental?.summary.summaryText ?? 'no-incremental',
    state.rawTail.turns.map((turn) => turn.turnId).join('|'),
    state.rawTailStartMessageId ?? 'no-raw-tail-start'
  );
}

function areCompressionStatesEquivalent(
  left: SessionCompressionState | undefined,
  right: SessionCompressionState | undefined
): boolean {
  if (!left || !right) {
    return left === right;
  }

  return JSON.stringify(normalizeCompressionStateForComparison(left)) === JSON.stringify(normalizeCompressionStateForComparison(right));
}

function normalizeCompressionStateForComparison(state: SessionCompressionState) {
  return {
    sessionId: state.sessionId,
    compressionMode: state.compressionMode,
    baselines: getCompressionBaselines(state).map((baseline) => ({
      baselineId: baseline.baselineId,
      baselineVersion: baseline.baselineVersion,
      generation: baseline.generation,
      sourceBaselineIds: baseline.sourceBaselineIds ? [...baseline.sourceBaselineIds] : undefined,
      summary: baseline.summary,
      derivedFrom: baseline.derivedFrom
    })),
    incremental: state.incremental
      ? {
          summary: state.incremental.summary,
          derivedFrom: state.incremental.derivedFrom
        }
      : undefined,
    rawTail: {
      turnCount: state.rawTail.turnCount,
      turns: state.rawTail.turns,
      derivedFrom: state.rawTail.derivedFrom
    },
    baselineCoveredUntilMessageId: state.baselineCoveredUntilMessageId,
    incrementalCoveredUntilMessageId: state.incrementalCoveredUntilMessageId,
    rawTailStartMessageId: state.rawTailStartMessageId,
    baselineVersion: state.baselineVersion,
    compressionDiagnostics: state.compressionDiagnostics,
    derivedFrom: state.derivedFrom
  };
}

function assertCompressionStateInvariants(state: SessionCompressionState): void {
  const baselineDerivedFrom = getCompressionBaselines(state).flatMap((baseline) => baseline.derivedFrom);
  const baselineIds = new Set(baselineDerivedFrom);
  const incrementalIds = new Set(state.incremental?.derivedFrom ?? []);
  const rawTailIds = new Set(state.rawTail.turns.flatMap((turn) => turn.messageIds));

  if (baselineIds.size !== baselineDerivedFrom.length) {
    throw new Error('compression state overlap detected inside baseline list');
  }

  if (hasSetOverlap(baselineIds, incrementalIds) || hasSetOverlap(baselineIds, rawTailIds) || hasSetOverlap(incrementalIds, rawTailIds)) {
    throw new Error('compression state overlap detected between baseline, incremental, and rawTail');
  }

  if (state.compressionMode === 'full' && state.incremental) {
    throw new Error('full compression state must not retain an incremental block');
  }
}

function hasSetOverlap(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }

  return false;
}

function lastMessageId(messageIds: readonly string[]): string | undefined {
  return messageIds.length > 0 ? messageIds[messageIds.length - 1] : undefined;
}

function getCompressionBaselines(state?: SessionCompressionState): SessionCompressionBaselineState[] {
  if (!state) {
    return [];
  }

  if (state.baselines && state.baselines.length > 0) {
    return state.baselines;
  }

  const legacyBaseline = readLegacyCompressionBaseline(state);
  return legacyBaseline ? [legacyBaseline] : [];
}

function getLatestCompressionBaseline(state?: SessionCompressionState): SessionCompressionBaselineState | undefined {
  const baselines = getCompressionBaselines(state);
  return baselines.length > 0 ? baselines[baselines.length - 1] : undefined;
}

function latestCompressionBaselineId(state?: SessionCompressionState): string | undefined {
  return getLatestCompressionBaseline(state)?.baselineId;
}

function cloneCompressionBaselineState(baseline: SessionCompressionBaselineState): SessionCompressionBaselineState {
  return {
    baselineId: baseline.baselineId,
    baselineVersion: baseline.baselineVersion,
    ...(typeof baseline.generation === 'number' ? { generation: baseline.generation } : {}),
    ...(baseline.sourceBaselineIds ? { sourceBaselineIds: [...baseline.sourceBaselineIds] } : {}),
    summary: {
      ...baseline.summary
    },
    derivedFrom: [...baseline.derivedFrom],
    createdAt: baseline.createdAt
  };
}

function readLegacyCompressionBaseline(state: SessionCompressionState): SessionCompressionBaselineState | undefined {
  const legacyState = state as SessionCompressionState & {
    baseline?: SessionCompressionBaselineState;
  };
  return legacyState.baseline;
}

function countConversationMessages(messages: readonly AgentMessageLike[]): number {
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
    baseDir?: string;
    stateDir?: string;
    resolvePath?: (input: string) => string;
  }
): string {
  if (isAbsolute(configuredPath)) {
    return configuredPath;
  }

  if (options.baseDir) {
    return resolve(options.baseDir, configuredPath);
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

export async function syncDerivedArtifactsForBundle(params: {
  engine: ContextEngine;
  sessionId: string;
  bundle: RuntimeContextBundle;
  latestCheckpoint?: SessionCheckpoint;
  triggerSource: DerivedArtifactTriggerSource;
  triggerCompressionMode?: ContextCompressionMode;
  forcePersist?: boolean;
  reason: string;
}): Promise<DerivedArtifactSyncResult> {
  const shouldPersist = params.forcePersist || shouldPersistBundleAsCheckpoint(params.bundle, params.latestCheckpoint);

  if (!shouldPersist) {
    return {
      persisted: false,
      reason: params.reason
    };
  }

  const checkpointResult = await params.engine.createCheckpoint({
    sessionId: params.sessionId,
    bundle: params.bundle,
    previousCheckpoint: params.latestCheckpoint,
    triggerSource: params.triggerSource,
    ...(params.triggerCompressionMode ? { triggerCompressionMode: params.triggerCompressionMode } : {})
  });
  const skillResult = await params.engine.crystallizeSkills({
    sessionId: params.sessionId,
    bundle: params.bundle,
    checkpointId: checkpointResult.checkpoint.id,
    triggerSource: params.triggerSource,
    ...(params.triggerCompressionMode ? { triggerCompressionMode: params.triggerCompressionMode } : {})
  });

  return {
    persisted: true,
    reason: params.reason,
    checkpointId: checkpointResult.checkpoint.id,
    deltaId: checkpointResult.delta.id,
    candidateCount: skillResult.candidates.length
  };
}

function resolveAssembleArtifactSyncReason(mode: ContextCompressionMode): string {
  if (mode === 'full') {
    return 'assemble_full_compaction';
  }

  if (mode === 'incremental') {
    return 'assemble_incremental_update';
  }

  return 'assemble_without_compression';
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

function collectBundleSelections(bundle: RuntimeContextBundle) {
  return [
    ...(bundle.goal ? [bundle.goal] : []),
    ...(bundle.intent ? [bundle.intent] : []),
    ...(bundle.currentProcess ? [bundle.currentProcess] : []),
    ...bundle.activeRules,
    ...bundle.activeConstraints,
    ...bundle.openRisks,
    ...bundle.recentDecisions,
    ...bundle.recentStateChanges,
    ...bundle.relevantEvidence,
    ...bundle.candidateSkills
  ];
}

function collectBundleNodeIds(bundle: RuntimeContextBundle): string[] {
  return Array.from(new Set(collectBundleSelections(bundle).map((item) => item.nodeId)));
}

function truncateText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(maxLength - 3, 1))}...`;
}
