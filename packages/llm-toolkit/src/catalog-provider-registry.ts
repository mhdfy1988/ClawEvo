import {
  listCatalogProviders,
  loadLlmToolkitConfig,
  resolveCatalogProviderOrder,
  resolveToolkitRelativePath,
  resolveProviderRuntimeConfig,
  type LlmToolkitConfig
} from './config.js';
import { CodexCliTextProvider } from './providers/codex-cli-provider.js';
import { OpenClawCodexOAuthTextProvider } from './providers/openclaw-codex-oauth-provider.js';
import { OpenAICompatibleChatTextProvider } from './providers/openai-compatible-chat-provider.js';
import { OpenAICompatibleResponsesTextProvider } from './providers/openai-compatible-responses-provider.js';
import { OpenAIResponsesTextProvider } from './providers/openai-responses-provider.js';
import { LlmProviderRegistry } from './provider-registry.js';
import type { LlmProviderCatalogEntry, LlmTextProvider } from './provider-types.js';

export interface CreateCatalogRegistryOptions {
  config?: LlmToolkitConfig;
  configFilePath?: string;
  fallbackDirs?: string[];
  providers?: Record<string, LlmTextProvider | false>;
}

export function createCatalogProviderRegistry(options: CreateCatalogRegistryOptions = {}): LlmProviderRegistry {
  const loadedConfig = loadLlmToolkitConfig({
    config: options.config,
    configFilePath: options.configFilePath,
    fallbackDirs: options.fallbackDirs
  });
  const registry = new LlmProviderRegistry();
  const providersById = new Map(listCatalogProviders(loadedConfig.config).map((provider) => [provider.id, provider]));
  const orderedProviderIds = resolveCatalogProviderOrder(loadedConfig.config);

  for (const providerId of orderedProviderIds) {
    const explicitProvider = options.providers?.[providerId];
    if (explicitProvider === false) {
      continue;
    }

    if (explicitProvider) {
      registry.register(explicitProvider);
      continue;
    }

    const provider = providersById.get(providerId);
    const runtimeConfig = resolveProviderRuntimeConfig(loadedConfig.config, providerId);
    if (!provider || provider.enabled === false || runtimeConfig?.enabled === false) {
      continue;
    }

    const runtimeProvider = createProviderFromCatalogEntry(provider, runtimeConfig, loadedConfig.configDir);
    if (runtimeProvider) {
      registry.register(runtimeProvider);
    }
  }

  return registry;
}

function createProviderFromCatalogEntry(
  provider: LlmProviderCatalogEntry,
  runtimeConfig: ReturnType<typeof resolveProviderRuntimeConfig>,
  configDir: string
): LlmTextProvider | undefined {
  if (provider.api === 'codex-cli') {
    return new CodexCliTextProvider({
      ...(runtimeConfig?.command ? { command: runtimeConfig.command } : {}),
      ...(runtimeConfig?.model ? { defaultModel: runtimeConfig.model } : {}),
      ...(runtimeConfig?.reasoningEffort ? { defaultReasoningEffort: runtimeConfig.reasoningEffort } : {}),
      ...(runtimeConfig?.cwd ? { cwd: resolveToolkitRelativePath(configDir, runtimeConfig.cwd) } : {})
    });
  }

  if (provider.api === 'openai-codex-responses') {
    const sessionOptions = {
      ...(runtimeConfig?.baseUrl ? { baseUrl: runtimeConfig.baseUrl } : {}),
      ...(runtimeConfig?.credentialFilePath
        ? { credentialFilePath: resolveToolkitRelativePath(configDir, runtimeConfig.credentialFilePath) }
        : {}),
      ...(runtimeConfig?.authorizeUrl ? { authorizeUrl: runtimeConfig.authorizeUrl } : {}),
      ...(runtimeConfig?.tokenUrl ? { tokenUrl: runtimeConfig.tokenUrl } : {}),
      ...(runtimeConfig?.redirectUri ? { redirectUri: runtimeConfig.redirectUri } : {}),
      ...(runtimeConfig?.scope ? { scope: runtimeConfig.scope } : {}),
      ...(runtimeConfig?.clientId ? { clientId: runtimeConfig.clientId } : {})
    };

    return new OpenClawCodexOAuthTextProvider({
      ...(runtimeConfig?.baseUrl ? { baseUrl: runtimeConfig.baseUrl } : {}),
      ...(runtimeConfig?.model ? { defaultModel: runtimeConfig.model } : {}),
      ...(runtimeConfig?.reasoningEffort ? { defaultReasoningEffort: runtimeConfig.reasoningEffort } : {}),
      ...(runtimeConfig?.systemPrompt ? { defaultSystemPrompt: runtimeConfig.systemPrompt } : {}),
      ...(Object.keys(sessionOptions).length > 0 ? { sessionOptions } : {})
    });
  }

  if (provider.api === 'openai-responses') {
    return new OpenAIResponsesTextProvider({
      ...(runtimeConfig?.apiKey ? { apiKey: runtimeConfig.apiKey } : {}),
      ...(runtimeConfig?.baseUrl ? { baseUrl: runtimeConfig.baseUrl } : {}),
      ...(runtimeConfig?.model
        ? { defaultModel: runtimeConfig.model }
        : provider.models[0]?.id
          ? { defaultModel: provider.models[0].id }
          : {}),
      ...(runtimeConfig?.reasoningEffort ? { defaultReasoningEffort: runtimeConfig.reasoningEffort } : {})
    });
  }

  if (provider.api === 'openai-compatible-chat-completions' || provider.api === 'openai-chat-completions') {
    return new OpenAICompatibleChatTextProvider({
      id: provider.id,
      ...(provider.label ? { label: provider.label } : {}),
      apiKind: provider.api,
      auth: runtimeConfig?.auth === 'none' || provider.auth === 'none' ? 'none' : 'api-key',
      ...(runtimeConfig?.baseUrl ? { baseUrl: runtimeConfig.baseUrl } : {}),
      ...(runtimeConfig?.apiKey ? { apiKey: runtimeConfig.apiKey } : {}),
      ...(runtimeConfig?.apiKeyEnv ? { apiKeyEnv: runtimeConfig.apiKeyEnv } : {}),
      ...(runtimeConfig?.model
        ? { defaultModel: runtimeConfig.model }
        : provider.models[0]?.id
          ? { defaultModel: provider.models[0].id }
          : {}),
      ...(runtimeConfig?.reasoningEffort ? { defaultReasoningEffort: runtimeConfig.reasoningEffort } : {}),
      ...(runtimeConfig?.headers ? { headers: runtimeConfig.headers } : {}),
      supportsReasoning: provider.models.some((model) => model.reasoning === true)
    });
  }

  if (provider.api === 'openai-compatible-responses') {
    return new OpenAICompatibleResponsesTextProvider({
      id: provider.id,
      ...(provider.label ? { label: provider.label } : {}),
      apiKind: provider.api,
      auth: runtimeConfig?.auth === 'none' || provider.auth === 'none' ? 'none' : 'api-key',
      ...(runtimeConfig?.baseUrl ? { baseUrl: runtimeConfig.baseUrl } : {}),
      ...(runtimeConfig?.apiKey ? { apiKey: runtimeConfig.apiKey } : {}),
      ...(runtimeConfig?.apiKeyEnv ? { apiKeyEnv: runtimeConfig.apiKeyEnv } : {}),
      ...(runtimeConfig?.model
        ? { defaultModel: runtimeConfig.model }
        : provider.models[0]?.id
          ? { defaultModel: provider.models[0].id }
          : {}),
      ...(runtimeConfig?.reasoningEffort ? { defaultReasoningEffort: runtimeConfig.reasoningEffort } : {}),
      ...(runtimeConfig?.headers ? { headers: runtimeConfig.headers } : {})
    });
  }

  return undefined;
}
