import type {
  AutonomyServiceContract,
  ControlPlaneFacadeContract,
  ControlPlaneReadonlySource,
  ExtensionRegistryContract,
  GovernanceServiceContract,
  ImportServiceContract,
  ImporterRegistryContract,
  ObservabilityServiceContract,
  PlatformEventServiceContract,
  WorkspaceCatalogServiceContract
} from './contracts.js';
import { CONTROL_PLANE_API_BOUNDARY, CONTROL_PLANE_READONLY_SOURCES } from './contracts.js';
import { AutonomyService } from './autonomy-service.js';
import { buildDefaultExtensionRegistry } from './extension-registry.js';
import { PlatformEventService } from './platform-event-service.js';
import { WorkspaceCatalogService } from './workspace-catalog-service.js';

export class ControlPlaneFacade implements ControlPlaneFacadeContract {
  readonly readonlySources: readonly ControlPlaneReadonlySource[] = CONTROL_PLANE_READONLY_SOURCES;
  readonly apiBoundary = CONTROL_PLANE_API_BOUNDARY;

  constructor(
    private readonly governanceService: GovernanceServiceContract,
    private readonly observabilityService: ObservabilityServiceContract,
    private readonly importService: ImportServiceContract,
    private readonly importerRegistry: ImporterRegistryContract,
    private readonly extensionRegistry: ExtensionRegistryContract = buildDefaultExtensionRegistry(importerRegistry),
    private readonly autonomyService: AutonomyServiceContract = new AutonomyService(),
    private readonly workspaceCatalogService: WorkspaceCatalogServiceContract = new WorkspaceCatalogService(),
    private readonly platformEventService: PlatformEventServiceContract = new PlatformEventService()
  ) {}

  listGovernancePolicyTemplates(...args: Parameters<GovernanceServiceContract['listPolicyTemplates']>) {
    return this.governanceService.listPolicyTemplates(...args);
  }

  previewGovernanceProposal(...args: Parameters<GovernanceServiceContract['previewProposal']>) {
    return this.governanceService.previewProposal(...args);
  }

  detectGovernanceConflicts(...args: Parameters<GovernanceServiceContract['detectProposalConflicts']>) {
    return this.governanceService.detectProposalConflicts(...args);
  }

  submitProposal(...args: Parameters<GovernanceServiceContract['submitProposal']>) {
    return this.governanceService.submitProposal(...args);
  }

  submitProposalBatch(...args: Parameters<GovernanceServiceContract['submitProposalBatch']>) {
    return this.governanceService.submitProposalBatch(...args);
  }

  reviewProposal(...args: Parameters<GovernanceServiceContract['reviewProposal']>) {
    return this.governanceService.reviewProposal(...args);
  }

  reviewProposalBatch(...args: Parameters<GovernanceServiceContract['reviewProposalBatch']>) {
    return this.governanceService.reviewProposalBatch(...args);
  }

  applyProposal(...args: Parameters<GovernanceServiceContract['applyProposal']>) {
    return this.governanceService.applyProposal(...args);
  }

  rollbackProposal(...args: Parameters<GovernanceServiceContract['rollbackProposal']>) {
    return this.governanceService.rollbackProposal(...args);
  }

  rollbackProposalBatch(...args: Parameters<GovernanceServiceContract['rollbackProposalBatch']>) {
    return this.governanceService.rollbackProposalBatch(...args);
  }

  buildGlobalGovernanceReview(...args: Parameters<GovernanceServiceContract['buildGlobalGovernanceReview']>) {
    return this.governanceService.buildGlobalGovernanceReview(...args);
  }

  createPollutionRecoveryPlan(...args: Parameters<GovernanceServiceContract['createPollutionRecoveryPlan']>) {
    return this.governanceService.createPollutionRecoveryPlan(...args);
  }

  saveKnowledgeLifecyclePolicy(...args: Parameters<GovernanceServiceContract['saveLifecyclePolicy']>) {
    return this.governanceService.saveLifecyclePolicy(...args);
  }

  listKnowledgeLifecyclePolicies(...args: Parameters<GovernanceServiceContract['listLifecyclePolicies']>) {
    return this.governanceService.listLifecyclePolicies(...args);
  }

  bulkRollbackGovernanceProposals(...args: Parameters<GovernanceServiceContract['bulkRollbackProposals']>) {
    return this.governanceService.bulkRollbackProposals(...args);
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

  saveObservabilityThresholds(...args: Parameters<ObservabilityServiceContract['saveThresholds']>) {
    return this.observabilityService.saveThresholds(...args);
  }

  getObservabilityThresholds(...args: Parameters<ObservabilityServiceContract['getThresholds']>) {
    return this.observabilityService.getThresholds(...args);
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

  listDashboardHistoryPage(...args: Parameters<ObservabilityServiceContract['listDashboardHistoryPage']>) {
    return this.observabilityService.listDashboardHistoryPage(...args);
  }

  createAlertSubscription(...args: Parameters<ObservabilityServiceContract['createAlertSubscription']>) {
    return this.observabilityService.createAlertSubscription(...args);
  }

  listAlertSubscriptions(...args: Parameters<ObservabilityServiceContract['listAlertSubscriptions']>) {
    return this.observabilityService.listAlertSubscriptions(...args);
  }

  listAlertNotifications(...args: Parameters<ObservabilityServiceContract['listAlertNotifications']>) {
    return this.observabilityService.listAlertNotifications(...args);
  }

  compareObservabilityReleases(...args: Parameters<ObservabilityServiceContract['compareReleases']>) {
    return this.observabilityService.compareReleases(...args);
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

  configureImportSchedulerPolicy(...args: Parameters<ImportServiceContract['configureSchedulerPolicy']>) {
    return this.importService.configureSchedulerPolicy(...args);
  }

  runDueImportJobs(...args: Parameters<ImportServiceContract['runDueJobs']>) {
    return this.importService.runDueJobs(...args);
  }

  batchRunImportJobs(...args: Parameters<ImportServiceContract['batchRunJobs']>) {
    return this.importService.batchRunJobs(...args);
  }

  stopImportJobs(...args: Parameters<ImportServiceContract['stopJobs']>) {
    return this.importService.stopJobs(...args);
  }

  resumeImportJobs(...args: Parameters<ImportServiceContract['resumeJobs']>) {
    return this.importService.resumeJobs(...args);
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

  listImportDeadLetters(...args: Parameters<ImportServiceContract['listDeadLetters']>) {
    return this.importService.listDeadLetters(...args);
  }

  listImporters(...args: Parameters<ImporterRegistryContract['listImporters']>) {
    return this.importerRegistry.listImporters(...args);
  }

  getImporter(...args: Parameters<ImporterRegistryContract['getImporter']>) {
    return this.importerRegistry.getImporter(...args);
  }

  buildSourceCatalog(...args: Parameters<ImporterRegistryContract['buildSourceCatalog']>) {
    return this.importerRegistry.buildSourceCatalog(...args);
  }

  getPlatformHostManifest(...args: Parameters<ExtensionRegistryContract['getHostManifest']>) {
    return this.extensionRegistry.getHostManifest(...args);
  }

  listExtensions(...args: Parameters<ExtensionRegistryContract['listExtensions']>) {
    return this.extensionRegistry.listExtensions(...args);
  }

  registerExtension(...args: Parameters<ExtensionRegistryContract['registerExtension']>) {
    return this.extensionRegistry.registerExtension(...args);
  }

  negotiateExtension(...args: Parameters<ExtensionRegistryContract['negotiateExtension']>) {
    return this.extensionRegistry.negotiateExtension(...args);
  }

  buildAutonomyRecommendations(...args: Parameters<AutonomyServiceContract['buildRecommendations']>) {
    return this.autonomyService.buildRecommendations(...args);
  }

  simulateAutonomyRecommendations(...args: Parameters<AutonomyServiceContract['simulateRecommendations']>) {
    return this.autonomyService.simulateRecommendations(...args);
  }

  saveWorkspaceIsolationPolicy(...args: Parameters<WorkspaceCatalogServiceContract['saveIsolationPolicy']>) {
    return this.workspaceCatalogService.saveIsolationPolicy(...args);
  }

  listWorkspaceIsolationPolicies(...args: Parameters<WorkspaceCatalogServiceContract['listIsolationPolicies']>) {
    return this.workspaceCatalogService.listIsolationPolicies(...args);
  }

  buildWorkspaceCatalog(...args: Parameters<WorkspaceCatalogServiceContract['buildCatalog']>) {
    return this.workspaceCatalogService.buildCatalog(...args);
  }

  getWorkspaceSummary(...args: Parameters<WorkspaceCatalogServiceContract['getWorkspaceSummary']>) {
    return this.workspaceCatalogService.getWorkspaceSummary(...args);
  }

  buildWorkspaceAggregate(...args: Parameters<WorkspaceCatalogServiceContract['buildAggregate']>) {
    return this.workspaceCatalogService.buildAggregate(...args);
  }

  recordPlatformEvent(...args: Parameters<PlatformEventServiceContract['recordEvent']>) {
    return this.platformEventService.recordEvent(...args);
  }

  listPlatformEvents(...args: Parameters<PlatformEventServiceContract['listEvents']>) {
    return this.platformEventService.listEvents(...args);
  }

  createWebhookSubscription(...args: Parameters<PlatformEventServiceContract['createWebhookSubscription']>) {
    return this.platformEventService.createWebhookSubscription(...args);
  }

  listWebhookSubscriptions(...args: Parameters<PlatformEventServiceContract['listWebhookSubscriptions']>) {
    return this.platformEventService.listWebhookSubscriptions(...args);
  }

  listWebhookDeliveries(...args: Parameters<PlatformEventServiceContract['listWebhookDeliveries']>) {
    return this.platformEventService.listWebhookDeliveries(...args);
  }
}
