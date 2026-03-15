import type {
  ContextNoiseDisposition,
  ContextProcessingResult,
  ManualCorrectionRecord
} from '../types/context-processing.js';
import type { RawContextRecord } from '../types/io.js';
import { processContextRecord } from '../context-processing/context-processing-pipeline.js';

export interface ContextProcessingHarnessFixture {
  name: string;
  records: RawContextRecord[];
  manualCorrections?: ManualCorrectionRecord[];
}

export interface ContextProcessingHarnessMetrics {
  recordCount: number;
  sentenceCount: number;
  clauseCount: number;
  semanticSpanCount: number;
  nodeCandidateCount: number;
  summaryCandidateCount: number;
  conceptMatchCount: number;
  noiseCounts: Record<ContextNoiseDisposition, number>;
  cacheHitCount: number;
  experienceHintCount: number;
}

export interface ContextProcessingHarnessReport {
  fixtureName: string;
  metrics: ContextProcessingHarnessMetrics;
  results: ContextProcessingResult[];
}

export function runContextProcessingHarness(
  fixture: ContextProcessingHarnessFixture
): ContextProcessingHarnessReport {
  const results = fixture.records.map((record) =>
    processContextRecord(record, {
      manualCorrections: fixture.manualCorrections
    })
  );

  return {
    fixtureName: fixture.name,
    metrics: {
      recordCount: results.length,
      sentenceCount: sumBy(results, (result) => result.parseResult.sentences.length),
      clauseCount: sumBy(results, (result) => result.parseResult.clauses.length),
      semanticSpanCount: sumBy(results, (result) => result.semanticSpans.length),
      nodeCandidateCount: sumBy(results, (result) => result.nodeCandidates.length),
      summaryCandidateCount: sumBy(results, (result) => result.summaryCandidates.length),
      conceptMatchCount: sumBy(results, (result) => result.diagnostics.conceptMatchCount),
      noiseCounts: {
        drop: countNoiseDispositions(results, 'drop'),
        evidence_only: countNoiseDispositions(results, 'evidence_only'),
        hint_only: countNoiseDispositions(results, 'hint_only'),
        materialize: countNoiseDispositions(results, 'materialize')
      },
      cacheHitCount: results.filter((result) => result.diagnostics.cacheHit).length,
      experienceHintCount: results.filter((result) => result.experienceHint).length
    },
    results
  };
}

export function formatContextProcessingHarnessReport(report: ContextProcessingHarnessReport): string {
  return [
    `[ContextProcessing] ${report.fixtureName}`,
    `records=${report.metrics.recordCount}`,
    `sentences=${report.metrics.sentenceCount} clauses=${report.metrics.clauseCount} semanticSpans=${report.metrics.semanticSpanCount}`,
    `nodeCandidates=${report.metrics.nodeCandidateCount} summaryCandidates=${report.metrics.summaryCandidateCount} conceptMatches=${report.metrics.conceptMatchCount}`,
    `noise: drop=${report.metrics.noiseCounts.drop} evidence_only=${report.metrics.noiseCounts.evidence_only} hint_only=${report.metrics.noiseCounts.hint_only} materialize=${report.metrics.noiseCounts.materialize}`,
    `cacheHits=${report.metrics.cacheHitCount} experienceHints=${report.metrics.experienceHintCount}`
  ].join('\n');
}

function countNoiseDispositions(
  results: readonly ContextProcessingResult[],
  disposition: ContextNoiseDisposition
): number {
  return results.reduce(
    (total, result) => total + result.noiseDecisions.filter((decision) => decision.disposition === disposition).length,
    0
  );
}

function sumBy<T>(values: readonly T[], selector: (value: T) => number): number {
  return values.reduce((total, value) => total + selector(value), 0);
}
