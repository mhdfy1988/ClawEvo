import type { CoreLogger, ProvenanceRef } from '@openclaw-compact-context/contracts';
import type {
  PromptAssemblyContract,
  ProviderNeutralAssemblyField,
  RuntimeContextWindowContract,
  RuntimeMessageSummary,
  RuntimeWindowLatestPointers,
  RuntimeWindowSource,
  ToolCallResultMatchKind,
  ToolCallResultPair
} from '@openclaw-compact-context/contracts';

export interface AgentMessageLike {
  role?: string;
  content?: unknown;
  id?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export type OpenClawToolResultStatus = 'success' | 'empty' | 'partial' | 'failure';

export type OpenClawToolResultKind =
  | 'command_execution'
  | 'structured_query'
  | 'search_listing'
  | 'document_fetch'
  | 'file_read'
  | 'patch_apply'
  | 'test_run'
  | 'build_run'
  | 'unknown';

export interface CompressedToolResultPreviewSection {
  head?: string;
  tail?: string;
  omittedLineCount?: number;
  omittedCharCount?: number;
}

export interface CompressedToolResultMessageContent {
  toolName: string;
  toolCallId?: string;
  status: OpenClawToolResultStatus;
  resultKind: OpenClawToolResultKind;
  summary: string;
  keySignals: string[];
  command?: string;
  preview?: {
    output?: CompressedToolResultPreviewSection;
    stdout?: CompressedToolResultPreviewSection;
    stderr?: CompressedToolResultPreviewSection;
  };
  metrics?: {
    byteLength: number;
    lineCount?: number;
    itemCount?: number;
  };
  affectedPaths?: string[];
  error?: {
    name?: string;
    code?: string;
    message?: string;
    exitCode?: number;
  };
  artifact?: {
    path?: string;
    sourcePath?: string;
    sourceUrl?: string;
    contentHash: string;
    byteLength: number;
  };
  truncation: {
    wasCompressed: boolean;
    policyId: string;
    reason: string;
    droppedSections: string[];
  };
  provenance: ProvenanceRef;
}

export interface OpenClawContextEngineInfo {
  id: string;
  name: string;
  version?: string;
  ownsCompaction?: boolean;
}

export interface OpenClawAssembleResult {
  messages: AgentMessageLike[];
  estimatedTokens: number;
  systemPromptAddition?: string;
}

export type OpenClawRuntimeWindowSource = RuntimeWindowSource;
export type OpenClawRuntimeMessageSummary = RuntimeMessageSummary;
export type OpenClawRuntimeWindowLatestPointers = RuntimeWindowLatestPointers;
export type OpenClawToolCallResultMatchKind = ToolCallResultMatchKind;
export type OpenClawToolCallResultPair = ToolCallResultPair;

export interface OpenClawRuntimeWindowLayer {
  messages: AgentMessageLike[];
  summary: OpenClawRuntimeMessageSummary[];
  counts: {
    total: number;
    system: number;
    conversation: number;
  };
}

export interface OpenClawRuntimeContextWindowContract
  extends RuntimeContextWindowContract<AgentMessageLike> {
  inbound: OpenClawRuntimeWindowLayer;
  preferred: OpenClawRuntimeWindowLayer;
  final: OpenClawRuntimeWindowLayer;
}

export type OpenClawProviderNeutralAssemblyField = ProviderNeutralAssemblyField;
export type OpenClawPromptAssemblyContract = PromptAssemblyContract;

export interface OpenClawCompactResult {
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
}

export interface OpenClawContextEngine {
  readonly info: OpenClawContextEngineInfo;
  bootstrap?(params: { sessionId: string; sessionFile: string }): Promise<{
    bootstrapped: boolean;
    importedMessages?: number;
    reason?: string;
  }>;
  ingest(params: {
    sessionId: string;
    message: AgentMessageLike;
    isHeartbeat?: boolean;
  }): Promise<{ ingested: boolean }>;
  ingestBatch?(params: {
    sessionId: string;
    messages: AgentMessageLike[];
    isHeartbeat?: boolean;
  }): Promise<{ ingestedCount: number }>;
  afterTurn?(params: {
    sessionId: string;
    sessionFile: string;
    messages: AgentMessageLike[];
    prePromptMessageCount: number;
    autoCompactionSummary?: string;
    isHeartbeat?: boolean;
    tokenBudget?: number;
    runtimeContext?: Record<string, unknown>;
  }): Promise<void>;
  assemble(params: {
    sessionId: string;
    messages: AgentMessageLike[];
    tokenBudget?: number;
  }): Promise<OpenClawAssembleResult>;
  compact(params: {
    sessionId: string;
    sessionFile: string;
    tokenBudget?: number;
    force?: boolean;
    currentTokenCount?: number;
    compactionTarget?: 'budget' | 'threshold';
    customInstructions?: string;
    runtimeContext?: Record<string, unknown>;
  }): Promise<OpenClawCompactResult>;
  dispose?(): Promise<void>;
}

export interface OpenClawGatewayError {
  code?: string;
  message?: string;
}

export interface OpenClawGatewayHandlerOptions {
  params: Record<string, unknown>;
  respond: (
    ok: boolean,
    payload?: unknown,
    error?: OpenClawGatewayError,
    meta?: Record<string, unknown>
  ) => void;
}

export interface OpenClawHookAgentContext {
  agentId?: string;
  sessionId?: string;
  sessionKey?: string;
  workspaceDir?: string;
  messageProvider?: string;
  trigger?: string;
  channelId?: string;
}

export interface OpenClawHookBeforeCompactionEvent {
  messageCount: number;
  compactingCount?: number;
  tokenCount?: number;
  messages?: AgentMessageLike[];
  sessionFile?: string;
}

export interface OpenClawHookAfterCompactionEvent {
  messageCount: number;
  tokenCount?: number;
  compactedCount: number;
  sessionFile?: string;
}

export interface OpenClawHookToolResultPersistEvent {
  message?: AgentMessageLike;
  toolResult?: AgentMessageLike | unknown;
  result?: AgentMessageLike | unknown;
  [key: string]: unknown;
}

export interface OpenClawHookRegistrationOptions {
  priority?: number;
  name?: string;
  description?: string;
}

export interface OpenClawCliProgramLike {
  command(name: string): OpenClawCliProgramLike;
  description(text: string): OpenClawCliProgramLike;
  addHelpText?(
    position: 'before' | 'after',
    text: string | (() => string)
  ): OpenClawCliProgramLike;
  option(flags: string, description?: string, defaultValue?: unknown): OpenClawCliProgramLike;
  argument(name: string, description?: string): OpenClawCliProgramLike;
  action(
    handler: (...args: any[]) => Promise<unknown> | unknown
  ): OpenClawCliProgramLike;
}

export interface OpenClawPluginCliContext {
  program: OpenClawCliProgramLike;
  config: Record<string, unknown>;
  workspaceDir?: string;
  logger: OpenClawPluginLogger;
}

export type OpenClawPluginCliRegistrar = (
  ctx: OpenClawPluginCliContext
) => Promise<void> | void;

export interface OpenClawTypedHookHandlerMap {
  before_compaction: (
    event: OpenClawHookBeforeCompactionEvent,
    ctx: OpenClawHookAgentContext
  ) => Promise<void> | void;
  after_compaction: (
    event: OpenClawHookAfterCompactionEvent,
    ctx: OpenClawHookAgentContext
  ) => Promise<void> | void;
}

export type OpenClawPluginLogger = CoreLogger;

export interface OpenClawPluginApi {
  id: string;
  name: string;
  version?: string;
  description?: string;
  config?: Record<string, unknown>;
  pluginConfig?: Record<string, unknown>;
  runtime?: {
    state?: {
      resolveStateDir?: (...args: unknown[]) => string;
    };
  };
  logger: OpenClawPluginLogger;
  resolvePath?: (input: string) => string;
  registerContextEngine: (id: string, factory: () => OpenClawContextEngine | Promise<OpenClawContextEngine>) => void;
  registerGatewayMethod: (
    method: string,
    handler: (options: OpenClawGatewayHandlerOptions) => Promise<void> | void
  ) => void;
  registerCli?: (
    registrar: OpenClawPluginCliRegistrar,
    opts?: {
      commands?: string[];
    }
  ) => void;
  registerHook?: (
    events: string | string[],
    handler: (...args: unknown[]) => Promise<unknown> | unknown,
    opts?: OpenClawHookRegistrationOptions
  ) => void;
  on?: <K extends keyof OpenClawTypedHookHandlerMap>(
    hookName: K,
    handler: OpenClawTypedHookHandlerMap[K],
    opts?: OpenClawHookRegistrationOptions
  ) => void;
}

export interface OpenClawPluginDefinition {
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  kind?: 'memory' | 'context-engine';
  register?: (api: OpenClawPluginApi) => void | Promise<void>;
}
