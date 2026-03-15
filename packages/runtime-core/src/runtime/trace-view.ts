import type {
  GraphNode,
  JsonObject,
  NodeGovernance,
  RuntimeContextSelectionSlot,
  TracePersistenceView,
  TraceView
} from '@openclaw-compact-context/contracts';
import type { ContextNoiseDecision, EvidenceAnchor, SemanticSpan } from '@openclaw-compact-context/contracts';
import type { TraceLearningView } from '@openclaw-compact-context/contracts';

type TraceEvidenceAnchorInput = EvidenceAnchor;
type TraceSemanticSpanInput = SemanticSpan;

interface TraceSelectionInput {
  included: boolean;
  slot?: RuntimeContextSelectionSlot;
  reason: string;
  scopeReason?: string;
  query: string;
  tokenBudget: number;
  categoryBudget?: number;
}

interface TraceToolResultCompressionInput {
  compressed: true;
  reason?: string;
  lookup: {
    artifactPath?: string;
    sourcePath?: string;
    sourceUrl?: string;
    contentHash?: string;
  };
}

export function buildTraceView(input: {
  node: GraphNode;
  governance: NodeGovernance;
  selection?: TraceSelectionInput;
  toolResultCompression?: TraceToolResultCompressionInput;
  persistence?: Partial<TracePersistenceView>;
  evidenceAnchor?: TraceEvidenceAnchorInput;
  semanticSpans?: TraceSemanticSpanInput[];
  noiseDecisions?: ContextNoiseDecision[];
  learning?: TraceLearningView;
}): TraceView {
  const { node, governance, selection, toolResultCompression, persistence, evidenceAnchor, semanticSpans, noiseDecisions, learning } = input;
  const provenance = governance.provenance ?? node.provenance;
  const sourceType = readPayloadString(node.payload, 'sourceType') ?? node.sourceRef?.sourceType;
  const derivedFromNodeIds = governance.traceability.derivedFromNodeIds ?? [];
  const promptReady = governance.promptReadiness.eligible && !isConflictSuppressed(governance);
  const basePersistence: TracePersistenceView = {
    ...(provenance?.sourceStage ? { sourceStage: provenance.sourceStage } : {}),
    persistedInCheckpoint: provenance?.sourceStage === 'checkpoint',
    surfacedInDelta: provenance?.sourceStage === 'delta',
    surfacedInSkillCandidate: provenance?.sourceStage === 'skill_candidate',
    ...(governance.traceability.derivedFromCheckpointId
      ? { derivedFromCheckpointId: governance.traceability.derivedFromCheckpointId }
      : {}),
    ...(provenance?.sourceStage === 'checkpoint'
      ? {
          checkpointId: provenance.rawSourceId ?? node.id,
          ...(provenance.sourceBundleId ? { checkpointSourceBundleId: provenance.sourceBundleId } : {})
        }
      : {}),
    ...(provenance?.sourceStage === 'delta'
      ? {
          deltaId: provenance.rawSourceId ?? node.id,
          ...(provenance.sourceBundleId ? { deltaSourceBundleId: provenance.sourceBundleId } : {})
        }
      : {}),
    ...(provenance?.sourceStage === 'skill_candidate'
      ? {
          skillCandidateId: provenance.rawSourceId ?? node.id,
          ...(provenance.sourceBundleId ? { skillCandidateSourceBundleId: provenance.sourceBundleId } : {})
        }
      : {})
  };

  return {
    source: {
      ...(governance.knowledgeState ? { originKind: governance.knowledgeState } : {}),
      ...(provenance?.sourceStage ? { sourceStage: provenance.sourceStage } : {}),
      ...(provenance?.producer ? { producer: provenance.producer } : {}),
      scope: node.scope,
      ...(sourceType ? { sourceType } : {}),
      ...(governance.traceability.rawSourceId ? { rawSourceId: governance.traceability.rawSourceId } : {}),
      ...(node.sourceRef?.sourcePath || toolResultCompression?.lookup.sourcePath
        ? { sourcePath: node.sourceRef?.sourcePath ?? toolResultCompression?.lookup.sourcePath }
        : {}),
      ...(node.sourceRef?.sourceSpan ? { sourceSpan: node.sourceRef.sourceSpan } : {}),
      ...(toolResultCompression?.lookup.sourceUrl ? { sourceUrl: toolResultCompression.lookup.sourceUrl } : {}),
      ...(node.sourceRef?.contentHash || provenance?.rawContentHash || toolResultCompression?.lookup.contentHash
        ? {
            contentHash:
              node.sourceRef?.contentHash ?? provenance?.rawContentHash ?? toolResultCompression?.lookup.contentHash
          }
        : {}),
      ...(toolResultCompression?.lookup.artifactPath ? { artifactPath: toolResultCompression.lookup.artifactPath } : {})
    },
    transformation: {
      ...(governance.traceability.rawSourceId ? { recordId: governance.traceability.rawSourceId } : {}),
      ...(derivedFromNodeIds[0] ? { evidenceNodeId: derivedFromNodeIds[0] } : {}),
      semanticNodeId: node.id,
      derivedFromNodeIds,
      ...(provenance?.createdByHook ? { createdByHook: provenance.createdByHook } : {}),
      ...(evidenceAnchor?.recordId ? { anchorRecordId: evidenceAnchor.recordId } : {}),
      ...(evidenceAnchor?.sourcePath ? { anchorSourcePath: evidenceAnchor.sourcePath } : {}),
      ...(evidenceAnchor?.sourceSpan ? { anchorSourceSpan: evidenceAnchor.sourceSpan } : {}),
      ...(typeof evidenceAnchor?.startOffset === 'number' ? { anchorStartOffset: evidenceAnchor.startOffset } : {}),
      ...(typeof evidenceAnchor?.endOffset === 'number' ? { anchorEndOffset: evidenceAnchor.endOffset } : {}),
      ...(evidenceAnchor?.sentenceId ? { anchorSentenceId: evidenceAnchor.sentenceId } : {}),
      ...(evidenceAnchor?.clauseId ? { anchorClauseId: evidenceAnchor.clauseId } : {}),
      ...(semanticSpans && semanticSpans.length > 0
        ? {
            semanticSpanIds: semanticSpans.map((span) => span.id),
            normalizedConceptIds: dedupeConceptIds(semanticSpans),
            ...(noiseDecisions && noiseDecisions.length > 0
              ? {
                  noiseDispositions: noiseDecisions.map(
                    (decision) => `${decision.spanId}:${decision.disposition}`
                  )
                }
              : {})
          }
        : {})
    },
    selection: {
      evaluated: Boolean(selection),
      ...(selection
        ? {
            included: selection.included,
            ...(selection.slot ? { slot: selection.slot } : {}),
            reason: selection.reason,
            ...(selection.scopeReason ? { scopeReason: selection.scopeReason } : {}),
            query: selection.query,
            tokenBudget: selection.tokenBudget,
            ...(typeof selection.categoryBudget === 'number' ? { categoryBudget: selection.categoryBudget } : {})
          }
        : {})
    },
    output: {
      promptReady,
      preferredForm: governance.promptReadiness.preferredForm,
      assembledIntoPrompt: selection?.included === true,
      summarizedIntoCompactView:
        governance.promptReadiness.preferredForm !== 'raw' || toolResultCompression?.compressed === true,
      requiresEvidence: governance.promptReadiness.requiresEvidence,
      requiresCompression: governance.promptReadiness.requiresCompression,
      ...(resolveSummaryOnlyReason(governance, toolResultCompression)
        ? { summaryOnlyReason: resolveSummaryOnlyReason(governance, toolResultCompression) }
        : {})
    },
    persistence: {
      ...basePersistence,
      ...persistence
    },
    ...(learning ? { learning } : {})
  };
}

function dedupeConceptIds(semanticSpans: readonly TraceSemanticSpanInput[]): string[] {
  return [...new Set(semanticSpans.flatMap((span) => span.conceptMatches.map((match) => match.conceptId)))];
}

function resolveSummaryOnlyReason(
  governance: NodeGovernance,
  toolResultCompression?: TraceToolResultCompressionInput
): string | undefined {
  if (toolResultCompression?.reason) {
    return toolResultCompression.reason;
  }

  if (governance.promptReadiness.requiresCompression) {
    return 'node requires compression before prompt assembly';
  }

  switch (governance.promptReadiness.preferredForm) {
    case 'summary':
      return 'prompt readiness prefers summary form';
    case 'citation_only':
      return 'prompt readiness prefers citation-only form';
    case 'derived':
      return 'prompt readiness prefers derived form';
    case 'raw':
    default:
      return undefined;
  }
}

function isConflictSuppressed(governance: NodeGovernance): boolean {
  return (
    governance.validity.resolutionState === 'suppressed' ||
    governance.conflict?.resolutionState === 'suppressed' ||
    governance.validity.freshness === 'superseded' ||
    governance.conflict?.conflictStatus === 'superseded'
  );
}

function readPayloadString(payload: JsonObject | undefined, key: string): string | undefined {
  if (!payload) {
    return undefined;
  }

  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}
