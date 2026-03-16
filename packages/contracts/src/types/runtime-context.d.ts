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
}
export interface RuntimeWindowLatestPointers {
    latestUserMessageId?: string;
    latestAssistantMessageId?: string;
    latestToolResultIds: string[];
    latestUserInFinalWindow: boolean;
    latestAssistantInFinalWindow: boolean;
    latestToolResultIdsInFinalWindow: string[];
}
export type ToolCallResultMatchKind = 'tool_call_id' | 'sequence_fallback' | 'tool_call_only' | 'tool_result_only';
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
        compressedCount: number;
        preservedConversationCount: number;
    };
    latestPointers: RuntimeWindowLatestPointers;
    toolCallResultPairs: ToolCallResultPair[];
    inbound: RuntimeWindowLayer<TMessage>;
    preferred: RuntimeWindowLayer<TMessage>;
    final: RuntimeWindowLayer<TMessage>;
}
export type ProviderNeutralAssemblyField = 'messages' | 'systemPromptAddition' | 'estimatedTokens';
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
