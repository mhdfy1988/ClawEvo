export type LlmTransportId =
  | 'codex-cli'
  | 'codex-oauth'
  | 'openai-responses'
  | 'openai-compatible-chat'
  | 'openai-compatible-responses';
export type CodexTransportId = 'codex-cli' | 'codex-oauth' | 'openai-responses';

export type LlmReasoningEffort = 'low' | 'medium' | 'high';

export type LlmApiKind =
  | 'codex-cli'
  | 'openai-codex-responses'
  | 'openai-responses'
  | 'openai-chat-completions'
  | 'openai-compatible-responses'
  | 'openai-compatible-chat-completions'
  | 'ollama-chat'
  | 'custom';

export type LlmAuthKind = 'none' | 'api-key' | 'oauth' | 'cli';

export type LlmProviderStatus = 'implemented' | 'experimental' | 'planned';

export type LlmInputKind = 'text' | 'image' | 'audio' | 'file';

export interface LlmTextGenerateInput {
  prompt: string;
  model?: string;
  reasoningEffort?: LlmReasoningEffort;
  maxOutputTokens?: number;
}

export interface LlmProviderAvailability {
  available: boolean;
  configured: boolean;
  reason: string;
  details?: Record<string, string>;
}

export interface LlmTextGenerateResult {
  providerId: string;
  providerLabel: string;
  transport: LlmTransportId;
  text: string;
  model?: string;
  reasoningEffort?: LlmReasoningEffort;
  diagnostics?: Record<string, unknown>;
}

export interface LlmTextProvider {
  readonly id: string;
  readonly label: string;
  readonly transport: LlmTransportId;
  isAvailable(): Promise<LlmProviderAvailability> | LlmProviderAvailability;
  generateText(input: LlmTextGenerateInput): Promise<LlmTextGenerateResult>;
}

export interface LlmModelCatalogEntry {
  id: string;
  name?: string;
  api?: LlmApiKind;
  reasoning?: boolean;
  input?: LlmInputKind[];
  contextWindow?: number;
  maxTokens?: number;
  notes?: string;
}

export interface LlmProviderCatalogEntry {
  id: string;
  enabled: boolean;
  status: LlmProviderStatus;
  label?: string;
  vendor?: string;
  auth?: LlmAuthKind;
  api?: LlmApiKind;
  notes?: string;
  models: LlmModelCatalogEntry[];
}

export interface LlmProviderRuntimeEntry {
  id: string;
  enabled?: boolean;
  auth?: LlmAuthKind;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  credentialFilePath?: string;
  command?: string;
  model?: string;
  reasoningEffort?: LlmReasoningEffort;
  systemPrompt?: string;
  cwd?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  redirectUri?: string;
  scope?: string;
  clientId?: string;
  headers?: Record<string, string>;
}

export interface LlmProviderFailure {
  providerId: string;
  providerLabel: string;
  transport?: LlmTransportId;
  stage: 'availability' | 'generate';
  code?:
    | 'provider-missing'
    | 'provider-unavailable'
    | 'provider-cooldown'
    | 'availability-error'
    | 'generate-error';
  message: string;
}

export interface LlmRegistryGenerateResult {
  result: LlmTextGenerateResult;
  attempts: string[];
  failures: LlmProviderFailure[];
}
