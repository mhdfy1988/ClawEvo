import { LlmProviderRegistry } from '../provider-registry.js';
import {
  loadLlmToolkitConfig,
  normalizeTransportOrder,
  resolveProviderRuntimeConfig,
  resolveToolkitRelativePath,
  type LlmToolkitConfig
} from '../config.js';
import { CodexCliTextProvider, type CodexCliProviderOptions } from '../providers/codex-cli-provider.js';
import {
  OpenClawCodexOAuthTextProvider,
  type OpenClawCodexOAuthProviderOptions
} from '../providers/openclaw-codex-oauth-provider.js';
import type { OpenClawCodexOAuthSessionOptions } from '../sessions/openclaw-codex-oauth-session.js';
import { OpenAIResponsesTextProvider, type OpenAIResponsesProviderOptions } from '../providers/openai-responses-provider.js';

export const DEFAULT_CODEX_PROVIDER_ORDER = ['codex-cli', 'codex-oauth', 'openai-responses'] as const;

export type CodexProviderMode = 'auto' | 'codex' | 'codex-cli' | 'codex-oauth' | 'openai-responses';

export interface CreateCodexProviderRegistryOptions {
  config?: LlmToolkitConfig;
  configFilePath?: string;
  fallbackDirs?: string[];
  codexCli?: CodexCliProviderOptions | false;
  codexOauth?: OpenClawCodexOAuthProviderOptions | false;
  openaiResponses?: OpenAIResponsesProviderOptions | false;
}

export function createCodexProviderRegistry(options: CreateCodexProviderRegistryOptions = {}): LlmProviderRegistry {
  const loadedConfig = loadLlmToolkitConfig({
    config: options.config,
    configFilePath: options.configFilePath,
    fallbackDirs: options.fallbackDirs
  });
  const registry = new LlmProviderRegistry();

  const codexCliOptions = resolveCodexCliOptions({
    explicit: options.codexCli,
    fileConfig: resolveProviderRuntimeConfig(loadedConfig.config, 'codex-cli'),
    configDir: loadedConfig.configDir
  });

  if (codexCliOptions !== false) {
    registry.register(new CodexCliTextProvider(codexCliOptions));
  }

  const codexOauthOptions = resolveCodexOAuthOptions({
    explicit: options.codexOauth,
    fileConfig: resolveProviderRuntimeConfig(loadedConfig.config, 'codex-oauth'),
    configDir: loadedConfig.configDir
  });

  if (codexOauthOptions !== false) {
    registry.register(new OpenClawCodexOAuthTextProvider(codexOauthOptions));
  }

  const openaiResponsesOptions = resolveOpenAIResponsesOptions({
    explicit: options.openaiResponses,
    fileConfig: resolveProviderRuntimeConfig(loadedConfig.config, 'openai-responses')
  });

  if (openaiResponsesOptions !== false) {
    registry.register(new OpenAIResponsesTextProvider(openaiResponsesOptions));
  }

  return registry;
}

export interface ResolveCodexProviderOrderOptions {
  config?: LlmToolkitConfig;
  configFilePath?: string;
  fallbackDirs?: string[];
  registeredProviderIds?: readonly string[];
}

export type CreateCodexRegistryOptions = CreateCodexProviderRegistryOptions;
export const createDefaultCodexProviderRegistry = createCodexProviderRegistry;

export function resolveCodexProviderOrder(
  mode: CodexProviderMode,
  options: ResolveCodexProviderOrderOptions = {}
): string[] {
  const loadedConfig = loadLlmToolkitConfig({
    config: options.config,
    configFilePath: options.configFilePath,
    fallbackDirs: options.fallbackDirs
  });
  const configuredOrder = normalizeTransportOrder(loadedConfig.config.codex?.providerOrder);
  const catalogOrder = normalizeTransportOrder(loadedConfig.config.catalog?.providerOrder);
  const effectiveOrder =
    configuredOrder.length > 0
      ? configuredOrder
      : catalogOrder.length > 0
        ? catalogOrder
        : [...DEFAULT_CODEX_PROVIDER_ORDER];
  const filteredOrder = filterOrderByRegisteredProviders(effectiveOrder, options.registeredProviderIds);

  switch (mode) {
    case 'auto':
    case 'codex':
      return filteredOrder;
    case 'codex-cli':
      return filterOrderByRegisteredProviders(['codex-cli'], options.registeredProviderIds);
    case 'codex-oauth':
      return filterOrderByRegisteredProviders(['codex-oauth'], options.registeredProviderIds);
    case 'openai-responses':
      return filterOrderByRegisteredProviders(['openai-responses'], options.registeredProviderIds);
    default:
      return assertNever(mode);
  }
}

function resolveCodexCliOptions(input: {
  explicit: CodexCliProviderOptions | false | undefined;
  fileConfig:
    | {
        enabled?: boolean;
        command?: string;
        model?: string;
        reasoningEffort?: 'low' | 'medium' | 'high';
        cwd?: string;
      }
    | undefined;
  configDir: string;
}): CodexCliProviderOptions | false {
  if (input.explicit === false) {
    return false;
  }

  if (input.explicit) {
    return input.explicit;
  }

  if (input.fileConfig?.enabled === false) {
    return false;
  }

  return {
    ...(input.fileConfig?.command ? { command: input.fileConfig.command } : {}),
    ...(input.fileConfig?.model ? { defaultModel: input.fileConfig.model } : {}),
    ...(input.fileConfig?.reasoningEffort ? { defaultReasoningEffort: input.fileConfig.reasoningEffort } : {}),
    ...(input.fileConfig?.cwd ? { cwd: resolveToolkitRelativePath(input.configDir, input.fileConfig.cwd) } : {})
  };
}

function resolveCodexOAuthOptions(input: {
  explicit: OpenClawCodexOAuthProviderOptions | false | undefined;
  fileConfig:
    | {
        enabled?: boolean;
        baseUrl?: string;
        model?: string;
        reasoningEffort?: 'low' | 'medium' | 'high';
        credentialFilePath?: string;
        authorizeUrl?: string;
        tokenUrl?: string;
        redirectUri?: string;
        scope?: string;
        clientId?: string;
      }
    | undefined;
  configDir: string;
}): OpenClawCodexOAuthProviderOptions | false {
  if (input.explicit === false) {
    return false;
  }

  if (input.explicit) {
    return input.explicit;
  }

  if (input.fileConfig?.enabled === false) {
    return false;
  }

  const sessionOptions: OpenClawCodexOAuthSessionOptions = {
    ...(input.fileConfig?.baseUrl ? { baseUrl: input.fileConfig.baseUrl } : {}),
    ...(input.fileConfig?.credentialFilePath
      ? { credentialFilePath: resolveToolkitRelativePath(input.configDir, input.fileConfig.credentialFilePath) }
      : {}),
    ...(input.fileConfig?.authorizeUrl ? { authorizeUrl: input.fileConfig.authorizeUrl } : {}),
    ...(input.fileConfig?.tokenUrl ? { tokenUrl: input.fileConfig.tokenUrl } : {}),
    ...(input.fileConfig?.redirectUri ? { redirectUri: input.fileConfig.redirectUri } : {}),
    ...(input.fileConfig?.scope ? { scope: input.fileConfig.scope } : {}),
    ...(input.fileConfig?.clientId ? { clientId: input.fileConfig.clientId } : {})
  };

  return {
    ...(input.fileConfig?.baseUrl ? { baseUrl: input.fileConfig.baseUrl } : {}),
    ...(input.fileConfig?.model ? { defaultModel: input.fileConfig.model } : {}),
    ...(input.fileConfig?.reasoningEffort ? { defaultReasoningEffort: input.fileConfig.reasoningEffort } : {}),
    ...(Object.keys(sessionOptions).length > 0 ? { sessionOptions } : {})
  };
}

function resolveOpenAIResponsesOptions(input: {
  explicit: OpenAIResponsesProviderOptions | false | undefined;
  fileConfig:
    | {
        enabled?: boolean;
        apiKey?: string;
        baseUrl?: string;
        model?: string;
        reasoningEffort?: 'low' | 'medium' | 'high';
      }
    | undefined;
}): OpenAIResponsesProviderOptions | false {
  if (input.explicit === false) {
    return false;
  }

  if (input.explicit) {
    return input.explicit;
  }

  if (input.fileConfig?.enabled === false) {
    return false;
  }

  return {
    ...(input.fileConfig?.apiKey ? { apiKey: input.fileConfig.apiKey } : {}),
    ...(input.fileConfig?.baseUrl ? { baseUrl: input.fileConfig.baseUrl } : {}),
    ...(input.fileConfig?.model ? { defaultModel: input.fileConfig.model } : {}),
    ...(input.fileConfig?.reasoningEffort ? { defaultReasoningEffort: input.fileConfig.reasoningEffort } : {})
  };
}

function filterOrderByRegisteredProviders(order: readonly string[], registeredProviderIds: readonly string[] | undefined): string[] {
  if (!registeredProviderIds || registeredProviderIds.length === 0) {
    return [...order];
  }

  const registeredSet = new Set(registeredProviderIds);
  return order.filter((providerId) => registeredSet.has(providerId));
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Codex provider mode: ${String(value)}`);
}
