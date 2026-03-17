import { extractResponseText } from '../response-text.js';
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

export interface OpenAICompatibleResponsesTextProviderOptions {
  id: string;
  label?: string;
  apiKind?: Extract<LlmApiKind, 'openai-responses' | 'openai-compatible-responses'>;
  auth?: Extract<LlmAuthKind, 'none' | 'api-key'>;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  defaultModel?: string;
  defaultReasoningEffort?: LlmReasoningEffort;
  headers?: Record<string, string>;
  fetchFn?: typeof fetch;
}

export class OpenAICompatibleResponsesTextProvider implements LlmTextProvider {
  readonly id: string;
  readonly label: string;
  readonly transport = 'openai-compatible-responses' as const;

  readonly #apiKind: Extract<LlmApiKind, 'openai-responses' | 'openai-compatible-responses'>;
  readonly #auth: Extract<LlmAuthKind, 'none' | 'api-key'>;
  readonly #baseUrl?: string;
  readonly #apiKey?: string;
  readonly #apiKeyEnv?: string;
  readonly #defaultModel?: string;
  readonly #defaultReasoningEffort: LlmReasoningEffort;
  readonly #headers: Record<string, string>;
  readonly #fetchFn: typeof fetch;

  constructor(options: OpenAICompatibleResponsesTextProviderOptions) {
    this.id = options.id;
    this.label = options.label?.trim() || options.id;
    this.#apiKind = options.apiKind || 'openai-compatible-responses';
    this.#auth = options.auth || 'api-key';
    this.#baseUrl = options.baseUrl?.trim() ? normalizeOpenAICompatibleBaseUrl(options.baseUrl) : undefined;
    this.#apiKeyEnv = options.apiKeyEnv?.trim() || undefined;
    this.#apiKey = resolveOpenAICompatibleApiKey({
      explicitApiKey: options.apiKey,
      apiKeyEnv: this.#apiKeyEnv
    });
    this.#defaultModel = options.defaultModel?.trim() || undefined;
    this.#defaultReasoningEffort = normalizeOpenAICompatibleReasoningEffort(options.defaultReasoningEffort);
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
    const response = await this.#fetchFn(`${requestConfig.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(requestConfig.apiKey ? { Authorization: `Bearer ${requestConfig.apiKey}` } : {}),
        ...this.#headers
      },
      body: JSON.stringify({
        model: requestConfig.model,
        input: input.prompt,
        text: {
          verbosity: 'low'
        },
        reasoning: {
          effort: reasoningEffort
        },
        ...(typeof input.maxOutputTokens === 'number' ? { max_output_tokens: input.maxOutputTokens } : {})
      })
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      throw new Error(`${this.label} 调用失败（${response.status}）：${responseBody || 'empty response'}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = extractResponseText(payload);
    if (!text) {
      throw new Error(`${this.label} 没有返回可用文本。`);
    }

    return {
      providerId: this.id,
      providerLabel: this.label,
      transport: this.transport,
      text,
      model: requestConfig.model,
      reasoningEffort,
      diagnostics: {
        baseUrl: requestConfig.baseUrl,
        apiKind: this.#apiKind,
        auth: this.#auth,
        responseId: typeof payload.id === 'string' ? payload.id : undefined
      }
    };
  }
}
