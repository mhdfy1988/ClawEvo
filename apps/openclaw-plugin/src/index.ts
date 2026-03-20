import { createCompactContextCore } from '@openclaw-compact-context/compact-context-core';
import { createOpenClawPlugin } from '@openclaw-compact-context/openclaw-adapter/openclaw';
import { normalizePluginConfig } from '@openclaw-compact-context/openclaw-adapter/openclaw/context-engine-adapter';
import { registerCompactContextHostCli } from './cli/openclaw-host-cli.js';
import { loadCompactContextRuntimeConfig } from './runtime-config.js';

export * from '@openclaw-compact-context/openclaw-adapter';

const basePlugin = createOpenClawPlugin(createCompactContextCore(), {
  resolveConfig() {
    const loaded = loadCompactContextRuntimeConfig();
    return normalizePluginConfig(loaded.config, {
      configBaseDir: loaded.configDir
    });
  }
});

const defaultPlugin = {
  ...basePlugin,
  register(api: Parameters<NonNullable<typeof basePlugin.register>>[0]) {
    basePlugin.register?.(api);
    registerCompactContextHostCli(api);
  }
};

export default defaultPlugin;
