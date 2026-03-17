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
    this.#baseUrl = options.baseUrl?.trim() ? normalizeBaseUrl(options.baseUrl) : undefined;
    this.#apiKeyEnv = options.apiKeyEnv?.trim() || undefined;
    this.#apiKey = resolveApiKey({
      explicitApiKey: options.apiKey,
      apiKeyEnv: this.#apiKeyEnv
    });
    this.#defaultModel = options.defaultModel?.trim() || undefined;
    this.#defaultReasoningEffort = normalizeReasoningEffort(options.defaultReasoningEffort);
    this.#headers = { ...(options.headers || {}) };
    this.#fetchFn = options.fetchFn || fetch;
  }

  isAvailable(): LlmProviderAvailability {
    if (!this.#baseUrl) {
      return {
        available: false,
        configured: false,
        reason: `provider ${this.id} 未配置 baseUrl。`
      };
    }

    if (this.#auth === 'api-key' && !this.#apiKey) {
      return {
        available: false,
        configured: false,
        reason: this.#apiKeyEnv
          ? `provider ${this.id} 未配置 apiKey，且环境变量 ${this.#apiKeyEnv} 为空。`
          : `provider ${this.id} 未配置 apiKey。`
      };
    }

    return {
      available: true,
      configured: true,
      reason: `${this.label} 可用。`,
      details: {
        baseUrl: this.#baseUrl,
        ...(this.#defaultModel ? { model: this.#defaultModel } : {}),
        apiKind: this.#apiKind,
        auth: this.#auth
      }
    };
  }

  async generateText(input: LlmTextGenerateInput): Promise<LlmTextGenerateResult> {
    if (!this.#baseUrl) {
      throw new Error(`provider ${this.id} 未配置 baseUrl。`);
    }

    if (this.#auth === 'api-key' && !this.#apiKey) {
      throw new Error(`provider ${this.id} 未配置 apiKey。`);
    }

    const model = input.model?.trim() || this.#defaultModel;
    if (!model) {
      throw new Error(`provider ${this.id} 未配置默认模型，调用时也没有显式传入 model。`);
    }

    const reasoningEffort = normalizeReasoningEffort(input.reasoningEffort || this.#defaultReasoningEffort);
    const response = await this.#fetchFn(`${this.#baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.#apiKey ? { Authorization: `Bearer ${this.#apiKey}` } : {}),
        ...this.#headers
      },
      body: JSON.stringify({
        model,
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
      model,
      reasoningEffort,
      diagnostics: {
        baseUrl: this.#baseUrl,
        apiKind: this.#apiKind,
        auth: this.#auth,
        responseId: typeof payload.id === 'string' ? payload.id : undefined
      }
    };
  }
}

function resolveApiKey(input: { explicitApiKey?: string; apiKeyEnv?: string }): string | undefined {
  if (input.explicitApiKey?.trim()) {
    return input.explicitApiKey.trim();
  }

  if (input.apiKeyEnv?.trim()) {
    return process.env[input.apiKeyEnv.trim()]?.trim() || undefined;
  }

  return undefined;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '');
}

function normalizeReasoningEffort(value: string | undefined): LlmReasoningEffort {
  return value === 'medium' || value === 'high' ? value : 'low';
}
