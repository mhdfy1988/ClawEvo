import type { EvaluationReport } from '../evaluation/evaluation-harness.js';
import type { StageObservabilityReport, StageObservabilityTrendPoint } from '../evaluation/observability-report.js';
import type { OpenClawRuntimeContextWindowContract, OpenClawRuntimeWindowSource } from '../openclaw/types.js';
import type { ManualCorrectionRecord } from '../types/context-processing.js';
import type { Scope } from '../types/core.js';
import type { IngestResult, RawContextInput } from '../types/io.js';

export type ControlPlaneServiceName =
  | 'governance-service'
  | 'observability-service'
  | 'import-service'
  | 'extension-registry'
  | 'autonomy-service'
  | 'workspace-catalog-service'
  | 'platform-event-service'
  | 'control-plane-facade'
  | 'control-plane-server'
  | 'importer-registry'
  | 'control-plane-client';
export type ControlPlaneApiSurface = 'runtime_api' | 'debug_api' | 'control_plane_service' | 'control_plane_api';
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
  { name: 'compact-context.capture_observability_snapshot', surface: 'debug_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.inspect_observability_history', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.create_import_job', surface: 'debug_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.run_import_job', surface: 'debug_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.retry_import_job', surface: 'debug_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.rerun_import_job', surface: 'debug_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.schedule_import_job', surface: 'debug_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.run_due_import_jobs', surface: 'debug_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.get_import_job', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.list_import_jobs', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.list_import_job_history', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.apply_corrections', surface: 'debug_api', readonly: false, authority: 'runtime_plugin', directStoreAccess: false },
  { name: 'compact-context.list_corrections', surface: 'debug_api', readonly: true, authority: 'runtime_plugin', directStoreAccess: false }
] as const;

export const CONTROL_PLANE_SERVICE_BOUNDARY: readonly ControlPlaneBoundaryDescriptor[] = [
  { name: 'governance-service', surface: 'control_plane_service', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'observability-service', surface: 'control_plane_service', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'import-service', surface: 'control_plane_service', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'extension-registry', surface: 'control_plane_service', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'autonomy-service', surface: 'control_plane_service', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'workspace-catalog-service', surface: 'control_plane_service', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'platform-event-service', surface: 'control_plane_service', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'control-plane-facade', surface: 'control_plane_service', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'importer-registry', surface: 'control_plane_service', readonly: true, authority: 'control_plane_service', directStoreAccess: false }
] as const;

export const CONTROL_PLANE_API_BOUNDARY: readonly ControlPlaneBoundaryDescriptor[] = [
  { name: 'GET /api/health', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/runtime/snapshots', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/runtime/explain', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/governance/proposals', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/governance/audit', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/governance/templates', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/governance/global/review', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/governance/global/recovery', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/governance/lifecycle-policies', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/governance/lifecycle-policies', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/governance/proposals/bulk-rollback', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/governance/preview', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/governance/conflicts', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/governance/proposals', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/governance/proposals/batch', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/governance/proposals/batch/review', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/governance/proposals/batch/rollback', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/governance/proposals/:id/review', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/governance/proposals/:id/apply', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/governance/proposals/:id/rollback', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/observability/dashboard', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/observability/snapshots', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/observability/history', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/observability/history/page', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/observability/thresholds', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/observability/thresholds', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/observability/subscriptions', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/observability/subscriptions', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/observability/notifications', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/observability/compare', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/import/catalog', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/import/jobs', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/import/jobs/:id', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/import/jobs/:id/history', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/import/jobs', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/import/jobs/:id/run', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/import/jobs/:id/retry', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/import/jobs/:id/rerun', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/import/jobs/:id/schedule', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/import/jobs/batch/run', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/import/jobs/batch/stop', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/import/jobs/batch/resume', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/import/dead-letters', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/workbench/aliases', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/workbench/knowledge-review', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/workbench/import-review', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/workbench/runtime-governance-trace', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/extensions', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/extensions', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/extensions/negotiate', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/autonomy/recommendations', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/autonomy/simulate', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/workspaces', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/workspaces/:id', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/workspaces/aggregate', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/workspaces/policies', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/workspaces/policies', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/platform/events', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/platform/events/stream', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/platform/webhooks/subscriptions', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'POST /api/platform/webhooks/subscriptions', surface: 'control_plane_api', readonly: false, authority: 'control_plane_service', directStoreAccess: false },
  { name: 'GET /api/platform/webhooks/deliveries', surface: 'control_plane_api', readonly: true, authority: 'control_plane_service', directStoreAccess: false }
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

export interface ControlPlaneRuntimeSnapshotRef {
  sessionId: string;
  source: OpenClawRuntimeWindowSource;
  capturedAt?: string;
  query?: string;
}

export interface ControlPlaneRequestContext {
  actor: string;
  authority: GovernanceAuthority;
  requestId?: string;
  sessionId?: string;
  workspaceId?: string;
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
  contextSessionId?: string;
  runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
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
  runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
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

export interface GovernancePolicyTemplate {
  id: string;
  label: string;
  targetScope: Scope;
  recommendedAuthority: GovernanceAuthority;
  summary: string;
  reviewChecklist: string[];
}

export interface GovernancePreviewChange {
  correctionId: string;
  targetKind: ManualCorrectionRecord['targetKind'];
  targetId: string;
  action: ManualCorrectionRecord['action'];
  summary: string;
  metadataPreview: Record<string, string | number | boolean | null>;
}

export interface GovernanceDiffPreview {
  targetScope: Scope;
  reason: string;
  changeCount: number;
  targetIds: string[];
  changes: GovernancePreviewChange[];
}

export interface GovernanceProposalConflict {
  proposalId: string;
  conflictingProposalId: string;
  targetScope: Scope;
  targetIds: string[];
  severity: 'warning' | 'blocking';
  reason: string;
}

export interface GovernanceBatchResult<TPayload> {
  requestedCount: number;
  succeededIds: string[];
  failed: Array<{
    id?: string;
    message: string;
  }>;
  payloads: TPayload[];
}

export interface GovernanceMergeSuggestion {
  targetId: string;
  proposalIds: string[];
  scopes: Scope[];
  recommendedScope: Extract<Scope, 'workspace' | 'global'>;
  reason: string;
}

export interface GlobalGovernanceReview {
  generatedAt: string;
  pendingGlobalProposalIds: string[];
  conflictingWorkspaceProposalIds: string[];
  mergeSuggestions: GovernanceMergeSuggestion[];
  workspaceIsolationNotes: string[];
  pollutionRiskProposalIds: string[];
}

export interface PollutionRecoveryPlan {
  generatedAt: string;
  proposalIds: string[];
  rollbackProposalIds: string[];
  affectedTargets: string[];
  riskSummary: string;
  requiresHumanReview: boolean;
}

export interface KnowledgeLifecyclePolicy {
  id: string;
  scope: Extract<Scope, 'workspace' | 'global'>;
  label: string;
  decayDays: number;
  retireDays: number;
  refreshDays: number;
  savedAt: string;
  savedBy?: string;
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

export interface ObservabilityDashboardSnapshot {
  id: string;
  stage: string;
  capturedAt: string;
  sessionIds: string[];
  windowCount: number;
  dashboard: ObservabilityDashboardContract;
}

export interface ObservabilityDashboardHistoryPoint {
  snapshotId: string;
  stage: string;
  capturedAt: string;
  runtimeWindowSummary: ObservabilityRuntimeWindowSummary;
  metricCards: ObservabilityDashboardMetricCard[];
}

export interface ObservabilityMetricSeriesPoint {
  snapshotId: string;
  capturedAt: string;
  value?: number;
  status: ObservabilityMetricStatus;
}

export interface ObservabilityDashboardHistoryContract {
  pointCount: number;
  stages: string[];
  latestCapturedAt?: string;
  points: ObservabilityDashboardHistoryPoint[];
  metricSeries: Record<ObservabilityDashboardMetricKey, ObservabilityMetricSeriesPoint[]>;
}

export interface ObservabilityThresholdRecord {
  stage: string;
  savedAt: string;
  savedBy?: string;
  thresholds: ObservabilityAlertThresholds;
}

export interface ObservabilityHistoryPage {
  stage?: string;
  offset: number;
  limit: number;
  totalCount: number;
  hasMore: boolean;
  history: ObservabilityDashboardHistoryContract;
}

export type ObservabilityAlertChannel = 'log' | 'webhook' | 'console';
export type ObservabilityAlertDeliveryStatus = 'delivered' | 'suppressed' | 'failed';

export interface ObservabilityAlertSubscription {
  id: string;
  createdAt: string;
  createdBy?: string;
  stage?: string;
  channel: ObservabilityAlertChannel;
  target: string;
  minSeverity: ObservabilityAlertSeverity;
  metricKeys?: ObservabilityDashboardMetricKey[];
}

export interface ObservabilityAlertNotification {
  id: string;
  subscriptionId: string;
  snapshotId: string;
  createdAt: string;
  severity: ObservabilityAlertSeverity;
  channel: ObservabilityAlertChannel;
  target: string;
  alert: ObservabilityDashboardAlert;
  status: ObservabilityAlertDeliveryStatus;
  message: string;
}

export interface ObservabilityReleaseMetricDelta {
  key: ObservabilityDashboardMetricKey;
  label: string;
  unit: ObservabilityMetricUnit;
  baselineValue?: number;
  candidateValue?: number;
  delta?: number;
  baselineStatus: ObservabilityMetricStatus;
  candidateStatus: ObservabilityMetricStatus;
  regression: boolean;
}

export interface ObservabilityReleaseComparison {
  baselineSnapshotId: string;
  candidateSnapshotId: string;
  comparedAt: string;
  regressions: ObservabilityReleaseMetricDelta[];
  improvements: ObservabilityReleaseMetricDelta[];
  stable: ObservabilityReleaseMetricDelta[];
}

export type PlatformExtensionKind = 'importer' | 'governance' | 'observability' | 'integration';
export type PlatformExtensionSource = 'builtin' | 'local' | 'external';
export type PlatformExtensionStatus = 'active' | 'disabled';
export type PlatformExtensionCapability =
  | 'import_job_runner'
  | 'governance_policy'
  | 'observability_metric'
  | 'workspace_view'
  | 'event_consumer'
  | 'sdk_client';
export type PlatformSigningStatus = 'trusted' | 'unsigned' | 'unverified';

export interface PlatformCapabilityManifest {
  apiVersion: string;
  platformVersion: string;
  providerNeutral: boolean;
  capabilities: PlatformExtensionCapability[];
}

export interface PlatformExtensionManifest {
  id: string;
  label: string;
  description: string;
  kind: PlatformExtensionKind;
  source: PlatformExtensionSource;
  version: string;
  apiVersion: string;
  providerNeutral: boolean;
  capabilities: PlatformExtensionCapability[];
  status: PlatformExtensionStatus;
  signature?: string;
  homepage?: string;
  testContract?: string;
}

export interface PlatformExtensionNegotiationResult {
  extensionId: string;
  requestedApiVersion: string;
  compatible: boolean;
  negotiatedApiVersion?: string;
  missingCapabilities: PlatformExtensionCapability[];
  warnings: string[];
  signingStatus: PlatformSigningStatus;
}

export type AutonomyRecommendationClass =
  | 'threshold_tuning'
  | 'import_strategy'
  | 'recall_strategy'
  | 'promotion_strategy'
  | 'low_risk_automation';
export type AutonomyRecommendationSeverity = 'info' | 'warning' | 'critical';
export type AutonomySimulationRiskLevel = 'low' | 'medium' | 'high';

export interface AutonomyRecommendation {
  id: string;
  classification: AutonomyRecommendationClass;
  severity: AutonomyRecommendationSeverity;
  title: string;
  rationale: string;
  proposedChange: string;
  expectedImpact: string;
  requiresHumanReview: boolean;
  stage?: string;
}

export interface AutonomyRecommendationBundle {
  generatedAt: string;
  recommendationCount: number;
  basedOn: {
    snapshotCount: number;
    importJobCount: number;
    proposalCount: number;
  };
  stage?: string;
  recommendations: AutonomyRecommendation[];
}

export interface AutonomySimulationMetricDelta {
  key: ObservabilityDashboardMetricKey;
  delta: number;
  direction: 'improve' | 'regress' | 'neutral';
}

export interface AutonomySimulationResult {
  generatedAt: string;
  recommendationIds: string[];
  projectedMetricDeltas: AutonomySimulationMetricDelta[];
  riskLevel: AutonomySimulationRiskLevel;
  summary: string;
  requiresHumanReview: boolean;
}

export type WorkspaceIsolationMode = 'isolated' | 'shared_review' | 'shared_global';
export type WorkspaceAuthorityMode = 'workspace_reviewer' | 'global_reviewer' | 'mixed';

export interface WorkspaceIsolationPolicy {
  workspaceId: string;
  isolationMode: WorkspaceIsolationMode;
  authorityMode: WorkspaceAuthorityMode;
  sharedGlobalRead: boolean;
  sharedGlobalWrite: boolean;
  savedAt: string;
  savedBy?: string;
}

export interface WorkspaceCatalogEntry {
  workspaceId: string;
  sessionIds: string[];
  importJobCount: number;
  proposalCount: number;
  snapshotCount: number;
  lastActivityAt?: string;
  isolationMode: WorkspaceIsolationMode;
  authorityMode: WorkspaceAuthorityMode;
}

export interface WorkspaceAggregateView {
  workspaceCount: number;
  activeWorkspaceIds: string[];
  totalImportJobs: number;
  totalProposals: number;
  totalSnapshots: number;
  sharedGlobalWriteWorkspaceIds: string[];
}

export type PlatformEventType =
  | 'extension.registered'
  | 'governance.proposal_submitted'
  | 'governance.proposal_reviewed'
  | 'governance.proposal_applied'
  | 'governance.proposal_rolled_back'
  | 'governance.bulk_rolled_back'
  | 'observability.snapshot_recorded'
  | 'import.job_created'
  | 'import.job_completed'
  | 'import.job_failed'
  | 'workspace.policy_saved'
  | 'autonomy.recommendations_generated';

export interface PlatformEventRecord {
  id: string;
  type: PlatformEventType;
  createdAt: string;
  resourceId?: string;
  stage?: string;
  sessionId?: string;
  workspaceId?: string;
  payload: Record<string, unknown>;
}

export interface PlatformWebhookSubscription {
  id: string;
  createdAt: string;
  createdBy?: string;
  target: string;
  eventTypes: PlatformEventType[];
  active: boolean;
  secret?: string;
}

export interface PlatformWebhookDelivery {
  id: string;
  subscriptionId: string;
  eventId: string;
  createdAt: string;
  target: string;
  status: 'delivered' | 'suppressed' | 'failed';
}

export type ImportSourceKind = 'document' | 'repo_structure' | 'structured_input';
export type ImportParserKind = 'document_parser' | 'repo_structure_parser' | 'structured_payload_parser';
export type ImportNormalizationMode = 'document' | 'repo_structure' | 'structured_input';
export type ImportMaterializationMode = 'source_entities' | 'runtime_ingest';
export type ImportJobStatus = 'pending' | 'scheduled' | 'running' | 'completed' | 'failed';
export type ImportJobStage = 'parse' | 'normalize' | 'materialize';
export type ImportJobAttemptAction = 'run' | 'retry' | 'rerun';
export type ImportScheduleStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type ImportBatchAction = 'run' | 'stop' | 'resume';

export interface ImportSchedulerPolicy {
  maxRetryCount: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  deadLetterAfterRetryCount: number;
  historyRetentionLimit: number;
}

export const DEFAULT_IMPORT_SCHEDULER_POLICY: Readonly<ImportSchedulerPolicy> = {
  maxRetryCount: 3,
  initialBackoffMs: 60_000,
  maxBackoffMs: 3_600_000,
  deadLetterAfterRetryCount: 3,
  historyRetentionLimit: 50
} as const;

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

export interface ImportJobAttempt {
  id: string;
  jobId: string;
  attemptNumber: number;
  action: ImportJobAttemptAction;
  startedAt: string;
  completedAt: string;
  status: Extract<ImportJobStatus, 'completed' | 'failed'>;
  stageTrace: ImportStageTrace[];
  warnings: string[];
  error?: string;
  failureTrace?: ImportFailureTrace;
}

export interface ImportJobSchedule {
  id: string;
  jobId: string;
  dueAt: string;
  createdAt: string;
  status: ImportScheduleStatus;
  createdBy?: string;
  note?: string;
  dispatchedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface ImportJobDebugContext {
  sessionId: string;
  inspectRuntimeWindowMethod: 'compact-context.inspect_runtime_window';
  getImportJobMethod: 'compact-context.get_import_job';
  listImportHistoryMethod: 'compact-context.list_import_job_history';
}

export interface ImportDeadLetterRecord {
  id: string;
  jobId: string;
  createdAt: string;
  reason: string;
  retryCount: number;
  error?: string;
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
  attemptCount: number;
  lastAttemptAction?: ImportJobAttemptAction;
  lastRunAt?: string;
  nextScheduledAt?: string;
  schedulerPolicy: ImportSchedulerPolicy;
  retryCount: number;
  paused: boolean;
  deadLetteredAt?: string;
  runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
  debugContext?: ImportJobDebugContext;
  completedAt?: string;
  error?: string;
  failureTrace?: ImportFailureTrace;
}

export interface ImportJobResult {
  jobId: string;
  status: Extract<ImportJobStatus, 'completed'>;
  attemptNumber: number;
  attemptAction: ImportJobAttemptAction;
  ingestedRecordCount: number;
  persistedNodeCount: number;
  persistedEdgeCount: number;
  warnings: string[];
  completedAt: string;
  flow: ImportJobFlow;
  versionInfo: ImportVersionInfo;
  stageTrace: ImportStageTrace[];
  runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
  debugContext?: ImportJobDebugContext;
}

export interface ImportRunDueJobsResult {
  processedCount: number;
  completedCount: number;
  failedCount: number;
  scheduleIds: string[];
  results: ImportJobResult[];
  failures: Array<{
    scheduleId: string;
    jobId: string;
    message: string;
  }>;
}

export interface PendingImportJobRecord {
  job: ImportJob;
  input: RawContextInput;
  normalizedInput?: RawContextInput;
  result?: ImportJobResult;
  history: ImportJobAttempt[];
  schedules: ImportJobSchedule[];
  deadLetters: ImportDeadLetterRecord[];
}

export interface ImportBatchRunResult {
  action: ImportBatchAction;
  requestedCount: number;
  updatedJobIds: string[];
  failedJobIds: string[];
}

export interface ImporterRegistryEntry {
  id: string;
  sourceKind: ImportSourceKind;
  label: string;
  description: string;
  parser: ImportParserKind;
  normalizer: ImportNormalizationMode;
  materializer: ImportMaterializationMode;
  acceptedFormats: string[];
  supportsIncremental: boolean;
  emitsSourceEntities: boolean;
  dedupeStrategy: string;
  versionStrategy: string;
  normalizationNotes: string[];
  inspectMethods: readonly string[];
}

export interface ImportSourceCatalog {
  version: string;
  generatedAt: string;
  importers: ImporterRegistryEntry[];
  supportedSourceKinds: ImportSourceKind[];
}

export interface GovernanceWorkbenchAliasEntry {
  conceptId: string;
  aliases: string[];
  proposalIds: string[];
}

export interface GovernanceWorkbenchKnowledgeReviewItem {
  id: string;
  type: import('../types/core.js').NodeType;
  label: string;
  scope: Scope;
  freshness: import('../types/core.js').Freshness;
}

export interface GovernanceWorkbenchImportReviewItem {
  jobId: string;
  sessionId: string;
  sourceKind: ImportSourceKind;
  status: ImportJobStatus;
  attemptCount: number;
  lastRunAt?: string;
  nextScheduledAt?: string;
  error?: string;
}

export interface GovernanceWorkbenchTraceView {
  sessionId: string;
  runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
  proposals: GovernanceProposal[];
  audit: GovernanceAuditRecord[];
  imports: GovernanceWorkbenchImportReviewItem[];
}

export interface GovernanceServiceContract {
  listPolicyTemplates(): Promise<GovernancePolicyTemplate[]>;
  previewProposal(input: {
    targetScope: Scope;
    reason: string;
    corrections: readonly ManualCorrectionRecord[];
  }): Promise<GovernanceDiffPreview>;
  detectProposalConflicts(input: {
    targetScope: Scope;
    corrections: readonly ManualCorrectionRecord[];
    excludeProposalId?: string;
  }): Promise<GovernanceProposalConflict[]>;
  submitProposal(input: {
    targetScope: Scope;
    submittedBy: string;
    authority: GovernanceAuthority;
    reason: string;
    corrections: readonly ManualCorrectionRecord[];
    contextSessionId?: string;
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    submittedAt?: string;
  }): Promise<GovernanceProposal>;
  submitProposalBatch(input: {
    requests: Array<{
      targetScope: Scope;
      submittedBy: string;
      authority: GovernanceAuthority;
      reason: string;
      corrections: readonly ManualCorrectionRecord[];
      contextSessionId?: string;
      runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
      submittedAt?: string;
    }>;
  }): Promise<GovernanceBatchResult<GovernanceProposal>>;
  reviewProposal(input: {
    proposalId: string;
    reviewedBy: string;
    authority: GovernanceAuthority;
    decision: GovernanceDecision;
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    reviewedAt?: string;
    note?: string;
  }): Promise<GovernanceProposal>;
  reviewProposalBatch(input: {
    requests: Array<{
      proposalId: string;
      reviewedBy: string;
      authority: GovernanceAuthority;
      decision: GovernanceDecision;
      runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
      reviewedAt?: string;
      note?: string;
    }>;
  }): Promise<GovernanceBatchResult<GovernanceProposal>>;
  applyProposal(input: {
    proposalId: string;
    appliedBy: string;
    authority: GovernanceAuthority;
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    appliedAt?: string;
    engine: {
      applyManualCorrections(corrections: ManualCorrectionRecord[]): Promise<void>;
    };
  }): Promise<GovernanceApplyResult>;
  rollbackProposal(input: {
    proposalId: string;
    rolledBackBy: string;
    authority: GovernanceAuthority;
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    rolledBackAt?: string;
    note?: string;
    engine: {
      applyManualCorrections(corrections: ManualCorrectionRecord[]): Promise<void>;
    };
  }): Promise<GovernanceRollbackResult>;
  rollbackProposalBatch(input: {
    requests: Array<{
      proposalId: string;
      rolledBackBy: string;
      authority: GovernanceAuthority;
      runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
      rolledBackAt?: string;
      note?: string;
    }>;
    engine: {
      applyManualCorrections(corrections: ManualCorrectionRecord[]): Promise<void>;
    };
  }): Promise<GovernanceBatchResult<GovernanceRollbackResult>>;
  buildGlobalGovernanceReview(): Promise<GlobalGovernanceReview>;
  createPollutionRecoveryPlan(input?: {
    proposalIds?: readonly string[];
    limit?: number;
  }): Promise<PollutionRecoveryPlan>;
  saveLifecyclePolicy(input: {
    scope: Extract<Scope, 'workspace' | 'global'>;
    label: string;
    decayDays: number;
    retireDays: number;
    refreshDays: number;
    savedAt?: string;
    savedBy?: string;
  }): Promise<KnowledgeLifecyclePolicy>;
  listLifecyclePolicies(): Promise<KnowledgeLifecyclePolicy[]>;
  bulkRollbackProposals(input: {
    proposalIds: readonly string[];
    rolledBackBy: string;
    authority: GovernanceAuthority;
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    rolledBackAt?: string;
    note?: string;
    engine: {
      applyManualCorrections(corrections: ManualCorrectionRecord[]): Promise<void>;
    };
  }): Promise<GovernanceBatchResult<GovernanceRollbackResult>>;
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
  saveThresholds(input: {
    stage: string;
    thresholds: Partial<ObservabilityAlertThresholds>;
    savedAt?: string;
    savedBy?: string;
  }): ObservabilityThresholdRecord;
  getThresholds(stage: string): ObservabilityThresholdRecord | undefined;
  recordDashboardSnapshot(input: {
    stage: string;
    sessionIds: readonly string[];
    windowCount: number;
    dashboard: ObservabilityDashboardContract;
    capturedAt?: string;
  }): ObservabilityDashboardSnapshot;
  listDashboardSnapshots(input?: {
    stage?: string;
    offset?: number;
    limit?: number;
  }): ObservabilityDashboardSnapshot[];
  listDashboardHistoryPage(input?: {
    stage?: string;
    offset?: number;
    limit?: number;
  }): ObservabilityHistoryPage;
  buildDashboardHistory(input: {
    snapshots: readonly ObservabilityDashboardSnapshot[];
  }): ObservabilityDashboardHistoryContract;
  createAlertSubscription(input: {
    stage?: string;
    channel: ObservabilityAlertChannel;
    target: string;
    minSeverity?: ObservabilityAlertSeverity;
    metricKeys?: readonly ObservabilityDashboardMetricKey[];
    createdAt?: string;
    createdBy?: string;
  }): ObservabilityAlertSubscription;
  listAlertSubscriptions(stage?: string): ObservabilityAlertSubscription[];
  listAlertNotifications(limit?: number): ObservabilityAlertNotification[];
  compareReleases(input: {
    baselineSnapshotId: string;
    candidateSnapshotId: string;
  }): ObservabilityReleaseComparison;
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
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
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
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    completedAt?: string;
  }): Promise<ImportJobResult>;
  retryJob(input: {
    jobId: string;
    engine: {
      ingest(input: RawContextInput): Promise<IngestResult>;
    };
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    completedAt?: string;
  }): Promise<ImportJobResult>;
  rerunJob(input: {
    jobId: string;
    engine: {
      ingest(input: RawContextInput): Promise<IngestResult>;
    };
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    completedAt?: string;
  }): Promise<ImportJobResult>;
  scheduleJob(input: {
    jobId: string;
    dueAt: string;
    createdAt?: string;
    createdBy?: string;
    note?: string;
  }): Promise<ImportJobSchedule>;
  configureSchedulerPolicy(input: {
    jobId: string;
    policy: Partial<ImportSchedulerPolicy>;
  }): Promise<ImportJob>;
  runDueJobs(input: {
    engine: {
      ingest(input: RawContextInput): Promise<IngestResult>;
    };
    now?: string;
    limit?: number;
  }): Promise<ImportRunDueJobsResult>;
  batchRunJobs(input: {
    jobIds: readonly string[];
    engine: {
      ingest(input: RawContextInput): Promise<IngestResult>;
    };
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    completedAt?: string;
  }): Promise<ImportBatchRunResult>;
  stopJobs(jobIds: readonly string[]): Promise<ImportBatchRunResult>;
  resumeJobs(input: {
    jobIds: readonly string[];
    dueAt?: string;
  }): Promise<ImportBatchRunResult>;
  getJob(jobId: string): Promise<PendingImportJobRecord | undefined>;
  listJobs(limit?: number): Promise<ImportJob[]>;
  getJobHistory(jobId: string, limit?: number): Promise<ImportJobAttempt[]>;
  listDeadLetters(limit?: number): Promise<ImportDeadLetterRecord[]>;
}

export interface ImporterRegistryContract {
  listImporters(): ImporterRegistryEntry[];
  getImporter(sourceKind: ImportSourceKind): ImporterRegistryEntry | undefined;
  buildSourceCatalog(): ImportSourceCatalog;
}

export interface ExtensionRegistryContract {
  getHostManifest(): PlatformCapabilityManifest;
  listExtensions(): PlatformExtensionManifest[];
  registerExtension(input: Omit<PlatformExtensionManifest, 'status'> & { status?: PlatformExtensionStatus }): PlatformExtensionManifest;
  negotiateExtension(input: {
    extensionId: string;
    requestedApiVersion: string;
    requiredCapabilities?: readonly PlatformExtensionCapability[];
  }): PlatformExtensionNegotiationResult;
}

export interface AutonomyServiceContract {
  buildRecommendations(input: {
    stage?: string;
    snapshots: readonly ObservabilityDashboardSnapshot[];
    importJobs: readonly ImportJob[];
    proposals: readonly GovernanceProposal[];
    thresholds?: ObservabilityThresholdRecord;
  }): AutonomyRecommendationBundle;
  simulateRecommendations(input: {
    recommendations: readonly AutonomyRecommendation[];
  }): AutonomySimulationResult;
}

export interface WorkspaceCatalogServiceContract {
  saveIsolationPolicy(input: {
    workspaceId: string;
    isolationMode: WorkspaceIsolationMode;
    authorityMode: WorkspaceAuthorityMode;
    sharedGlobalRead?: boolean;
    sharedGlobalWrite?: boolean;
    savedAt?: string;
    savedBy?: string;
  }): WorkspaceIsolationPolicy;
  listIsolationPolicies(): WorkspaceIsolationPolicy[];
  buildCatalog(input: {
    jobs: readonly ImportJob[];
    proposals: readonly GovernanceProposal[];
    snapshots: readonly ObservabilityDashboardSnapshot[];
  }): WorkspaceCatalogEntry[];
  getWorkspaceSummary(input: {
    workspaceId: string;
    jobs: readonly ImportJob[];
    proposals: readonly GovernanceProposal[];
    snapshots: readonly ObservabilityDashboardSnapshot[];
  }): WorkspaceCatalogEntry | undefined;
  buildAggregate(input: {
    catalog: readonly WorkspaceCatalogEntry[];
  }): WorkspaceAggregateView;
}

export interface PlatformEventServiceContract {
  recordEvent(input: {
    type: PlatformEventType;
    resourceId?: string;
    stage?: string;
    sessionId?: string;
    workspaceId?: string;
    createdAt?: string;
    payload: Record<string, unknown>;
  }): PlatformEventRecord;
  listEvents(input?: {
    limit?: number;
    type?: PlatformEventType;
    workspaceId?: string;
  }): PlatformEventRecord[];
  createWebhookSubscription(input: {
    target: string;
    eventTypes: readonly PlatformEventType[];
    createdAt?: string;
    createdBy?: string;
    secret?: string;
  }): PlatformWebhookSubscription;
  listWebhookSubscriptions(): PlatformWebhookSubscription[];
  listWebhookDeliveries(limit?: number): PlatformWebhookDelivery[];
}

export interface ControlPlaneFacadeContract {
  readonly readonlySources: readonly ControlPlaneReadonlySource[];
  readonly apiBoundary: readonly ControlPlaneBoundaryDescriptor[];
  listGovernancePolicyTemplates: GovernanceServiceContract['listPolicyTemplates'];
  previewGovernanceProposal: GovernanceServiceContract['previewProposal'];
  detectGovernanceConflicts: GovernanceServiceContract['detectProposalConflicts'];
  submitProposal: GovernanceServiceContract['submitProposal'];
  submitProposalBatch: GovernanceServiceContract['submitProposalBatch'];
  reviewProposal: GovernanceServiceContract['reviewProposal'];
  reviewProposalBatch: GovernanceServiceContract['reviewProposalBatch'];
  applyProposal: GovernanceServiceContract['applyProposal'];
  rollbackProposal: GovernanceServiceContract['rollbackProposal'];
  rollbackProposalBatch: GovernanceServiceContract['rollbackProposalBatch'];
  buildGlobalGovernanceReview: GovernanceServiceContract['buildGlobalGovernanceReview'];
  createPollutionRecoveryPlan: GovernanceServiceContract['createPollutionRecoveryPlan'];
  saveKnowledgeLifecyclePolicy: GovernanceServiceContract['saveLifecyclePolicy'];
  listKnowledgeLifecyclePolicies: GovernanceServiceContract['listLifecyclePolicies'];
  bulkRollbackGovernanceProposals: GovernanceServiceContract['bulkRollbackProposals'];
  listProposals: GovernanceServiceContract['listProposals'];
  listAuditRecords: GovernanceServiceContract['listAuditRecords'];
  buildDashboard: ObservabilityServiceContract['buildDashboard'];
  saveObservabilityThresholds: ObservabilityServiceContract['saveThresholds'];
  getObservabilityThresholds: ObservabilityServiceContract['getThresholds'];
  recordDashboardSnapshot: ObservabilityServiceContract['recordDashboardSnapshot'];
  listDashboardSnapshots: ObservabilityServiceContract['listDashboardSnapshots'];
  listDashboardHistoryPage: ObservabilityServiceContract['listDashboardHistoryPage'];
  buildDashboardHistory: ObservabilityServiceContract['buildDashboardHistory'];
  createAlertSubscription: ObservabilityServiceContract['createAlertSubscription'];
  listAlertSubscriptions: ObservabilityServiceContract['listAlertSubscriptions'];
  listAlertNotifications: ObservabilityServiceContract['listAlertNotifications'];
  compareObservabilityReleases: ObservabilityServiceContract['compareReleases'];
  createImportJob: ImportServiceContract['createJob'];
  runImportJob: ImportServiceContract['runJob'];
  retryImportJob: ImportServiceContract['retryJob'];
  rerunImportJob: ImportServiceContract['rerunJob'];
  scheduleImportJob: ImportServiceContract['scheduleJob'];
  configureImportSchedulerPolicy: ImportServiceContract['configureSchedulerPolicy'];
  runDueImportJobs: ImportServiceContract['runDueJobs'];
  batchRunImportJobs: ImportServiceContract['batchRunJobs'];
  stopImportJobs: ImportServiceContract['stopJobs'];
  resumeImportJobs: ImportServiceContract['resumeJobs'];
  getImportJob: ImportServiceContract['getJob'];
  listImportJobs: ImportServiceContract['listJobs'];
  listImportJobHistory: ImportServiceContract['getJobHistory'];
  listImportDeadLetters: ImportServiceContract['listDeadLetters'];
  listImporters: ImporterRegistryContract['listImporters'];
  getImporter: ImporterRegistryContract['getImporter'];
  buildSourceCatalog: ImporterRegistryContract['buildSourceCatalog'];
  getPlatformHostManifest: ExtensionRegistryContract['getHostManifest'];
  listExtensions: ExtensionRegistryContract['listExtensions'];
  registerExtension: ExtensionRegistryContract['registerExtension'];
  negotiateExtension: ExtensionRegistryContract['negotiateExtension'];
  buildAutonomyRecommendations: AutonomyServiceContract['buildRecommendations'];
  simulateAutonomyRecommendations: AutonomyServiceContract['simulateRecommendations'];
  saveWorkspaceIsolationPolicy: WorkspaceCatalogServiceContract['saveIsolationPolicy'];
  listWorkspaceIsolationPolicies: WorkspaceCatalogServiceContract['listIsolationPolicies'];
  buildWorkspaceCatalog: WorkspaceCatalogServiceContract['buildCatalog'];
  getWorkspaceSummary: WorkspaceCatalogServiceContract['getWorkspaceSummary'];
  buildWorkspaceAggregate: WorkspaceCatalogServiceContract['buildAggregate'];
  recordPlatformEvent: PlatformEventServiceContract['recordEvent'];
  listPlatformEvents: PlatformEventServiceContract['listEvents'];
  createWebhookSubscription: PlatformEventServiceContract['createWebhookSubscription'];
  listWebhookSubscriptions: PlatformEventServiceContract['listWebhookSubscriptions'];
  listWebhookDeliveries: PlatformEventServiceContract['listWebhookDeliveries'];
}
