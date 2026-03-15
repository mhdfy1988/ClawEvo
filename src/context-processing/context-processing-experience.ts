import { createHash } from 'node:crypto';

import type {
  ContextProcessingExperienceHint,
  ContextProcessingNodeCandidate,
  ContextProcessingResult,
  SemanticSpan
} from '../types/context-processing.js';

export function buildContextProcessingExperienceHint(
  result: Pick<ContextProcessingResult, 'route' | 'semanticSpans' | 'nodeCandidates' | 'noiseDecisions'>
): ContextProcessingExperienceHint | undefined {
  const actionableCandidates = result.nodeCandidates.filter((candidate) => candidate.disposition === 'materialize');
  const procedureStepSpanIds = actionableCandidates
    .filter((candidate) => candidate.nodeType === 'Process' || candidate.nodeType === 'Step')
    .map((candidate) => candidate.spanId);
  const failureSignalSpanIds = actionableCandidates
    .filter(
      (candidate) =>
        candidate.nodeType === 'Risk' ||
        candidate.nodeType === 'State'
    )
    .map((candidate) => candidate.spanId)
    .filter((spanId) => looksLikeFailureSignal(spanId, result.semanticSpans));
  const procedureStepLabels = resolveSpanLabels(procedureStepSpanIds, result.semanticSpans);
  const failureSignalLabels = resolveSpanLabels(failureSignalSpanIds, result.semanticSpans);

  if (procedureStepSpanIds.length === 0 && failureSignalSpanIds.length === 0) {
    return undefined;
  }

  const criticalStepSpanIds =
    procedureStepSpanIds.length > 0 ? [procedureStepSpanIds[procedureStepSpanIds.length - 1] as string] : [];
  const criticalStepLabels = resolveSpanLabels(criticalStepSpanIds, result.semanticSpans);
  const baseKey = [
    result.route,
    procedureStepSpanIds.join(','),
    failureSignalSpanIds.join(','),
    criticalStepSpanIds.join(',')
  ].join('|');

  return {
    attemptId: hashId('context-processing-attempt', baseKey),
    episodeId: hashId('context-processing-episode', result.route, procedureStepSpanIds.join(',')),
    status:
      procedureStepSpanIds.length > 0 && failureSignalSpanIds.length > 0
        ? 'mixed'
        : failureSignalSpanIds.length > 0
          ? 'failure_only'
          : 'procedure_only',
    failureSignalSpanIds,
    failureSignalLabels,
    procedureStepSpanIds,
    procedureStepLabels,
    criticalStepSpanIds,
    criticalStepLabels
  };
}

function looksLikeFailureSignal(spanId: string, semanticSpans: readonly SemanticSpan[]): boolean {
  const span = semanticSpans.find((item) => item.id === spanId);
  const text = span?.normalizedText ?? '';
  return /\b(?:fail|failed|error|timeout|blocked|warning)\b|\u5931\u8d25|\u9519\u8bef|\u8d85\u65f6|\u963b\u585e|\u98ce\u9669/iu.test(text);
}

function hashId(...parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

function resolveSpanLabels(spanIds: readonly string[], semanticSpans: readonly SemanticSpan[]): string[] {
  const spansById = new Map(semanticSpans.map((span) => [span.id, span]));
  return spanIds
    .map((spanId) => spansById.get(spanId)?.text.trim())
    .filter((value): value is string => Boolean(value));
}
