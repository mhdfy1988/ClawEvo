import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import type {
  CodexTransportId,
  LlmApiKind,
  LlmAuthKind,
  LlmInputKind,
  LlmModelCatalogEntry,
  LlmProviderCatalogEntry,
  LlmProviderRuntimeEntry,
  LlmProviderStatus,
  LlmReasoningEffort
} from './provider-types.js';

export const DEFAULT_LLM_CONFIG_FILE_NAME = 'openclaw.llm.config.json';

export interface CodexCliFileConfig {
  enabled?: boolean;
  command?: string;
  model?: string;
  reasoningEffort?: LlmReasoningEffort;
  cwd?: string;
}

export interface CodexOAuthFileConfig {
  enabled?: boolean;
  baseUrl?: string;
  model?: string;
  reasoningEffort?: LlmReasoningEffort;
  systemPrompt?: string;
  credentialFilePath?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  redirectUri?: string;
  scope?: string;
  clientId?: string;
}

export interface OpenAIResponsesFileConfig {
  enabled?: boolean;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  reasoningEffort?: LlmReasoningEffort;
  systemPrompt?: string;
}

export interface LlmModelCatalogFileConfig {
  id: string;
  name?: string;
  api?: LlmApiKind;
  reasoning?: boolean;
  input?: LlmInputKind[];
  contextWindow?: number;
  maxTokens?: number;
  notes?: string;
}

export interface LlmProviderCatalogFileConfig {
  enabled?: boolean;
  status?: LlmProviderStatus;
  label?: string;
  vendor?: string;
  auth?: LlmAuthKind;
  api?: LlmApiKind;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  credentialFilePath?: string;
  notes?: string;
  models?: LlmModelCatalogFileConfig[];
}

export interface LlmCatalogConfigSection {
  providerOrder?: string[];
  providers?: Record<string, LlmProviderCatalogFileConfig>;
}

export interface LlmRuntimeConfigSection {
  defaultModelRef?: string;
  stateFilePath?: string;
  providers?: Record<string, LlmProviderRuntimeFileConfig>;
}

export interface LlmProviderRuntimeFileConfig {
  enabled?: boolean;
  auth?: LlmAuthKind;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  credentialFilePath?: string;
  command?: string;
  model?: string;
  reasoningEffort?: LlmReasoningEffort;
  systemPrompt?: string;
  cwd?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  redirectUri?: string;
  scope?: string;
  clientId?: string;
  headers?: Record<string, string>;
}

export interface CodexToolkitConfigSection {
  providerOrder?: CodexTransportId[];
  providers?: {
    'codex-cli'?: CodexCliFileConfig;
    'codex-oauth'?: CodexOAuthFileConfig;
    'openai-responses'?: OpenAIResponsesFileConfig;
  };
}

export interface LlmToolkitConfig {
  catalog?: LlmCatalogConfigSection;
  codex?: CodexToolkitConfigSection;
  runtime?: LlmRuntimeConfigSection;
}

export interface LoadLlmToolkitConfigOptions {
  config?: LlmToolkitConfig;
  configFilePath?: string;
  cwd?: string;
  fallbackDirs?: string[];
}

export interface LoadedLlmToolkitConfig {
  config: LlmToolkitConfig;
  source: 'defaults' | 'inline' | 'file';
  filePath?: string;
  configDir: string;
}

export function loadLlmToolkitConfig(options: LoadLlmToolkitConfigOptions = {}): LoadedLlmToolkitConfig {
  const cwd = resolve(options.cwd || process.cwd());

  if (options.config) {
    return {
      config: options.config,
      source: 'inline',
      configDir: cwd
    };
  }

  const filePath = resolveConfigFilePath({
    cwd,
    explicitPath: options.configFilePath,
    fallbackDirs: options.fallbackDirs
  });

  if (!filePath) {
    return {
      config: {},
      source: 'defaults',
      configDir: cwd
    };
  }

  return {
    config: parseToolkitConfig(readFileSync(filePath, 'utf8'), filePath),
    source: 'file',
    filePath,
    configDir: dirname(filePath)
  };
}

export function resolveToolkitRelativePath(configDir: string, value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  if (isAbsolute(value)) {
    return value;
  }

  return resolve(configDir, value);
}

export function normalizeTransportOrder(order: readonly string[] | undefined): CodexTransportId[] {
  if (!order || order.length === 0) {
    return [];
  }

  const normalized = order.filter(isCodexTransportId);
  return [...new Set(normalized)];
}

export function listCatalogProviders(config: LlmToolkitConfig | undefined): LlmProviderCatalogEntry[] {
  if (!config?.catalog?.providers) {
    return [];
  }

  return Object.entries(config.catalog.providers).map(([providerId, provider]) => ({
    id: providerId,
    enabled: provider.enabled !== false,
    status: provider.status || 'planned',
    ...(provider.label ? { label: provider.label } : {}),
    ...(provider.vendor ? { vendor: provider.vendor } : {}),
    ...(provider.auth ? { auth: provider.auth } : {}),
    ...(provider.api ? { api: provider.api } : {}),
    ...(provider.notes ? { notes: provider.notes } : {}),
    models: (provider.models || []).map(normalizeCatalogModel)
  }));
}

export function resolveProviderRuntimeConfig(
  config: LlmToolkitConfig | undefined,
  providerId: string
): LlmProviderRuntimeEntry | undefined {
  const runtimeProvider = config?.runtime?.providers?.[providerId];
  const catalogProvider = config?.catalog?.providers?.[providerId];
  const codexProvider = resolveCodexRuntimeCompatConfig(config, providerId);

  const enabled = runtimeProvider?.enabled ?? catalogProvider?.enabled ?? codexProvider?.enabled;
  const auth = runtimeProvider?.auth ?? catalogProvider?.auth;
  const baseUrl = runtimeProvider?.baseUrl ?? catalogProvider?.baseUrl ?? codexProvider?.baseUrl;
  const apiKey = runtimeProvider?.apiKey ?? catalogProvider?.apiKey ?? codexProvider?.apiKey;
  const apiKeyEnv = runtimeProvider?.apiKeyEnv ?? catalogProvider?.apiKeyEnv;
  const credentialFilePath =
    runtimeProvider?.credentialFilePath ?? catalogProvider?.credentialFilePath ?? codexProvider?.credentialFilePath;
  const command = runtimeProvider?.command ?? codexProvider?.command;
  const model = runtimeProvider?.model ?? codexProvider?.model;
  const reasoningEffort = runtimeProvider?.reasoningEffort ?? codexProvider?.reasoningEffort;
  const systemPrompt = runtimeProvider?.systemPrompt ?? codexProvider?.systemPrompt;
  const cwd = runtimeProvider?.cwd ?? codexProvider?.cwd;
  const authorizeUrl = runtimeProvider?.authorizeUrl ?? codexProvider?.authorizeUrl;
  const tokenUrl = runtimeProvider?.tokenUrl ?? codexProvider?.tokenUrl;
  const redirectUri = runtimeProvider?.redirectUri ?? codexProvider?.redirectUri;
  const scope = runtimeProvider?.scope ?? codexProvider?.scope;
  const clientId = runtimeProvider?.clientId ?? codexProvider?.clientId;
  const headers = runtimeProvider?.headers;

  const merged: LlmProviderRuntimeEntry = {
    id: providerId,
    ...(enabled !== undefined ? { enabled } : {}),
    ...(auth ? { auth } : {}),
    ...(baseUrl ? { baseUrl } : {}),
    ...(apiKey ? { apiKey } : {}),
    ...(apiKeyEnv ? { apiKeyEnv } : {}),
    ...(credentialFilePath ? { credentialFilePath } : {}),
    ...(command ? { command } : {}),
    ...(model ? { model } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}),
    ...(systemPrompt ? { systemPrompt } : {}),
    ...(cwd ? { cwd } : {}),
    ...(authorizeUrl ? { authorizeUrl } : {}),
    ...(tokenUrl ? { tokenUrl } : {}),
    ...(redirectUri ? { redirectUri } : {}),
    ...(scope ? { scope } : {}),
    ...(clientId ? { clientId } : {}),
    ...(headers ? { headers: { ...headers } } : {})
  };

  return Object.keys(merged).length > 1 ? merged : undefined;
}

export function resolveCatalogProviderOrder(config: LlmToolkitConfig | undefined): string[] {
  if (!config?.catalog) {
    return [];
  }

  const configuredOrder = config.catalog.providerOrder?.filter((value) => typeof value === 'string' && value.trim()) || [];
  if (configuredOrder.length > 0) {
    return [...new Set(configuredOrder)];
  }

  return listCatalogProviders(config)
    .filter((provider) => provider.enabled)
    .map((provider) => provider.id);
}

function resolveConfigFilePath(input: { cwd: string; explicitPath?: string; fallbackDirs?: string[] }): string | undefined {
  const explicitPath = input.explicitPath?.trim();
  if (explicitPath) {
    const candidates = explicitPathCandidates(input.cwd, explicitPath, input.fallbackDirs);
    const matched = candidates.find((candidate) => existsSync(candidate));
    if (!matched) {
      throw new Error(`显式配置文件不存在：${explicitPath}`);
    }

    return matched;
  }

  const envPath = process.env.OPENCLAW_LLM_CONFIG?.trim();
  if (envPath) {
    const candidates = explicitPathCandidates(input.cwd, envPath, input.fallbackDirs);
    const matched = candidates.find((candidate) => existsSync(candidate));
    if (!matched) {
      throw new Error(`环境变量 OPENCLAW_LLM_CONFIG 指向的配置文件不存在：${envPath}`);
    }

    return matched;
  }

  const candidates = [
    join(input.cwd, DEFAULT_LLM_CONFIG_FILE_NAME),
    join(input.cwd, '.openclaw', 'llm.config.json'),
    ...defaultConfigCandidates(input.fallbackDirs),
    join(homedir(), '.openclaw', 'llm.config.json')
  ];

  return [...new Set(candidates)].find((candidate) => existsSync(candidate));
}

function explicitPathCandidates(cwd: string, explicitPath: string, fallbackDirs: readonly string[] | undefined): string[] {
  if (isAbsolute(explicitPath)) {
    return [explicitPath];
  }

  return [...new Set([resolve(cwd, explicitPath), ...resolveAgainstFallbackDirs(explicitPath, fallbackDirs)])];
}

function defaultConfigCandidates(fallbackDirs: readonly string[] | undefined): string[] {
  if (!fallbackDirs || fallbackDirs.length === 0) {
    return [];
  }

  const candidates = fallbackDirs.flatMap((dir) => [
    join(dir, DEFAULT_LLM_CONFIG_FILE_NAME),
    join(dir, '.openclaw', 'llm.config.json')
  ]);

  return [...new Set(candidates)];
}

function resolveAgainstFallbackDirs(value: string, fallbackDirs: readonly string[] | undefined): string[] {
  if (!fallbackDirs || fallbackDirs.length === 0) {
    return [];
  }

  return fallbackDirs.map((dir) => resolve(dir, value));
}

function parseToolkitConfig(rawText: string, filePath: string): LlmToolkitConfig {
  const parsed = JSON.parse(rawText) as unknown;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`LLM 配置文件必须是 JSON 对象：${filePath}`);
  }

  return parsed as LlmToolkitConfig;
}

function normalizeCatalogModel(model: LlmModelCatalogFileConfig): LlmModelCatalogEntry {
  return {
    id: model.id,
    ...(model.name ? { name: model.name } : {}),
    ...(model.api ? { api: model.api } : {}),
    ...(typeof model.reasoning === 'boolean' ? { reasoning: model.reasoning } : {}),
    ...(model.input ? { input: [...model.input] } : {}),
    ...(typeof model.contextWindow === 'number' ? { contextWindow: model.contextWindow } : {}),
    ...(typeof model.maxTokens === 'number' ? { maxTokens: model.maxTokens } : {}),
    ...(model.notes ? { notes: model.notes } : {})
  };
}

function isCodexTransportId(value: string): value is CodexTransportId {
  return value === 'codex-cli' || value === 'codex-oauth' || value === 'openai-responses';
}

function resolveCodexRuntimeCompatConfig(
  config: LlmToolkitConfig | undefined,
  providerId: string
): LlmProviderRuntimeFileConfig | undefined {
  if (!config?.codex?.providers) {
    return undefined;
  }

  if (providerId === 'codex-cli') {
    return config.codex.providers['codex-cli'];
  }

  if (providerId === 'codex-oauth') {
    return config.codex.providers['codex-oauth'];
  }

  if (providerId === 'openai-responses') {
    return config.codex.providers['openai-responses'];
  }

  return undefined;
}
