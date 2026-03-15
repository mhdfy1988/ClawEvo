import { ControlPlaneFacade } from '../control-plane/control-plane-facade.js';
import type { ControlPlaneFacadeContract } from '../control-plane/contracts.js';
import { GovernanceService } from '../control-plane/governance-service.js';
import { ImportService } from '../control-plane/import-service.js';
import { buildDefaultImporterRegistry } from '../control-plane/importer-registry.js';
import { ObservabilityService } from '../control-plane/observability-service.js';

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
