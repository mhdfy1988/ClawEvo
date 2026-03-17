import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import {
  DEFAULT_LLM_CONFIG_FILE_NAME,
  loadLlmToolkitConfig,
  resolveToolkitRelativePath,
  type LoadedLlmToolkitConfig,
  type LoadLlmToolkitConfigOptions,
  type LlmToolkitConfig
} from './config.js';

export const DEFAULT_LLM_STATE_FILE_NAME = join('.openclaw', 'llm.state.json');

export interface LlmToolkitState {
  currentModelRef?: string;
  updatedAt?: string;
}

export interface ParsedModelRef {
  ref: string;
  providerId: string;
  modelId: string;
}

export interface LoadedLlmToolkitState {
  state: LlmToolkitState;
  filePath: string;
  source: 'defaults' | 'file';
}

export interface ResolvedModelSelection {
  configSource: 'defaults' | 'inline' | 'file';
  configFilePath?: string;
  stateFilePath: string;
  currentModelRef?: string;
  defaultModelRef?: string;
  effectiveModelRef?: string;
  effectiveSource?: 'state' | 'config';
}

interface StateContextOptions extends LoadLlmToolkitConfigOptions {
  loadedConfig?: LoadedLlmToolkitConfig;
}

export function parseModelRef(value: string): ParsedModelRef {
  const trimmed = value.trim();
  const separator = trimmed.indexOf('/');
  if (separator <= 0 || separator === trimmed.length - 1) {
    throw new Error(`模型引用格式无效：${value}。期望 <provider>/<model>。`);
  }

  const providerId = trimmed.slice(0, separator).trim();
  const modelId = trimmed.slice(separator + 1).trim();
  if (!providerId || !modelId) {
    throw new Error(`模型引用格式无效：${value}。期望 <provider>/<model>。`);
  }

  return {
    ref: `${providerId}/${modelId}`,
    providerId,
    modelId
  };
}

export function normalizeModelRef(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  return parseModelRef(value).ref;
}

export function formatModelRef(providerId: string, modelId: string): string {
  return parseModelRef(`${providerId}/${modelId}`).ref;
}

export function loadLlmToolkitState(options: StateContextOptions = {}): LoadedLlmToolkitState {
  const loadedConfig = resolveLoadedConfig(options);
  const filePath = resolveLlmToolkitStateFilePath({ loadedConfig });

  if (!existsSync(filePath)) {
    return {
      state: {},
      filePath,
      source: 'defaults'
    };
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`LLM 状态文件必须是 JSON 对象：${filePath}`);
  }

  const state = parsed as LlmToolkitState;
  return {
    state: {
      ...(normalizeModelRef(state.currentModelRef) ? { currentModelRef: normalizeModelRef(state.currentModelRef) } : {}),
      ...(typeof state.updatedAt === 'string' ? { updatedAt: state.updatedAt } : {})
    },
    filePath,
    source: 'file'
  };
}

export function saveCurrentModelRef(
  modelRef: string | undefined,
  options: StateContextOptions = {}
): LoadedLlmToolkitState {
  const loadedConfig = resolveLoadedConfig(options);
  const filePath = resolveLlmToolkitStateFilePath({ loadedConfig });
  const nextState: LlmToolkitState = {
    ...(normalizeModelRef(modelRef) ? { currentModelRef: normalizeModelRef(modelRef) } : {}),
    updatedAt: new Date().toISOString()
  };

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');

  return {
    state: nextState,
    filePath,
    source: 'file'
  };
}

export function saveDefaultModelRef(
  modelRef: string | undefined,
  options: LoadLlmToolkitConfigOptions = {}
): LoadedLlmToolkitConfig {
  const loadedConfig = loadLlmToolkitConfig(options);
  const normalizedRef = normalizeModelRef(modelRef);

  if (!normalizedRef && loadedConfig.source === 'defaults' && !loadedConfig.filePath) {
    return loadedConfig;
  }

  const filePath = resolveWritableConfigFilePath(loadedConfig, options.cwd, options.writableConfigFilePath);
  const nextConfig: LlmToolkitConfig = {
    ...loadedConfig.config,
    runtime: {
      ...loadedConfig.config.runtime,
      ...(normalizedRef ? { defaultModelRef: normalizedRef } : {})
    }
  };

  if (!normalizedRef) {
    delete nextConfig.runtime?.defaultModelRef;
    if (nextConfig.runtime && Object.keys(nextConfig.runtime).length === 0) {
      delete nextConfig.runtime;
    }
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');

  return {
    config: nextConfig,
    source: 'file',
    filePath,
    configDir: dirname(filePath)
  };
}

export function resolveLlmToolkitStateFilePath(options: StateContextOptions = {}): string {
  const loadedConfig = resolveLoadedConfig(options);
  return resolveStateFilePathFromLoadedConfig(loadedConfig);
}

export function resolveModelSelection(options: StateContextOptions & {
  mode?: string;
  registeredProviderIds?: readonly string[];
} = {}): ResolvedModelSelection {
  const loadedConfig = resolveLoadedConfig(options);
  const loadedState = loadLlmToolkitState({ loadedConfig });
  const currentModelRef = normalizeModelRef(loadedState.state.currentModelRef);
  const defaultModelRef = normalizeModelRef(loadedConfig.config.runtime?.defaultModelRef);
  const requestedProviderId = resolveRequestedProviderId({
    mode: options.mode,
    registeredProviderIds: options.registeredProviderIds
  });
  const registeredProviderIds = options.registeredProviderIds ? new Set(options.registeredProviderIds) : undefined;

  const effectiveStateModelRef = resolveCandidateModelRef({
    requestedProviderId,
    registeredProviderIds,
    modelRef: currentModelRef
  });
  if (effectiveStateModelRef) {
    return {
      configSource: loadedConfig.source,
      ...(loadedConfig.filePath ? { configFilePath: loadedConfig.filePath } : {}),
      stateFilePath: loadedState.filePath,
      ...(currentModelRef ? { currentModelRef } : {}),
      ...(defaultModelRef ? { defaultModelRef } : {}),
      effectiveModelRef: effectiveStateModelRef,
      effectiveSource: 'state'
    };
  }

  const effectiveDefaultModelRef = resolveCandidateModelRef({
    requestedProviderId,
    registeredProviderIds,
    modelRef: defaultModelRef
  });
  return {
    configSource: loadedConfig.source,
    ...(loadedConfig.filePath ? { configFilePath: loadedConfig.filePath } : {}),
    stateFilePath: loadedState.filePath,
    ...(currentModelRef ? { currentModelRef } : {}),
    ...(defaultModelRef ? { defaultModelRef } : {}),
    ...(effectiveDefaultModelRef ? { effectiveModelRef: effectiveDefaultModelRef, effectiveSource: 'config' } : {})
  };
}

export function reorderProviderOrderForModelRef(order: readonly string[], modelRef: string | undefined): string[] {
  const normalizedRef = normalizeModelRef(modelRef);
  if (!normalizedRef) {
    return [...order];
  }

  const { providerId } = parseModelRef(normalizedRef);
  if (!order.includes(providerId)) {
    return [...order];
  }

  return [providerId, ...order.filter((candidate) => candidate !== providerId)];
}

function resolveLoadedConfig(options: StateContextOptions): LoadedLlmToolkitConfig {
  return options.loadedConfig ?? loadLlmToolkitConfig(options);
}

function resolveStateFilePathFromLoadedConfig(loadedConfig: LoadedLlmToolkitConfig): string {
  const configuredPath = resolveToolkitRelativePath(loadedConfig.configDir, loadedConfig.config.runtime?.stateFilePath);
  return configuredPath ?? resolve(loadedConfig.configDir, DEFAULT_LLM_STATE_FILE_NAME);
}

function resolveWritableConfigFilePath(
  loadedConfig: LoadedLlmToolkitConfig,
  cwd?: string,
  writableConfigFilePath?: string
): string {
  if (loadedConfig.filePath) {
    return loadedConfig.filePath;
  }

  if (writableConfigFilePath) {
    return writableConfigFilePath;
  }

  return resolve(cwd || process.cwd(), DEFAULT_LLM_CONFIG_FILE_NAME);
}

function resolveRequestedProviderId(input: {
  mode?: string;
  registeredProviderIds?: readonly string[];
}): string | undefined {
  if (input.mode && input.mode !== 'auto' && input.mode !== 'code' && input.mode !== 'codex' && input.mode !== 'llm') {
    return input.mode;
  }

  if (input.registeredProviderIds && input.registeredProviderIds.length === 1) {
    return input.registeredProviderIds[0];
  }

  return undefined;
}

function resolveCandidateModelRef(input: {
  requestedProviderId?: string;
  registeredProviderIds?: Set<string>;
  modelRef?: string;
}): string | undefined {
  const normalizedRef = normalizeModelRef(input.modelRef);
  if (!normalizedRef) {
    return undefined;
  }

  const parsed = parseModelRef(normalizedRef);
  if (input.requestedProviderId && parsed.providerId !== input.requestedProviderId) {
    return undefined;
  }
  if (input.registeredProviderIds && !input.registeredProviderIds.has(parsed.providerId)) {
    return undefined;
  }

  return parsed.ref;
}
