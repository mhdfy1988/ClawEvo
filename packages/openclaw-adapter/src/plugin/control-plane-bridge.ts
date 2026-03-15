import type { ControlPlaneFacadeContract } from '@openclaw-compact-context/contracts';
import {
  ControlPlaneFacade,
  GovernanceService,
  ImportService,
  ObservabilityService,
  buildDefaultImporterRegistry
} from '@openclaw-compact-context/control-plane-core';

export interface PluginControlPlaneBridge {
  facade: ControlPlaneFacadeContract;
}

export function createDefaultPluginControlPlaneBridge(): PluginControlPlaneBridge {
  const governanceService = new GovernanceService();
  const observabilityService = new ObservabilityService();
  const importService = new ImportService();
  const importerRegistry = buildDefaultImporterRegistry();

  return {
    facade: new ControlPlaneFacade(
      governanceService,
      observabilityService,
      importService,
      importerRegistry
    )
  };
}
