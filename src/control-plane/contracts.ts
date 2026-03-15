import type { EvaluationReport } from '../evaluation/evaluation-harness.js';
import type { StageObservabilityReport, StageObservabilityTrendPoint } from '../evaluation/observability-report.js';
import type { OpenClawRuntimeContextWindowContract } from '../openclaw/types.js';
import type { ManualCorrectionRecord } from '../types/context-processing.js';
import type { Scope } from '../types/core.js';
import type { IngestResult, RawContextInput } from '../types/io.js';

export type ControlPlaneServiceName = 'governance-service' | 'observability-service' | 'import-service';
export type ControlPlaneApiSurface = 'runtime_api' | 'debug_api' | 'control_plane_service';
export type ControlPlaneReadonlySource =
  | 'live_runtime_snapshot'
  | 'persisted_runtime_snapshot'
  | 'transcript_session_file';

export interface ControlPlaneBoundaryDescriptor {
  name: string;
  surface: ControlPlaneApiSurface;
  readonly: boolean;
  authority: 'runtime_plugin' | 'control_plane_service';
  directStoreAccess: false;
}

export const RUNTIME_API_BOUNDARY: readonly ControlPlaneBoundaryDescriptor[] = [
  { name: 'bootstrap', surface: 'runtime_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'ingest', surface: 'runtime_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'ingestBatch', surface: 'runtime_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'afterTurn', surface: 'runtime_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'assemble', surface: 'runtime_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact', surface: 'runtime_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false }
] as const;

export const DEBUG_API_BOUNDARY: readonly ControlPlaneBoundaryDescriptor[] = [
  { name: 'compact-context.health', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.ingest_context', surface: 'debug_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.compile_context', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.create_checkpoint', surface: 'debug_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.query_nodes', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.query_edges', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.get_latest_checkpoint', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.list_checkpoints', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.crystallize_skills', surface: 'debug_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.list_skill_candidates', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.explain', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.inspect_bundle', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.inspect_runtime_window', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.inspect_observability_dashboard', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.create_import_job', surface: 'debug_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.run_import_job', surface: 'debug_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.get_import_job', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.list_import_jobs', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.apply_corrections', surface: 'debug_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.list_corrections', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false }
] as const;

export const CONTROL_PLANE_SERVICE_BOUNDARY: readonly ControlPlaneBoundaryDescriptor[] = [
  { name: 'governance-service', surface: 'control_plane_service', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'observability-service', surface: 'control_plane_service', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'import-service', surface: 'control_plane_service', readonly: false, authority: 'control_plane_service', directStoreAccess: false }
] as const;

export const CONTROL_PLANE_READONLY_SOURCES: readonly ControlPlaneReadonlySource[] = [
  'live_runtime_snapshot',
  'persisted_runtime_snapshot',
  'transcript_session_file'
] as const;

export type GovernanceProposalStatus = 'pending' | 'approved' | 'rejected' | 'applied';
export type GovernanceDecision = 'approve' | 'reject';
export type GovernanceAuditEvent = 'submitted' | 'approved' | 'rejected' | 'applied' | 'rolled_back';
export type GovernanceAuthority = 'session_operator' | 'workspace_reviewer' | 'global_reviewer';
export type GovernanceLifecycleAction = 'submit' | 'review' | 'apply' | 'rollback';

export interface GovernanceScopeBoundary {
  targetScope: Scope;
  submitAuthorities: readonly GovernanceAuthority[];
  reviewAuthorities: readonly GovernanceAuthority[];
  applyAuthorities: readonly GovernanceAuthority[];
  rollbackAuthorities: readonly GovernanceAuthority[];
}

export interface GovernanceProposal {
  id: string;
  targetScope: Scope;
  submittedAt: string;
  submittedBy: string;
  submittedAuthority: GovernanceAuthority;
  reason: string;
  corrections: ManualCorrectionRecord[];
  status: GovernanceProposalStatus;
  review?: {
    decision: GovernanceDecision;
    reviewedAt: string;
    reviewedBy: string;
    note?: string;
  };
  appliedAt?: string;
  appliedBy?: string;
  appliedAuthority?: GovernanceAuthority;
  rollback?: {
    rolledBackAt: string;
    rolledBackBy: string;
    rolledBackAuthority: GovernanceAuthority;
    note?: string;
  };
}

export interface GovernanceAuditRecord {
  id: string;
  proposalId: string;
  event: GovernanceAuditEvent;
  actor: string;
  timestamp: string;
  note?: string;
}

export interface GovernanceApplyResult {
  proposalId: string;
  appliedCount: number;
  appliedAt: string;
}

export interface GovernanceRollbackResult {
  proposalId: string;
  rolledBackCount: number;
  rolledBackAt: string;
}

export interface ObservabilityStageReportInput {
  stage: string;
  reports: readonly EvaluationReport[];
  history?: readonly StageObservabilityTrendPoint[];
}

export interface ObservabilityRuntimeWindowSummary {
  sampleCount: number;
  liveCount: number;
  persistedCount: number;
  transcriptFallbackCount: number;
  averageCompressedCount: number;
  averageFinalMessageCount: number;
  latestCapturedAt?: string;
}

export type ObservabilityMetricSource = 'runtime_windows' | 'stage_report';
export type ObservabilityMetricUnit = 'ratio' | 'count';
export type ObservabilityMetricStatus = 'healthy' | 'warning' | 'critical' | 'unknown';
export type ObservabilityAlertSeverity = 'warning' | 'critical';
export type ObservabilityThresholdDirection = 'min' | 'max';
export type ObservabilityDashboardMetricKey =
  | 'runtime_live_window_ratio'
  | 'runtime_transcript_fallback_ratio'
  | 'runtime_average_compressed_count'
  | 'runtime_average_final_message_count'
  | 'recall_noise_rate'
  | 'promotion_quality'
  | 'knowledge_pollution_rate'
  | 'high_scope_reuse_benefit'
  | 'high_scope_reuse_intrusion'
  | 'multi_source_coverage';

export interface ObservabilityAlertThresholds {
  minLiveRuntimeRatio: number;
  maxTranscriptFallbackRatio: number;
  maxRecallNoiseRate: number;
  minPromotionQuality: number;
  maxKnowledgePollutionRate: number;
  minHighScopeReuseBenefit: number;
  maxHighScopeReuseIntrusion: number;
  minMultiSourceCoverage: number;
}

export const DEFAULT_OBSERVABILITY_ALERT_THRESHOLDS: Readonly<ObservabilityAlertThresholds> = {
  minLiveRuntimeRatio: 0.5,
  maxTranscriptFallbackRatio: 0.4,
  maxRecallNoiseRate: 0.35,
  minPromotionQuality: 0.6,
  maxKnowledgePollutionRate: 0.2,
  minHighScopeReuseBenefit: 0.4,
  maxHighScopeReuseIntrusion: 0.3,
  minMultiSourceCoverage: 0.5
} as const;

export interface ObservabilityDashboardMetricCard {
  key: ObservabilityDashboardMetricKey;
  label: string;
  source: ObservabilityMetricSource;
  unit: ObservabilityMetricUnit;
  status: ObservabilityMetricStatus;
  value?: number;
  previousValue?: number;
  trendDelta?: number;
  threshold?: {
    direction: ObservabilityThresholdDirection;
    value: number;
  };
}

export interface ObservabilityDashboardAlert {
  key: ObservabilityDashboardMetricKey;
  severity: ObservabilityAlertSeverity;
  source: ObservabilityMetricSource;
  currentValue: number;
  threshold: {
    direction: ObservabilityThresholdDirection;
    value: number;
  };
  message: string;
}

export interface ObservabilityContractBundle {
  readonlySources: readonly ControlPlaneReadonlySource[];
  latestStageReport: StageObservabilityReport;
  runtimeWindowSummary: ObservabilityRuntimeWindowSummary;
}

export interface ObservabilityDashboardContract extends ObservabilityContractBundle {
  thresholds: ObservabilityAlertThresholds;
  metricCards: ObservabilityDashboardMetricCard[];
  alerts: ObservabilityDashboardAlert[];
}

export type ImportSourceKind = 'document' | 'repo_structure' | 'structured_input';
export type ImportParserKind = 'document_parser' | 'repo_structure_parser' | 'structured_payload_parser';
export type ImportNormalizationMode = 'document' | 'repo_structure' | 'structured_input';
export type ImportMaterializationMode = 'source_entities' | 'runtime_ingest';
export type ImportJobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ImportJobStage = 'parse' | 'normalize' | 'materialize';

export interface ImportSourceDescriptor {
  kind: ImportSourceKind;
  path?: string;
  uri?: string;
  repoRoot?: string;
  format?: string;
  checksum?: string;
}

export interface ImportJobFlow {
  parser: ImportParserKind;
  normalizer: ImportNormalizationMode;
  materializer: ImportMaterializationMode;
  stageOrder: readonly ImportJobStage[];
}

export interface ImportVersionInfo {
  sourceVersion?: string;
  schemaVersion?: string;
  parserVersion?: string;
  normalizerVersion?: string;
  materializerVersion?: string;
  dedupeKey?: string;
  recordVersion?: string;
}

export interface ImportIncrementalState {
  enabled: boolean;
  previousJobId?: string;
  cursor?: string;
  changedRecordIds?: string[];
}

export interface ImportStageTrace {
  stage: ImportJobStage;
  status: 'completed' | 'failed';
  recordCount?: number;
  warningCount?: number;
  durationMs?: number;
  completedAt: string;
}

export interface ImportFailureTrace {
  stage: ImportJobStage;
  failedAt: string;
  message: string;
  retriable: boolean;
}

export interface ImportJob {
  id: string;
  sessionId: string;
  workspaceId?: string;
  sourceKind: ImportSourceKind;
  source: ImportSourceDescriptor;
  flow: ImportJobFlow;
  incremental: ImportIncrementalState;
  versionInfo: ImportVersionInfo;
  requestedBy?: string;
  createdAt: string;
  status: ImportJobStatus;
  completedAt?: string;
  error?: string;
  failureTrace?: ImportFailureTrace;
}

export interface ImportJobResult {
  jobId: string;
  status: Extract<ImportJobStatus, 'completed'>;
  ingestedRecordCount: number;
  persistedNodeCount: number;
  persistedEdgeCount: number;
  warnings: string[];
  completedAt: string;
  flow: ImportJobFlow;
  versionInfo: ImportVersionInfo;
  stageTrace: ImportStageTrace[];
}

export interface PendingImportJobRecord {
  job: ImportJob;
  input: RawContextInput;
  normalizedInput?: RawContextInput;
  result?: ImportJobResult;
}

export interface GovernanceServiceContract {
  submitProposal(input: {
    targetScope: Scope;
    submittedBy: string;
    authority: GovernanceAuthority;
    reason: string;
    corrections: readonly ManualCorrectionRecord[];
    submittedAt?: string;
  }): Promise<GovernanceProposal>;
  reviewProposal(input: {
    proposalId: string;
    reviewedBy: string;
    authority: GovernanceAuthority;
    decision: GovernanceDecision;
    reviewedAt?: string;
    note?: string;
  }): Promise<GovernanceProposal>;
  applyProposal(input: {
    proposalId: string;
    appliedBy: string;
    authority: GovernanceAuthority;
    appliedAt?: string;
    engine: {
      applyManualCorrections(corrections: ManualCorrectionRecord[]): Promise<void>;
    };
  }): Promise<GovernanceApplyResult>;
  rollbackProposal(input: {
    proposalId: string;
    rolledBackBy: string;
    authority: GovernanceAuthority;
    rolledBackAt?: string;
    note?: string;
    engine: {
      applyManualCorrections(corrections: ManualCorrectionRecord[]): Promise<void>;
    };
  }): Promise<GovernanceRollbackResult>;
  listProposals(limit?: number): Promise<GovernanceProposal[]>;
  listAuditRecords(limit?: number): Promise<GovernanceAuditRecord[]>;
}

export interface ObservabilityServiceContract {
  buildStageReport(input: ObservabilityStageReportInput): StageObservabilityReport;
  summarizeRuntimeWindows(windows: readonly OpenClawRuntimeContextWindowContract[]): ObservabilityRuntimeWindowSummary;
  buildContractBundle(input: {
    stage: string;
    reports: readonly EvaluationReport[];
    history?: readonly StageObservabilityTrendPoint[];
    windows: readonly OpenClawRuntimeContextWindowContract[];
  }): ObservabilityContractBundle;
  buildDashboard(input: {
    stage: string;
    reports: readonly EvaluationReport[];
    history?: readonly StageObservabilityTrendPoint[];
    windows: readonly OpenClawRuntimeContextWindowContract[];
    thresholds?: Partial<ObservabilityAlertThresholds>;
  }): ObservabilityDashboardContract;
}

export interface ImportServiceContract {
  createJob(input: {
    sessionId: string;
    workspaceId?: string;
    sourceKind: ImportSourceKind;
    source?: Partial<ImportSourceDescriptor>;
    flow?: Partial<ImportJobFlow>;
    versionInfo?: Partial<ImportVersionInfo>;
    incremental?: Partial<ImportIncrementalState>;
    requestedBy?: string;
    createdAt?: string;
    input: RawContextInput;
  }): Promise<ImportJob>;
  runJob(input: {
    jobId: string;
    engine: {
      ingest(input: RawContextInput): Promise<IngestResult>;
    };
    parse?: (record: PendingImportJobRecord) => Promise<RawContextInput>;
    normalize?: (input: RawContextInput, record: PendingImportJobRecord) => Promise<RawContextInput>;
    materialize?: (
      normalizedInput: RawContextInput,
      record: PendingImportJobRecord,
      engine: {
        ingest(input: RawContextInput): Promise<IngestResult>;
      }
    ) => Promise<IngestResult>;
    completedAt?: string;
  }): Promise<ImportJobResult>;
  getJob(jobId: string): Promise<PendingImportJobRecord | undefined>;
  listJobs(limit?: number): Promise<ImportJob[]>;
}
