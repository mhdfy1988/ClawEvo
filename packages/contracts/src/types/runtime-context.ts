import type { CompressionDiagnostics, ContextCompressionMode } from './core.js';

export type RuntimeWindowSource = 'live_runtime' | 'persisted_snapshot' | 'transcript_fallback';

export interface RuntimeMessageSummary {
  index: number;
  id?: string;
  timestamp?: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  contentTypes: string[];
  preview: string;
  textLength: number;
  toolCalls?: Array<{
    id?: string;
    name?: string;
  }>;
  toolCallId?: string;
  toolResultCompression?: {
    compressed: boolean;
    summary: string;
    status?: string;
    resultKind?: string;
    artifactPath?: string;
    sourcePath?: string;
    sourceUrl?: string;
    droppedSections: string[];
  };
}

export interface RuntimeWindowLatestPointers {
  latestUserMessageId?: string;
  latestAssistantMessageId?: string;
  latestToolResultIds: string[];
  latestUserInFinalWindow: boolean;
  latestAssistantInFinalWindow: boolean;
  latestToolResultIdsInFinalWindow: string[];
}

export type ToolCallResultMatchKind =
  | 'tool_call_id'
  | 'sequence_fallback'
  | 'tool_call_only'
  | 'tool_result_only';

export interface ToolCallResultPair {
  toolCallId?: string;
  toolName?: string;
  assistantMessageId?: string;
  resultMessageId?: string;
  matchKind: ToolCallResultMatchKind;
  callInFinalWindow: boolean;
  resultInFinalWindow: boolean;
}

export interface RuntimeWindowLayer<TMessage = unknown> {
  messages: TMessage[];
  summary: RuntimeMessageSummary[];
  counts: {
    total: number;
    system: number;
    conversation: number;
  };
}

export interface RuntimeContextWindowContract<TMessage = unknown> {
  version: string;
  source: RuntimeWindowSource;
  sessionId: string;
  query: string;
  capturedAt?: string;
  totalBudget: number;
  compression: {
    recentRawMessageCount: number;
    recentRawTurnCount?: number;
    compressedCount: number;
    preservedConversationCount: number;
    compressionMode?: 'none' | 'incremental' | 'full';
    compressionReason?: string;
    policy?: RuntimeCompressionPolicy;
  };
  latestPointers: RuntimeWindowLatestPointers;
  toolCallResultPairs: ToolCallResultPair[];
  inbound: RuntimeWindowLayer<TMessage>;
  preferred: RuntimeWindowLayer<TMessage>;
  final: RuntimeWindowLayer<TMessage>;
}

export type ProviderNeutralAssemblyField = 'messages' | 'systemPromptAddition' | 'estimatedTokens';

export interface RuntimeCompressionPolicy {
  rawTailTurnCount: number;
  fullCompactionThresholdRatio: number;
  maxBaselineCount: number;
  maxBaselineRollupRatio: number;
}

export interface PromptAssemblyContract {
  version: string;
  runtimeWindowVersion: string;
  providerNeutralOutputs: readonly ProviderNeutralAssemblyField[];
  hostAssemblyResponsibilities: readonly string[];
  debugOnlyFields: readonly string[];
  finalMessageCount: number;
  includesSystemPromptAddition: boolean;
  estimatedTokens?: number;
}

export interface PromptAssemblySidecarReference {
  messageId?: string;
  toolCallId?: string;
  toolName?: string;
  summary: string;
  status?: string;
  resultKind?: string;
  artifactPath?: string;
  sourcePath?: string;
  sourceUrl?: string;
  contentHash?: string;
  droppedSections: string[];
}

export interface PromptAssemblySnapshot<TMessage = unknown> {
  version: string;
  messages: TMessage[];
  messageSummary: RuntimeMessageSummary[];
  systemPromptAddition?: string;
  estimatedTokens?: number;
  toolCallResultPairs: ToolCallResultPair[];
  sidecarReferences: PromptAssemblySidecarReference[];
  compression: {
    mode?: ContextCompressionMode;
    reason?: string;
    diagnostics?: CompressionDiagnostics;
    policy?: RuntimeCompressionPolicy;
  };
}

export interface RuntimeCompressionCompactionView {
  mode?: ContextCompressionMode;
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
}
