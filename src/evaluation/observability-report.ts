import type { EvaluationReport } from './evaluation-harness.js';

export interface StageObservabilitySnapshot {
  fixtureCount: number;
  passCount: number;
  passRate: number;
  averageRelationPrecision: number;
  averageRelationRecall: number;
  averageBundleCoverage: number;
  averageExplainCoverage: number;
  averageConceptCoverage: number;
  totalPathCount: number;
  totalPrunedPathCount: number;
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
    averageBundleCoverage: average(reports.map((report) => report.metrics.bundleQuality.requiredCoverage)),
    averageExplainCoverage: average(reports.map((report) => report.metrics.explainCompleteness.coverage)),
    averageConceptCoverage: average(reports.map((report) => report.metrics.contextProcessing.conceptCoverage)),
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

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}
