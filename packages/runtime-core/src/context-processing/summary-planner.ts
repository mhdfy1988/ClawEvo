import { createHash } from 'node:crypto';

import type {
  ContextProcessingNodeCandidate,
  ContextSummaryCandidate,
  ContextProcessingNodeCandidateDisposition,
  SemanticExtractionNodeTarget
} from '@openclaw-compact-context/contracts';
import type { NodePromptPreferredForm, RuntimeContextSelectionSlot } from '@openclaw-compact-context/contracts';
import { normalizeUtteranceText } from './utterance-parser.js';

export function buildSummaryCandidates(
  nodeCandidates: readonly ContextProcessingNodeCandidate[]
): ContextSummaryCandidate[] {
  const candidates: ContextSummaryCandidate[] = [];

  for (const nodeCandidate of nodeCandidates) {
    const slot = resolveSummarySlot(nodeCandidate.nodeType);

    if (!slot) {
      continue;
    }

    candidates.push({
      id: buildSummaryCandidateId(nodeCandidate),
      slot,
      label: nodeCandidate.label,
      preferredForm: resolveSummaryPreferredForm(nodeCandidate.nodeType, nodeCandidate.disposition),
      requiresEvidence: nodeCandidate.nodeType !== 'Concept' && nodeCandidate.nodeType !== 'Topic',
      reason: `${nodeCandidate.reason}; slot=${slot}`,
      spanIds: [nodeCandidate.spanId],
      sourceNodeCandidateIds: [nodeCandidate.id]
    });
  }

  return dedupeSummaryCandidates(candidates);
}

function resolveSummarySlot(nodeType: SemanticExtractionNodeTarget): RuntimeContextSelectionSlot | undefined {
  switch (nodeType) {
    case 'Goal':
      return 'goal';
    case 'Intent':
      return 'intent';
    case 'Process':
    case 'Step':
      return 'currentProcess';
    case 'Rule':
      return 'activeRules';
    case 'Constraint':
    case 'Mode':
      return 'activeConstraints';
    case 'Risk':
      return 'openRisks';
    case 'Decision':
      return 'recentDecisions';
    case 'State':
    case 'Outcome':
      return 'recentStateChanges';
    case 'Tool':
    case 'Topic':
    case 'Concept':
      return 'relevantEvidence';
    case 'Skill':
      return 'candidateSkills';
    default:
      return undefined;
  }
}

function resolveSummaryPreferredForm(
  nodeType: SemanticExtractionNodeTarget,
  disposition: ContextProcessingNodeCandidateDisposition
): NodePromptPreferredForm {
  if (disposition === 'summary_only') {
    return 'summary';
  }

  switch (nodeType) {
    case 'Topic':
    case 'Concept':
      return 'summary';
    case 'Tool':
      return 'citation_only';
    default:
      return 'raw';
  }
}

function buildSummaryCandidateId(candidate: ContextProcessingNodeCandidate): string {
  return createHash('sha256')
    .update(['context-summary-candidate', candidate.id, candidate.nodeType].join('|'))
    .digest('hex');
}

function dedupeSummaryCandidates(
  candidates: readonly ContextSummaryCandidate[]
): ContextSummaryCandidate[] {
  const byKey = new Map<string, ContextSummaryCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.slot}:${normalizeUtteranceText(candidate.label)}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }

    byKey.set(key, {
      ...existing,
      spanIds: dedupeStrings(existing.spanIds.concat(candidate.spanIds)),
      sourceNodeCandidateIds: dedupeStrings(
        existing.sourceNodeCandidateIds.concat(candidate.sourceNodeCandidateIds)
      )
    });
  }

  return [...byKey.values()];
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}
