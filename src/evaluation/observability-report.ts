import type { EvaluationReport } from './evaluation-harness.js';

export interface StageObservabilitySnapshot {
  fixtureCount: number;
  passCount: number;
  passRate: number;
  averageRelationPrecision: number;
  averageRelationRecall: number;
  averageRecallNoiseRate: number;
  averageBundleCoverage: number;
  averageExplainCoverage: number;
  averageConceptCoverage: number;
  averageMemoryUsefulness: number;
  averageMemoryIntrusion: number;
  averagePromotionQuality: number;
  averageKnowledgePollutionRate: number;
  averageHighScopeReuseBenefit: number;
  averageHighScopeReuseIntrusion: number;
  averageMultiSourceCoverage: number;
  averageCandidatePathCount: number;
  averageAdmittedPathCount: number;
  averagePathPruneRate: number;
  totalPathCount: number;
  totalPrunedPathCount: number;
}

export interface StageObservabilityTrendPoint {
  label: string;
  snapshot: StageObservabilitySnapshot;
}

export interface StageObservabilityTrendReport {
  pointCount: number;
  labels: string[];
  latestPassRate: number;
  latestRelationPrecision: number;
  latestRelationRecall: number;
  latestRecallNoiseRate: number;
  latestPathPruneRate: number;
  latestMemoryIntrusion: number;
  latestPromotionQuality: number;
  latestKnowledgePollutionRate: number;
  latestHighScopeReuseBenefit: number;
  latestMultiSourceCoverage: number;
}

export interface StageObservabilityReport {
  stage: string;
  current: StageObservabilitySnapshot;
  trend: StageObservabilityTrendReport;
}

export function buildStageObservabilitySnapshot(
  reports: readonly EvaluationReport[]
): StageObservabilitySnapshot {
  return {
    fixtureCount: reports.length,
    passCount: reports.filter((report) => report.pass).length,
    passRate: average(reports.map((report) => (report.pass ? 1 : 0))),
    averageRelationPrecision: average(reports.map((report) => report.metrics.relationRecall.precision)),
    averageRelationRecall: average(reports.map((report) => report.metrics.relationRecall.recall)),
    averageRecallNoiseRate: average(
      reports.map((report) =>
        report.metrics.relationRecall.selectedNodeIds.length > 0
          ? report.metrics.relationRecall.noiseNodeIds.length / report.metrics.relationRecall.selectedNodeIds.length
          : 0
      )
    ),
    averageBundleCoverage: average(reports.map((report) => report.metrics.bundleQuality.requiredCoverage)),
    averageExplainCoverage: average(reports.map((report) => report.metrics.explainCompleteness.coverage)),
    averageConceptCoverage: average(reports.map((report) => report.metrics.contextProcessing.conceptCoverage)),
    averageMemoryUsefulness: average(reports.map((report) => report.metrics.memoryQuality.usefulness)),
    averageMemoryIntrusion: average(reports.map((report) => report.metrics.memoryQuality.intrusion)),
    averagePromotionQuality: average(reports.map((report) => report.metrics.promotionQuality.knowledgeClassCoverage)),
    averageKnowledgePollutionRate: average(reports.map((report) => report.metrics.promotionQuality.pollutionRate)),
    averageHighScopeReuseBenefit: average(reports.map((report) => report.metrics.scopeReuse.benefit)),
    averageHighScopeReuseIntrusion: average(reports.map((report) => report.metrics.scopeReuse.intrusion)),
    averageMultiSourceCoverage: average(reports.map((report) => report.metrics.multiSource.coverage)),
    averageCandidatePathCount: average(
      reports.map((report) => report.metrics.retrievalCost.bundleRelation?.candidatePathCount ?? 0)
    ),
    averageAdmittedPathCount: average(
      reports.map((report) => report.metrics.retrievalCost.bundleRelation?.admittedPathCount ?? 0)
    ),
    averagePathPruneRate: average(
      reports.map((report) => {
        const candidateCount = report.metrics.retrievalCost.bundleRelation?.candidatePathCount ?? 0;
        const prunedCount = report.metrics.retrievalCost.bundleRelation?.prunedPathCount ?? 0;
        return candidateCount > 0 ? prunedCount / candidateCount : 0;
      })
    ),
    totalPathCount: reports.reduce(
      (total, report) => total + (report.metrics.retrievalCost.bundleRelation?.pathCount ?? 0),
      0
    ),
    totalPrunedPathCount: reports.reduce(
      (total, report) => total + (report.metrics.retrievalCost.bundleRelation?.prunedPathCount ?? 0),
      0
    )
  };
}

export function buildStageObservabilityTrend(
  points: readonly StageObservabilityTrendPoint[]
): StageObservabilityTrendReport {
  const [latest] = [...points].slice(-1);

  return {
    pointCount: points.length,
    labels: points.map((point) => point.label),
    latestPassRate: latest?.snapshot.passRate ?? 0,
    latestRelationPrecision: latest?.snapshot.averageRelationPrecision ?? 0,
    latestRelationRecall: latest?.snapshot.averageRelationRecall ?? 0,
    latestRecallNoiseRate: latest?.snapshot.averageRecallNoiseRate ?? 0,
    latestPathPruneRate: latest?.snapshot.averagePathPruneRate ?? 0,
    latestMemoryIntrusion: latest?.snapshot.averageMemoryIntrusion ?? 0,
    latestPromotionQuality: latest?.snapshot.averagePromotionQuality ?? 0,
    latestKnowledgePollutionRate: latest?.snapshot.averageKnowledgePollutionRate ?? 0,
    latestHighScopeReuseBenefit: latest?.snapshot.averageHighScopeReuseBenefit ?? 0,
    latestMultiSourceCoverage: latest?.snapshot.averageMultiSourceCoverage ?? 0
  };
}

export function buildStageObservabilityReport(input: {
  stage: string;
  reports: readonly EvaluationReport[];
  history?: readonly StageObservabilityTrendPoint[];
}): StageObservabilityReport {
  const current = buildStageObservabilitySnapshot(input.reports);
  const trend = buildStageObservabilityTrend([...(input.history ?? []), { label: input.stage, snapshot: current }]);

  return {
    stage: input.stage,
    current,
    trend
  };
}

export function formatStageObservabilityReport(report: StageObservabilityReport): string {
  return [
    `[Stage Observability] ${report.stage}`,
    `fixtures: ${report.current.fixtureCount} pass=${report.current.passCount} rate=${formatRatio(report.current.passRate)}`,
    `relation: precision=${formatRatio(report.current.averageRelationPrecision)} recall=${formatRatio(report.current.averageRelationRecall)} noise=${formatRatio(report.current.averageRecallNoiseRate)}`,
    `bundle: coverage=${formatRatio(report.current.averageBundleCoverage)} explain=${formatRatio(report.current.averageExplainCoverage)}`,
    `context: concept=${formatRatio(report.current.averageConceptCoverage)} memoryUsefulness=${formatRatio(report.current.averageMemoryUsefulness)} memoryIntrusion=${formatRatio(report.current.averageMemoryIntrusion)}`,
    `governance: promotion=${formatRatio(report.current.averagePromotionQuality)} pollution=${formatRatio(report.current.averageKnowledgePollutionRate)} scopeReuse=${formatRatio(report.current.averageHighScopeReuseBenefit)} scopeIntrusion=${formatRatio(report.current.averageHighScopeReuseIntrusion)}`,
    `multi-source: coverage=${formatRatio(report.current.averageMultiSourceCoverage)}`,
    `paths: candidate=${formatRatio(report.current.averageCandidatePathCount)} admitted=${formatRatio(report.current.averageAdmittedPathCount)} pruneRate=${formatRatio(report.current.averagePathPruneRate)} total=${report.current.totalPathCount} pruned=${report.current.totalPrunedPathCount}`,
    `trend: points=${report.trend.pointCount} latestPass=${formatRatio(report.trend.latestPassRate)} latestPollution=${formatRatio(report.trend.latestKnowledgePollutionRate)} latestReuse=${formatRatio(report.trend.latestHighScopeReuseBenefit)} latestMultiSource=${formatRatio(report.trend.latestMultiSourceCoverage)}`
  ].join('\n');
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function formatRatio(value: number): string {
  return value.toFixed(2);
}
