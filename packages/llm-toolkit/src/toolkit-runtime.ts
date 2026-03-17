import {
  loadLlmToolkitConfig,
  resolveCatalogProviderOrder,
  type LoadLlmToolkitConfigOptions,
  type LoadedLlmToolkitConfig,
  type LlmToolkitConfig
} from './config.js';
import {
  createCatalogProviderRegistry,
  type CreateCatalogRegistryOptions
} from './catalog-provider-registry.js';
import {
  createCodexProviderRegistry,
  resolveCodexProviderOrder,
  type CodexProviderMode,
  type CreateCodexProviderRegistryOptions
} from './presets/codex-preset.js';
import { LlmProviderRegistry } from './provider-registry.js';
import {
  resolveModelSelection,
  type ResolvedModelSelection
} from './runtime-state.js';

export type LlmToolkitRuntimeMode = 'llm' | CodexProviderMode;

export interface CreateLlmToolkitRuntimeOptions extends LoadLlmToolkitConfigOptions {
  createCatalogRegistry?: (options?: CreateCatalogRegistryOptions) => LlmProviderRegistry;
  createCodexRegistry?: (options?: CreateCodexProviderRegistryOptions) => LlmProviderRegistry;
}

export interface ResolveLlmTextRuntimeOptions {
  mode: LlmToolkitRuntimeMode;
  registry?: LlmProviderRegistry;
  registeredProviderIds?: readonly string[];
}

export interface ResolvedLlmTextRuntime {
  loadedConfig: LoadedLlmToolkitConfig;
  registry: LlmProviderRegistry;
  registeredProviderIds: string[];
  providerOrder: string[];
  modelSelection: ResolvedModelSelection;
}

export interface LlmToolkitRuntime {
  readonly loadedConfig: LoadedLlmToolkitConfig;
  createRegistry(mode: LlmToolkitRuntimeMode): LlmProviderRegistry;
  resolveProviderOrder(mode: LlmToolkitRuntimeMode, registeredProviderIds?: readonly string[]): string[];
  resolveModelSelection(input?: {
    mode?: string;
    registeredProviderIds?: readonly string[];
  }): ResolvedModelSelection;
  resolveTextRuntime(input: ResolveLlmTextRuntimeOptions): ResolvedLlmTextRuntime;
}

export function createLlmToolkitRuntime(options: CreateLlmToolkitRuntimeOptions = {}): LlmToolkitRuntime {
  const loadedConfig = loadLlmToolkitConfig(options);
  const createCatalogRegistry = options.createCatalogRegistry ?? createCatalogProviderRegistry;
  const createCodexRegistry = options.createCodexRegistry ?? createCodexProviderRegistry;

  return {
    loadedConfig,
    createRegistry(mode) {
      if (mode === 'llm') {
        return createCatalogRegistry({
          config: loadedConfig.config,
          configFilePath: loadedConfig.filePath,
          fallbackDirs: options.fallbackDirs
        });
      }

      return createCodexRegistry({
        config: loadedConfig.config,
        configFilePath: loadedConfig.filePath,
        fallbackDirs: options.fallbackDirs
      });
    },
    resolveProviderOrder(mode, registeredProviderIds) {
      if (mode === 'llm') {
        const configuredOrder = resolveCatalogProviderOrder(loadedConfig.config);
        if (configuredOrder.length === 0) {
          return registeredProviderIds ? [...registeredProviderIds] : [];
        }

        return filterOrderByRegisteredProviders(configuredOrder, registeredProviderIds);
      }

      return resolveCodexProviderOrder(mode, {
        config: loadedConfig.config,
        configFilePath: loadedConfig.filePath,
        fallbackDirs: options.fallbackDirs,
        registeredProviderIds
      });
    },
    resolveModelSelection(input = {}) {
      return resolveModelSelection({
        loadedConfig,
        fallbackDirs: options.fallbackDirs,
        ...(input.mode ? { mode: input.mode } : {}),
        ...(input.registeredProviderIds ? { registeredProviderIds: input.registeredProviderIds } : {})
      });
    },
    resolveTextRuntime(input) {
      const registry = input.registry ?? this.createRegistry(input.mode);
      const fallbackProviderOrder = this.resolveProviderOrder(input.mode);
      const registeredProviderIds =
        input.registeredProviderIds ??
        (typeof registry.listProviders === 'function'
          ? registry.listProviders().map((provider) => provider.id)
          : [...fallbackProviderOrder]);

      return {
        loadedConfig,
        registry,
        registeredProviderIds: [...registeredProviderIds],
        providerOrder:
          typeof registry.listProviders === 'function' || input.registeredProviderIds
            ? this.resolveProviderOrder(input.mode, registeredProviderIds)
            : fallbackProviderOrder,
        modelSelection: this.resolveModelSelection({
          mode: input.mode === 'llm' ? undefined : input.mode,
          registeredProviderIds
        })
      };
    }
  };
}

function filterOrderByRegisteredProviders(order: readonly string[], registeredProviderIds: readonly string[] | undefined): string[] {
  if (!registeredProviderIds || registeredProviderIds.length === 0) {
    return [...order];
  }

  const registeredSet = new Set(registeredProviderIds);
  return order.filter((providerId) => registeredSet.has(providerId));
}
