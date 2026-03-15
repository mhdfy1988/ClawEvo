import { randomUUID } from 'node:crypto';

import { buildStageObservabilityReport } from './stage-observability-report.js';
import type {
  EvaluationReport,
  RuntimeContextWindowContract,
  StageObservabilityReport,
  StageObservabilitySnapshot,
  StageObservabilityTrendPoint
} from './contracts.js';
import type {
  ObservabilityAlertChannel,
  ObservabilityAlertNotification,
  ObservabilityAlertSeverity,
  ObservabilityAlertSubscription,
  ObservabilityContractBundle,
  ObservabilityDashboardAlert,
  ObservabilityDashboardContract,
  ObservabilityDashboardHistoryContract,
  ObservabilityDashboardHistoryPoint,
  ObservabilityDashboardMetricCard,
  ObservabilityDashboardMetricKey,
  ObservabilityDashboardSnapshot,
  ObservabilityHistoryPage,
  ObservabilityMetricSeriesPoint,
  ObservabilityMetricSource,
  ObservabilityMetricStatus,
  ObservabilityReleaseComparison,
  ObservabilityReleaseMetricDelta,
  ObservabilityRuntimeWindowSummary,
  ObservabilityServiceContract,
  ObservabilityThresholdRecord,
  ObservabilityAlertThresholds
} from './contracts.js';
import { CONTROL_PLANE_READONLY_SOURCES, DEFAULT_OBSERVABILITY_ALERT_THRESHOLDS } from './contracts.js';

const DASHBOARD_HISTORY_KEYS: readonly ObservabilityDashboardMetricKey[] = [
  'runtime_live_window_ratio',
  'runtime_transcript_fallback_ratio',
  'runtime_average_compressed_count',
  'runtime_average_final_message_count',
  'recall_noise_rate',
  'promotion_quality',
  'knowledge_pollution_rate',
  'high_scope_reuse_benefit',
  'high_scope_reuse_intrusion',
  'multi_source_coverage'
] as const;

export class ObservabilityService implements ObservabilityServiceContract {
  private readonly dashboardSnapshots: ObservabilityDashboardSnapshot[] = [];
  private readonly thresholdRecords = new Map<string, ObservabilityThresholdRecord>();
  private readonly alertSubscriptions: ObservabilityAlertSubscription[] = [];
  private readonly alertNotifications: ObservabilityAlertNotification[] = [];

  buildStageReport(input: import('./contracts.js').ObservabilityStageReportInput) {
    return buildStageObservabilityReport(input);
  }

  summarizeRuntimeWindows(windows: readonly RuntimeContextWindowContract[]): ObservabilityRuntimeWindowSummary {
    const sampleCount = windows.length;
    const liveCount = windows.filter((window) => window.source === 'live_runtime').length;
    const persistedCount = windows.filter((window) => window.source === 'persisted_snapshot').length;
    const transcriptFallbackCount = windows.filter((window) => window.source === 'transcript_fallback').length;
    const averageCompressedCount =
      sampleCount > 0
        ? windows.reduce((total, window) => total + window.compression.compressedCount, 0) / sampleCount
        : 0;
    const averageFinalMessageCount =
      sampleCount > 0 ? windows.reduce((total, window) => total + window.final.counts.total, 0) / sampleCount : 0;
    const latestCapturedAt = [...windows]
      .map((window) => window.capturedAt)
      .filter((value): value is string => typeof value === 'string')
      .sort()
      .at(-1);

    return {
      sampleCount,
      liveCount,
      persistedCount,
      transcriptFallbackCount,
      averageCompressedCount,
      averageFinalMessageCount,
      ...(latestCapturedAt ? { latestCapturedAt } : {})
    };
  }

  buildContractBundle(input: {
    stage: string;
    reports: readonly EvaluationReport[];
    history?: readonly StageObservabilityTrendPoint[];
    windows: readonly RuntimeContextWindowContract[];
  }): ObservabilityContractBundle {
    return {
      readonlySources: CONTROL_PLANE_READONLY_SOURCES,
      latestStageReport: this.buildStageReport({
        stage: input.stage,
        reports: input.reports,
        ...(input.history ? { history: input.history } : {})
      }),
      runtimeWindowSummary: this.summarizeRuntimeWindows(input.windows)
    };
  }

  buildDashboard(input: {
    stage: string;
    reports: readonly EvaluationReport[];
    history?: readonly StageObservabilityTrendPoint[];
    windows: readonly RuntimeContextWindowContract[];
    thresholds?: Partial<ObservabilityAlertThresholds>;
  }): ObservabilityDashboardContract {
    const bundle = this.buildContractBundle(input);
    const persistedThresholds = this.thresholdRecords.get(input.stage)?.thresholds;
    const thresholds = resolveObservabilityAlertThresholds(persistedThresholds, input.thresholds);
    const previousSnapshot = input.history?.at(-1)?.snapshot;
    const metricCards = buildDashboardMetricCards({
      latestStageReport: bundle.latestStageReport,
      runtimeWindowSummary: bundle.runtimeWindowSummary,
      hasStageReports: input.reports.length > 0,
      thresholds,
      previousSnapshot
    });

    return {
      ...bundle,
      thresholds,
      metricCards,
      alerts: buildDashboardAlerts(metricCards)
    };
  }

  saveThresholds(input: {
    stage: string;
    thresholds: Partial<ObservabilityAlertThresholds>;
    savedAt?: string;
    savedBy?: string;
  }): ObservabilityThresholdRecord {
    const existing = this.thresholdRecords.get(input.stage)?.thresholds;
    const record: ObservabilityThresholdRecord = {
      stage: input.stage,
      savedAt: input.savedAt ?? new Date().toISOString(),
      ...(input.savedBy ? { savedBy: input.savedBy } : {}),
      thresholds: resolveObservabilityAlertThresholds(existing, input.thresholds)
    };
    this.thresholdRecords.set(input.stage, record);
    return record;
  }

  getThresholds(stage: string): ObservabilityThresholdRecord | undefined {
    const record = this.thresholdRecords.get(stage);
    return record
      ? {
          ...record,
          thresholds: { ...record.thresholds }
        }
      : undefined;
  }

  recordDashboardSnapshot(input: {
    stage: string;
    sessionIds: readonly string[];
    windowCount: number;
    dashboard: ObservabilityDashboardContract;
    capturedAt?: string;
  }): ObservabilityDashboardSnapshot {
    const snapshot: ObservabilityDashboardSnapshot = {
      id: `observability_snapshot_${randomUUID()}`,
      stage: input.stage,
      capturedAt: input.capturedAt ?? new Date().toISOString(),
      sessionIds: [...input.sessionIds],
      windowCount: input.windowCount,
      dashboard: input.dashboard
    };

    this.dashboardSnapshots.unshift(snapshot);
    this.emitAlertNotifications(snapshot);
    return snapshot;
  }

  listDashboardSnapshots(input?: {
    stage?: string;
    offset?: number;
    limit?: number;
  }): ObservabilityDashboardSnapshot[] {
    const filtered = this.dashboardSnapshots.filter((snapshot) => !input?.stage || snapshot.stage === input.stage);
    const offset = input?.offset && input.offset > 0 ? input.offset : 0;
    const limit = input?.limit && input.limit > 0 ? input.limit : filtered.length;
    return filtered.slice(offset, offset + limit);
  }

  listDashboardHistoryPage(input?: {
    stage?: string;
    offset?: number;
    limit?: number;
  }): ObservabilityHistoryPage {
    const stage = input?.stage;
    const filtered = this.dashboardSnapshots.filter((snapshot) => !stage || snapshot.stage === stage);
    const offset = input?.offset && input.offset > 0 ? input.offset : 0;
    const limit = input?.limit && input.limit > 0 ? input.limit : 20;
    const slice = filtered.slice(offset, offset + limit);

    return {
      ...(stage ? { stage } : {}),
      offset,
      limit,
      totalCount: filtered.length,
      hasMore: offset + limit < filtered.length,
      history: this.buildDashboardHistory({
        snapshots: slice
      })
    };
  }

  buildDashboardHistory(input: {
    snapshots: readonly ObservabilityDashboardSnapshot[];
  }): ObservabilityDashboardHistoryContract {
    const snapshots = [...input.snapshots].sort((left, right) => left.capturedAt.localeCompare(right.capturedAt));
    const metricSeries = Object.fromEntries(
      DASHBOARD_HISTORY_KEYS.map((key) => [
        key,
        snapshots.map((snapshot) => {
          const card = snapshot.dashboard.metricCards.find((candidate) => candidate.key === key);
          return {
            snapshotId: snapshot.id,
            capturedAt: snapshot.capturedAt,
            value: card?.value,
            status: card?.status ?? 'unknown'
          } satisfies ObservabilityMetricSeriesPoint;
        })
      ])
    ) as Record<ObservabilityDashboardMetricKey, ObservabilityMetricSeriesPoint[]>;

    return {
      pointCount: snapshots.length,
      stages: [...new Set(snapshots.map((snapshot) => snapshot.stage))],
      ...(snapshots.at(-1)?.capturedAt ? { latestCapturedAt: snapshots.at(-1)?.capturedAt } : {}),
      points: snapshots.map((snapshot) => ({
        snapshotId: snapshot.id,
        stage: snapshot.stage,
        capturedAt: snapshot.capturedAt,
        runtimeWindowSummary: snapshot.dashboard.runtimeWindowSummary,
        metricCards: snapshot.dashboard.metricCards
      })),
      metricSeries
    };
  }

  createAlertSubscription(input: {
    stage?: string;
    channel: ObservabilityAlertChannel;
    target: string;
    minSeverity?: ObservabilityAlertSeverity;
    metricKeys?: readonly ObservabilityDashboardMetricKey[];
    createdAt?: string;
    createdBy?: string;
  }): ObservabilityAlertSubscription {
    const subscription: ObservabilityAlertSubscription = {
      id: `observability_subscription_${randomUUID()}`,
      createdAt: input.createdAt ?? new Date().toISOString(),
      ...(input.createdBy ? { createdBy: input.createdBy } : {}),
      ...(input.stage ? { stage: input.stage } : {}),
      channel: input.channel,
      target: input.target,
      minSeverity: input.minSeverity ?? 'warning',
      ...(input.metricKeys?.length ? { metricKeys: [...input.metricKeys] } : {})
    };
    this.alertSubscriptions.unshift(subscription);
    return subscription;
  }

  listAlertSubscriptions(stage?: string): ObservabilityAlertSubscription[] {
    return this.alertSubscriptions
      .filter((subscription) => !stage || !subscription.stage || subscription.stage === stage)
      .map((subscription) => ({
        ...subscription,
        ...(subscription.metricKeys ? { metricKeys: [...subscription.metricKeys] } : {})
      }));
  }

  listAlertNotifications(limit = 50): ObservabilityAlertNotification[] {
    return this.alertNotifications.slice(0, limit).map((notification) => ({
      ...notification,
      alert: { ...notification.alert, threshold: { ...notification.alert.threshold } }
    }));
  }

  compareReleases(input: {
    baselineSnapshotId: string;
    candidateSnapshotId: string;
  }): ObservabilityReleaseComparison {
    const baseline = this.requireSnapshot(input.baselineSnapshotId);
    const candidate = this.requireSnapshot(input.candidateSnapshotId);
    const deltas = candidate.dashboard.metricCards.map((candidateCard) =>
      buildReleaseMetricDelta(candidateCard, baseline.dashboard.metricCards.find((card) => card.key === candidateCard.key))
    );

    return {
      baselineSnapshotId: baseline.id,
      candidateSnapshotId: candidate.id,
      comparedAt: new Date().toISOString(),
      regressions: deltas.filter((delta) => delta.regression),
      improvements: deltas.filter((delta) => !delta.regression && isImprovement(delta)),
      stable: deltas.filter((delta) => !delta.regression && !isImprovement(delta))
    };
  }

  private emitAlertNotifications(snapshot: ObservabilityDashboardSnapshot): void {
    for (const subscription of this.alertSubscriptions) {
      if (subscription.stage && subscription.stage !== snapshot.stage) {
        continue;
      }

      for (const alert of snapshot.dashboard.alerts) {
        if (!severityGte(alert.severity, subscription.minSeverity)) {
          continue;
        }
        if (subscription.metricKeys?.length && !subscription.metricKeys.includes(alert.key)) {
          continue;
        }

        this.alertNotifications.unshift({
          id: `observability_notification_${randomUUID()}`,
          subscriptionId: subscription.id,
          snapshotId: snapshot.id,
          createdAt: snapshot.capturedAt,
          severity: alert.severity,
          channel: subscription.channel,
          target: subscription.target,
          alert,
          status: subscription.channel === 'webhook' ? 'delivered' : 'delivered',
          message: `[${alert.severity}] ${alert.message}`
        });
      }
    }
  }

  private requireSnapshot(snapshotId: string): ObservabilityDashboardSnapshot {
    const snapshot = this.dashboardSnapshots.find((candidate) => candidate.id === snapshotId);
    if (!snapshot) {
      throw new Error(`unknown observability snapshot: ${snapshotId}`);
    }
    return snapshot;
  }
}

function resolveObservabilityAlertThresholds(
  base: Partial<ObservabilityAlertThresholds> | undefined,
  overrides: Partial<ObservabilityAlertThresholds> | undefined
): ObservabilityAlertThresholds {
  return {
    ...DEFAULT_OBSERVABILITY_ALERT_THRESHOLDS,
    ...(base ?? {}),
    ...(overrides ?? {})
  };
}

function buildDashboardMetricCards(input: {
  latestStageReport: StageObservabilityReport;
  runtimeWindowSummary: ObservabilityRuntimeWindowSummary;
  hasStageReports: boolean;
  thresholds: ObservabilityAlertThresholds;
  previousSnapshot?: StageObservabilitySnapshot;
}): ObservabilityDashboardMetricCard[] {
  const runtimeSampleCount = input.runtimeWindowSummary.sampleCount;
  const runtimeLiveRatio =
    runtimeSampleCount > 0 ? input.runtimeWindowSummary.liveCount / input.runtimeWindowSummary.sampleCount : undefined;
  const runtimeTranscriptFallbackRatio =
    runtimeSampleCount > 0
      ? input.runtimeWindowSummary.transcriptFallbackCount / input.runtimeWindowSummary.sampleCount
      : undefined;

  return [
    buildMetricCard({
      key: 'runtime_live_window_ratio',
      label: 'Runtime live window ratio',
      source: 'runtime_windows',
      unit: 'ratio',
      value: runtimeLiveRatio,
      threshold: {
        direction: 'min',
        value: input.thresholds.minLiveRuntimeRatio
      }
    }),
    buildMetricCard({
      key: 'runtime_transcript_fallback_ratio',
      label: 'Runtime transcript fallback ratio',
      source: 'runtime_windows',
      unit: 'ratio',
      value: runtimeTranscriptFallbackRatio,
      threshold: {
        direction: 'max',
        value: input.thresholds.maxTranscriptFallbackRatio
      }
    }),
    buildMetricCard({
      key: 'runtime_average_compressed_count',
      label: 'Runtime average compressed count',
      source: 'runtime_windows',
      unit: 'count',
      value: runtimeSampleCount > 0 ? input.runtimeWindowSummary.averageCompressedCount : undefined
    }),
    buildMetricCard({
      key: 'runtime_average_final_message_count',
      label: 'Runtime average final message count',
      source: 'runtime_windows',
      unit: 'count',
      value: runtimeSampleCount > 0 ? input.runtimeWindowSummary.averageFinalMessageCount : undefined
    }),
    buildMetricCard({
      key: 'recall_noise_rate',
      label: 'Recall noise rate',
      source: 'stage_report',
      unit: 'ratio',
      value: input.hasStageReports ? input.latestStageReport.current.averageRecallNoiseRate : undefined,
      previousValue: input.previousSnapshot?.averageRecallNoiseRate,
      threshold: {
        direction: 'max',
        value: input.thresholds.maxRecallNoiseRate
      }
    }),
    buildMetricCard({
      key: 'promotion_quality',
      label: 'Promotion quality',
      source: 'stage_report',
      unit: 'ratio',
      value: input.hasStageReports ? input.latestStageReport.current.averagePromotionQuality : undefined,
      previousValue: input.previousSnapshot?.averagePromotionQuality,
      threshold: {
        direction: 'min',
        value: input.thresholds.minPromotionQuality
      }
    }),
    buildMetricCard({
      key: 'knowledge_pollution_rate',
      label: 'Knowledge pollution rate',
      source: 'stage_report',
      unit: 'ratio',
      value: input.hasStageReports ? input.latestStageReport.current.averageKnowledgePollutionRate : undefined,
      previousValue: input.previousSnapshot?.averageKnowledgePollutionRate,
      threshold: {
        direction: 'max',
        value: input.thresholds.maxKnowledgePollutionRate
      }
    }),
    buildMetricCard({
      key: 'high_scope_reuse_benefit',
      label: 'High-scope reuse benefit',
      source: 'stage_report',
      unit: 'ratio',
      value: input.hasStageReports ? input.latestStageReport.current.averageHighScopeReuseBenefit : undefined,
      previousValue: input.previousSnapshot?.averageHighScopeReuseBenefit,
      threshold: {
        direction: 'min',
        value: input.thresholds.minHighScopeReuseBenefit
      }
    }),
    buildMetricCard({
      key: 'high_scope_reuse_intrusion',
      label: 'High-scope reuse intrusion',
      source: 'stage_report',
      unit: 'ratio',
      value: input.hasStageReports ? input.latestStageReport.current.averageHighScopeReuseIntrusion : undefined,
      previousValue: input.previousSnapshot?.averageHighScopeReuseIntrusion,
      threshold: {
        direction: 'max',
        value: input.thresholds.maxHighScopeReuseIntrusion
      }
    }),
    buildMetricCard({
      key: 'multi_source_coverage',
      label: 'Multi-source coverage',
      source: 'stage_report',
      unit: 'ratio',
      value: input.hasStageReports ? input.latestStageReport.current.averageMultiSourceCoverage : undefined,
      previousValue: input.previousSnapshot?.averageMultiSourceCoverage,
      threshold: {
        direction: 'min',
        value: input.thresholds.minMultiSourceCoverage
      }
    })
  ];
}

function buildMetricCard(input: {
  key: ObservabilityDashboardMetricKey;
  label: string;
  source: ObservabilityMetricSource;
  unit: import('./contracts.js').ObservabilityMetricUnit;
  value?: number;
  previousValue?: number;
  threshold?: {
    direction: import('./contracts.js').ObservabilityThresholdDirection;
    value: number;
  };
}): ObservabilityDashboardMetricCard {
  if (typeof input.value !== 'number') {
    return {
      key: input.key,
      label: input.label,
      source: input.source,
      unit: input.unit,
      status: 'unknown',
      ...(input.threshold ? { threshold: input.threshold } : {})
    };
  }

  return {
    key: input.key,
    label: input.label,
    source: input.source,
    unit: input.unit,
    status: resolveMetricStatus(input.value, input.threshold),
    value: input.value,
    ...(typeof input.previousValue === 'number' ? { previousValue: input.previousValue } : {}),
    ...(typeof input.previousValue === 'number' ? { trendDelta: input.value - input.previousValue } : {}),
    ...(input.threshold ? { threshold: input.threshold } : {})
  };
}

function resolveMetricStatus(
  value: number,
  threshold:
    | {
        direction: import('./contracts.js').ObservabilityThresholdDirection;
        value: number;
      }
    | undefined
): ObservabilityMetricStatus {
  if (!threshold) {
    return 'healthy';
  }

  if (threshold.direction === 'max') {
    if (value <= threshold.value) {
      return 'healthy';
    }

    if (threshold.value === 0) {
      return value > 0 ? 'critical' : 'healthy';
    }

    return value >= threshold.value * 1.5 ? 'critical' : 'warning';
  }

  if (value >= threshold.value) {
    return 'healthy';
  }

  if (threshold.value === 0) {
    return 'warning';
  }

  return value <= threshold.value * 0.5 ? 'critical' : 'warning';
}

function buildDashboardAlerts(metricCards: readonly ObservabilityDashboardMetricCard[]): ObservabilityDashboardAlert[] {
  return metricCards.flatMap((card) => {
    if (card.status !== 'warning' && card.status !== 'critical') {
      return [];
    }

    if (typeof card.value !== 'number' || !card.threshold) {
      return [];
    }

    return [
      {
        key: card.key,
        severity: card.status as ObservabilityAlertSeverity,
        source: card.source,
        currentValue: card.value,
        threshold: card.threshold,
        message: buildDashboardAlertMessage(card)
      }
    ];
  });
}

function buildDashboardAlertMessage(card: ObservabilityDashboardMetricCard): string {
  const comparator = card.threshold?.direction === 'max' ? 'exceeded' : 'fell below';
  const value = typeof card.value === 'number' ? formatMetricValue(card.value, card.unit) : 'n/a';
  const threshold = card.threshold ? formatMetricValue(card.threshold.value, card.unit) : 'n/a';

  return `${card.label} ${comparator} threshold: current=${value} threshold=${threshold}`;
}

function formatMetricValue(value: number, unit: import('./contracts.js').ObservabilityMetricUnit): string {
  return unit === 'count' ? value.toFixed(1) : value.toFixed(2);
}

function severityGte(current: ObservabilityAlertSeverity, expected: ObservabilityAlertSeverity): boolean {
  const order: Record<ObservabilityAlertSeverity, number> = {
    warning: 1,
    critical: 2
  };
  return order[current] >= order[expected];
}

function buildReleaseMetricDelta(
  candidateCard: ObservabilityDashboardMetricCard,
  baselineCard?: ObservabilityDashboardMetricCard
): ObservabilityReleaseMetricDelta {
  const baselineValue = baselineCard?.value;
  const candidateValue = candidateCard.value;
  const delta =
    typeof baselineValue === 'number' && typeof candidateValue === 'number' ? candidateValue - baselineValue : undefined;
  const regression = isRegression({
    baseline: baselineCard,
    candidate: candidateCard,
    delta
  });

  return {
    key: candidateCard.key,
    label: candidateCard.label,
    unit: candidateCard.unit,
    ...(typeof baselineValue === 'number' ? { baselineValue } : {}),
    ...(typeof candidateValue === 'number' ? { candidateValue } : {}),
    ...(typeof delta === 'number' ? { delta } : {}),
    baselineStatus: baselineCard?.status ?? 'unknown',
    candidateStatus: candidateCard.status,
    regression
  };
}

function isRegression(input: {
  baseline: ObservabilityDashboardMetricCard | undefined;
  candidate: ObservabilityDashboardMetricCard;
  delta: number | undefined;
}): boolean {
  if (!input.baseline) {
    return input.candidate.status === 'warning' || input.candidate.status === 'critical';
  }

  if (severityRank(input.candidate.status) > severityRank(input.baseline.status)) {
    return true;
  }

  if (typeof input.delta !== 'number' || !input.candidate.threshold) {
    return false;
  }

  return input.candidate.threshold.direction === 'max' ? input.delta > 0 : input.delta < 0;
}

function isImprovement(delta: ObservabilityReleaseMetricDelta): boolean {
  if (severityRank(delta.candidateStatus) < severityRank(delta.baselineStatus)) {
    return true;
  }

  if (typeof delta.delta !== 'number') {
    return false;
  }

  return delta.delta !== 0 && !delta.regression;
}

function severityRank(status: ObservabilityMetricStatus): number {
  switch (status) {
    case 'critical':
      return 3;
    case 'warning':
      return 2;
    case 'healthy':
      return 1;
    case 'unknown':
    default:
      return 0;
  }
}
