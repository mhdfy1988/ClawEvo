import type {
  Attempt,
  CheckpointLifecycle,
  ContextSelection,
  Episode,
  FailureSignal,
  GraphNode,
  NodeGovernance,
  ProcedureCandidate,
  RelationRetrievalDiagnostics,
  RuntimeContextBundle,
  RuntimeContextCategory,
  RuntimeContextFixedSlot,
  SessionCheckpoint,
  SessionDelta,
  SkillCandidateLifecycle,
  SkillCandidate,
  TracePersistenceView
} from '@openclaw-compact-context/contracts';
import type { EvidenceAnchor, ManualCorrectionRecord, SemanticSpan } from '@openclaw-compact-context/contracts';
import type { ExplainRequest, ExplainResult } from '@openclaw-compact-context/contracts';
import { readCompressedToolResultMetadata } from '../infrastructure/tool-result-compression-metadata.js';
import type { ContextCompiler } from './context-compiler.js';
import type { ContextPersistenceStore } from '../infrastructure/context-persistence.js';
import {
  describeConflictSummary,
  describeGovernanceSummary,
  isSuppressedByConflict,
  normalizeNodeGovernance
} from '../governance/governance.js';
import type { GraphStore } from '../infrastructure/graph-store.js';
import { normalizeEdgeGovernance } from '../governance/relation-contract.js';
import { collectMemoryLifecycleSummary } from '../governance/memory-lifecycle.js';
import {
  deriveExperienceLearning,
  describeExperienceLearningSummary,
  describeNodeExperienceRoles
} from './experience-learning.js';
import { processContextGraphNode } from '../context-processing/context-processing-pipeline.js';
import {
  applyRuntimeNodeCorrection,
  collectCorrectionsForNode,
  getActiveManualCorrections,
  isNodeSuppressedByManualCorrection
} from '../governance/manual-corrections.js';
import { assessHigherScopeRecallAdmission, describeHigherScopeSkipReason } from '../governance/scope-policy.js';
import { buildTraceView } from './trace-view.js';
import { assessPromotedKnowledgeGovernance, describePromotionGovernance } from '../governance/knowledge-promotion.js';

const DEFAULT_EXPLAIN_TOKEN_BUDGET = 512;

interface RelatedNodeDescription {
  relatedNode: GraphNode;
  edge: Awaited<ReturnType<GraphStore['getEdgesForNode']>>[number];
}

interface ExplainSelectionDetails {
  selection?: ExplainResult['selection'];
  relationRetrieval?: RelationRetrievalDiagnostics;
  bundle?: RuntimeContextBundle;
  pathExplain?: ExplainResult['pathExplain'];
}

interface PersistenceDescription {
  view: Partial<TracePersistenceView>;
  readCount: number;
  memoryLifecycle?: ExplainResult['memoryLifecycle'];
}

interface SemanticDescription {
  evidenceAnchor?: EvidenceAnchor;
  semanticSpans: SemanticSpan[];
  noiseDecisions: import('@openclaw-compact-context/contracts').ContextNoiseDecision[];
}

interface ExperienceDescription {
  attempt?: Attempt;
  episode?: Episode;
  failureSignals: FailureSignal[];
  procedureCandidate?: ProcedureCandidate;
  nodeRoles: string[];
}

export class AuditExplainer {
  constructor(
    private readonly graphStore: GraphStore,
    private readonly contextCompiler?: ContextCompiler,
    private readonly persistenceStore?: ContextPersistenceStore
  ) {}

  async explain(request: ExplainRequest): Promise<ExplainResult> {
    const storedNode = await this.graphStore.getNode(request.nodeId);
    const manualCorrections = getActiveManualCorrections();
    const node = storedNode ? applyRuntimeNodeCorrection(storedNode, manualCorrections) : undefined;

    if (!node) {
      return {
        summary: `Node "${request.nodeId}" was not found.`,
        sources: [],
        relatedNodes: []
      };
    }

    const adjacency = await this.describeRelatedNodes(node);
    const provenanceSummary = describeProvenance(node.provenance);
    const governance = normalizeNodeGovernance(node);
    const toolResultCompression = describeToolResultCompression(node);
    const promotionGovernance = assessPromotedKnowledgeGovernance(node);
    const derivedFromText =
      node.provenance?.derivedFromNodeIds && node.provenance.derivedFromNodeIds.length > 0
        ? ` Derived from ${node.provenance.derivedFromNodeIds.length} node(s).`
        : '';
    const rawSourceText =
      node.provenance?.rawSourceId && !toolResultCompression ? ` Raw source id: ${node.provenance.rawSourceId}.` : '';
    const sessionId = request.selectionContext?.sessionId ?? readPayloadString(node.payload, 'sessionId');
    const selectionDetails = await this.describeSelection(node, node.label, governance, request.selectionContext);
    const selection = selectionDetails.selection;
    const conflict = describeConflict(governance);
    const persistence = await this.describePersistence(node, governance, selection, sessionId);
    const semantic = await this.describeSemantic(node);
    const experience = this.describeExperience(node.id, selectionDetails.bundle);
    const corrections = await this.describeCorrections(node, semantic.semanticSpans);
    const trace = buildTraceView({
      node,
      governance,
      selection: selection
        ? {
            ...selection,
            ...(selection.scopeReason ? { scopeReason: selection.scopeReason } : {})
          }
        : undefined,
      toolResultCompression,
      persistence: persistence.view,
      evidenceAnchor: semantic.evidenceAnchor,
      semanticSpans: semantic.semanticSpans,
      noiseDecisions: semantic.noiseDecisions,
      learning:
        experience.attempt || experience.episode || experience.failureSignals.length > 0
          ? {
              ...(experience.attempt ? { attemptId: experience.attempt.id, attemptStatus: experience.attempt.status } : {}),
              ...(experience.episode ? { episodeId: experience.episode.id, episodeStatus: experience.episode.status } : {}),
              failureSignalIds: experience.failureSignals.map((signal) => signal.id),
              criticalStepNodeIds: experience.attempt?.criticalStepNodeIds ?? [],
              ...(experience.procedureCandidate ? { procedureCandidateId: experience.procedureCandidate.id } : {}),
              ...(experience.nodeRoles.length > 0 ? { nodeRoles: experience.nodeRoles } : {})
            }
          : undefined
    });

    return {
      node,
      provenance: node.provenance,
      governance,
      ...(promotionGovernance ? { promotionGovernance } : {}),
      ...(semantic.evidenceAnchor ? { evidenceAnchor: semantic.evidenceAnchor } : {}),
      ...(semantic.semanticSpans.length > 0 ? { semanticSpans: semantic.semanticSpans } : {}),
      ...(semantic.noiseDecisions.length > 0 ? { noiseDecisions: semantic.noiseDecisions } : {}),
      trace,
      ...(corrections.applied.length > 0 ? { corrections } : {}),
      ...(experience.attempt || experience.episode || experience.failureSignals.length > 0
        ? {
            experience: {
              ...(experience.attempt ? { attempt: experience.attempt } : {}),
              ...(experience.episode ? { episode: experience.episode } : {}),
              failureSignals: experience.failureSignals,
              ...(experience.procedureCandidate ? { procedureCandidate: experience.procedureCandidate } : {}),
              nodeRoles: experience.nodeRoles
            }
          }
        : {}),
      retrieval: {
        adjacency: adjacency.diagnostics,
        ...(selectionDetails.relationRetrieval ? { selectionCompile: selectionDetails.relationRetrieval } : {}),
        persistenceReadCount: persistence.readCount
      },
      ...(persistence.memoryLifecycle ? { memoryLifecycle: persistence.memoryLifecycle } : {}),
      conflict,
      ...(selectionDetails.pathExplain && selectionDetails.pathExplain.length > 0
        ? { pathExplain: selectionDetails.pathExplain }
        : {}),
      toolResultCompression,
      summary:
        `${node.type} "${node.label}" is active in ${node.scope} scope with ${adjacency.allEdges.length} linked edges. ` +
        `Provenance: ${provenanceSummary}. ${describeGovernanceSummary(governance)}` +
        `${describePromotionGovernance(promotionGovernance)}` +
        `${describeConflictSummary(governance)}${derivedFromText}${rawSourceText}` +
        `${formatToolResultCompressionSummary(toolResultCompression)}` +
        `${formatSemanticSummary(semantic.evidenceAnchor, semantic.semanticSpans)}` +
        `${formatNoiseSummary(semantic.noiseDecisions)}` +
        `${formatCorrectionSummary(corrections)}` +
        `${describeExperienceLearningSummary(
          experience.attempt && experience.episode
            ? {
                attempt: experience.attempt,
                episode: experience.episode,
                failureSignals: experience.failureSignals,
                ...(experience.procedureCandidate ? { procedureCandidate: experience.procedureCandidate } : {})
              }
            : undefined
        )}` +
        `${formatSelectionSummary(selection)}${formatRelationRetrievalSummary(selectionDetails.relationRetrieval)}${formatPersistenceSummary(trace.persistence)}` +
        `${collectMemoryLifecycleSummary({
          checkpoints:
            persistence.memoryLifecycle?.checkpoints.map((checkpoint) => ({
              id: checkpoint.checkpointId,
              lifecycle: checkpoint.lifecycle
            })) ?? [],
          skillCandidates:
            persistence.memoryLifecycle?.skillCandidates.map((candidate) => ({
              id: candidate.skillCandidateId,
              lifecycle: candidate.lifecycle
            })) ?? []
        })}`,
      sources: node.sourceRef ? [node.sourceRef] : [],
      selection,
      relatedNodes: adjacency.relatedNodes
        .filter((value) => normalizeEdgeGovernance(value.edge).explainVisible)
        .map((value) => ({
          id: value.relatedNode.id,
          type: value.relatedNode.type,
          label: value.relatedNode.label,
          provenance: value.relatedNode.provenance,
          relation: {
            edgeType: value.edge.type,
            confidence: value.edge.confidence,
            governance: normalizeEdgeGovernance(value.edge)
          }
        }))
    };
  }

  private async describeSemantic(node: GraphNode): Promise<SemanticDescription> {
    const sourceNode = await this.resolveEvidenceSourceNode(node);

    if (!sourceNode) {
      return {
        semanticSpans: [],
        noiseDecisions: []
      };
    }

    const semantic = processContextGraphNode(node, sourceNode);

    return {
      evidenceAnchor: semantic.evidenceAnchor,
      semanticSpans: semantic.semanticSpans,
      noiseDecisions: semantic.noiseDecisions
    };
  }

  private async describeRelatedNodes(node: GraphNode): Promise<{
    allEdges: Awaited<ReturnType<GraphStore['getEdgesForNode']>>;
    relatedNodes: RelatedNodeDescription[];
    diagnostics: RelationRetrievalDiagnostics;
  }> {
    const manualCorrections = getActiveManualCorrections();
    const allEdges = await this.graphStore.getEdgesForNodes([node.id]);
    const relatedNodeIds = dedupeIds(
      allEdges.map((edge) => (edge.fromId === node.id ? edge.toId : edge.fromId))
    );
    const relatedNodes =
      relatedNodeIds.length === 0
        ? []
        : relatedNodeIds.length === 1
          ? await Promise.all([this.graphStore.getNode(relatedNodeIds[0] as string)])
          : await this.graphStore.getNodesByIds(relatedNodeIds);
    const relatedNodeById = new Map<string, GraphNode>();

    for (const relatedNode of relatedNodes) {
      if (!relatedNode) {
        continue;
      }

      const correctedNode = applyRuntimeNodeCorrection(relatedNode, manualCorrections);
      relatedNodeById.set(correctedNode.id, correctedNode);
    }

    return {
      allEdges,
      relatedNodes: allEdges
        .map((edge) => {
          const relatedId = edge.fromId === node.id ? edge.toId : edge.fromId;
          const relatedNode = relatedNodeById.get(relatedId);
          return relatedNode ? { relatedNode, edge } : undefined;
        })
        .filter((value): value is RelatedNodeDescription => Boolean(value)),
      diagnostics: {
        strategy: 'single_node_adjacency',
        sourceCount: 1,
        sourceSlots: [],
        edgeTypes: dedupeEdgeTypes(allEdges.map((edge) => edge.type)),
        edgeLookupCount: 1,
        nodeLookupCount: relatedNodeIds.length === 0 ? 0 : 1,
        scannedEdgeCount: allEdges.length,
        eligibleEdgeCount: allEdges.filter((edge) => normalizeEdgeGovernance(edge).explainVisible).length,
        relatedNodeCount: relatedNodeById.size
      }
    };
  }

  private async describePersistence(
    node: GraphNode,
    governance: NodeGovernance,
    selection: ExplainResult['selection'],
    sessionId: string | undefined
  ): Promise<PersistenceDescription> {
    const persistence: Partial<TracePersistenceView> = {
      ...(node.provenance?.sourceStage ? { sourceStage: node.provenance.sourceStage } : {}),
      persistedInCheckpoint: node.provenance?.sourceStage === 'checkpoint',
      surfacedInDelta: node.provenance?.sourceStage === 'delta',
      surfacedInSkillCandidate: node.provenance?.sourceStage === 'skill_candidate',
      ...(governance.traceability.derivedFromCheckpointId
        ? { derivedFromCheckpointId: governance.traceability.derivedFromCheckpointId }
        : {}),
      ...(node.provenance?.sourceStage === 'checkpoint'
        ? {
            checkpointId: node.provenance.rawSourceId ?? node.id,
            ...(node.provenance.sourceBundleId ? { checkpointSourceBundleId: node.provenance.sourceBundleId } : {})
          }
        : {}),
      ...(node.provenance?.sourceStage === 'delta'
        ? {
            deltaId: node.provenance.rawSourceId ?? node.id,
            ...(node.provenance.sourceBundleId ? { deltaSourceBundleId: node.provenance.sourceBundleId } : {})
          }
        : {}),
      ...(node.provenance?.sourceStage === 'skill_candidate'
        ? {
            skillCandidateId: node.provenance.rawSourceId ?? node.id,
            ...(node.provenance.sourceBundleId ? { skillCandidateSourceBundleId: node.provenance.sourceBundleId } : {})
          }
        : {})
    };

    if (!this.persistenceStore || !sessionId) {
      const retentionReason = resolveRetentionReason(selection, persistence);
      return {
        view: retentionReason ? { ...persistence, retentionReason } : persistence,
        readCount: 0
      };
    }

    const [checkpoints, deltas, skillCandidates] = await Promise.all([
      this.persistenceStore.listCheckpoints(sessionId, 12),
      this.persistenceStore.listDeltas(sessionId, 12),
      this.persistenceStore.listSkillCandidates(sessionId, 12)
    ]);
    const checkpointMatches = checkpoints.filter((item) => checkpointContainsNode(item, node)).slice(0, 3);
    const deltaMatches = deltas.filter((item) => deltaContainsNode(item, node)).slice(0, 3);
    const skillCandidateMatches = skillCandidates.filter((item) => skillCandidateContainsNode(item, node)).slice(0, 3);
    const checkpoint = checkpointMatches[0];
    const delta = deltaMatches[0];
    const skillCandidate = skillCandidateMatches[0];

    if (checkpoint) {
      persistence.persistedInCheckpoint = true;
      persistence.checkpointId = checkpoint.id;
      persistence.checkpointSourceBundleId =
        checkpoint.sourceBundleId ?? checkpoint.provenance?.sourceBundleId ?? persistence.checkpointSourceBundleId;
    }

    if (delta) {
      persistence.surfacedInDelta = true;
      persistence.deltaId = delta.id;
      persistence.deltaSourceBundleId =
        delta.sourceBundleId ?? delta.provenance?.sourceBundleId ?? persistence.deltaSourceBundleId;
      persistence.derivedFromCheckpointId =
        persistence.derivedFromCheckpointId ?? delta.provenance?.derivedFromCheckpointId;
    }

    if (skillCandidate) {
      persistence.surfacedInSkillCandidate = true;
      persistence.skillCandidateId = skillCandidate.id;
      persistence.skillCandidateSourceBundleId =
        skillCandidate.sourceBundleId ??
        skillCandidate.provenance?.sourceBundleId ??
        persistence.skillCandidateSourceBundleId;
    }

    const retentionReason = resolveRetentionReason(selection, persistence);
    return {
      view: retentionReason ? { ...persistence, retentionReason } : persistence,
      readCount: 3,
      ...(checkpointMatches.length > 0 || skillCandidateMatches.length > 0
        ? {
            memoryLifecycle: {
              checkpoints: checkpointMatches.map((item) => ({
                checkpointId: item.id,
                ...(item.sourceBundleId ? { sourceBundleId: item.sourceBundleId } : {}),
                ...(item.lifecycle ? { lifecycle: item.lifecycle } : {})
              })),
              skillCandidates: skillCandidateMatches.map((item) => ({
                skillCandidateId: item.id,
                ...(item.sourceBundleId ? { sourceBundleId: item.sourceBundleId } : {}),
                ...(item.lifecycle ? { lifecycle: item.lifecycle } : {})
              }))
            }
          }
        : {})
    };
  }

  private async describeSelection(
    node: GraphNode,
    fallbackQuery: string,
    governance: NodeGovernance,
    selectionContext: ExplainRequest['selectionContext']
  ): Promise<ExplainSelectionDetails> {
    if (!selectionContext || !this.contextCompiler) {
      return {};
    }

    const query = selectionContext.query?.trim() || fallbackQuery;
    const tokenBudget = selectionContext.tokenBudget ?? DEFAULT_EXPLAIN_TOKEN_BUDGET;
    const bundle = await this.contextCompiler.compile({
      sessionId: selectionContext.sessionId,
      ...(selectionContext.workspaceId ? { workspaceId: selectionContext.workspaceId } : {}),
      query,
      tokenBudget,
      ...(selectionContext.relationRecallPolicy ? { relationRecallPolicy: selectionContext.relationRecallPolicy } : {})
    });

    return {
      selection: describeBundleSelection(bundle, node, query, tokenBudget, governance),
      relationRetrieval: bundle.diagnostics?.relationRetrieval,
      bundle,
      pathExplain: collectSelectionPaths(bundle, node.id)
    };
  }

  private describeExperience(nodeId: string, bundle: RuntimeContextBundle | undefined): ExperienceDescription {
    if (!bundle) {
      return {
        failureSignals: [],
        nodeRoles: []
      };
    }

    const experience = deriveExperienceLearning(bundle);

    return {
      attempt: experience.attempt,
      episode: experience.episode,
      failureSignals: experience.failureSignals,
      ...(experience.procedureCandidate ? { procedureCandidate: experience.procedureCandidate } : {}),
      nodeRoles: describeNodeExperienceRoles(nodeId, experience)
    };
  }

  private async describeCorrections(
    node: GraphNode,
    semanticSpans: SemanticSpan[]
  ): Promise<NonNullable<ExplainResult['corrections']>> {
    if (!this.persistenceStore) {
      return {
        applied: [],
        targetIds: []
      };
    }

    const corrections = await this.persistenceStore.listManualCorrections(200);
    const targetIds = dedupeIds([
      node.id,
      ...semanticSpans.map((span) => span.id),
      ...semanticSpans.map((span) => span.normalizedText),
      ...semanticSpans.flatMap((span) => span.conceptMatches.map((match) => match.conceptId))
    ]);
    const applied = dedupeCorrections(
      targetIds.flatMap((targetId) => collectCorrectionsForNode(targetId, corrections))
    );

    return {
      applied,
      targetIds
    };
  }

  private async resolveEvidenceSourceNode(node: GraphNode): Promise<GraphNode | undefined> {
    if (node.type === 'Evidence') {
      return node;
    }

    const derivedFromNodeIds = dedupeIds(node.provenance?.derivedFromNodeIds ?? []);

    if (derivedFromNodeIds.length === 0) {
      return node;
    }

    const relatedNodes =
      derivedFromNodeIds.length === 1
        ? await Promise.all([this.graphStore.getNode(derivedFromNodeIds[0] as string)])
        : await this.graphStore.getNodesByIds(derivedFromNodeIds);

    const evidenceNode = relatedNodes.find(
      (candidate): candidate is GraphNode => candidate !== undefined && candidate.type === 'Evidence'
    );

    return evidenceNode ?? node;
  }
}

function describeBundleSelection(
  bundle: RuntimeContextBundle,
  node: GraphNode,
  query: string,
  tokenBudget: number,
  governance?: NodeGovernance
): ExplainResult['selection'] {
  if (isNodeSuppressedByManualCorrection(node, getActiveManualCorrections())) {
    return {
      included: false,
      reason: 'node was suppressed by a manual correction before runtime bundle selection',
      scopeReason: describeSelectionScopeReason(node, false, governance),
      query,
      tokenBudget
    };
  }

  const nodeId = node.id;
  const fixedSelected = findFixedSelection(bundle, nodeId);

  if (fixedSelected) {
      return {
        included: true,
        slot: fixedSelected.slot,
        reason: fixedSelected.selection.reason,
        ...(fixedSelected.selection.primaryRecallKind
          ? { primaryRecallKind: fixedSelected.selection.primaryRecallKind }
          : {}),
        ...(fixedSelected.selection.recallKinds?.length ? { recallKinds: [...fixedSelected.selection.recallKinds] } : {}),
        scopeReason: describeSelectionScopeReason(node, true, governance),
        query,
        tokenBudget
    };
  }

  const categorySelected = findCategorySelection(bundle, nodeId);

  if (categorySelected) {
      return {
        included: true,
        slot: categorySelected.slot,
        reason: categorySelected.selection.reason,
        ...(categorySelected.selection.primaryRecallKind
          ? { primaryRecallKind: categorySelected.selection.primaryRecallKind }
          : {}),
        ...(categorySelected.selection.recallKinds?.length
          ? { recallKinds: [...categorySelected.selection.recallKinds] }
          : {}),
        scopeReason: describeSelectionScopeReason(node, true, governance),
        query,
        tokenBudget,
      categoryBudget: bundle.diagnostics?.categoryBudgets[categorySelected.slot]
    };
  }

  const fixedSkipped = bundle.diagnostics?.fixed.skipped.find((item) => item.nodeId === nodeId);

  if (fixedSkipped) {
    return {
      included: false,
      slot: inferFixedSlot(fixedSkipped.reason),
      reason: fixedSkipped.reason,
      scopeReason: describeSelectionScopeReason(node, false, governance),
      query,
      tokenBudget
    };
  }

  for (const category of bundle.diagnostics?.categories ?? []) {
    const skipped = category.skipped.find((item) => item.nodeId === nodeId);

    if (!skipped) {
      continue;
    }

      return {
        included: false,
        slot: category.category,
        reason: skipped.reason,
        scopeReason: describeSelectionScopeReason(node, false, governance),
        query,
        tokenBudget,
        categoryBudget: category.allocatedBudget
      };
  }

  const topicHint = bundle.diagnostics?.topicHints?.find((item) => item.nodeId === nodeId);

  if (topicHint) {
    return {
      included: false,
      reason: topicHint.reason,
      scopeReason: describeSelectionScopeReason(node, false, governance),
      query,
      tokenBudget
    };
  }

  if (governance && isSuppressedByConflict(governance)) {
    return {
      included: false,
      reason: describeConflictSelectionReason(governance),
      scopeReason: describeSelectionScopeReason(node, false, governance),
      query,
      tokenBudget
    };
  }

  const higherScopeAdmission = assessHigherScopeRecallAdmission(node);

  return {
    included: false,
    reason:
      (!higherScopeAdmission.admitted ? higherScopeAdmission.reason : undefined) ??
      (governance ? describeHigherScopeSkipReason(node) : undefined) ??
      'node was not selected in the compiled runtime bundle',
    scopeReason: describeSelectionScopeReason(node, false, governance),
    query,
    tokenBudget
  };
}

function findFixedSelection(
  bundle: RuntimeContextBundle,
  nodeId: string
): {
  slot: RuntimeContextFixedSlot;
  selection: ContextSelection;
} | undefined {
  if (bundle.goal?.nodeId === nodeId) {
    return {
      slot: 'goal',
      selection: bundle.goal
    };
  }

  if (bundle.intent?.nodeId === nodeId) {
    return {
      slot: 'intent',
      selection: bundle.intent
    };
  }

  if (bundle.currentProcess?.nodeId === nodeId) {
    return {
      slot: 'currentProcess',
      selection: bundle.currentProcess
    };
  }

  return undefined;
}

function findCategorySelection(
  bundle: RuntimeContextBundle,
  nodeId: string
): {
  slot: RuntimeContextCategory;
  selection: ContextSelection;
} | undefined {
  const categories = [
    ['activeRules', bundle.activeRules],
    ['activeConstraints', bundle.activeConstraints],
    ['openRisks', bundle.openRisks],
    ['recentDecisions', bundle.recentDecisions],
    ['recentStateChanges', bundle.recentStateChanges],
    ['relevantEvidence', bundle.relevantEvidence],
    ['candidateSkills', bundle.candidateSkills]
  ] as const;

  for (const [slot, items] of categories) {
    const selection = items.find((item) => item.nodeId === nodeId);

    if (selection) {
      return {
        slot,
        selection
      };
    }
  }

  return undefined;
}

function collectSelectionPaths(bundle: RuntimeContextBundle, nodeId: string): ExplainResult['pathExplain'] {
  const fixed = findFixedSelection(bundle, nodeId)?.selection;
  const category = findCategorySelection(bundle, nodeId)?.selection;
  const selection = fixed ?? category;

  return selection?.relationPaths?.length ? selection.relationPaths : undefined;
}

function formatSelectionSummary(selection: ExplainResult['selection']): string {
  if (!selection) {
    return '';
  }

  const slotText = selection.slot ? ` ${selection.included ? 'in' : 'from'} ${selection.slot}` : '';
  const budgetText = typeof selection.categoryBudget === 'number' ? ` Category budget: ${selection.categoryBudget}.` : '';
  const scopeText = selection.scopeReason ? ` Scope: ${selection.scopeReason}.` : '';
  const recallText =
    selection.recallKinds && selection.recallKinds.length > 0
      ? ` Recall: ${selection.recallKinds.join(' + ')}.`
      : '';

  if (selection.included) {
    return ` Selection: included${slotText}. Reason: ${selection.reason}.${recallText}${scopeText} Query: "${selection.query}".${budgetText}`;
  }

  return ` Selection: skipped${slotText}. Reason: ${selection.reason}.${recallText}${scopeText} Query: "${selection.query}".${budgetText}`;
}

function formatRelationRetrievalSummary(diagnostics: RelationRetrievalDiagnostics | undefined): string {
  if (!diagnostics || (diagnostics.pathCount ?? 0) === 0) {
    return '';
  }

  const selectedSample = diagnostics.selectedPathSamples?.[0];
  const prunedSample = diagnostics.prunedPathSamples?.[0];
  const selectedText = selectedSample ? ` Selected path: ${selectedSample}.` : '';
  const prunedText = prunedSample ? ` Pruned path: ${prunedSample}.` : '';

  return ` Path policy: budget=${diagnostics.pathBudget ?? 0}, per-target=${diagnostics.maxPathsPerTarget ?? 0}, per-source=${diagnostics.maxPathsPerSource ?? 0}, expanded-targets=${diagnostics.maxExpandedTargets ?? 0}, floor=${diagnostics.minPathBonus?.toFixed(2) ?? '0.00'}.${selectedText}${prunedText}`;
}

function formatSemanticSummary(
  evidenceAnchor: ExplainResult['evidenceAnchor'],
  semanticSpans: ExplainResult['semanticSpans']
): string {
  if (!evidenceAnchor && (!semanticSpans || semanticSpans.length === 0)) {
    return '';
  }

  const anchorParts = [
    evidenceAnchor?.recordId ? `record ${evidenceAnchor.recordId}` : undefined,
    evidenceAnchor?.sourcePath ? `path ${evidenceAnchor.sourcePath}` : undefined,
    evidenceAnchor?.sourceSpan ? `span ${evidenceAnchor.sourceSpan}` : undefined
  ].filter((value): value is string => Boolean(value));
  const spanPreview =
    semanticSpans && semanticSpans.length > 0
      ? ` Semantic spans: ${semanticSpans.length} clause(s), e.g. ${semanticSpans
          .slice(0, 2)
          .map((span) => `${span.clauseId}=${JSON.stringify(span.text)}`)
          .join(' | ')}.`
      : '';
  const conceptIds =
    semanticSpans && semanticSpans.length > 0
      ? [...new Set(semanticSpans.flatMap((span) => span.conceptMatches.map((match) => match.conceptId)))]
      : [];
  const conceptText = conceptIds.length > 0 ? ` Concepts: ${conceptIds.join(' | ')}.` : '';

  if (anchorParts.length === 0) {
    return `${spanPreview}${conceptText}`;
  }

  return ` Evidence anchor: ${anchorParts.join(' / ')}.${spanPreview}${conceptText}`;
}

function formatNoiseSummary(noiseDecisions: ExplainResult['noiseDecisions']): string {
  if (!noiseDecisions || noiseDecisions.length === 0) {
    return '';
  }

  const byDisposition = new Map<string, number>();

  for (const decision of noiseDecisions) {
    byDisposition.set(decision.disposition, (byDisposition.get(decision.disposition) ?? 0) + 1);
  }

  return ` Noise policy: ${[...byDisposition.entries()]
    .map(([disposition, count]) => `${disposition}=${count}`)
    .join(' | ')}.`;
}

function formatPersistenceSummary(persistence: TracePersistenceView): string {
  const surfaces = [
    persistence.persistedInCheckpoint
      ? `checkpoint${persistence.checkpointId ? ` ${persistence.checkpointId}` : ''}`
      : undefined,
    persistence.surfacedInDelta ? `delta${persistence.deltaId ? ` ${persistence.deltaId}` : ''}` : undefined,
    persistence.surfacedInSkillCandidate
      ? `skill candidate${persistence.skillCandidateId ? ` ${persistence.skillCandidateId}` : ''}`
      : undefined
  ].filter((value): value is string => Boolean(value));

  if (surfaces.length === 0 && !persistence.retentionReason) {
    return '';
  }

  const retainedText = surfaces.length > 0 ? ` Persistence: retained in ${surfaces.join(' | ')}.` : '';
  const checkpointSourceText = persistence.derivedFromCheckpointId
    ? ` Derived from checkpoint ${persistence.derivedFromCheckpointId}.`
    : '';
  const bundleLineage = [
    persistence.checkpointSourceBundleId ? `checkpoint bundle ${persistence.checkpointSourceBundleId}` : undefined,
    persistence.deltaSourceBundleId ? `delta bundle ${persistence.deltaSourceBundleId}` : undefined,
    persistence.skillCandidateSourceBundleId
      ? `skill bundle ${persistence.skillCandidateSourceBundleId}`
      : undefined
  ].filter((value): value is string => Boolean(value));
  const bundleText = bundleLineage.length > 0 ? ` Bundles: ${bundleLineage.join(' | ')}.` : '';
  const retentionReasonText = persistence.retentionReason ? ` Retention: ${persistence.retentionReason}.` : '';

  return `${retainedText}${checkpointSourceText}${bundleText}${retentionReasonText}`;
}

function formatToolResultCompressionSummary(toolResultCompression: ExplainResult['toolResultCompression']): string {
  if (!toolResultCompression) {
    return '';
  }

  const identity = [toolResultCompression.toolName, toolResultCompression.resultKind, toolResultCompression.status]
    .filter(Boolean)
    .join(' / ');
  const droppedSectionsText =
    toolResultCompression.droppedSections.length > 0
      ? ` Dropped sections: ${toolResultCompression.droppedSections.join(' | ')}.`
      : '';
  const lookupParts = [
    toolResultCompression.lookup.artifactPath
      ? `artifact ${toolResultCompression.lookup.artifactPath}`
      : undefined,
    toolResultCompression.lookup.sourcePath ? `source ${toolResultCompression.lookup.sourcePath}` : undefined,
    toolResultCompression.lookup.sourceUrl ? `url ${toolResultCompression.lookup.sourceUrl}` : undefined,
    toolResultCompression.lookup.rawSourceId ? `raw source ${toolResultCompression.lookup.rawSourceId}` : undefined
  ].filter((value): value is string => Boolean(value));
  const lookupText = lookupParts.length > 0 ? ` Lookup: ${lookupParts.join(' | ')}.` : '';

  return ` Tool result compression: ${identity ? `${identity} ` : ''}used policy ${toolResultCompression.policyId}. ` +
    `Reason: ${toolResultCompression.reason ?? 'tool output was normalized for transcript persistence'}.` +
    `${droppedSectionsText}${lookupText}`;
}

function formatCorrectionSummary(corrections: NonNullable<ExplainResult['corrections']>): string {
  if (corrections.applied.length === 0) {
    return '';
  }

  return ` Corrections: ${corrections.applied
    .slice(0, 3)
    .map((correction) => `${correction.targetKind}:${correction.targetId}:${correction.action}`)
    .join(' | ')}.`;
}

function inferFixedSlot(reason: string): RuntimeContextFixedSlot | undefined {
  if (/current process/i.test(reason)) {
    return 'currentProcess';
  }

  if (/intent/i.test(reason)) {
    return 'intent';
  }

  if (/goal/i.test(reason)) {
    return 'goal';
  }

  return undefined;
}

function describeProvenance(provenance: ExplainResult['provenance']): string {
  if (!provenance) {
    return 'unknown';
  }

  return `${provenance.originKind} / ${provenance.sourceStage} / ${provenance.producer}`;
}

function describeConflict(governance: NodeGovernance): ExplainResult['conflict'] | undefined {
  const conflict = governance.conflict;

  if (!conflict) {
    return undefined;
  }

  return {
    conflictStatus: conflict.conflictStatus,
    resolutionState: conflict.resolutionState,
    conflictSetKey: conflict.conflictSetKey,
    ...(typeof conflict.overridePriority === 'number' ? { overridePriority: conflict.overridePriority } : {}),
    ...(conflict.supersededByNodeId ? { supersededByNodeId: conflict.supersededByNodeId } : {}),
    conflictingNodeIds: conflict.conflictingNodeIds ?? [],
    ...(describeConflictSelectionReason(governance) !== 'node was not selected in the compiled runtime bundle'
      ? { resolutionReason: describeConflictSelectionReason(governance) }
      : {})
  };
}

function describeConflictSelectionReason(governance: NodeGovernance): string {
  const conflict = governance.conflict;

  if (!conflict) {
    return 'node was not selected in the compiled runtime bundle';
  }

  if (conflict.conflictStatus === 'superseded') {
    const byText = conflict.supersededByNodeId ? ` by node ${conflict.supersededByNodeId}` : '';
    return `node was suppressed because it was superseded${byText}`;
  }

  if (conflict.resolutionState === 'suppressed') {
    const peers =
      conflict.conflictingNodeIds && conflict.conflictingNodeIds.length > 0
        ? ` against ${conflict.conflictingNodeIds.join(', ')}`
        : '';
    return `node was suppressed by conflict resolution${peers}`;
  }

  if (conflict.conflictStatus === 'confirmed') {
    const peers =
      conflict.conflictingNodeIds && conflict.conflictingNodeIds.length > 0
        ? ` against ${conflict.conflictingNodeIds.join(', ')}`
        : '';
    return `node is part of a confirmed conflict set${peers}`;
  }

  return 'node was not selected in the compiled runtime bundle';
}

function describeSelectionScopeReason(
  node: GraphNode,
  included: boolean,
  governance: NodeGovernance | undefined
): string | undefined {
  if (!governance) {
    return undefined;
  }

  const admission = assessHigherScopeRecallAdmission(node);

  switch (governance.scopePolicy.currentScope) {
    case 'session':
      return included ? 'session scope remains the primary recall source' : undefined;
    case 'workspace':
      return included
        ? `workspace scope was selected as a higher-scope fallback; ${admission.reason}`
        : admission.admitted
          ? 'workspace scope only participates after stronger session recall candidates'
          : admission.reason;
    case 'global':
      return included
        ? `global scope was selected as a last-resort fallback; ${admission.reason}`
        : admission.admitted
          ? 'global scope only participates after stronger session/workspace recall candidates'
          : admission.reason;
    default:
      return undefined;
  }
}

function checkpointContainsNode(checkpoint: SessionCheckpoint, node: GraphNode): boolean {
  if (checkpoint.provenance?.derivedFromNodeIds?.includes(node.id)) {
    return true;
  }

  switch (node.type) {
    case 'Goal':
      return checkpoint.summary.goal === node.label;
    case 'Intent':
      return checkpoint.summary.intent === node.label;
    case 'Rule':
      return checkpoint.summary.activeRuleIds.includes(node.id);
    case 'Constraint':
      return checkpoint.summary.activeConstraintIds.includes(node.id);
    case 'Process':
    case 'Step':
      return checkpoint.summary.currentProcessId === node.id;
    case 'Decision':
      return checkpoint.summary.recentDecisionIds.includes(node.id);
    case 'State':
    case 'Outcome':
      return checkpoint.summary.recentStateIds.includes(node.id);
    case 'Risk':
      return checkpoint.summary.openRiskIds.includes(node.id);
    default:
      return false;
  }
}

function deltaContainsNode(delta: SessionDelta, node: GraphNode): boolean {
  return (
    delta.addedRuleIds.includes(node.id) ||
    delta.addedConstraintIds.includes(node.id) ||
    delta.addedDecisionIds.includes(node.id) ||
    delta.addedStateIds.includes(node.id) ||
    delta.addedRiskIds.includes(node.id)
  );
}

function skillCandidateContainsNode(skillCandidate: SkillCandidate, node: GraphNode): boolean {
  if (skillCandidate.sourceNodeIds?.includes(node.id)) {
    return true;
  }

  if (skillCandidate.provenance?.derivedFromNodeIds?.includes(node.id)) {
    return true;
  }

  switch (node.type) {
    case 'Rule':
      return skillCandidate.requiredRuleIds.includes(node.id);
    case 'Constraint':
      return skillCandidate.requiredConstraintIds.includes(node.id);
    case 'Evidence':
      return skillCandidate.evidenceNodeIds.includes(node.id);
    case 'Process':
    case 'Step':
      return skillCandidate.workflowSteps.includes(node.label);
    case 'Goal':
    case 'Intent':
      return skillCandidate.applicableWhen.includes(node.label);
    default:
      return false;
  }
}

function resolveRetentionReason(
  selection: ExplainResult['selection'],
  persistence: Partial<TracePersistenceView>
): string | undefined {
  const retainedSurfaces = [
    persistence.persistedInCheckpoint ? 'checkpoint history' : undefined,
    persistence.surfacedInDelta ? 'delta history' : undefined,
    persistence.surfacedInSkillCandidate ? 'skill candidate history' : undefined
  ].filter((value): value is string => Boolean(value));

  if (retainedSurfaces.length === 0) {
    return undefined;
  }

  const retainedText = retainedSurfaces.join(' / ');

  if (selection?.included === false) {
    return `node is retained in ${retainedText} but was not selected into the current runtime bundle`;
  }

  if (selection?.included === true) {
    return `node is selected into the current runtime bundle and also retained in ${retainedText}`;
  }

  return `node is retained in ${retainedText}`;
}

function describeToolResultCompression(node: NonNullable<ExplainResult['node']>): ExplainResult['toolResultCompression'] {
  const payload = asRecord(node.payload);
  const metadata = asRecord(payload?.metadata);
  const metadataView = readCompressedToolResultMetadata(metadata);

  if (!metadataView) {
    return undefined;
  }

  return {
    compressed: true,
    ...(metadataView.toolName ? { toolName: metadataView.toolName } : {}),
    ...(metadataView.toolCallId ? { toolCallId: metadataView.toolCallId } : {}),
    ...(metadataView.status ? { status: metadataView.status } : {}),
    ...(metadataView.resultKind ? { resultKind: metadataView.resultKind } : {}),
    ...(metadataView.summary ? { summary: metadataView.summary } : {}),
    keySignals: metadataView.keySignals,
    affectedPaths: metadataView.affectedPaths,
    policyId: metadataView.policyId,
    ...(metadataView.reason ? { reason: metadataView.reason } : {}),
    droppedSections: metadataView.droppedSections,
    lookup: {
      ...(node.provenance?.rawSourceId ? { rawSourceId: node.provenance.rawSourceId } : {}),
      ...(metadataView.lookup.artifactPath ? { artifactPath: metadataView.lookup.artifactPath } : {}),
      ...(metadataView.lookup.sourcePath ? { sourcePath: metadataView.lookup.sourcePath } : {}),
      ...(metadataView.lookup.sourceUrl ? { sourceUrl: metadataView.lookup.sourceUrl } : {}),
      ...(metadataView.lookup.contentHash ? { contentHash: metadataView.lookup.contentHash } : {}),
      ...(typeof metadataView.lookup.byteLength === 'number' ? { byteLength: metadataView.lookup.byteLength } : {})
    },
    ...(hasAnyMetric(metadataView.metrics) ? { metrics: metadataView.metrics } : {}),
    ...(metadataView.error ? { error: metadataView.error } : {})
  };
}

function hasAnyMetric(metrics: NonNullable<ReturnType<typeof readCompressedToolResultMetadata>>['metrics']): boolean {
  return Object.keys(metrics).length > 0;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function readPayloadString(payload: GraphNode['payload'], key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function dedupeCorrections(corrections: ManualCorrectionRecord[]): ManualCorrectionRecord[] {
  const byId = new Map<string, ManualCorrectionRecord>();

  for (const correction of corrections) {
    byId.set(correction.id, correction);
  }

  return [...byId.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function dedupeEdgeTypes(edgeTypes: RelatedNodeDescription['edge']['type'][]): RelatedNodeDescription['edge']['type'][] {
  return [...new Set(edgeTypes)];
}
