import { createCompactContextCore } from '@openclaw-compact-context/compact-context-core';
import { createOpenClawPlugin } from '@openclaw-compact-context/openclaw-adapter/openclaw';
import { registerCompactContextHostCli } from './cli/openclaw-host-cli.js';

export * from '@openclaw-compact-context/openclaw-adapter';

const basePlugin = createOpenClawPlugin(createCompactContextCore());

const defaultPlugin = {
  ...basePlugin,
  register(api: Parameters<NonNullable<typeof basePlugin.register>>[0]) {
    basePlugin.register?.(api);
    registerCompactContextHostCli(api);
  }
};

export default defaultPlugin;
