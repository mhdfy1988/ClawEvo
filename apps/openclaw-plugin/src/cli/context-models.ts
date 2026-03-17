import {
  createLlmToolkitRuntime,
  listCatalogProviders,
  parseModelRef,
  saveCurrentModelRef,
  saveDefaultModelRef
} from '@openclaw-compact-context/llm-toolkit';
import { getPluginLlmConfigLoadOptions } from './config-paths.js';

export interface ModelsCommandInput {
  configFilePath?: string;
  cwd?: string;
  modelRef?: string;
  fallbackDirs?: string[];
}

export interface ListedCatalogModel {
  ref: string;
  id: string;
  name?: string;
  api?: string;
  reasoning?: boolean;
  input?: string[];
  isCurrent: boolean;
  isDefault: boolean;
}

export interface ListedCatalogProvider {
  id: string;
  enabled: boolean;
  status: string;
  label?: string;
  vendor?: string;
  auth?: string;
  api?: string;
  models: ListedCatalogModel[];
}

export interface ModelsListResult {
  configSource: 'defaults' | 'inline' | 'file';
  configFilePath?: string;
  stateFilePath: string;
  currentModelRef?: string;
  defaultModelRef?: string;
  effectiveModelRef?: string;
  effectiveSource?: 'state' | 'config';
  providers: ListedCatalogProvider[];
}

export interface ModelsCurrentResult {
  configSource: 'defaults' | 'inline' | 'file';
  configFilePath?: string;
  stateFilePath: string;
  currentModelRef?: string;
  defaultModelRef?: string;
  effectiveModelRef?: string;
  effectiveSource?: 'state' | 'config';
}

export interface ModelsMutationResult extends ModelsCurrentResult {
  targetModelRef?: string;
  action: 'use' | 'default' | 'clear' | 'reset';
}

export function runModelsList(input: ModelsCommandInput = {}): ModelsListResult {
  const normalizedInput = withFallbackDirs(input);
  const runtime = createModelsRuntime(normalizedInput);
  const providers = listCatalogProviders(runtime.loadedConfig.config);
  const selection = runtime.resolveModelSelection();

  return {
    configSource: runtime.loadedConfig.source,
    ...(runtime.loadedConfig.filePath ? { configFilePath: runtime.loadedConfig.filePath } : {}),
    stateFilePath: selection.stateFilePath,
    ...(selection.currentModelRef ? { currentModelRef: selection.currentModelRef } : {}),
    ...(selection.defaultModelRef ? { defaultModelRef: selection.defaultModelRef } : {}),
    ...(selection.effectiveModelRef ? { effectiveModelRef: selection.effectiveModelRef } : {}),
    ...(selection.effectiveSource ? { effectiveSource: selection.effectiveSource } : {}),
    providers: providers.map((provider) => ({
      id: provider.id,
      enabled: provider.enabled,
      status: provider.status,
      ...(provider.label ? { label: provider.label } : {}),
      ...(provider.vendor ? { vendor: provider.vendor } : {}),
      ...(provider.auth ? { auth: provider.auth } : {}),
      ...(provider.api ? { api: provider.api } : {}),
      models: provider.models.map((model) => ({
        ref: `${provider.id}/${model.id}`,
        id: model.id,
        ...(model.name ? { name: model.name } : {}),
        ...(model.api ? { api: model.api } : {}),
        ...(typeof model.reasoning === 'boolean' ? { reasoning: model.reasoning } : {}),
        ...(model.input ? { input: [...model.input] } : {}),
        isCurrent: selection.currentModelRef === `${provider.id}/${model.id}`,
        isDefault: selection.defaultModelRef === `${provider.id}/${model.id}`
      }))
    }))
  };
}

export function runModelsCurrent(input: ModelsCommandInput = {}): ModelsCurrentResult {
  const normalizedInput = withFallbackDirs(input);
  const runtime = createModelsRuntime(normalizedInput);
  const selection = runtime.resolveModelSelection();

  return {
    configSource: runtime.loadedConfig.source,
    ...(runtime.loadedConfig.filePath ? { configFilePath: runtime.loadedConfig.filePath } : {}),
    stateFilePath: selection.stateFilePath,
    ...(selection.currentModelRef ? { currentModelRef: selection.currentModelRef } : {}),
    ...(selection.defaultModelRef ? { defaultModelRef: selection.defaultModelRef } : {}),
    ...(selection.effectiveModelRef ? { effectiveModelRef: selection.effectiveModelRef } : {}),
    ...(selection.effectiveSource ? { effectiveSource: selection.effectiveSource } : {})
  };
}

export function runModelsUse(input: ModelsCommandInput): ModelsMutationResult {
  const normalizedInput = withFallbackDirs(input);
  const modelRef = normalizeAndValidateModelRef(normalizedInput);
  saveCurrentModelRef(modelRef, resolvePluginStateOptions(normalizedInput));
  return buildMutationResult({
    input: normalizedInput,
    action: 'use',
    targetModelRef: modelRef
  });
}

export function runModelsDefault(input: ModelsCommandInput): ModelsMutationResult {
  const normalizedInput = withFallbackDirs(input);
  const modelRef = normalizeAndValidateModelRef(normalizedInput);
  const loadedConfig = saveDefaultModelRef(modelRef, resolvePluginStateOptions(normalizedInput));
  const runtime = createModelsRuntime({
    ...normalizedInput,
    loadedConfig
  });
  const selection = runtime.resolveModelSelection();

  return {
    configSource: loadedConfig.source,
    ...(loadedConfig.filePath ? { configFilePath: loadedConfig.filePath } : {}),
    stateFilePath: selection.stateFilePath,
    ...(selection.currentModelRef ? { currentModelRef: selection.currentModelRef } : {}),
    ...(selection.defaultModelRef ? { defaultModelRef: selection.defaultModelRef } : {}),
    ...(selection.effectiveModelRef ? { effectiveModelRef: selection.effectiveModelRef } : {}),
    ...(selection.effectiveSource ? { effectiveSource: selection.effectiveSource } : {}),
    action: 'default',
    targetModelRef: modelRef
  };
}

export function runModelsClear(input: ModelsCommandInput = {}): ModelsMutationResult {
  const normalizedInput = withFallbackDirs(input);
  saveCurrentModelRef(undefined, resolvePluginStateOptions(normalizedInput));
  return buildMutationResult({
    input: normalizedInput,
    action: 'clear'
  });
}

export function runModelsReset(input: ModelsCommandInput = {}): ModelsMutationResult {
  const normalizedInput = withFallbackDirs(input);
  const loadedConfig = saveDefaultModelRef(undefined, resolvePluginStateOptions(normalizedInput));
  saveCurrentModelRef(undefined, resolvePluginStateOptions(normalizedInput, loadedConfig));
  const runtime = createModelsRuntime({
    ...normalizedInput,
    loadedConfig
  });
  const selection = runtime.resolveModelSelection();

  return {
    configSource: loadedConfig.source,
    ...(loadedConfig.filePath ? { configFilePath: loadedConfig.filePath } : {}),
    stateFilePath: selection.stateFilePath,
    ...(selection.currentModelRef ? { currentModelRef: selection.currentModelRef } : {}),
    ...(selection.defaultModelRef ? { defaultModelRef: selection.defaultModelRef } : {}),
    ...(selection.effectiveModelRef ? { effectiveModelRef: selection.effectiveModelRef } : {}),
    ...(selection.effectiveSource ? { effectiveSource: selection.effectiveSource } : {}),
    action: 'reset'
  };
}

function buildMutationResult(input: {
  input: ModelsCommandInput;
  action: ModelsMutationResult['action'];
  targetModelRef?: string;
}): ModelsMutationResult {
  const normalizedInput = withFallbackDirs(input.input);
  const runtime = createModelsRuntime(normalizedInput);
  const selection = runtime.resolveModelSelection();

  return {
    configSource: runtime.loadedConfig.source,
    ...(runtime.loadedConfig.filePath ? { configFilePath: runtime.loadedConfig.filePath } : {}),
    stateFilePath: selection.stateFilePath,
    ...(selection.currentModelRef ? { currentModelRef: selection.currentModelRef } : {}),
    ...(selection.defaultModelRef ? { defaultModelRef: selection.defaultModelRef } : {}),
    ...(selection.effectiveModelRef ? { effectiveModelRef: selection.effectiveModelRef } : {}),
    ...(selection.effectiveSource ? { effectiveSource: selection.effectiveSource } : {}),
    action: input.action,
    ...(input.targetModelRef ? { targetModelRef: input.targetModelRef } : {})
  };
}

function normalizeAndValidateModelRef(input: ModelsCommandInput): string {
  const rawModelRef = input.modelRef?.trim();
  if (!rawModelRef) {
    throw new Error('models use/default 需要提供 <provider>/<model>。');
  }

  const parsed = parseModelRef(rawModelRef);
  const runtime = createModelsRuntime(withFallbackDirs(input));
  const catalogProviders = listCatalogProviders(runtime.loadedConfig.config);
  if (catalogProviders.length > 0) {
    const provider = catalogProviders.find((candidate) => candidate.id === parsed.providerId);
    if (!provider) {
      throw new Error(`配置里不存在 provider：${parsed.providerId}`);
    }
    const model = provider.models.find((candidate) => candidate.id === parsed.modelId);
    if (!model) {
      throw new Error(`provider ${parsed.providerId} 下不存在模型：${parsed.modelId}`);
    }
  }

  return parsed.ref;
}

function withFallbackDirs(input: ModelsCommandInput): ModelsCommandInput {
  return {
    ...input,
    fallbackDirs: input.fallbackDirs
  };
}

function createModelsRuntime(
  input: ModelsCommandInput & {
    loadedConfig?: ReturnType<typeof createLlmToolkitRuntime>['loadedConfig'];
  }
) {
  const pluginLoadOptions = getPluginLlmConfigLoadOptions({
    ...(input.loadedConfig?.filePath
      ? { configFilePath: input.loadedConfig.filePath }
      : input.configFilePath
        ? { configFilePath: input.configFilePath }
        : {}),
    ...(input.fallbackDirs ? { fallbackDirs: input.fallbackDirs } : {})
  });

  const runtime = createLlmToolkitRuntime({
    ...(input.loadedConfig ? { config: input.loadedConfig.config } : {}),
    ...pluginLoadOptions,
    ...(input.loadedConfig?.configDir
      ? { cwd: input.loadedConfig.configDir }
      : input.cwd
        ? { cwd: input.cwd }
        : {}),
  });

  return {
    ...runtime,
    loadedConfig: input.loadedConfig ?? runtime.loadedConfig
  };
}

function resolvePluginStateOptions(
  input: ModelsCommandInput & {
    loadedConfig?: ReturnType<typeof createLlmToolkitRuntime>['loadedConfig'];
  },
  loadedConfig?: ReturnType<typeof createLlmToolkitRuntime>['loadedConfig']
) {
  return {
    ...getPluginLlmConfigLoadOptions({
      ...(input.configFilePath ? { configFilePath: input.configFilePath } : {}),
      ...(input.fallbackDirs ? { fallbackDirs: input.fallbackDirs } : {})
    }),
    ...(input.cwd ? { cwd: input.cwd } : {}),
    ...(loadedConfig ? { loadedConfig } : {})
  };
}
