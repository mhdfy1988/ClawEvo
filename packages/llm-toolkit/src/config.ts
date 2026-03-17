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
    explicitPath: options.configFilePath
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
    ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}),
    ...(provider.apiKey ? { apiKey: provider.apiKey } : {}),
    ...(provider.apiKeyEnv ? { apiKeyEnv: provider.apiKeyEnv } : {}),
    ...(provider.credentialFilePath ? { credentialFilePath: provider.credentialFilePath } : {}),
    ...(provider.notes ? { notes: provider.notes } : {}),
    models: (provider.models || []).map(normalizeCatalogModel)
  }));
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

function resolveConfigFilePath(input: { cwd: string; explicitPath?: string }): string | undefined {
  const explicitPath = input.explicitPath?.trim() || process.env.OPENCLAW_LLM_CONFIG?.trim();
  if (explicitPath) {
    const resolved = resolve(input.cwd, explicitPath);
    return existsSync(resolved) ? resolved : undefined;
  }

  const candidates = [
    join(input.cwd, DEFAULT_LLM_CONFIG_FILE_NAME),
    join(input.cwd, '.openclaw', 'llm.config.json'),
    join(homedir(), '.openclaw', 'llm.config.json')
  ];

  return candidates.find((candidate) => existsSync(candidate));
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
