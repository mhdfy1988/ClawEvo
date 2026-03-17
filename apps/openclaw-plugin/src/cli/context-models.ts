import {
  listCatalogProviders,
  loadLlmToolkitConfig,
  parseModelRef,
  resolveModelSelection,
  saveCurrentModelRef,
  saveDefaultModelRef
} from '@openclaw-compact-context/llm-toolkit';
import { getPluginConfigFallbackDirs } from './config-paths.js';

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
  targetModelRef: string;
}

export function runModelsList(input: ModelsCommandInput = {}): ModelsListResult {
  const normalizedInput = withFallbackDirs(input);
  const loadedConfig = loadLlmToolkitConfig(normalizedInput);
  const providers = listCatalogProviders(loadedConfig.config);
  const selection = resolveModelSelection({
    loadedConfig,
    fallbackDirs: normalizedInput.fallbackDirs
  });

  return {
    configSource: loadedConfig.source,
    ...(loadedConfig.filePath ? { configFilePath: loadedConfig.filePath } : {}),
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
  const loadedConfig = loadLlmToolkitConfig(normalizedInput);
  const selection = resolveModelSelection({
    loadedConfig,
    fallbackDirs: normalizedInput.fallbackDirs
  });

  return {
    configSource: loadedConfig.source,
    ...(loadedConfig.filePath ? { configFilePath: loadedConfig.filePath } : {}),
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
  saveCurrentModelRef(modelRef, normalizedInput);
  return buildMutationResult({
    input: normalizedInput,
    targetModelRef: modelRef
  });
}

export function runModelsDefault(input: ModelsCommandInput): ModelsMutationResult {
  const normalizedInput = withFallbackDirs(input);
  const modelRef = normalizeAndValidateModelRef(normalizedInput);
  const loadedConfig = saveDefaultModelRef(modelRef, normalizedInput);
  const selection = resolveModelSelection({
    loadedConfig,
    fallbackDirs: normalizedInput.fallbackDirs
  });

  return {
    configSource: loadedConfig.source,
    ...(loadedConfig.filePath ? { configFilePath: loadedConfig.filePath } : {}),
    stateFilePath: selection.stateFilePath,
    ...(selection.currentModelRef ? { currentModelRef: selection.currentModelRef } : {}),
    ...(selection.defaultModelRef ? { defaultModelRef: selection.defaultModelRef } : {}),
    ...(selection.effectiveModelRef ? { effectiveModelRef: selection.effectiveModelRef } : {}),
    ...(selection.effectiveSource ? { effectiveSource: selection.effectiveSource } : {}),
    targetModelRef: modelRef
  };
}

function buildMutationResult(input: {
  input: ModelsCommandInput;
  targetModelRef: string;
}): ModelsMutationResult {
  const normalizedInput = withFallbackDirs(input.input);
  const loadedConfig = loadLlmToolkitConfig(normalizedInput);
  const selection = resolveModelSelection({
    loadedConfig,
    fallbackDirs: normalizedInput.fallbackDirs
  });

  return {
    configSource: loadedConfig.source,
    ...(loadedConfig.filePath ? { configFilePath: loadedConfig.filePath } : {}),
    stateFilePath: selection.stateFilePath,
    ...(selection.currentModelRef ? { currentModelRef: selection.currentModelRef } : {}),
    ...(selection.defaultModelRef ? { defaultModelRef: selection.defaultModelRef } : {}),
    ...(selection.effectiveModelRef ? { effectiveModelRef: selection.effectiveModelRef } : {}),
    ...(selection.effectiveSource ? { effectiveSource: selection.effectiveSource } : {}),
    targetModelRef: input.targetModelRef
  };
}

function normalizeAndValidateModelRef(input: ModelsCommandInput): string {
  const rawModelRef = input.modelRef?.trim();
  if (!rawModelRef) {
    throw new Error('models use/default 需要提供 <provider>/<model>。');
  }

  const parsed = parseModelRef(rawModelRef);
  const loadedConfig = loadLlmToolkitConfig(withFallbackDirs(input));
  const catalogProviders = listCatalogProviders(loadedConfig.config);
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
    fallbackDirs: input.fallbackDirs ?? getPluginConfigFallbackDirs()
  };
}
