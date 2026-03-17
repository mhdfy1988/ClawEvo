import { listCatalogProviders, loadLlmToolkitConfig, resolveCatalogProviderOrder, type LlmToolkitConfig } from './config.js';
import { OpenAICompatibleChatTextProvider } from './openai-compatible-chat-provider.js';
import { OpenAICompatibleResponsesTextProvider } from './openai-compatible-responses-provider.js';
import { LlmProviderRegistry } from './provider-registry.js';
import type { LlmProviderCatalogEntry, LlmTextProvider } from './provider-types.js';

export interface CreateCatalogRegistryOptions {
  config?: LlmToolkitConfig;
  configFilePath?: string;
  providers?: Record<string, LlmTextProvider | false>;
}

export function createCatalogProviderRegistry(options: CreateCatalogRegistryOptions = {}): LlmProviderRegistry {
  const loadedConfig = loadLlmToolkitConfig({
    config: options.config,
    configFilePath: options.configFilePath
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
    if (!provider || provider.enabled === false) {
      continue;
    }

    const runtimeProvider = createProviderFromCatalogEntry(provider);
    if (runtimeProvider) {
      registry.register(runtimeProvider);
    }
  }

  return registry;
}

function createProviderFromCatalogEntry(provider: LlmProviderCatalogEntry): LlmTextProvider | undefined {
  if (provider.api === 'openai-compatible-chat-completions' || provider.api === 'openai-chat-completions') {
    return new OpenAICompatibleChatTextProvider({
      id: provider.id,
      ...(provider.label ? { label: provider.label } : {}),
      apiKind: provider.api,
      auth: provider.auth === 'none' ? 'none' : 'api-key',
      ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}),
      ...(provider.apiKey ? { apiKey: provider.apiKey } : {}),
      ...(provider.apiKeyEnv ? { apiKeyEnv: provider.apiKeyEnv } : {}),
      ...(provider.models[0]?.id ? { defaultModel: provider.models[0].id } : {}),
      supportsReasoning: provider.models.some((model) => model.reasoning === true)
    });
  }

  if (provider.api === 'openai-compatible-responses' || provider.api === 'openai-responses') {
    return new OpenAICompatibleResponsesTextProvider({
      id: provider.id,
      ...(provider.label ? { label: provider.label } : {}),
      apiKind: provider.api,
      auth: provider.auth === 'none' ? 'none' : 'api-key',
      ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}),
      ...(provider.apiKey ? { apiKey: provider.apiKey } : {}),
      ...(provider.apiKeyEnv ? { apiKeyEnv: provider.apiKeyEnv } : {}),
      ...(provider.models[0]?.id ? { defaultModel: provider.models[0].id } : {})
    });
  }

  return undefined;
}
