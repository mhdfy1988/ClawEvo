import type { LoadLlmToolkitConfigOptions, LlmRuntimeConfigSection } from '@openclaw-compact-context/llm-toolkit';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COMPACT_CONTEXT_PLUGIN_ID = 'compact-context';
export const COMPACT_CONTEXT_CONFIG_FILE_NAME = 'compact-context.llm.config.json';
export const COMPACT_CONTEXT_CONFIG_EXAMPLE_FILE_NAME = 'compact-context.llm.config.example.json';
export const COMPACT_CONTEXT_STATE_FILE_NAME = 'compact-context.llm.state.json';
export const COMPACT_CONTEXT_CREDENTIAL_FILE_NAME = 'compact-context.codex-oauth.json';

export const PLUGIN_ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OPENCLAW_PLUGIN_DATA_DIR = resolve(homedir(), '.openclaw', 'plugins', COMPACT_CONTEXT_PLUGIN_ID);

export function getPluginConfigFallbackDirs(): string[] {
  return [OPENCLAW_PLUGIN_DATA_DIR, PLUGIN_ROOT_DIR];
}

export function getPluginLlmConfigLoadOptions(input: {
  configFilePath?: string;
  fallbackDirs?: string[];
} = {}): Pick<
  LoadLlmToolkitConfigOptions,
  'configFilePath' | 'fallbackDirs' | 'defaultConfigSearchPaths' | 'includeLegacyDefaultSearch' | 'writableConfigFilePath' | 'defaultRuntimeConfig'
> {
  return {
    ...(input.configFilePath ? { configFilePath: input.configFilePath } : {}),
    fallbackDirs: input.fallbackDirs ?? getPluginConfigFallbackDirs(),
    defaultConfigSearchPaths: getPluginDefaultConfigSearchPaths(),
    includeLegacyDefaultSearch: false,
    writableConfigFilePath: getPluginWritableConfigFilePath(),
    defaultRuntimeConfig: getPluginDefaultRuntimeConfig()
  };
}

export function getPluginDefaultConfigSearchPaths(): string[] {
  return [
    join(OPENCLAW_PLUGIN_DATA_DIR, COMPACT_CONTEXT_CONFIG_FILE_NAME),
    join(PLUGIN_ROOT_DIR, COMPACT_CONTEXT_CONFIG_FILE_NAME)
  ];
}

export function getPluginWritableConfigFilePath(): string {
  return join(OPENCLAW_PLUGIN_DATA_DIR, COMPACT_CONTEXT_CONFIG_FILE_NAME);
}

export function getPluginDefaultRuntimeConfig(): LlmRuntimeConfigSection {
  return {
    stateFilePath: resolvePreferredDefaultPath({
      openclawPath: join(OPENCLAW_PLUGIN_DATA_DIR, COMPACT_CONTEXT_STATE_FILE_NAME),
      pluginPath: join(PLUGIN_ROOT_DIR, COMPACT_CONTEXT_STATE_FILE_NAME)
    }),
    providers: {
      'codex-oauth': {
        credentialFilePath: resolvePreferredDefaultPath({
          openclawPath: join(OPENCLAW_PLUGIN_DATA_DIR, COMPACT_CONTEXT_CREDENTIAL_FILE_NAME),
          pluginPath: join(PLUGIN_ROOT_DIR, COMPACT_CONTEXT_CREDENTIAL_FILE_NAME)
        })
      }
    }
  };
}

function resolvePreferredDefaultPath(input: { openclawPath: string; pluginPath: string }): string {
  if (existsSync(input.openclawPath)) {
    return input.openclawPath;
  }

  if (existsSync(input.pluginPath)) {
    return input.pluginPath;
  }

  return input.openclawPath;
}
