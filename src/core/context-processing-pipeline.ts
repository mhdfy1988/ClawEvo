import { createHash } from 'node:crypto';

import type { GraphNode, NodeType } from '../types/core.js';
import type {
  ConceptMatch,
  ContextInputRouteKind,
  ContextNoiseDecision,
  ContextProcessingNodeCandidate,
  ContextProcessingPipelineOptions,
  ContextProcessingResult,
  ManualCorrectionRecord,
  SemanticExtractionNodeTarget,
  SemanticSpan
} from '../types/context-processing.js';
import type { RawContextRecord } from '../types/io.js';
import { getSemanticExtractionContract } from './context-processing-contracts.js';
import { buildContextProcessingExperienceHint } from './context-processing-experience.js';
import { getManualContextProcessingCorrections } from './context-processing-corrections.js';
import { CONTEXT_PROCESSING_VERSIONS } from './context-processing-versions.js';
import {
  resolveLabelOverrideForTargets,
  resolveSemanticClassificationOverrides
} from './manual-corrections.js';
import { evaluateNoisePolicy } from './noise-policy.js';
import {
  buildSemanticSpansFromGraphNode,
  buildSemanticSpansFromRecord,
  type SemanticSpanExtractionResult
} from './semantic-spans.js';
import { buildSummaryCandidates } from './summary-planner.js';
import { normalizeUtteranceText } from './utterance-parser.js';

const contextProcessingCache = new Map<string, ContextProcessingResult>();

export function clearContextProcessingCache(): void {
  contextProcessingCache.clear();
}

export function processContextRecord(
  record: RawContextRecord,
  options: ContextProcessingPipelineOptions = {}
): ContextProcessingResult {
  const manualCorrections = options.manualCorrections ?? getManualContextProcessingCorrections();
  const cacheKey = buildContextProcessingCacheKey(record, manualCorrections, options.primaryNodeType);
  const cached = contextProcessingCache.get(cacheKey);

  if (cached) {
    return cloneProcessingResult(cached, {
      cacheKey,
      cacheHit: true
    });
  }

  const result = buildContextProcessingResult(buildSemanticSpansFromRecord(record), {
    ...options,
    manualCorrections
  });
  const withCacheInfo = cloneProcessingResult(result, {
    cacheKey,
    cacheHit: false
  });

  contextProcessingCache.set(cacheKey, withCacheInfo);
  return cloneProcessingResult(withCacheInfo, {
    cacheKey,
    cacheHit: false
  });
}

export function processContextGraphNode(
  node: GraphNode,
  sourceNode: GraphNode = node,
  options: ContextProcessingPipelineOptions = {}
): ContextProcessingResult {
  const manualCorrections = options.manualCorrections ?? getManualContextProcessingCorrections();
  return buildContextProcessingResult(buildSemanticSpansFromGraphNode(node, sourceNode), {
    ...options,
    manualCorrections
  });
}

function buildContextProcessingResult(
  extraction: SemanticSpanExtractionResult,
  options: ContextProcessingPipelineOptions
): ContextProcessingResult {
  const contract = getSemanticExtractionContract(extraction.route);
  const semanticSpans = applySemanticClassificationCorrections(
    extraction.semanticSpans,
    options.manualCorrections ?? []
  );
  const noiseDecisions = evaluateNoisePolicy(extraction.route, semanticSpans, options.manualCorrections ?? []);
  const nodeCandidates = buildNodeCandidates(
    extraction.route,
    semanticSpans,
    noiseDecisions,
    options.primaryNodeType,
    options.manualCorrections ?? []
  );
  const summaryCandidates = buildSummaryCandidates(nodeCandidates);
  const materializationPlan = {
    route: extraction.route,
    preserveEvidence: contract.preserveRawEvidence,
    materializeNodeCandidates: nodeCandidates.filter((candidate) => candidate.disposition === 'materialize'),
    summaryOnlyNodeCandidates: nodeCandidates.filter((candidate) => candidate.disposition === 'summary_only')
  };
  const experienceHint = buildContextProcessingExperienceHint({
    route: extraction.route,
    semanticSpans,
    nodeCandidates,
    noiseDecisions
  });

  return {
    version: CONTEXT_PROCESSING_VERSIONS.pipeline,
    versions: CONTEXT_PROCESSING_VERSIONS,
    route: extraction.route,
    contract,
    parseResult: extraction.parseResult,
    evidenceAnchor: extraction.evidenceAnchor,
    semanticSpans,
    noiseDecisions,
    nodeCandidates,
    summaryCandidates,
    materializationPlan,
    ...(experienceHint ? { experienceHint } : {}),
    diagnostics: {
      version: CONTEXT_PROCESSING_VERSIONS.pipeline,
      route: extraction.route,
      clauseSplitApplied: extraction.parseResult.clauseSplitApplied,
      appliedFallbacks: extraction.parseResult.appliedFallbacks,
      sentenceCount: extraction.parseResult.sentences.length,
      clauseCount: extraction.parseResult.clauses.length,
      semanticSpanCount: semanticSpans.length,
      conceptMatchCount: semanticSpans.reduce((total, span) => total + span.conceptMatches.length, 0),
      noiseDecisionCount: noiseDecisions.length,
      droppedSpanCount: noiseDecisions.filter((item) => item.disposition === 'drop').length,
      evidenceOnlySpanCount: noiseDecisions.filter((item) => item.disposition === 'evidence_only').length,
      hintOnlySpanCount: noiseDecisions.filter((item) => item.disposition === 'hint_only').length,
      materializeSpanCount: noiseDecisions.filter((item) => item.disposition === 'materialize').length,
      nodeCandidateCount: nodeCandidates.length,
      materializeNodeCandidateCount: materializationPlan.materializeNodeCandidates.length,
      summaryCandidateCount: summaryCandidates.length
    }
  };
}

function buildNodeCandidates(
  route: ContextInputRouteKind,
  semanticSpans: readonly SemanticSpan[],
  noiseDecisions: readonly ContextNoiseDecision[],
  primaryNodeType?: NodeType,
  corrections: readonly ManualCorrectionRecord[] = []
): ContextProcessingNodeCandidate[] {
  const candidates: ContextProcessingNodeCandidate[] = [];
  const noiseBySpanId = new Map(noiseDecisions.map((decision) => [decision.spanId, decision]));

  for (const span of semanticSpans) {
    const decision = noiseBySpanId.get(span.id);

    if (decision?.disposition === 'drop' || decision?.disposition === 'evidence_only') {
      continue;
    }

    const structuralTarget = selectStructuralSpanTarget(route, span.candidateNodeTypes, primaryNodeType);

    if (structuralTarget && decision?.disposition !== 'hint_only') {
      candidates.push(
        createNodeCandidate(route, span, structuralTarget, 'materialize', 'structural target selected', undefined, corrections)
      );
    }

    if (allowsSupplementalTopicOrConcept(route) && span.candidateNodeTypes.includes('Topic')) {
      if (primaryNodeType === 'Topic') {
        candidates.push(
          createNodeCandidate(
            route,
            span,
            'Topic',
            'summary_only',
            'topic remains attached to the primary node',
            undefined,
            corrections
          )
        );
      } else if (decision?.disposition === 'hint_only') {
        candidates.push(
          createNodeCandidate(route, span, 'Topic', 'summary_only', decision.reason, undefined, corrections)
        );
      } else if (shouldMaterializeTopic(span)) {
        candidates.push(
          createNodeCandidate(route, span, 'Topic', 'materialize', 'topic is specific enough to materialize', undefined, corrections)
        );
      } else {
        candidates.push(
          createNodeCandidate(route, span, 'Topic', 'summary_only', 'topic kept as a summary-only hint', undefined, corrections)
        );
      }
    }

    if (allowsSupplementalTopicOrConcept(route) && span.candidateNodeTypes.includes('Concept')) {
      const conceptMatches = dedupeConceptMatches(span.conceptMatches);

      if (conceptMatches.length === 0) {
        continue;
      }

      for (const conceptMatch of conceptMatches) {
        if (primaryNodeType === 'Concept' || decision?.disposition === 'hint_only') {
          candidates.push(
            createNodeCandidate(
              route,
              span,
              'Concept',
              'summary_only',
              primaryNodeType === 'Concept'
                ? 'concept remains attached to the primary node'
                : decision?.reason ?? 'concept kept as a summary-only hint',
              conceptMatch,
              corrections
            )
          );
          continue;
        }

        candidates.push(
          createNodeCandidate(
            route,
            span,
            'Concept',
            'materialize',
            'concept match is explicit enough to materialize',
            conceptMatch,
            corrections
          )
        );
      }
    }
  }

  return dedupeNodeCandidates(candidates);
}

function applySemanticClassificationCorrections(
  semanticSpans: readonly SemanticSpan[],
  corrections: readonly ManualCorrectionRecord[]
): SemanticSpan[] {
  return semanticSpans.map((span) => {
    const overrides = resolveSemanticClassificationOverrides(
      [span.id, normalizeUtteranceText(span.normalizedText || span.text)],
      corrections
    );
    if (overrides.include.length === 0 && overrides.exclude.length === 0) {
      return span;
    }

    const nextTypes = new Set<SemanticExtractionNodeTarget>(span.candidateNodeTypes);

    for (const excluded of overrides.exclude) {
      nextTypes.delete(excluded);
    }

    for (const included of overrides.include) {
      nextTypes.add(included);
    }

    return {
      ...span,
      candidateNodeTypes: [...nextTypes]
    };
  });
}

function selectStructuralSpanTarget(
  route: ContextInputRouteKind,
  supportedTargets: readonly SemanticExtractionNodeTarget[],
  primaryNodeType?: NodeType
): SemanticExtractionNodeTarget | undefined {
  const structuralByRoute: Record<ContextInputRouteKind, SemanticExtractionNodeTarget[]> = {
    conversation: ['Goal', 'Constraint', 'Process', 'Step'],
    tool_result: [],
    transcript: ['Goal', 'Constraint', 'Process', 'Step'],
    document: [],
    experience_trace: ['Process', 'Step', 'Constraint'],
    system: []
  };

  for (const target of structuralByRoute[route]) {
    if (!supportedTargets.includes(target)) {
      continue;
    }

    if (primaryNodeType && target === primaryNodeType) {
      continue;
    }

    return target;
  }

  return undefined;
}

function allowsSupplementalTopicOrConcept(route: ContextInputRouteKind): boolean {
  return route === 'conversation' || route === 'transcript' || route === 'experience_trace';
}

function shouldMaterializeTopic(span: SemanticSpan): boolean {
  if (span.conceptMatches.length > 0) {
    return true;
  }

  const meaningfulTermCount = span.normalizedText.split(/\s+/u).filter(Boolean).length;
  return meaningfulTermCount >= 4;
}

function createNodeCandidate(
  route: ContextInputRouteKind,
  span: SemanticSpan,
  nodeType: SemanticExtractionNodeTarget,
  disposition: ContextProcessingNodeCandidate['disposition'],
  reason: string,
  conceptMatch?: ConceptMatch,
  corrections: readonly ManualCorrectionRecord[] = []
): ContextProcessingNodeCandidate {
  const correctionTargetIds = [span.id, normalizeUtteranceText(span.normalizedText || span.text)];
  const label =
    resolveLabelOverrideForTargets(correctionTargetIds, corrections) ??
    buildCandidateLabel(nodeType, span, conceptMatch);

  return {
    id: hashId(
      'context-node-candidate',
      route,
      span.id,
      nodeType,
      conceptMatch?.conceptId ?? '',
      disposition
    ),
    spanId: span.id,
    route,
    nodeType,
    label,
    normalizedLabel: normalizeUtteranceText(label),
    disposition,
    reason,
    ...(conceptMatch ? { conceptId: conceptMatch.conceptId } : {})
  };
}

function buildCandidateLabel(
  nodeType: SemanticExtractionNodeTarget,
  span: SemanticSpan,
  conceptMatch?: ConceptMatch
): string {
  if (nodeType === 'Concept' && conceptMatch) {
    return conceptMatch.preferredLabel;
  }

  if (nodeType === 'Topic') {
    return conceptMatch?.preferredLabel ?? semanticPreview(span.text);
  }

  return semanticPreview(span.text);
}

function semanticPreview(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().slice(0, 96) || 'empty';
}

function dedupeConceptMatches(matches: readonly ConceptMatch[]): ConceptMatch[] {
  const byConceptId = new Map<string, ConceptMatch>();

  for (const match of matches) {
    if (!byConceptId.has(match.conceptId)) {
      byConceptId.set(match.conceptId, match);
    }
  }

  return [...byConceptId.values()];
}

function dedupeNodeCandidates(
  candidates: readonly ContextProcessingNodeCandidate[]
): ContextProcessingNodeCandidate[] {
  const byId = new Map<string, ContextProcessingNodeCandidate>();

  for (const candidate of candidates) {
    if (!byId.has(candidate.id)) {
      byId.set(candidate.id, candidate);
    }
  }

  return [...byId.values()];
}

function buildContextProcessingCacheKey(
  record: RawContextRecord,
  manualCorrections: readonly ManualCorrectionRecord[],
  primaryNodeType?: NodeType
): string {
  return hashId(
    'context-processing-cache',
    CONTEXT_PROCESSING_VERSIONS.pipeline,
    CONTEXT_PROCESSING_VERSIONS.parser,
    CONTEXT_PROCESSING_VERSIONS.conceptLexicon,
    CONTEXT_PROCESSING_VERSIONS.semanticClassifier,
    CONTEXT_PROCESSING_VERSIONS.noisePolicy,
    CONTEXT_PROCESSING_VERSIONS.summaryPlanner,
    record.id ?? '',
    record.scope,
    record.sourceType,
    record.role ?? '',
    record.content,
    primaryNodeType ?? '',
    buildCorrectionsFingerprint(manualCorrections)
  );
}

function buildCorrectionsFingerprint(
  corrections: readonly ManualCorrectionRecord[]
): string {
  return corrections
    .map((correction) =>
      [
        correction.id,
        correction.targetKind,
        correction.targetId,
        correction.action,
        correction.createdAt,
        JSON.stringify(correction.metadata ?? {})
      ].join(':')
    )
    .sort()
    .join('|');
}

function cloneProcessingResult(
  result: ContextProcessingResult,
  cache: { cacheKey: string; cacheHit: boolean }
): ContextProcessingResult {
  const cloned = structuredClone(result);
  cloned.diagnostics.cacheKey = cache.cacheKey;
  cloned.diagnostics.cacheHit = cache.cacheHit;
  return cloned;
}

function hashId(...parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
