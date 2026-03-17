import {
  ControlPlaneFacade,
  GovernanceService,
  ImportService,
  ObservabilityService,
  buildDefaultImporterRegistry
} from '@openclaw-compact-context/control-plane-core';
import { createOpenClawPlugin } from '@openclaw-compact-context/openclaw-adapter/openclaw';
import { registerCompactContextHostCli } from './cli/openclaw-host-cli.js';

export * from '@openclaw-compact-context/openclaw-adapter';

const basePlugin = createOpenClawPlugin(
  new ControlPlaneFacade(
    new GovernanceService(),
    new ObservabilityService(),
    new ImportService(),
    buildDefaultImporterRegistry()
  )
);

const defaultPlugin = {
  ...basePlugin,
  register(api: Parameters<NonNullable<typeof basePlugin.register>>[0]) {
    basePlugin.register?.(api);
    registerCompactContextHostCli(api);
  }
};

export default defaultPlugin;
