import { extractResponseText } from '../response-text.js';
import type {
  LlmProviderAvailability,
  LlmReasoningEffort,
  LlmTextGenerateInput,
  LlmTextGenerateResult,
  LlmTextProvider
} from '../provider-types.js';

export interface OpenAIResponsesProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultReasoningEffort?: LlmReasoningEffort;
  fetchFn?: typeof fetch;
}

export class OpenAIResponsesTextProvider implements LlmTextProvider {
  readonly id = 'openai-responses';
  readonly label = 'OpenAI Responses API';
  readonly transport = 'openai-responses' as const;

  readonly #apiKey?: string;
  readonly #baseUrl: string;
  readonly #defaultModel: string;
  readonly #defaultReasoningEffort: LlmReasoningEffort;
  readonly #fetchFn: typeof fetch;

  constructor(options: OpenAIResponsesProviderOptions = {}) {
    this.#apiKey = options.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || undefined;
    this.#baseUrl = normalizeBaseUrl(options.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1');
    this.#defaultModel =
      options.defaultModel?.trim() || process.env.OPENCLAW_OPENAI_RESPONSES_MODEL?.trim() || 'gpt-5-codex';
    this.#defaultReasoningEffort = normalizeReasoningEffort(
      options.defaultReasoningEffort || process.env.OPENCLAW_OPENAI_RESPONSES_REASONING_EFFORT
    );
    this.#fetchFn = options.fetchFn || fetch;
  }

  isAvailable(): LlmProviderAvailability {
    if (!this.#apiKey) {
      return {
        available: false,
        configured: false,
        reason: '未配置 OPENAI_API_KEY。'
      };
    }

    return {
      available: true,
      configured: true,
      reason: 'OpenAI Responses API 可用。',
      details: {
        baseUrl: this.#baseUrl,
        model: this.#defaultModel
      }
    };
  }

  async generateText(input: LlmTextGenerateInput): Promise<LlmTextGenerateResult> {
    if (!this.#apiKey) {
      throw new Error('未配置 OPENAI_API_KEY，无法调用 OpenAI Responses API。');
    }

    const model = input.model?.trim() || this.#defaultModel;
    const reasoningEffort = normalizeReasoningEffort(input.reasoningEffort || this.#defaultReasoningEffort);
    const response = await this.#fetchFn(`${this.#baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.#apiKey}`,
        'Content-Type': 'application/json'
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
      const body = await response.text().catch(() => '');
      throw new Error(`OpenAI Responses API 调用失败（${response.status}）：${body || 'empty response'}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = extractResponseText(payload);

    if (!text) {
      throw new Error('OpenAI Responses API 没有返回可用文本。');
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
        responseId: typeof payload.id === 'string' ? payload.id : undefined
      }
    };
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '');
}

function normalizeReasoningEffort(value: string | undefined): LlmReasoningEffort {
  return value === 'medium' || value === 'high' ? value : 'low';
}
