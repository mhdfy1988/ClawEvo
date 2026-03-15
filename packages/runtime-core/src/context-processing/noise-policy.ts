import type {
  ContextInputRouteKind,
  ContextNoiseDecision,
  ContextNoiseDisposition,
  ContextNoiseSignal,
  ManualCorrectionRecord,
  SemanticSpan
} from '@openclaw-compact-context/contracts';
import { normalizeUtteranceText } from './utterance-parser.js';

const ACKNOWLEDGEMENT_REGEX =
  /^(?:ok|okay|yes|yep|yeah|sure|thanks|thank you|got it|understood|fine|cool|roger|copy|\u597d\u7684|\u884c|\u6069|\u55ef|\u660e\u767d|\u6536\u5230|\u8c22\u8c22|\u597d\u5427)$/iu;

export const CONTEXT_PROCESSING_NOISE_POLICY_TARGET = 'context-processing-noise-policy';

export function evaluateNoisePolicy(
  route: ContextInputRouteKind,
  semanticSpans: readonly SemanticSpan[],
  corrections: readonly ManualCorrectionRecord[] = []
): ContextNoiseDecision[] {
  const seenNormalizedText = new Set<string>();

  return semanticSpans.map((span) => {
    const override = resolveNoisePolicyOverride(span, corrections);

    if (override) {
      return {
        spanId: span.id,
        route,
        disposition: override.disposition,
        reason: override.reason,
        signals: ['manual_override'],
        targetId: override.targetId
      };
    }

    const normalized = normalizeUtteranceText(span.normalizedText || span.text);
    const tokenCount = normalized.split(/\s+/u).filter(Boolean).length;
    const nonTopicCandidateTypes = span.candidateNodeTypes.filter((type) => type !== 'Topic' && type !== 'Concept');
    const signals: ContextNoiseSignal[] = [];

    if (!normalized) {
      signals.push('empty_span');
      return buildNoiseDecision(span.id, route, 'drop', 'span is empty after normalization', signals, normalized);
    }

    if (seenNormalizedText.has(normalized)) {
      signals.push('duplicate_clause');
      return buildNoiseDecision(
        span.id,
        route,
        'evidence_only',
        'duplicate clause kept only as evidence to avoid repeated materialization',
        signals,
        normalized
      );
    }

    seenNormalizedText.add(normalized);

    if (ACKNOWLEDGEMENT_REGEX.test(normalized)) {
      signals.push('acknowledgement');
      return buildNoiseDecision(
        span.id,
        route,
        'evidence_only',
        'acknowledgement-style utterance is retained as evidence only',
        signals,
        normalized
      );
    }

    if (nonTopicCandidateTypes.length === 0 && span.conceptMatches.length === 0 && tokenCount <= 3) {
      signals.push('weak_topic_only');
      return buildNoiseDecision(
        span.id,
        route,
        'hint_only',
        'weak topic-only clause is kept as a hint instead of being materialized',
        signals,
        normalized
      );
    }

    if (nonTopicCandidateTypes.length === 0 && span.conceptMatches.length === 0 && tokenCount <= 2) {
      signals.push('low_information');
      return buildNoiseDecision(
        span.id,
        route,
        'evidence_only',
        'low-information clause is retained as evidence only',
        signals,
        normalized
      );
    }

    return buildNoiseDecision(
      span.id,
      route,
      'materialize',
      'clause carries enough structural or conceptual signal to materialize',
      signals,
      normalized
    );
  });
}

function buildNoiseDecision(
  spanId: string,
  route: ContextInputRouteKind,
  disposition: ContextNoiseDisposition,
  reason: string,
  signals: ContextNoiseSignal[],
  targetId: string
): ContextNoiseDecision {
  return {
    spanId,
    route,
    disposition,
    reason,
    signals,
    targetId
  };
}

function resolveNoisePolicyOverride(
  span: SemanticSpan,
  corrections: readonly ManualCorrectionRecord[]
): { disposition: ContextNoiseDisposition; reason: string; targetId: string } | undefined {
  const candidates = [span.id, normalizeUtteranceText(span.normalizedText || span.text)];
  const relevant = corrections
    .filter((correction) => correction.targetKind === 'noise_policy' && candidates.includes(correction.targetId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  for (const correction of relevant) {
    const disposition = readNoiseDisposition(correction);

    if (!disposition) {
      continue;
    }

    if (correction.action === 'rollback') {
      return undefined;
    }

    return {
      disposition,
      reason: correction.reason || 'manual noise policy override',
      targetId: correction.targetId
    };
  }

  return undefined;
}

export function readNoiseDisposition(
  correction: ManualCorrectionRecord
): ContextNoiseDisposition | undefined {
  if (correction.targetKind !== 'noise_policy') {
    return undefined;
  }

  const disposition = correction.metadata?.disposition;
  return disposition === 'drop' ||
    disposition === 'evidence_only' ||
    disposition === 'hint_only' ||
    disposition === 'materialize'
    ? disposition
    : undefined;
}
