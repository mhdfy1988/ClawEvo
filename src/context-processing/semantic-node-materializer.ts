import { createHash } from 'node:crypto';

import type {
  GraphNode,
  JsonObject,
  KnowledgeKind,
  KnowledgeStrength,
  NodeType,
  ProvenanceRef,
  Scope,
  SourceRef
} from '../types/core.js';
import type {
  ConceptMatch,
  ContextInputRouteKind,
  ContextProcessingNodeCandidate,
  SemanticSpan
} from '../types/context-processing.js';
import type { RawContextRecord } from '../types/io.js';
import { buildNodeGovernance } from '../governance/governance.js';

export function materializeSemanticNodeCandidate(input: {
  record: RawContextRecord;
  evidenceNodeId: string;
  sessionId: string;
  workspaceId?: string;
  route: ContextInputRouteKind;
  span: SemanticSpan;
  nodeType: NodeType;
  conceptMatch?: ConceptMatch;
  baseStrength: KnowledgeStrength;
  baseConfidence: number;
  kind: KnowledgeKind;
  sourceRef: SourceRef | undefined;
  provenance: ProvenanceRef | undefined;
  overridePriority?: number;
}): GraphNode {
  const {
    record,
    evidenceNodeId,
    sessionId,
    workspaceId,
    route,
    span,
    nodeType,
    conceptMatch,
    baseStrength,
    baseConfidence,
    kind,
    sourceRef,
    provenance,
    overridePriority
  } = input;
  const now = record.createdAt ?? new Date().toISOString();
  const semanticGroupKey = buildSemanticSpanGroupKey(record, route, nodeType, span, conceptMatch);
  const version = buildSemanticSpanVersion(span, conceptMatch);
  const freshness = 'active';
  const strength = resolveSpanNodeStrength(baseStrength, nodeType);
  const confidence = resolveSpanNodeConfidence(baseConfidence, nodeType, span, conceptMatch);
  const semanticMetadata: JsonObject = {
    ...(record.metadata ?? {}),
    semanticGroupKey,
    semanticSpanId: span.id,
    semanticSpanText: span.text,
    semanticSpanNormalizedText: span.normalizedText,
    semanticSpanRoute: route,
    semanticSpanSentenceId: span.sentenceId,
    semanticSpanClauseId: span.clauseId,
    semanticSpanStartOffset: span.startOffset,
    semanticSpanEndOffset: span.endOffset,
    ...(span.conceptMatches.length > 0
      ? {
          conceptIds: span.conceptMatches.map((item) => item.conceptId),
          conceptLabels: span.conceptMatches.map((item) => item.preferredLabel)
        }
      : {})
  };
  const conflictSetKey = isRuleLikeType(nodeType) ? semanticGroupKey : undefined;

  return {
    id: hashId('semantic', sessionId, nodeType, semanticGroupKey),
    type: nodeType,
    scope: record.scope,
    kind,
    label: buildSemanticSpanLabel(nodeType, span, conceptMatch),
    payload: {
      sessionId,
      workspaceId: workspaceId ?? null,
      sourceType: record.sourceType,
      contentPreview: span.text.slice(0, 400),
      metadata: semanticMetadata
    },
    strength,
    confidence,
    sourceRef,
    provenance,
    governance: buildNodeGovernance({
      type: nodeType,
      scope: record.scope,
      strength,
      confidence,
      freshness,
      validFrom: now,
      provenance,
      sourceType: record.sourceType,
      workspaceId,
      conflict:
        conflictSetKey || typeof overridePriority === 'number'
          ? {
              conflictStatus: 'none',
              resolutionState: 'unresolved',
              ...(conflictSetKey ? { conflictSetKey } : {}),
              ...(typeof overridePriority === 'number' ? { overridePriority } : {})
            }
          : undefined
    }),
    version,
    freshness,
    validFrom: now,
    updatedAt: now
  };
}

export function resolveCandidateConceptMatch(
  candidate: ContextProcessingNodeCandidate,
  span: SemanticSpan
): ConceptMatch | undefined {
  if (candidate.nodeType !== 'Concept' || !candidate.conceptId) {
    return undefined;
  }

  return span.conceptMatches.find((match) => match.conceptId === candidate.conceptId);
}

function buildSemanticSpanGroupKey(
  record: RawContextRecord,
  route: ContextInputRouteKind,
  nodeType: NodeType,
  span: SemanticSpan,
  conceptMatch?: ConceptMatch
): string {
  const anchor =
    conceptMatch?.conceptId ??
    normalizeSemanticText(span.normalizedText).slice(0, 96) ??
    normalizeSemanticText(span.text).slice(0, 96);

  return ['span', record.scope, route, nodeType, anchor].filter(Boolean).join('|');
}

function buildSemanticSpanVersion(span: SemanticSpan, conceptMatch?: ConceptMatch): string {
  return `v:${hashId(
    'semantic-span-version',
    span.normalizedText,
    conceptMatch?.conceptId ?? '',
    span.route
  ).slice(0, 12)}`;
}

function buildSemanticSpanLabel(
  nodeType: NodeType,
  span: SemanticSpan,
  conceptMatch?: ConceptMatch
): string {
  if (nodeType === 'Concept' && conceptMatch) {
    return `concept:${conceptMatch.preferredLabel}`;
  }

  if (nodeType === 'Topic') {
    return `topic:${conceptMatch?.preferredLabel ?? semanticPreview(span.text)}`;
  }

  return `${nodeType.toLowerCase()}:${semanticPreview(span.text)}`;
}

function semanticPreview(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().slice(0, 96) || 'empty';
}

function resolveSpanNodeStrength(baseStrength: KnowledgeStrength, nodeType: NodeType): KnowledgeStrength {
  if (nodeType === 'Concept' || nodeType === 'Topic') {
    return 'heuristic';
  }

  if (baseStrength === 'hard') {
    return 'soft';
  }

  return baseStrength;
}

function resolveSpanNodeConfidence(
  baseConfidence: number,
  nodeType: NodeType,
  span: SemanticSpan,
  conceptMatch?: ConceptMatch
): number {
  const conceptBonus = conceptMatch ? 0.08 : 0;
  const topicPenalty = nodeType === 'Topic' ? 0.08 : 0;
  const conceptPenalty = nodeType === 'Concept' ? 0.03 : 0;
  const shortSpanPenalty = span.normalizedText.length < 12 ? 0.05 : 0;

  return Math.max(0.45, Math.min(0.97, baseConfidence - topicPenalty - conceptPenalty - shortSpanPenalty + conceptBonus));
}

function normalizeSemanticText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashId(...parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

function isRuleLikeType(nodeType: NodeType): boolean {
  return nodeType === 'Rule' || nodeType === 'Constraint' || nodeType === 'Mode';
}
