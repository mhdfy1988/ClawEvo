import { extractResponseText } from '../response-text.js';
import type {
  LlmProviderAvailability,
  LlmReasoningEffort,
  LlmTextGenerateInput,
  LlmTextGenerateResult,
  LlmTextProvider
} from '../provider-types.js';
import {
  OpenClawCodexOAuthSession,
  type OpenClawCodexOAuthSessionOptions
} from '../sessions/openclaw-codex-oauth-session.js';

const DEFAULT_BASE_URL = 'https://chatgpt.com/backend-api';
const DEFAULT_MODEL = 'gpt-5.4';

export interface OpenClawCodexOAuthProviderOptions {
  session?: OpenClawCodexOAuthSession;
  sessionOptions?: OpenClawCodexOAuthSessionOptions;
  baseUrl?: string;
  defaultModel?: string;
  defaultReasoningEffort?: LlmReasoningEffort;
  fetchFn?: typeof fetch;
}

export class OpenClawCodexOAuthTextProvider implements LlmTextProvider {
  readonly id = 'codex-oauth';
  readonly label = 'OpenClaw Codex OAuth';
  readonly transport = 'codex-oauth' as const;

  readonly #session: OpenClawCodexOAuthSession;
  readonly #baseUrl: string;
  readonly #defaultModel: string;
  readonly #defaultReasoningEffort: LlmReasoningEffort;
  readonly #fetchFn: typeof fetch;

  constructor(options: OpenClawCodexOAuthProviderOptions = {}) {
    this.#session = options.session || new OpenClawCodexOAuthSession(options.sessionOptions);
    this.#baseUrl = normalizeBaseUrl(options.baseUrl || process.env.OPENCLAW_CODEX_OAUTH_BASE_URL || DEFAULT_BASE_URL);
    this.#defaultModel = options.defaultModel?.trim() || process.env.OPENCLAW_CODEX_OAUTH_MODEL?.trim() || DEFAULT_MODEL;
    this.#defaultReasoningEffort = normalizeReasoningEffort(
      options.defaultReasoningEffort || process.env.OPENCLAW_CODEX_OAUTH_REASONING_EFFORT
    );
    this.#fetchFn = options.fetchFn || fetch;
  }

  async isAvailable(): Promise<LlmProviderAvailability> {
    return this.#session.getAvailability();
  }

  async generateText(input: LlmTextGenerateInput): Promise<LlmTextGenerateResult> {
    const credential = await this.#session.getValidCredential();
    const model = input.model?.trim() || this.#defaultModel;
    const reasoningEffort = normalizeReasoningEffort(input.reasoningEffort || this.#defaultReasoningEffort);
    const response = await this.#fetchFn(`${this.#baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential.access}`,
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
      throw new Error(`OpenClaw Codex OAuth 请求失败（${response.status}）：${body || 'empty response'}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = extractResponseText(payload);
    if (!text) {
      throw new Error('OpenClaw Codex OAuth 没有返回可用文本。');
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
        responseId: typeof payload.id === 'string' ? payload.id : undefined,
        accountId: credential.accountId
      }
    };
  }
}

function normalizeReasoningEffort(value: string | undefined): LlmReasoningEffort {
  return value === 'medium' || value === 'high' ? value : 'low';
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '');
}
