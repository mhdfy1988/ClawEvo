import { extractChatCompletionText } from '../response-text.js';
import type {
  LlmApiKind,
  LlmAuthKind,
  LlmProviderAvailability,
  LlmReasoningEffort,
  LlmTextGenerateInput,
  LlmTextGenerateResult,
  LlmTextProvider
} from '../provider-types.js';
import {
  assertOpenAICompatibleRequestConfig,
  normalizeOpenAICompatibleBaseUrl,
  normalizeOpenAICompatibleReasoningEffort,
  resolveOpenAICompatibleApiKey,
  resolveOpenAICompatibleAvailability
} from './openai-compatible-provider-shared.js';

export interface OpenAICompatibleChatTextProviderOptions {
  id: string;
  label?: string;
  apiKind?: Extract<LlmApiKind, 'openai-chat-completions' | 'openai-compatible-chat-completions'>;
  auth?: Extract<LlmAuthKind, 'none' | 'api-key'>;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  defaultModel?: string;
  defaultReasoningEffort?: LlmReasoningEffort;
  supportsReasoning?: boolean;
  headers?: Record<string, string>;
  fetchFn?: typeof fetch;
}

export class OpenAICompatibleChatTextProvider implements LlmTextProvider {
  readonly id: string;
  readonly label: string;
  readonly transport = 'openai-compatible-chat' as const;

  readonly #apiKind: Extract<LlmApiKind, 'openai-chat-completions' | 'openai-compatible-chat-completions'>;
  readonly #auth: Extract<LlmAuthKind, 'none' | 'api-key'>;
  readonly #baseUrl?: string;
  readonly #apiKey?: string;
  readonly #apiKeyEnv?: string;
  readonly #defaultModel?: string;
  readonly #defaultReasoningEffort: LlmReasoningEffort;
  readonly #supportsReasoning: boolean;
  readonly #headers: Record<string, string>;
  readonly #fetchFn: typeof fetch;

  constructor(options: OpenAICompatibleChatTextProviderOptions) {
    this.id = options.id;
    this.label = options.label?.trim() || options.id;
    this.#apiKind = options.apiKind || 'openai-compatible-chat-completions';
    this.#auth = options.auth || 'api-key';
    this.#baseUrl = options.baseUrl?.trim() ? normalizeOpenAICompatibleBaseUrl(options.baseUrl) : undefined;
    this.#apiKeyEnv = options.apiKeyEnv?.trim() || undefined;
    this.#apiKey = resolveOpenAICompatibleApiKey({
      explicitApiKey: options.apiKey,
      apiKeyEnv: this.#apiKeyEnv
    });
    this.#defaultModel = options.defaultModel?.trim() || undefined;
    this.#defaultReasoningEffort = normalizeOpenAICompatibleReasoningEffort(options.defaultReasoningEffort);
    this.#supportsReasoning = options.supportsReasoning === true;
    this.#headers = { ...(options.headers || {}) };
    this.#fetchFn = options.fetchFn || fetch;
  }

  isAvailable(): LlmProviderAvailability {
    return resolveOpenAICompatibleAvailability({
      providerId: this.id,
      providerLabel: this.label,
      baseUrl: this.#baseUrl,
      auth: this.#auth,
      apiKey: this.#apiKey,
      apiKeyEnv: this.#apiKeyEnv,
      defaultModel: this.#defaultModel,
      apiKind: this.#apiKind
    });
  }

  async generateText(input: LlmTextGenerateInput): Promise<LlmTextGenerateResult> {
    const requestConfig = assertOpenAICompatibleRequestConfig({
      providerId: this.id,
      baseUrl: this.#baseUrl,
      auth: this.#auth,
      apiKey: this.#apiKey,
      defaultModel: this.#defaultModel,
      requestedModel: input.model
    });

    const reasoningEffort = normalizeOpenAICompatibleReasoningEffort(input.reasoningEffort || this.#defaultReasoningEffort);
    const body = {
      model: requestConfig.model,
      messages: [
        {
          role: 'user',
          content: input.prompt
        }
      ],
      ...(typeof input.maxOutputTokens === 'number' ? { max_tokens: input.maxOutputTokens } : {}),
      ...(this.#supportsReasoning ? { reasoning: { effort: reasoningEffort } } : {})
    };

    const response = await this.#fetchFn(`${requestConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(requestConfig.apiKey ? { Authorization: `Bearer ${requestConfig.apiKey}` } : {}),
        ...this.#headers
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      throw new Error(
        `${this.label} 调用失败（${response.status}）：${responseBody || 'empty response'}`
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = extractChatCompletionText(payload);
    if (!text) {
      throw new Error(`${this.label} 没有返回可用文本。`);
    }

    return {
      providerId: this.id,
      providerLabel: this.label,
      transport: this.transport,
      text,
      model: requestConfig.model,
      ...(this.#supportsReasoning ? { reasoningEffort } : {}),
      diagnostics: {
        baseUrl: requestConfig.baseUrl,
        apiKind: this.#apiKind,
        auth: this.#auth,
        responseId: typeof payload.id === 'string' ? payload.id : undefined
      }
    };
  }
}
