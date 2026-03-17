import type {
  LlmApiKind,
  LlmAuthKind,
  LlmProviderAvailability,
  LlmReasoningEffort
} from '../provider-types.js';

export type OpenAICompatibleApiKind =
  | Extract<LlmApiKind, 'openai-chat-completions' | 'openai-compatible-chat-completions'>
  | Extract<LlmApiKind, 'openai-responses' | 'openai-compatible-responses'>;

export type OpenAICompatibleAuthKind = Extract<LlmAuthKind, 'none' | 'api-key'>;

export function resolveOpenAICompatibleApiKey(input: {
  explicitApiKey?: string;
  apiKeyEnv?: string;
}): string | undefined {
  if (input.explicitApiKey?.trim()) {
    return input.explicitApiKey.trim();
  }

  if (input.apiKeyEnv?.trim()) {
    return process.env[input.apiKeyEnv.trim()]?.trim() || undefined;
  }

  return undefined;
}

export function normalizeOpenAICompatibleBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '');
}

export function normalizeOpenAICompatibleReasoningEffort(value: string | undefined): LlmReasoningEffort {
  return value === 'medium' || value === 'high' ? value : 'low';
}

export function resolveOpenAICompatibleAvailability(input: {
  providerId: string;
  providerLabel: string;
  baseUrl?: string;
  auth: OpenAICompatibleAuthKind;
  apiKey?: string;
  apiKeyEnv?: string;
  defaultModel?: string;
  apiKind: OpenAICompatibleApiKind;
}): LlmProviderAvailability {
  if (!input.baseUrl) {
    return {
      available: false,
      configured: false,
      reason: `provider ${input.providerId} 未配置 baseUrl。`
    };
  }

  if (input.auth === 'api-key' && !input.apiKey) {
    return {
      available: false,
      configured: false,
      reason: input.apiKeyEnv
        ? `provider ${input.providerId} 未配置 apiKey，且环境变量 ${input.apiKeyEnv} 为空。`
        : `provider ${input.providerId} 未配置 apiKey。`
    };
  }

  return {
    available: true,
    configured: true,
    reason: `${input.providerLabel} 可用。`,
    details: {
      baseUrl: input.baseUrl,
      ...(input.defaultModel ? { model: input.defaultModel } : {}),
      apiKind: input.apiKind,
      auth: input.auth
    }
  };
}

export function assertOpenAICompatibleRequestConfig(input: {
  providerId: string;
  baseUrl?: string;
  auth: OpenAICompatibleAuthKind;
  apiKey?: string;
  defaultModel?: string;
  requestedModel?: string;
}): { baseUrl: string; apiKey?: string; model: string } {
  if (!input.baseUrl) {
    throw new Error(`provider ${input.providerId} 未配置 baseUrl。`);
  }

  if (input.auth === 'api-key' && !input.apiKey) {
    throw new Error(`provider ${input.providerId} 未配置 apiKey。`);
  }

  const model = input.requestedModel?.trim() || input.defaultModel?.trim();
  if (!model) {
    throw new Error(`provider ${input.providerId} 未配置默认模型，调用时也没有显式传入 model。`);
  }

  return {
    baseUrl: input.baseUrl,
    ...(input.apiKey ? { apiKey: input.apiKey } : {}),
    model
  };
}
