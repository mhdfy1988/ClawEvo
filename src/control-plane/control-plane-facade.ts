import type {
  ControlPlaneFacadeContract,
  ControlPlaneReadonlySource,
  GovernanceServiceContract,
  ImportServiceContract,
  ObservabilityServiceContract
} from './contracts.js';
import { CONTROL_PLANE_READONLY_SOURCES } from './contracts.js';

export class ControlPlaneFacade implements ControlPlaneFacadeContract {
  readonly readonlySources: readonly ControlPlaneReadonlySource[] = CONTROL_PLANE_READONLY_SOURCES;

  constructor(
    private readonly governanceService: GovernanceServiceContract,
    private readonly observabilityService: ObservabilityServiceContract,
    private readonly importService: ImportServiceContract
  ) {}

  submitProposal(...args: Parameters<GovernanceServiceContract['submitProposal']>) {
    return this.governanceService.submitProposal(...args);
  }

  reviewProposal(...args: Parameters<GovernanceServiceContract['reviewProposal']>) {
    return this.governanceService.reviewProposal(...args);
  }

  applyProposal(...args: Parameters<GovernanceServiceContract['applyProposal']>) {
    return this.governanceService.applyProposal(...args);
  }

  rollbackProposal(...args: Parameters<GovernanceServiceContract['rollbackProposal']>) {
    return this.governanceService.rollbackProposal(...args);
  }

  listProposals(...args: Parameters<GovernanceServiceContract['listProposals']>) {
    return this.governanceService.listProposals(...args);
  }

  listAuditRecords(...args: Parameters<GovernanceServiceContract['listAuditRecords']>) {
    return this.governanceService.listAuditRecords(...args);
  }

  buildDashboard(...args: Parameters<ObservabilityServiceContract['buildDashboard']>) {
    return this.observabilityService.buildDashboard(...args);
  }

  recordDashboardSnapshot(...args: Parameters<ObservabilityServiceContract['recordDashboardSnapshot']>) {
    return this.observabilityService.recordDashboardSnapshot(...args);
  }

  listDashboardSnapshots(...args: Parameters<ObservabilityServiceContract['listDashboardSnapshots']>) {
    return this.observabilityService.listDashboardSnapshots(...args);
  }

  buildDashboardHistory(...args: Parameters<ObservabilityServiceContract['buildDashboardHistory']>) {
    return this.observabilityService.buildDashboardHistory(...args);
  }

  createImportJob(...args: Parameters<ImportServiceContract['createJob']>) {
    return this.importService.createJob(...args);
  }

  runImportJob(...args: Parameters<ImportServiceContract['runJob']>) {
    return this.importService.runJob(...args);
  }

  retryImportJob(...args: Parameters<ImportServiceContract['retryJob']>) {
    return this.importService.retryJob(...args);
  }

  rerunImportJob(...args: Parameters<ImportServiceContract['rerunJob']>) {
    return this.importService.rerunJob(...args);
  }

  scheduleImportJob(...args: Parameters<ImportServiceContract['scheduleJob']>) {
    return this.importService.scheduleJob(...args);
  }

  runDueImportJobs(...args: Parameters<ImportServiceContract['runDueJobs']>) {
    return this.importService.runDueJobs(...args);
  }

  getImportJob(...args: Parameters<ImportServiceContract['getJob']>) {
    return this.importService.getJob(...args);
  }

  listImportJobs(...args: Parameters<ImportServiceContract['listJobs']>) {
    return this.importService.listJobs(...args);
  }

  listImportJobHistory(...args: Parameters<ImportServiceContract['getJobHistory']>) {
    return this.importService.getJobHistory(...args);
  }
}
