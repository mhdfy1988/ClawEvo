import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COMPACT_CONTEXT_RUNTIME_CONFIG_FILE_NAME = 'compact-context.runtime.config.json';
export const COMPACT_CONTEXT_RUNTIME_CONFIG_EXAMPLE_FILE_NAME = 'compact-context.runtime.config.example.json';

const PLUGIN_ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export interface LoadedCompactContextRuntimeConfig {
  config: Record<string, unknown>;
  source: 'defaults' | 'file';
  filePath?: string;
  configDir: string;
}

export function getPluginRuntimeConfigFilePath(): string {
  return join(PLUGIN_ROOT_DIR, COMPACT_CONTEXT_RUNTIME_CONFIG_FILE_NAME);
}

export function getPluginRuntimeConfigExampleFilePath(): string {
  return join(PLUGIN_ROOT_DIR, COMPACT_CONTEXT_RUNTIME_CONFIG_EXAMPLE_FILE_NAME);
}

export function loadCompactContextRuntimeConfig(): LoadedCompactContextRuntimeConfig {
  const filePath = getPluginRuntimeConfigFilePath();

  if (!existsSync(filePath)) {
    return {
      config: {},
      source: 'defaults',
      configDir: PLUGIN_ROOT_DIR
    };
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Compact Context runtime 配置文件必须是 JSON 对象：${filePath}`);
  }

  return {
    config: parsed as Record<string, unknown>,
    source: 'file',
    filePath,
    configDir: dirname(filePath)
  };
}
