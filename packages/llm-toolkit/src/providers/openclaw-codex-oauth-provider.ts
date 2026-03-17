import {
  completeSimple as piCompleteSimple,
  getModel as piGetModel,
  type AssistantMessage as PiAiAssistantMessage,
  type Model as PiAiModel,
  type SimpleStreamOptions as PiAiSimpleStreamOptions
} from '@mariozechner/pi-ai';

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
const DEFAULT_TRANSPORT = 'auto';
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant. Reply clearly and concisely.';

type PiAiTransport = NonNullable<PiAiSimpleStreamOptions['transport']>;
type PiAiCompleteSimple = typeof piCompleteSimple;
type PiAiGetModel = typeof piGetModel;

export interface OpenClawCodexOAuthProviderOptions {
  session?: OpenClawCodexOAuthSession;
  sessionOptions?: OpenClawCodexOAuthSessionOptions;
  baseUrl?: string;
  defaultModel?: string;
  defaultReasoningEffort?: LlmReasoningEffort;
  defaultTransport?: PiAiTransport;
  defaultSystemPrompt?: string;
  completeSimpleImpl?: PiAiCompleteSimple;
  getModelImpl?: PiAiGetModel;
}

export class OpenClawCodexOAuthTextProvider implements LlmTextProvider {
  readonly id = 'codex-oauth';
  readonly label = 'OpenClaw Codex OAuth';
  readonly transport = 'codex-oauth' as const;

  readonly #session: OpenClawCodexOAuthSession;
  readonly #baseUrl: string;
  readonly #defaultModel: string;
  readonly #defaultReasoningEffort: LlmReasoningEffort;
  readonly #defaultTransport: PiAiTransport;
  readonly #defaultSystemPrompt: string;
  readonly #completeSimpleImpl: PiAiCompleteSimple;
  readonly #getModelImpl: PiAiGetModel;

  constructor(options: OpenClawCodexOAuthProviderOptions = {}) {
    this.#session = options.session || new OpenClawCodexOAuthSession(options.sessionOptions);
    this.#baseUrl = normalizeBaseUrl(options.baseUrl || process.env.OPENCLAW_CODEX_OAUTH_BASE_URL || DEFAULT_BASE_URL);
    this.#defaultModel = options.defaultModel?.trim() || process.env.OPENCLAW_CODEX_OAUTH_MODEL?.trim() || DEFAULT_MODEL;
    this.#defaultReasoningEffort = normalizeReasoningEffort(
      options.defaultReasoningEffort || process.env.OPENCLAW_CODEX_OAUTH_REASONING_EFFORT
    );
    this.#defaultTransport = options.defaultTransport || DEFAULT_TRANSPORT;
    this.#defaultSystemPrompt =
      options.defaultSystemPrompt?.trim() ||
      process.env.OPENCLAW_CODEX_OAUTH_SYSTEM_PROMPT?.trim() ||
      DEFAULT_SYSTEM_PROMPT;
    this.#completeSimpleImpl = options.completeSimpleImpl || piCompleteSimple;
    this.#getModelImpl = options.getModelImpl || piGetModel;
  }

  async isAvailable(): Promise<LlmProviderAvailability> {
    return this.#session.getAvailability();
  }

  async generateText(input: LlmTextGenerateInput): Promise<LlmTextGenerateResult> {
    const credential = await this.#session.getValidCredential();
    const model = input.model?.trim() || this.#defaultModel;
    const reasoningEffort = normalizeReasoningEffort(input.reasoningEffort || this.#defaultReasoningEffort);
    const message = await this.#completeSimpleImpl(
      resolvePiAiModel({
        model,
        baseUrl: this.#baseUrl,
        getModelImpl: this.#getModelImpl
      }),
      {
        systemPrompt: this.#defaultSystemPrompt,
        messages: [
          {
            role: 'user',
            content: input.prompt,
            timestamp: Date.now()
          }
        ]
      },
      {
        apiKey: credential.access,
        transport: this.#defaultTransport,
        reasoning: reasoningEffort,
        ...(typeof input.maxOutputTokens === 'number' ? { maxTokens: input.maxOutputTokens } : {})
      }
    );

    const text = extractAssistantText(message);
    if (!text) {
      if (message.stopReason === 'error' && message.errorMessage?.trim()) {
        throw new Error(message.errorMessage.trim());
      }
      throw new Error('OpenClaw Codex OAuth returned no usable text.');
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
        transport: this.#defaultTransport,
        systemPrompt: this.#defaultSystemPrompt,
        stopReason: message.stopReason,
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

function resolvePiAiModel(input: {
  model: string;
  baseUrl: string;
  getModelImpl: PiAiGetModel;
}): PiAiModel<'openai-codex-responses'> {
  try {
    const resolved = input.getModelImpl(
      'openai-codex' as Parameters<PiAiGetModel>[0],
      input.model as Parameters<PiAiGetModel>[1]
    ) as PiAiModel<'openai-codex-responses'>;

    return {
      ...resolved,
      baseUrl: input.baseUrl
    };
  } catch {
    return {
      id: input.model,
      name: input.model,
      api: 'openai-codex-responses',
      provider: 'openai-codex',
      baseUrl: input.baseUrl,
      reasoning: true,
      input: ['text'],
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0
      },
      contextWindow: 200000,
      maxTokens: 32000
    };
  }
}

function extractAssistantText(message: PiAiAssistantMessage): string {
  return message.content
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('')
    .trim();
}
