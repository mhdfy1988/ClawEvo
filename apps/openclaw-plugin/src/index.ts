import {
  ControlPlaneFacade,
  GovernanceService,
  ImportService,
  ObservabilityService,
  buildDefaultImporterRegistry
} from '@openclaw-compact-context/control-plane-core';
import { createOpenClawPlugin } from '@openclaw-compact-context/openclaw-adapter/openclaw';

export * from '@openclaw-compact-context/openclaw-adapter';

const defaultPlugin = createOpenClawPlugin(
  new ControlPlaneFacade(
    new GovernanceService(),
    new ObservabilityService(),
    new ImportService(),
    buildDefaultImporterRegistry()
  )
);

export default defaultPlugin;
