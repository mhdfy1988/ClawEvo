import { buildStageObservabilityReport } from '../evaluation/observability-report.js';
import type {
  ObservabilityAlertSeverity,
  ObservabilityContractBundle,
  ObservabilityDashboardAlert,
  ObservabilityDashboardContract,
  ObservabilityDashboardMetricCard,
  ObservabilityMetricSource,
  ObservabilityRuntimeWindowSummary,
  ObservabilityServiceContract,
  ObservabilityAlertThresholds,
  ObservabilityDashboardMetricKey,
  ObservabilityMetricStatus
} from './contracts.js';
import { CONTROL_PLANE_READONLY_SOURCES, DEFAULT_OBSERVABILITY_ALERT_THRESHOLDS } from './contracts.js';

export class ObservabilityService implements ObservabilityServiceContract {
  buildStageReport(input: import('./contracts.js').ObservabilityStageReportInput) {
    return buildStageObservabilityReport(input);
  }

  summarizeRuntimeWindows(
    windows: readonly import('../openclaw/types.js').OpenClawRuntimeContextWindowContract[]
  ): ObservabilityRuntimeWindowSummary {
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
    reports: readonly import('../evaluation/evaluation-harness.js').EvaluationReport[];
    history?: readonly import('../evaluation/observability-report.js').StageObservabilityTrendPoint[];
    windows: readonly import('../openclaw/types.js').OpenClawRuntimeContextWindowContract[];
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
    reports: readonly import('../evaluation/evaluation-harness.js').EvaluationReport[];
    history?: readonly import('../evaluation/observability-report.js').StageObservabilityTrendPoint[];
    windows: readonly import('../openclaw/types.js').OpenClawRuntimeContextWindowContract[];
    thresholds?: Partial<import('./contracts.js').ObservabilityAlertThresholds>;
  }): ObservabilityDashboardContract {
    const bundle = this.buildContractBundle(input);
    const thresholds = resolveObservabilityAlertThresholds(input.thresholds);
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
}

function resolveObservabilityAlertThresholds(
  overrides: Partial<ObservabilityAlertThresholds> | undefined
): ObservabilityAlertThresholds {
  return {
    ...DEFAULT_OBSERVABILITY_ALERT_THRESHOLDS,
    ...(overrides ?? {})
  };
}

function buildDashboardMetricCards(input: {
  latestStageReport: import('../evaluation/observability-report.js').StageObservabilityReport;
  runtimeWindowSummary: ObservabilityRuntimeWindowSummary;
  hasStageReports: boolean;
  thresholds: ObservabilityAlertThresholds;
  previousSnapshot?: import('../evaluation/observability-report.js').StageObservabilitySnapshot;
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
      value:
        runtimeSampleCount > 0 ? input.runtimeWindowSummary.averageCompressedCount : undefined
    }),
    buildMetricCard({
      key: 'runtime_average_final_message_count',
      label: 'Runtime average final message count',
      source: 'runtime_windows',
      unit: 'count',
      value:
        runtimeSampleCount > 0 ? input.runtimeWindowSummary.averageFinalMessageCount : undefined
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
  const threshold =
    card.threshold ? formatMetricValue(card.threshold.value, card.unit) : 'n/a';

  return `${card.label} ${comparator} threshold: current=${value} threshold=${threshold}`;
}

function formatMetricValue(value: number, unit: import('./contracts.js').ObservabilityMetricUnit): string {
  if (unit === 'count') {
    return value.toFixed(1);
  }

  return value.toFixed(2);
}
