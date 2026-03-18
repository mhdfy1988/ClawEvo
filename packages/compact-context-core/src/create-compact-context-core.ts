import type { ControlPlaneFacadeContract } from './contracts.js';
import { ControlPlaneFacade } from './control-plane-facade.js';
import { GovernanceService } from './governance-service.js';
import { ImportService } from './import-service.js';
import { buildDefaultImporterRegistry } from './importer-registry.js';
import { ObservabilityService } from './observability-service.js';

export function createCompactContextCore(): ControlPlaneFacadeContract {
  return new ControlPlaneFacade(
    new GovernanceService(),
    new ObservabilityService(),
    new ImportService(),
    buildDefaultImporterRegistry()
  );
}
