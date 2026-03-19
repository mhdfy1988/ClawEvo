import { randomUUID } from 'node:crypto';

import type {
  ContextRecallKind,
  ContextSelection,
  ContextSelectionDiagnostic,
  EdgeType,
  FailureSignalSeverity,
  GraphEdge,
  GraphNode,
  KnowledgeStrength,
  NodeGovernance,
  NodeType,
  ProvenanceOriginKind,
  ProvenanceRef,
  RelationRecallPolicy,
  RelationRecallPath,
  RelationRecallRankingMode,
  RelationRetrievalDiagnostics,
  RelationRetrievalStrategy,
  RuntimeContextCategory,
  RuntimeContextDiagnostics,
  RuntimeContextBundle,
  RuntimeContextSelectionSlot
} from '@openclaw-compact-context/contracts';
import type { CompileContextRequest, GraphNodeFilter } from '@openclaw-compact-context/contracts';
import type { ManualCorrectionRecord } from '@openclaw-compact-context/contracts';
import type { GraphStore } from '../infrastructure/graph-store.js';
import { isSuppressedByConflict, normalizeNodeGovernance, promptReadinessScore, validityScore } from '../governance/governance.js';
import { getRelationRecallPriority, isRecallEligibleEdge } from '../governance/relation-contract.js';
import { assessHigherScopeRecallAdmission, describeScopeSelectionReason, scopePolicyScore } from '../governance/scope-policy.js';
import { analyzeTextMatch, matchesTextFilter, scoreTextMatch } from '../infrastructure/text-search.js';
import {
  applyRuntimeNodeCorrection,
  getActiveManualCorrections,
  isNodeSuppressedByManualCorrection
} from '../governance/manual-corrections.js';

const DEFAULT_CATEGORY_LIMITS = {
  rules: 8,
  constraints: 6,
  risks: 4,
  decisions: 4,
  states: 4,
  evidence: 6,
  skills: 4
};

const CATEGORY_BUDGET_RATIOS = {
  rules: 0.2,
  constraints: 0.16,
  risks: 0.14,
  decisions: 0.12,
  states: 0.14,
  evidence: 0.16,
  skills: 0.08
};

const DEFAULT_RELATION_PATH_BUDGET = 16;
const DEFAULT_RELATION_MAX_PATHS_PER_TARGET = 3;
const DEFAULT_RELATION_MAX_PATHS_PER_SOURCE = 3;
const DEFAULT_RELATION_MAX_EXPANDED_TARGETS = 6;
const DEFAULT_RELATION_MIN_PATH_BONUS = 5.2;
const DEFAULT_RELATION_RANKING_MODE: RelationRecallRankingMode = 'bonus_then_hops';

type CategoryBudgetPools = typeof CATEGORY_BUDGET_RATIOS;

type DeferredSelectionReason = 'category_budget_reserved' | 'total_budget_exhausted';

interface DeferredSelection {
  item: ContextSelection;
  reason: DeferredSelectionReason;
}

interface BudgetSelectionResult {
  selected: ContextSelection[];
  deferred: DeferredSelection[];
  used: number;
}

const CATEGORY_TO_BUDGET_POOL: Record<RuntimeContextCategory, keyof CategoryBudgetPools> = {
  activeRules: 'rules',
  activeConstraints: 'constraints',
  openRisks: 'risks',
  recentDecisions: 'decisions',
  recentStateChanges: 'states',
  relevantEvidence: 'evidence',
  candidateSkills: 'skills'
};

const RELATION_RECALL_SLOT_PRIORITY: Partial<Record<RuntimeContextSelectionSlot, number>> = {
  activeRules: 2.25,
  activeConstraints: 2,
  openRisks: 2.5,
  currentProcess: 1.75,
  recentDecisions: 1.25,
  recentStateChanges: 1
};

interface RelationRecallHint {
  edgeType: EdgeType;
  sourceSlot: RuntimeContextSelectionSlot;
  sourceNodeId: string;
  sourceLabel: string;
  bonus: number;
}

interface RelationRecallSupport {
  totalBonus: number;
  hints: RelationRecallHint[];
  paths: RelationRecallPath[];
}

interface RelationRecallResult {
  supportByNodeId: Map<string, RelationRecallSupport>;
  diagnostics: RelationRetrievalDiagnostics;
}

interface ResolvedRelationRecallPolicy extends RelationRecallPolicy {
  edgeTypes: EdgeType[];
  targetTypes: Array<GraphNode['type']>;
}

interface LearningRecallHint {
  kind: 'failure_signal' | 'procedure_step' | 'critical_step' | 'prerequisite' | 'failure_pattern' | 'successful_procedure';
  sourceNodeId: string;
  sourceLabel: string;
  bonus: number;
}

interface LearningRecallSupport {
  totalBonus: number;
  hints: LearningRecallHint[];
}

interface LearningRecallResult {
  supportByNodeId: Map<string, LearningRecallSupport>;
  diagnostics?: RuntimeContextDiagnostics['learning'];
}

interface RelationRecallBuildOptions {
  targetTypes: Array<GraphNode['type']>;
  edgeTypes: EdgeType[];
  supportSourceNodes?: boolean;
  maxHops?: 1 | 2;
  secondHopEdgeTypes?: EdgeType[];
  intermediateTypes?: NodeType[];
  maxPaths?: number;
  pathBudget?: number;
  maxPathsPerTarget?: number;
  maxPathsPerSource?: number;
  maxExpandedTargets?: number;
  minPathBonus?: number;
  rankingMode?: RelationRecallRankingMode;
}

export class ContextCompiler {
  constructor(private readonly graphStore: GraphStore) {}

  async compile(request: CompileContextRequest): Promise<RuntimeContextBundle> {
    const [
      goals,
      fallbackGoals,
      intents,
      fallbackIntents,
      rules,
      fallbackRules,
      constraints,
      fallbackConstraints,
      modes,
      fallbackModes,
      risks,
      fallbackRisks,
      processes,
      fallbackProcesses,
      steps,
      fallbackSteps,
      decisions,
      rawDecisions,
      outcomes,
      rawOutcomes,
      states,
      rawStates,
      compressedStates,
      tools,
      rawTools,
      evidence,
      rawEvidence,
      compressedEvidence,
      skills,
      topicNodes,
      attemptNodes,
      episodeNodes,
      failureSignalNodes,
      procedureCandidateNodes,
      patternNodes,
      failurePatternNodes,
      successfulProcedureNodes
    ] = await Promise.all([
      this.queryNodesForScopeHierarchy(request, {
        types: ['Goal'],
        text: request.goalLabel ?? request.query,
        originKinds: ['raw'],
        limit: 3
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Goal'],
        limit: 3
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Intent'],
        text: request.intentLabel ?? request.query,
        originKinds: ['raw'],
        limit: 3
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Intent'],
        limit: 3
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Rule'],
        freshness: ['active'],
        originKinds: ['raw']
      }),
      this.queryNodesForScopeHierarchy(request, { types: ['Rule'], freshness: ['active'] }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Constraint'],
        freshness: ['active'],
        originKinds: ['raw']
      }),
      this.queryNodesForScopeHierarchy(request, { types: ['Constraint'], freshness: ['active'] }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Mode'],
        freshness: ['active'],
        originKinds: ['raw'],
        limit: 20
      }),
      this.queryNodesForScopeHierarchy(request, { types: ['Mode'], freshness: ['active'], limit: 20 }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Risk'],
        freshness: ['active'],
        originKinds: ['raw'],
        limit: 20
      }),
      this.queryNodesForScopeHierarchy(request, { types: ['Risk'], freshness: ['active'], limit: 20 }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Process'],
        freshness: ['active'],
        originKinds: ['raw'],
        limit: 20
      }),
      this.queryNodesForScopeHierarchy(request, { types: ['Process'], freshness: ['active'], limit: 20 }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Step'],
        freshness: ['active'],
        originKinds: ['raw'],
        limit: 20
      }),
      this.queryNodesForScopeHierarchy(request, { types: ['Step'], freshness: ['active'], limit: 20 }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Decision'],
        freshness: ['active'],
        limit: 20
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Decision'],
        freshness: ['active'],
        originKinds: ['raw'],
        limit: 20
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Outcome'],
        freshness: ['active'],
        limit: 20
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Outcome'],
        freshness: ['active'],
        originKinds: ['raw'],
        limit: 20
      }),
      this.queryNodesForScopeHierarchy(request, { types: ['State'], freshness: ['active'], limit: 20 }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['State'],
        freshness: ['active'],
        originKinds: ['raw'],
        limit: 20
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['State'],
        freshness: ['active'],
        originKinds: ['compressed'],
        limit: 20
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Tool'],
        freshness: ['active'],
        limit: 20
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Tool'],
        freshness: ['active'],
        originKinds: ['raw'],
        limit: 20
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Evidence'],
        freshness: ['active'],
        limit: 40
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Evidence'],
        freshness: ['active'],
        originKinds: ['raw'],
        limit: 40
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Evidence'],
        freshness: ['active'],
        originKinds: ['compressed'],
        limit: 40
      }),
      this.queryNodesForScopeHierarchy(request, { types: ['Skill'], freshness: ['active'], limit: 20 }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Topic', 'Concept'],
        freshness: ['active'],
        limit: 12
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Attempt'],
        freshness: ['active'],
        limit: 12
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Episode'],
        freshness: ['active'],
        limit: 8
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['FailureSignal'],
        freshness: ['active'],
        limit: 16
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['ProcedureCandidate'],
        freshness: ['active'],
        limit: 12
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['Pattern'],
        freshness: ['active'],
        limit: 12
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['FailurePattern'],
        freshness: ['active'],
        limit: 12
      }),
      this.queryNodesForScopeHierarchy(request, {
        types: ['SuccessfulProcedure'],
        freshness: ['active'],
        limit: 12
      })
    ]);

    const selectedGoals = preferPrimaryNodes(goals, fallbackGoals);
    const selectedIntents = preferPrimaryNodes(intents, fallbackIntents);
    const selectedRules = preferPrimaryNodes(rules, fallbackRules);
    const selectedConstraints = preferPrimaryNodes(constraints, fallbackConstraints);
    const selectedModes = preferPrimaryNodes(modes, fallbackModes);
    const selectedRisks = preferPrimaryNodes(risks, fallbackRisks);
    const selectedProcesses = preferPrimaryNodes(processes, fallbackProcesses);
    const selectedSteps = preferPrimaryNodes(steps, fallbackSteps);
    const selectedDecisions = preferPrimaryNodes(rawDecisions, decisions);
    const selectedOutcomes = preferPrimaryNodes(rawOutcomes, outcomes);
    const selectedStates = dedupeNodes(selectedOutcomes.concat(mergePrimaryThenSecondary(rawStates, compressedStates, states, 20)));
    const selectedTools = preferPrimaryNodes(rawTools, tools);
    const selectedEvidence = dedupeNodes(selectedTools.concat(mergePrimaryThenSecondary(rawEvidence, compressedEvidence, evidence, 40)));
    const learningSupport = this.buildExperienceLearningSupport({
      attemptNodes,
      episodeNodes,
      failureSignalNodes,
      procedureCandidateNodes,
      patternNodes,
      failurePatternNodes,
      successfulProcedureNodes,
      candidateNodes: dedupeNodes(
        selectedRules
          .concat(selectedConstraints)
          .concat(selectedModes)
          .concat(selectedRisks)
          .concat(selectedProcesses)
          .concat(selectedSteps)
          .concat(selectedDecisions)
          .concat(selectedStates)
          .concat(selectedEvidence)
          .concat(skills)
      )
    });

    const goal = this.pickBest(selectedGoals, request.query, 'current goal match');
    const intent = this.pickBest(selectedIntents, request.query, 'current intent match');
    const provisionalCurrentProcess =
      this.pickBest(selectedSteps, request.query, 'current process step', undefined, learningSupport.supportByNodeId) ??
      this.pickBest(selectedProcesses, request.query, 'current process', undefined, learningSupport.supportByNodeId);
    const nextStepSupport = await this.buildRelationAwareNodeSupport(
      request,
      provisionalCurrentProcess ? [{ slot: 'currentProcess', selection: provisionalCurrentProcess }] : [],
      {
        targetTypes: ['Step', 'Process'],
        edgeTypes: ['next_step']
      }
    );
    const currentProcess =
      this.pickBest(
        selectedSteps,
        request.query,
        'current process step',
        nextStepSupport.supportByNodeId,
        learningSupport.supportByNodeId
      ) ??
      this.pickBest(
        selectedProcesses,
        request.query,
        'current process',
        nextStepSupport.supportByNodeId,
        learningSupport.supportByNodeId
      );
    const requiresSupport = await this.buildRelationAwareNodeSupport(
      request,
      currentProcess ? [{ slot: 'currentProcess', selection: currentProcess }] : [],
      {
        targetTypes: ['Rule', 'Constraint', 'Mode'],
        edgeTypes: ['requires']
      }
    );
    const initialRules = this.selectNodes(
      selectedRules,
      request.query,
      DEFAULT_CATEGORY_LIMITS.rules,
      'active rule',
      requiresSupport.supportByNodeId,
      learningSupport.supportByNodeId
    );
    const initialConstraints = this.selectNodes(
      dedupeNodes(selectedModes.concat(selectedConstraints)),
      request.query,
      DEFAULT_CATEGORY_LIMITS.constraints,
      'active constraint',
      requiresSupport.supportByNodeId,
      learningSupport.supportByNodeId
    );
    const overrideSupport = await this.buildRelationAwareNodeSupport(
      request,
      [
        ...initialRules.map((selection) => ({ slot: 'activeRules' as const, selection })),
        ...initialConstraints.map((selection) => ({ slot: 'activeConstraints' as const, selection }))
      ],
      {
        targetTypes: ['Rule', 'Constraint', 'Mode'],
        edgeTypes: ['overrides'],
        supportSourceNodes: true
      }
    );
    const combinedRuleSupport = mergeRelationSupportMaps(
      requiresSupport.supportByNodeId,
      overrideSupport.supportByNodeId
    );
    const activeRules = this.selectNodes(
      selectedRules,
      request.query,
      DEFAULT_CATEGORY_LIMITS.rules,
      'active rule',
      combinedRuleSupport,
      learningSupport.supportByNodeId
    );
    const activeConstraints = this.selectNodes(
      dedupeNodes(selectedModes.concat(selectedConstraints)),
      request.query,
      DEFAULT_CATEGORY_LIMITS.constraints,
      'active constraint',
      combinedRuleSupport,
      learningSupport.supportByNodeId
    );
    const recentDecisions = this.selectNodes(
      selectedDecisions,
      request.query,
      DEFAULT_CATEGORY_LIMITS.decisions,
      'recent decision',
      undefined,
      learningSupport.supportByNodeId
    );
    const recentStateChanges = this.selectNodes(
      selectedStates,
      request.query,
      DEFAULT_CATEGORY_LIMITS.states,
      'recent state',
      undefined,
      learningSupport.supportByNodeId
    );
    const inferredOpenRisks = dedupeSelections(
      activeConstraints.concat(recentStateChanges).filter((item) => /risk|block|conflict|constraint|forbid|warning/i.test(item.label))
    );
    const selectedOpenRisks = dedupeSelections(
      this.selectNodes(
        selectedRisks,
        request.query,
        DEFAULT_CATEGORY_LIMITS.risks,
        'open risk',
        undefined,
        learningSupport.supportByNodeId
      ).concat(inferredOpenRisks)
    ).slice(0, DEFAULT_CATEGORY_LIMITS.risks);
    const relationAwareEvidence = await this.buildRelationAwareEvidenceSupport(request, [
      ...activeRules.map((selection) => ({ slot: 'activeRules' as const, selection })),
      ...activeConstraints.map((selection) => ({ slot: 'activeConstraints' as const, selection })),
      ...selectedOpenRisks.map((selection) => ({ slot: 'openRisks' as const, selection })),
      ...(currentProcess ? [{ slot: 'currentProcess' as const, selection: currentProcess }] : []),
      ...recentDecisions.map((selection) => ({ slot: 'recentDecisions' as const, selection })),
      ...recentStateChanges.map((selection) => ({ slot: 'recentStateChanges' as const, selection }))
    ]);
    const relevantEvidence = this.selectNodes(
      selectedEvidence,
      request.query,
      DEFAULT_CATEGORY_LIMITS.evidence,
      'supporting evidence',
      relationAwareEvidence.supportByNodeId
    );
    const candidateSkills = this.selectNodes(
      skills,
      request.query,
      DEFAULT_CATEGORY_LIMITS.skills,
      'candidate skill'
    );
    const topicHints = this.selectNodes(
      topicNodes,
      request.query,
      4,
      'topic-aware recall hint',
      undefined,
      learningSupport.supportByNodeId
    );
    const topicAdmissions = this.selectTopicAdmissions(topicHints, relevantEvidence, candidateSkills);
    const selectedEvidenceWithTopicAdmissions = dedupeSelections(relevantEvidence.concat(topicAdmissions));

    const bundle = this.applyBudget({
      id: randomUUID(),
      sessionId: request.sessionId,
      ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
      query: request.query,
      goal,
      intent,
      activeRules,
      activeConstraints,
      currentProcess,
      recentDecisions,
      recentStateChanges,
      relevantEvidence: selectedEvidenceWithTopicAdmissions,
      candidateSkills,
      openRisks: selectedOpenRisks,
      tokenBudget: {
        total: request.tokenBudget,
        used: 0,
        reserved: 0
      },
      createdAt: new Date().toISOString()
    });

    if (bundle.diagnostics) {
      bundle.diagnostics.topicHints = topicHints
        .filter((item) => !topicAdmissions.some((admission) => admission.nodeId === item.nodeId))
        .map((item) =>
        toSelectionDiagnostic(item, 'reserved as a topic-aware recall hint; not yet admitted into the primary runtime bundle')
      );
      bundle.diagnostics.topicAdmissions = topicAdmissions.map((item) =>
        toSelectionDiagnostic(item, 'admitted as summary-only topic context under controlled stage-5 admission rules')
      );
      bundle.diagnostics.relationRetrieval = mergeRelationRetrievalDiagnostics([
        nextStepSupport.diagnostics,
        requiresSupport.diagnostics,
        overrideSupport.diagnostics,
        relationAwareEvidence.diagnostics
      ]);
      bundle.diagnostics.learning = learningSupport.diagnostics;
    }

    return bundle;
  }

  private async queryNodesForScopeHierarchy(
    request: CompileContextRequest,
    filter: GraphNodeFilter
  ): Promise<GraphNode[]> {
    const manualCorrections = getActiveManualCorrections();
    const supplementalLabelOverrideNodes = await this.getLabelOverrideSupplementalNodes(request, filter, manualCorrections);
    const [sessionNodes, workspaceNodes, globalNodes] = await Promise.all([
      this.graphStore.queryNodes({
        ...filter,
        scopes: ['session'],
        sessionId: request.sessionId
      }),
      request.workspaceId
        ? this.graphStore.queryNodes({
            ...filter,
            scopes: ['workspace'],
            workspaceId: request.workspaceId
          })
        : Promise.resolve([]),
      this.graphStore.queryNodes({
        ...filter,
        scopes: ['global']
      })
    ]);

    return dedupeNodes(
      sessionNodes
        .concat(workspaceNodes, globalNodes, supplementalLabelOverrideNodes)
        .map((node) => applyRuntimeNodeCorrection(node, manualCorrections))
    ).filter(
      (node) => matchesCompileScope(node, request) && !isNodeSuppressedByManualCorrection(node, manualCorrections)
    );
  }

  private async getLabelOverrideSupplementalNodes(
    request: CompileContextRequest,
    filter: GraphNodeFilter,
    corrections: readonly ManualCorrectionRecord[]
  ): Promise<GraphNode[]> {
    if (!filter.text) {
      return [];
    }

    const labelOverrideTargetIds = dedupeStrings(
      corrections
        .filter((correction) => correction.targetKind === 'label_override')
        .map((correction) => correction.targetId)
    );

    if (labelOverrideTargetIds.length === 0) {
      return [];
    }

    const candidates = await this.graphStore.getNodesByIds(labelOverrideTargetIds);

    return candidates
      .map((node) => applyRuntimeNodeCorrection(node, corrections))
      .filter((node) => matchesSupplementalNodeFilter(node, request, filter));
  }

  private pickBest(
    nodes: GraphNode[],
    query: string,
    reason: string,
    relationSupport?: Map<string, RelationRecallSupport>,
    learningSupport?: Map<string, LearningRecallSupport>
  ): ContextSelection | undefined {
    const ranked = this.rankNodes(nodes, query, relationSupport, learningSupport);
    const [best] = ranked;
    return best
      ? this.toSelection(best, query, reason, relationSupport?.get(best.id), learningSupport?.get(best.id), ranked)
      : undefined;
  }

  private selectNodes(
    nodes: GraphNode[],
    query: string,
    limit: number,
    reason: string,
    relationSupport?: Map<string, RelationRecallSupport>,
    learningSupport?: Map<string, LearningRecallSupport>
  ): ContextSelection[] {
    const ranked = this.rankNodes(nodes, query, relationSupport, learningSupport);

    return ranked
      .slice(0, limit)
      .map((node) =>
        this.toSelection(node, query, reason, relationSupport?.get(node.id), learningSupport?.get(node.id), ranked)
      );
  }

  private selectTopicAdmissions(
    topicHints: ContextSelection[],
    relevantEvidence: ContextSelection[],
    candidateSkills: ContextSelection[]
  ): ContextSelection[] {
    if (topicHints.length === 0) {
      return [];
    }

    const evidenceCount = relevantEvidence.length;
    const skillCount = candidateSkills.length;

    if (evidenceCount >= 4 && skillCount >= 2) {
      return [];
    }

    return topicHints
      .filter((item) => {
        const governance = item.governance;

        if (!governance || governance.promptReadiness.preferredForm !== 'summary') {
          return false;
        }

        if (governance.validity.confidence < 0.7) {
          return false;
        }

        return item.type === 'Topic' || item.type === 'Concept';
      })
      .slice(0, 1)
      .map((item) => ({
        ...item,
        reason: item.reason.replace('topic-aware recall hint', 'admitted topic-aware context')
      }));
  }

  private rankNodes(
    nodes: GraphNode[],
    query: string,
    relationSupport?: Map<string, RelationRecallSupport>,
    learningSupport?: Map<string, LearningRecallSupport>
  ): GraphNode[] {
    const manualCorrections = getActiveManualCorrections();
    return [...nodes]
      .filter((node) => {
        const governance = normalizeNodeGovernance(node);
        return (
          governance.promptReadiness.eligible &&
          !isSuppressedByConflict(governance) &&
          !isNodeSuppressedByManualCorrection(node, manualCorrections)
        );
      })
      .sort((left, right) => {
      const leftGovernance = normalizeNodeGovernance(left);
      const rightGovernance = normalizeNodeGovernance(right);
      const scopeDelta = scopePolicyScore(rightGovernance) - scopePolicyScore(leftGovernance);

      if (scopeDelta !== 0) {
        return scopeDelta;
      }

      const scoreDelta =
        this.scoreNode(right, query, relationSupport?.get(right.id), learningSupport?.get(right.id)) -
        this.scoreNode(left, query, relationSupport?.get(left.id), learningSupport?.get(left.id));

      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      const labelDelta = left.label.localeCompare(right.label);

      if (labelDelta !== 0) {
        return labelDelta;
      }

        return left.id.localeCompare(right.id);
      });
  }

  private scoreNode(
    node: GraphNode,
    query: string,
    relationSupport?: RelationRecallSupport,
    learningSupport?: LearningRecallSupport
  ): number {
    const governance = normalizeNodeGovernance(node);
    let score = 0;

    score += strengthScore(node.strength);
    score += provenanceScore(governance.knowledgeState);
    score += promptReadinessScore(governance);
    score += validityScore(governance);
    score += semanticExtractionScore(node);
    score += scoreTextMatch(node.label, query, {
      exactPhrase: 4,
      matchedTerm: 0.75,
      coverage: 1.5,
      fullCoverage: 1
    });
    score += scoreTextMatch(JSON.stringify(node.payload), query, {
      exactPhrase: 2,
      matchedTerm: 0.5,
      coverage: 1,
      fullCoverage: 0.5
    });

    if (governance.validity.freshness === 'active') {
      score += 2;
    }

    score += relationSupport?.totalBonus ?? 0;
    score += learningSupport?.totalBonus ?? 0;
    score += governance.validity.confidence;
    return score;
  }

  private toSelection(
    node: GraphNode,
    query: string,
    reason: string,
    relationSupport?: RelationRecallSupport,
    learningSupport?: LearningRecallSupport,
    rankedNodes: GraphNode[] = [node]
  ): ContextSelection {
    const governance = normalizeNodeGovernance(node);
    const relationReason = describeRelationRecallSupport(relationSupport);
    const learningReason = describeLearningRecallSupport(learningSupport);
    const scopeReason = describeScopeSelectionReason(node, rankedNodes);
    const recallKinds = collectRecallKinds(node, query, relationSupport, learningSupport);
    const primaryRecallKind = resolvePrimaryRecallKind(recallKinds);

    return {
      nodeId: node.id,
      type: node.type,
      label: node.label,
      scope: node.scope,
      kind: node.kind,
      strength: node.strength,
      reason: appendSelectionReason(`${reason}${relationReason}${learningReason}${scopeReason}`, node.provenance, governance),
      estimatedTokens: estimateTextTokens(node.label) + estimateTextTokens(JSON.stringify(node.payload)),
      sourceRef: node.sourceRef,
      provenance: node.provenance,
      governance,
      ...(primaryRecallKind ? { primaryRecallKind } : {}),
      ...(recallKinds.length > 0 ? { recallKinds } : {}),
      ...(relationSupport?.paths?.length ? { relationPaths: relationSupport.paths.slice(0, 4) } : {})
    };
  }

  private async buildRelationAwareEvidenceSupport(
    request: Pick<CompileContextRequest, 'sessionId' | 'workspaceId' | 'relationRecallPolicy'>,
    sources: Array<{
      slot: RuntimeContextSelectionSlot;
      selection: ContextSelection;
    }>
  ): Promise<RelationRecallResult> {
    return this.buildRelationAwareNodeSupport(request, sources, {
      targetTypes: ['Evidence'],
      edgeTypes: ['supported_by', 'requires', 'next_step', 'overrides'],
      maxHops: 2,
      secondHopEdgeTypes: ['supported_by'],
      intermediateTypes: ['Rule', 'Constraint', 'Mode', 'Process', 'Step', 'Risk', 'Decision', 'State', 'Outcome', 'Tool'],
      maxPaths: 24,
      pathBudget: DEFAULT_RELATION_PATH_BUDGET,
      maxPathsPerTarget: DEFAULT_RELATION_MAX_PATHS_PER_TARGET,
      maxPathsPerSource: DEFAULT_RELATION_MAX_PATHS_PER_SOURCE,
      maxExpandedTargets: DEFAULT_RELATION_MAX_EXPANDED_TARGETS,
      minPathBonus: DEFAULT_RELATION_MIN_PATH_BONUS,
      rankingMode: DEFAULT_RELATION_RANKING_MODE
    });
  }

  private async buildRelationAwareNodeSupport(
    request: Pick<CompileContextRequest, 'sessionId' | 'workspaceId' | 'relationRecallPolicy'>,
    sources: Array<{
      slot: RuntimeContextSelectionSlot;
      selection: ContextSelection;
    }>,
    options: RelationRecallBuildOptions
  ): Promise<RelationRecallResult> {
    if (sources.length === 0) {
      return emptyRelationRecallResult();
    }

    const manualCorrections = getActiveManualCorrections();
    const relationPolicy = resolveRelationRecallPolicy(request.relationRecallPolicy, options);
    const supportByNodeId = new Map<string, RelationRecallSupport>();
    const sourceByNodeId = new Map(sources.map((item) => [item.selection.nodeId, item]));
    const sourceIds = sources.map((item) => item.selection.nodeId);
    const strategy: RelationRetrievalStrategy = sources.length > 1 ? 'batch_adjacency' : 'single_source_fallback';
    const fallbackReason =
      strategy === 'single_source_fallback'
        ? 'only one relation source was available, so compiler used the single-node adjacency fallback'
        : undefined;
    const firstHopEdges =
      strategy === 'batch_adjacency'
        ? await this.graphStore.getEdgesForNodes(sourceIds)
        : await this.graphStore.getEdgesForNode(sourceIds[0] as string);
    const eligibleFirstHopEdges = firstHopEdges.filter(
      (edge) => isRecallEligibleEdge(edge) && relationPolicy.edgeTypes.includes(edge.type)
    );
    const firstHopNodeIds = dedupeIds(
      eligibleFirstHopEdges.flatMap((edge) => {
        const relatedIds: string[] = [];

        if (sourceByNodeId.has(edge.fromId) && edge.toId !== edge.fromId) {
          relatedIds.push(edge.toId);
        }

        if (sourceByNodeId.has(edge.toId) && edge.fromId !== edge.toId) {
          relatedIds.push(edge.fromId);
        }

        return relatedIds;
      })
    );
    const firstHopNodes =
      firstHopNodeIds.length === 0
        ? []
        : firstHopNodeIds.length === 1
          ? await Promise.all([this.graphStore.getNode(firstHopNodeIds[0] as string)])
          : await this.graphStore.getNodesByIds(firstHopNodeIds);
    const firstHopNodeById = new Map<string, GraphNode>();

    for (const firstHopNode of firstHopNodes) {
      if (!firstHopNode) {
        continue;
      }

      const correctedNode = applyRuntimeNodeCorrection(firstHopNode, manualCorrections);

      if (isNodeSuppressedByManualCorrection(correctedNode, manualCorrections)) {
        continue;
      }

      firstHopNodeById.set(correctedNode.id, correctedNode);
    }

    const secondHopSources = new Map<
      string,
      Array<{
        source: (typeof sources)[number];
        intermediateNode: GraphNode;
        firstHopEdge: (typeof firstHopEdges)[number];
        firstHopBonus: number;
      }>
    >();

    for (const edge of eligibleFirstHopEdges) {
      const slotMatches = [
        sourceByNodeId.get(edge.fromId)
          ? {
              source: sourceByNodeId.get(edge.fromId) as (typeof sources)[number],
              targetNodeId: options.supportSourceNodes ? edge.fromId : edge.toId
            }
          : undefined,
        sourceByNodeId.get(edge.toId)
          ? {
              source: sourceByNodeId.get(edge.toId) as (typeof sources)[number],
              targetNodeId: options.supportSourceNodes ? edge.toId : edge.fromId
            }
          : undefined
      ].filter((value): value is { source: (typeof sources)[number]; targetNodeId: string } => Boolean(value));

      for (const match of slotMatches) {
        const slotBonus = RELATION_RECALL_SLOT_PRIORITY[match.source.slot];

        if (!slotBonus) {
          continue;
        }

        const edgeBonus = getRelationRecallPriority(edge);

        if (typeof edgeBonus !== 'number') {
          continue;
        }

        const targetNode =
          match.targetNodeId === match.source.selection.nodeId
            ? undefined
            : firstHopNodeById.get(match.targetNodeId);
        const candidateNode =
          options.supportSourceNodes && match.targetNodeId === match.source.selection.nodeId
            ? undefined
            : targetNode;
        const directBonus = slotBonus + edgeBonus;

        if (options.supportSourceNodes !== true) {
          if (!candidateNode || !options.targetTypes.includes(candidateNode.type)) {
            if (
              relationPolicy.maxHops === 2 &&
              candidateNode &&
              options.intermediateTypes?.includes(candidateNode.type) &&
              matchesCompileScope(candidateNode, request)
            ) {
              const governance = normalizeNodeGovernance(candidateNode);

              if (governance.promptReadiness.eligible && !isSuppressedByConflict(governance)) {
                const existing = secondHopSources.get(candidateNode.id) ?? [];
                existing.push({
                  source: match.source,
                  intermediateNode: candidateNode,
                  firstHopEdge: edge,
                  firstHopBonus: directBonus
                });
                secondHopSources.set(candidateNode.id, existing);
              }
            }

            continue;
          }

          if (!matchesCompileScope(candidateNode, request)) {
            continue;
          }

          const governance = normalizeNodeGovernance(candidateNode);

          if (!governance.promptReadiness.eligible || isSuppressedByConflict(governance)) {
            continue;
          }
        }

        const supportNodeId = options.supportSourceNodes === true ? match.source.selection.nodeId : (candidateNode?.id as string);
        addRelationRecallSupport(supportByNodeId, supportNodeId, {
          edgeType: edge.type,
          sourceSlot: match.source.slot,
          sourceNodeId: match.source.selection.nodeId,
          sourceLabel: match.source.selection.label,
          bonus: directBonus
        }, candidateNode
          ? [{
              sourceNodeId: match.source.selection.nodeId,
              sourceSlot: match.source.slot,
              targetNodeId: candidateNode.id,
              hopCount: 1,
              bonus: directBonus,
              hops: [
                {
                  edgeType: edge.type,
                  fromNodeId: match.source.selection.nodeId,
                  toNodeId: candidateNode.id,
                  fromLabel: match.source.selection.label,
                  toLabel: candidateNode.label
                }
              ]
            }]
          : []);
      }
    }

    let secondHopEdges: Array<(typeof firstHopEdges)[number]> = [];
    let eligibleSecondHopEdges: Array<(typeof firstHopEdges)[number]> = [];
    let secondHopRelatedNodeById = new Map<string, GraphNode>();
    let candidatePathCount = 0;
    let admittedPathCount = 0;
    let prunedByBudgetCount = 0;
    let prunedByTargetCount = 0;
    let prunedBySourceCount = 0;
    let prunedByExpansionCount = 0;
    let prunedByScoreCount = 0;
    let pathBudgetExhausted = false;
    const selectedPathSamples: string[] = [];
    const prunedPathSamples: string[] = [];

    if (
      relationPolicy.maxHops === 2 &&
      secondHopSources.size > 0 &&
      relationPolicy.secondHopEdgeTypes.length > 0
    ) {
      const intermediateIds = [...secondHopSources.keys()];
      secondHopEdges =
        intermediateIds.length === 1
          ? await this.graphStore.getEdgesForNode(intermediateIds[0] as string)
          : await this.graphStore.getEdgesForNodes(intermediateIds);
      eligibleSecondHopEdges = secondHopEdges.filter(
        (edge) => isRecallEligibleEdge(edge) && relationPolicy.secondHopEdgeTypes.includes(edge.type)
      );
      const secondHopTargetIds = dedupeIds(
        eligibleSecondHopEdges.flatMap((edge) => {
          const targets: string[] = [];

          if (secondHopSources.has(edge.fromId) && edge.toId !== edge.fromId) {
            targets.push(edge.toId);
          }

          if (secondHopSources.has(edge.toId) && edge.fromId !== edge.toId) {
            targets.push(edge.fromId);
          }

          return targets;
        })
      );
      const secondHopNodes =
        secondHopTargetIds.length === 0
          ? []
          : secondHopTargetIds.length === 1
            ? await Promise.all([this.graphStore.getNode(secondHopTargetIds[0] as string)])
            : await this.graphStore.getNodesByIds(secondHopTargetIds);

      secondHopRelatedNodeById = new Map<string, GraphNode>();
      for (const secondHopNode of secondHopNodes) {
        if (!secondHopNode) {
          continue;
        }

        const correctedNode = applyRuntimeNodeCorrection(secondHopNode, manualCorrections);

        if (isNodeSuppressedByManualCorrection(correctedNode, manualCorrections)) {
          continue;
        }

        secondHopRelatedNodeById.set(correctedNode.id, correctedNode);
      }

      const pathBudget = Math.min(relationPolicy.pathBudget, options.maxPaths ?? Number.POSITIVE_INFINITY);
      const maxPathsPerTarget = relationPolicy.maxPathsPerTarget;
      const maxPathsPerSource = relationPolicy.maxPathsPerSource;
      const maxExpandedTargets = relationPolicy.maxExpandedTargets;
      const candidatePaths: Array<{
        targetNodeId: string;
        hint: RelationRecallHint;
        path: RelationRecallPath;
        sourceNodeId: string;
      }> = [];

      for (const edge of eligibleSecondHopEdges) {
        const intermediateMatches = [
          secondHopSources.has(edge.fromId)
            ? {
                intermediateId: edge.fromId,
                targetNodeId: edge.toId
              }
            : undefined,
          secondHopSources.has(edge.toId)
            ? {
                intermediateId: edge.toId,
                targetNodeId: edge.fromId
              }
            : undefined
        ].filter((value): value is { intermediateId: string; targetNodeId: string } => Boolean(value));

        const secondHopBonus = getRelationRecallPriority(edge);

        if (typeof secondHopBonus !== 'number') {
          continue;
        }

        for (const match of intermediateMatches) {
          const targetNode = secondHopRelatedNodeById.get(match.targetNodeId);

          if (!targetNode || !options.targetTypes.includes(targetNode.type)) {
            continue;
          }

          if (!matchesCompileScope(targetNode, request)) {
            continue;
          }

          const governance = normalizeNodeGovernance(targetNode);

          if (!governance.promptReadiness.eligible || isSuppressedByConflict(governance)) {
            continue;
          }

          for (const sourceMatch of secondHopSources.get(match.intermediateId) ?? []) {
            const pathBonus = scoreRelationRecallPath(sourceMatch, edge, secondHopBonus, targetNode);
            candidatePathCount += 1;

            if (pathBonus < relationPolicy.minPathBonus) {
              prunedByScoreCount += 1;
              pushDecisionSample(
                prunedPathSamples,
                formatPathDecisionSample(
                  'pruned',
                  sourceMatch.source.selection.label,
                  targetNode.label,
                  [
                    sourceMatch.firstHopEdge.type,
                    edge.type
                  ],
                  pathBonus,
                  `score ${pathBonus.toFixed(2)} < floor ${relationPolicy.minPathBonus.toFixed(2)}`
                )
              );
              continue;
            }

            candidatePaths.push({
              targetNodeId: targetNode.id,
              sourceNodeId: sourceMatch.source.selection.nodeId,
              hint: {
                edgeType: edge.type,
                sourceSlot: sourceMatch.source.slot,
                sourceNodeId: sourceMatch.source.selection.nodeId,
                sourceLabel: sourceMatch.source.selection.label,
                bonus: pathBonus
              },
              path: {
                sourceNodeId: sourceMatch.source.selection.nodeId,
                sourceSlot: sourceMatch.source.slot,
                targetNodeId: targetNode.id,
                hopCount: 2,
                bonus: pathBonus,
                hops: [
                  {
                    edgeType: sourceMatch.firstHopEdge.type,
                    fromNodeId: sourceMatch.source.selection.nodeId,
                    toNodeId: sourceMatch.intermediateNode.id,
                    fromLabel: sourceMatch.source.selection.label,
                    toLabel: sourceMatch.intermediateNode.label
                  },
                  {
                    edgeType: edge.type,
                    fromNodeId: sourceMatch.intermediateNode.id,
                    toNodeId: targetNode.id,
                    fromLabel: sourceMatch.intermediateNode.label,
                    toLabel: targetNode.label
                  }
                ]
              }
            });
          }
        }
      }

      const expandedTargets = new Set<string>();
      const admittedBySource = new Map<string, number>();
      const admittedByTarget = new Map<string, number>();

      candidatePaths
        .sort((left, right) => compareRelationPathCandidates(left.path, right.path, relationPolicy.rankingMode))
        .forEach((candidate) => {
          if (admittedPathCount >= pathBudget) {
            prunedByBudgetCount += 1;
            pathBudgetExhausted = true;
            pushDecisionSample(
              prunedPathSamples,
              formatPathDecisionSample(
                'pruned',
                candidate.path.hops[0]?.fromLabel ?? candidate.hint.sourceLabel,
                candidate.path.hops[candidate.path.hops.length - 1]?.toLabel ?? candidate.targetNodeId,
                candidate.path.hops.map((hop) => hop.edgeType),
                candidate.path.bonus,
                `path budget ${pathBudget} exhausted`
              )
            );
            return;
          }

          const targetCount = admittedByTarget.get(candidate.targetNodeId) ?? 0;
          const sourceCount = admittedBySource.get(candidate.sourceNodeId) ?? 0;

          if (targetCount >= maxPathsPerTarget) {
            prunedByTargetCount += 1;
            pushDecisionSample(
              prunedPathSamples,
              formatPathDecisionSample(
                'pruned',
                candidate.path.hops[0]?.fromLabel ?? candidate.hint.sourceLabel,
                candidate.path.hops[candidate.path.hops.length - 1]?.toLabel ?? candidate.targetNodeId,
                candidate.path.hops.map((hop) => hop.edgeType),
                candidate.path.bonus,
                `target already used ${targetCount} path(s)`
              )
            );
            return;
          }

          if (sourceCount >= maxPathsPerSource) {
            prunedBySourceCount += 1;
            pushDecisionSample(
              prunedPathSamples,
              formatPathDecisionSample(
                'pruned',
                candidate.path.hops[0]?.fromLabel ?? candidate.hint.sourceLabel,
                candidate.path.hops[candidate.path.hops.length - 1]?.toLabel ?? candidate.targetNodeId,
                candidate.path.hops.map((hop) => hop.edgeType),
                candidate.path.bonus,
                `source already used ${sourceCount} path(s)`
              )
            );
            return;
          }

          if (!expandedTargets.has(candidate.targetNodeId) && expandedTargets.size >= maxExpandedTargets) {
            prunedByExpansionCount += 1;
            pushDecisionSample(
              prunedPathSamples,
              formatPathDecisionSample(
                'pruned',
                candidate.path.hops[0]?.fromLabel ?? candidate.hint.sourceLabel,
                candidate.path.hops[candidate.path.hops.length - 1]?.toLabel ?? candidate.targetNodeId,
                candidate.path.hops.map((hop) => hop.edgeType),
                candidate.path.bonus,
                `expanded target budget ${maxExpandedTargets} exhausted`
              )
            );
            return;
          }

          expandedTargets.add(candidate.targetNodeId);
          admittedByTarget.set(candidate.targetNodeId, targetCount + 1);
          admittedBySource.set(candidate.sourceNodeId, sourceCount + 1);
          admittedPathCount += 1;

          addRelationRecallSupport(supportByNodeId, candidate.targetNodeId, candidate.hint, [candidate.path]);
          pushDecisionSample(
            selectedPathSamples,
            formatPathDecisionSample(
              'selected',
              candidate.path.hops[0]?.fromLabel ?? candidate.hint.sourceLabel,
              candidate.path.hops[candidate.path.hops.length - 1]?.toLabel ?? candidate.targetNodeId,
              candidate.path.hops.map((hop) => hop.edgeType),
              candidate.path.bonus,
              relationPolicy.rankingMode
            )
          );
        });
    }

    const totalPathCount = [...supportByNodeId.values()].reduce((total, item) => total + item.paths.length, 0);

    return {
      supportByNodeId,
      diagnostics: {
        strategy,
        sourceCount: sources.length,
        sourceSlots: dedupeSlots(sources.map((item) => item.slot)),
        edgeTypes: dedupeEdgeTypes(relationPolicy.edgeTypes.concat(relationPolicy.secondHopEdgeTypes)),
        edgeLookupCount: 1 + (secondHopEdges.length > 0 ? 1 : 0),
        nodeLookupCount:
          (firstHopNodeIds.length === 0 ? 0 : 1) + (secondHopRelatedNodeById.size > 0 ? 1 : 0),
        scannedEdgeCount: firstHopEdges.length + secondHopEdges.length,
        eligibleEdgeCount: eligibleFirstHopEdges.length + eligibleSecondHopEdges.length,
        relatedNodeCount:
          options.supportSourceNodes === true
            ? supportByNodeId.size
            : dedupeIds([
                ...firstHopNodeIds.filter((nodeId) => firstHopNodeById.has(nodeId)),
                ...[...secondHopRelatedNodeById.keys()]
              ]).length,
        ...(secondHopEdges.length > 0 ? { maxHopCount: 2 } : {}),
        ...(secondHopEdges.length > 0
          ? {
              pathBudget: relationPolicy.pathBudget,
              maxPathsPerTarget: relationPolicy.maxPathsPerTarget,
              maxPathsPerSource: relationPolicy.maxPathsPerSource,
              maxExpandedTargets: relationPolicy.maxExpandedTargets,
              minPathBonus: relationPolicy.minPathBonus,
              rankingMode: relationPolicy.rankingMode,
              candidatePathCount,
              admittedPathCount,
              pathCount: totalPathCount,
              prunedPathCount:
                prunedByBudgetCount + prunedByTargetCount + prunedBySourceCount + prunedByExpansionCount + prunedByScoreCount,
              prunedByBudgetCount,
              prunedByTargetCount,
              prunedBySourceCount,
              prunedByExpansionCount,
              prunedByScoreCount,
              pathBudgetExhausted,
              ...(selectedPathSamples.length > 0 ? { selectedPathSamples } : {}),
              ...(prunedPathSamples.length > 0 ? { prunedPathSamples } : {})
            }
          : {}),
        ...(fallbackReason ? { fallbackReason } : {})
      }
    };
  }

  private buildExperienceLearningSupport(input: {
    attemptNodes: GraphNode[];
    episodeNodes: GraphNode[];
    failureSignalNodes: GraphNode[];
    procedureCandidateNodes: GraphNode[];
    patternNodes: GraphNode[];
    failurePatternNodes: GraphNode[];
    successfulProcedureNodes: GraphNode[];
    candidateNodes: GraphNode[];
  }): LearningRecallResult {
    const supportByNodeId = new Map<string, LearningRecallSupport>();
    const candidateNodesByNormalizedLabel = buildCandidateNodesByNormalizedLabel(input.candidateNodes);
    const criticalStepLabels = new Map<string, string>();
    const diagnostics: NonNullable<RuntimeContextDiagnostics['learning']> = {
      attemptNodeIds: input.attemptNodes.map((node) => node.id),
      episodeNodeIds: input.episodeNodes.map((node) => node.id),
      successSignals: dedupeStrings(input.attemptNodes.flatMap((node) => readPayloadStringArray(node.payload, 'successSignals'))),
      criticalStepNodeIds: [],
      criticalStepLabels: [],
      failureSignals: [],
      procedureCandidates: [],
      promotedPatterns: []
    };

    for (const node of input.failureSignalNodes) {
      const sourceNodeIds = readPayloadStringArray(node.payload, 'sourceNodeIds');
      const severity = readFailureSignalSeverity(node.payload);
      diagnostics.failureSignals.push({
        nodeId: node.id,
        label: node.label,
        severity,
        sourceNodeIds
      });

      for (const sourceNodeId of sourceNodeIds) {
        addLearningSupportHint(supportByNodeId, sourceNodeId, {
          kind: 'failure_signal',
          sourceNodeId: node.id,
          sourceLabel: node.label,
          bonus: failureSignalSeverityBonus(severity)
        });
      }
    }

    for (const node of input.procedureCandidateNodes) {
      const stepNodeIds = readPayloadStringArray(node.payload, 'stepNodeIds');
      const stepLabels = readPayloadStringArray(node.payload, 'stepLabels');
      const prerequisiteNodeIds = readPayloadStringArray(node.payload, 'prerequisiteNodeIds');
      const prerequisiteLabels = readPayloadStringArray(node.payload, 'prerequisiteLabels');
      const criticalStepNodeIds = readPayloadStringArray(node.payload, 'criticalStepNodeIds');
      const confidence = readPayloadNumber(node.payload, 'confidence') ?? node.confidence;
      const status = readProcedureCandidateStatus(node.payload);

      diagnostics.procedureCandidates.push({
        nodeId: node.id,
        label: node.label,
        status,
        confidence,
        stepNodeIds,
        stepLabels,
        prerequisiteNodeIds,
        prerequisiteLabels,
        criticalStepNodeIds
      });

      for (const [index, stepNodeId] of stepNodeIds.entries()) {
        addLearningSupportHint(supportByNodeId, stepNodeId, {
          kind: 'procedure_step',
          sourceNodeId: node.id,
          sourceLabel: node.label,
          bonus: procedureCandidateBonus(status, confidence)
        });

        const stepLabel = stepLabels[index];
        if (stepLabel) {
          criticalStepLabels.set(stepNodeId, stepLabel);
        }
      }

      for (const criticalStepNodeId of criticalStepNodeIds) {
        addLearningSupportHint(supportByNodeId, criticalStepNodeId, {
          kind: 'critical_step',
          sourceNodeId: node.id,
          sourceLabel: node.label,
          bonus: 3
        });
      }

      for (const prerequisiteNodeId of prerequisiteNodeIds) {
        addLearningSupportHint(supportByNodeId, prerequisiteNodeId, {
          kind: 'prerequisite',
          sourceNodeId: node.id,
          sourceLabel: node.label,
          bonus: 1.75
        });
      }
    }

    for (const node of input.failurePatternNodes.concat(input.successfulProcedureNodes, input.patternNodes)) {
      const sourceNodeIds = dedupeStrings(readPayloadStringArray(node.payload, 'sourceNodeIds'));
      const promotionState = readPayloadString(node.payload, 'promotionState');
      diagnostics.promotedPatterns?.push({
        nodeId: node.id,
        type: node.type as 'Pattern' | 'FailurePattern' | 'SuccessfulProcedure',
        label: node.label,
        scope: node.scope,
        ...(promotionState ? { promotionState } : {}),
        confidence: node.confidence,
        sourceNodeIds
      });

      if (node.type === 'FailurePattern') {
        for (const sourceNodeId of dedupeStrings(
          sourceNodeIds.concat(readPayloadStringArray(node.payload, 'blockedStepNodeIds'), readPayloadStringArray(node.payload, 'riskNodeIds'))
        )) {
          addLearningSupportHint(supportByNodeId, sourceNodeId, {
            kind: 'failure_pattern',
            sourceNodeId: node.id,
            sourceLabel: node.label,
            bonus: 2.2
          });
        }

        for (const label of readPayloadStringArray(node.payload, 'blockedStepLabels').concat(readPayloadStringArray(node.payload, 'riskLabels'))) {
          for (const candidateNode of candidateNodesByNormalizedLabel.get(normalizeLearningLabel(label)) ?? []) {
            addLearningSupportHint(supportByNodeId, candidateNode.id, {
              kind: 'failure_pattern',
              sourceNodeId: node.id,
              sourceLabel: node.label,
              bonus: 1.85
            });
          }
        }
        continue;
      }

      if (node.type === 'SuccessfulProcedure') {
        for (const stepNodeId of readPayloadStringArray(node.payload, 'stepNodeIds')) {
          addLearningSupportHint(supportByNodeId, stepNodeId, {
            kind: 'successful_procedure',
            sourceNodeId: node.id,
            sourceLabel: node.label,
            bonus: 2.6
          });
        }

        for (const prerequisiteNodeId of readPayloadStringArray(node.payload, 'prerequisiteNodeIds')) {
          addLearningSupportHint(supportByNodeId, prerequisiteNodeId, {
            kind: 'prerequisite',
            sourceNodeId: node.id,
            sourceLabel: node.label,
            bonus: 1.9
          });
        }

        for (const label of readPayloadStringArray(node.payload, 'stepLabels').concat(readPayloadStringArray(node.payload, 'prerequisiteLabels'))) {
          for (const candidateNode of candidateNodesByNormalizedLabel.get(normalizeLearningLabel(label)) ?? []) {
            addLearningSupportHint(supportByNodeId, candidateNode.id, {
              kind: 'successful_procedure',
              sourceNodeId: node.id,
              sourceLabel: node.label,
              bonus: 2.15
            });
          }
        }
      }
    }

    diagnostics.criticalStepNodeIds = dedupeStrings(
      input.attemptNodes
        .flatMap((node) => readPayloadStringArray(node.payload, 'criticalStepNodeIds'))
        .concat(input.procedureCandidateNodes.flatMap((node) => readPayloadStringArray(node.payload, 'criticalStepNodeIds')))
    );
    diagnostics.criticalStepLabels = diagnostics.criticalStepNodeIds.map(
      (nodeId) => criticalStepLabels.get(nodeId) ?? nodeId
    );

    const hasDiagnostics =
      diagnostics.attemptNodeIds.length > 0 ||
      diagnostics.episodeNodeIds.length > 0 ||
      diagnostics.successSignals.length > 0 ||
      diagnostics.criticalStepNodeIds.length > 0 ||
      diagnostics.failureSignals.length > 0 ||
      diagnostics.procedureCandidates.length > 0 ||
      (diagnostics.promotedPatterns?.length ?? 0) > 0;

    return {
      supportByNodeId,
      ...(hasDiagnostics ? { diagnostics } : {})
    };
  }

  private applyBudget(bundle: RuntimeContextBundle): RuntimeContextBundle {
    let used = 0;

    const nextBundle: RuntimeContextBundle = {
      ...bundle,
      goal: undefined,
      intent: undefined,
      currentProcess: undefined,
      activeRules: [],
      activeConstraints: [],
      recentDecisions: [],
      recentStateChanges: [],
      relevantEvidence: [],
      candidateSkills: [],
      openRisks: [],
      diagnostics: createEmptyDiagnostics()
    };

    if (bundle.goal) {
      used += bundle.goal.estimatedTokens;
      nextBundle.goal = bundle.goal;
      nextBundle.diagnostics?.fixed.selected.push(
        toSelectionDiagnostic(bundle.goal, 'selected as fixed goal context')
      );
    }

    if (bundle.intent) {
      used += bundle.intent.estimatedTokens;
      nextBundle.intent = bundle.intent;
      nextBundle.diagnostics?.fixed.selected.push(
        toSelectionDiagnostic(bundle.intent, 'selected as fixed intent context')
      );
    }

    if (bundle.currentProcess && used + bundle.currentProcess.estimatedTokens <= bundle.tokenBudget.total) {
      nextBundle.currentProcess = bundle.currentProcess;
      used += bundle.currentProcess.estimatedTokens;
      nextBundle.diagnostics?.fixed.selected.push(
        toSelectionDiagnostic(bundle.currentProcess, 'selected as fixed current process context')
      );
    } else if (bundle.currentProcess) {
      nextBundle.diagnostics?.fixed.skipped.push(
        toSelectionDiagnostic(bundle.currentProcess, 'skipped fixed current process because total budget was exhausted')
      );
    }

    const remainingBudget = Math.max(bundle.tokenBudget.total - used, 0);
    const budgetPools = allocateCategoryBudgets(remainingBudget);
    const diagnostics = nextBundle.diagnostics;

    if (diagnostics) {
      diagnostics.categoryBudgets = createCategoryBudgetMap(budgetPools);
    }

    const firstPassByCategory = {} as Record<RuntimeContextCategory, BudgetSelectionResult>;

    const categoryOrder: RuntimeContextCategory[] = [
      'activeRules',
      'activeConstraints',
      'openRisks',
      'recentDecisions',
      'recentStateChanges',
      'relevantEvidence',
      'candidateSkills'
    ];

    for (const category of categoryOrder) {
      const budgetKey = CATEGORY_TO_BUDGET_POOL[category];
      const result = takeArrayWithinCategoryBudget(bundle[category], bundle.tokenBudget.total, used, budgetPools[budgetKey]);
      nextBundle[category] = result.selected;
      used = result.used;
      firstPassByCategory[category] = result;
    }

    const refillResults = {} as Record<RuntimeContextCategory, BudgetSelectionResult>;

    for (const category of categoryOrder) {
      const firstPass = firstPassByCategory[category];
      const refill = takeArrayWithinCategoryBudget(
        firstPass.deferred.map((entry) => entry.item),
        bundle.tokenBudget.total,
        used,
        Number.POSITIVE_INFINITY,
        false
      );

      if (refill.selected.length > 0) {
        nextBundle[category] = nextBundle[category].concat(refill.selected);
        used = refill.used;
      }

      refillResults[category] = refill;
    }

    if (diagnostics) {
      diagnostics.categories = categoryOrder.map((category) =>
        buildCategoryDiagnostics(
          category,
          diagnostics.categoryBudgets[category],
          bundle[category],
          firstPassByCategory[category],
          refillResults[category]
        )
      );
    }

    nextBundle.tokenBudget = {
      total: bundle.tokenBudget.total,
      used,
      reserved: Math.max(bundle.tokenBudget.total - used, 0)
    };

    return nextBundle;
  }
}

function takeArrayWithinCategoryBudget(
  items: ContextSelection[],
  totalBudget: number,
  startingUsed: number,
  categoryBudget: number,
  allowSoftFirst = true
): BudgetSelectionResult {
  const selected: ContextSelection[] = [];
  const deferred: DeferredSelection[] = [];
  let used = startingUsed;
  let spent = 0;

  for (const item of items) {
    if (used + item.estimatedTokens > totalBudget) {
      deferred.push({
        item,
        reason: 'total_budget_exhausted'
      });
      continue;
    }

    const fitsCategory = spent + item.estimatedTokens <= categoryBudget;
    const canUseSoftFirst = allowSoftFirst && selected.length === 0;

    if (fitsCategory || canUseSoftFirst) {
      selected.push(item);
      used += item.estimatedTokens;
      spent += item.estimatedTokens;
      continue;
    }

    deferred.push({
      item,
      reason: 'category_budget_reserved'
    });
  }

  return {
    selected,
    deferred,
    used
  };
}

function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function strengthScore(strength: KnowledgeStrength): number {
  switch (strength) {
    case 'hard':
      return 4;
    case 'soft':
      return 2;
    case 'heuristic':
    default:
      return 1;
  }
}

function provenanceScore(originKind: ProvenanceOriginKind | undefined): number {
  switch (originKind) {
    case 'raw':
      return 3;
    case 'compressed':
      return 1;
    case 'derived':
      return 0.5;
    default:
      return 2;
  }
}

function allocateCategoryBudgets(totalBudget: number): CategoryBudgetPools {
  return {
    rules: Math.floor(totalBudget * CATEGORY_BUDGET_RATIOS.rules),
    constraints: Math.floor(totalBudget * CATEGORY_BUDGET_RATIOS.constraints),
    risks: Math.floor(totalBudget * CATEGORY_BUDGET_RATIOS.risks),
    decisions: Math.floor(totalBudget * CATEGORY_BUDGET_RATIOS.decisions),
    states: Math.floor(totalBudget * CATEGORY_BUDGET_RATIOS.states),
    evidence: Math.floor(totalBudget * CATEGORY_BUDGET_RATIOS.evidence),
    skills: Math.floor(totalBudget * CATEGORY_BUDGET_RATIOS.skills)
  };
}

function createEmptyDiagnostics(): RuntimeContextDiagnostics {
  return {
    fixed: {
      selected: [],
      skipped: []
    },
    categoryBudgets: {
      activeRules: 0,
      activeConstraints: 0,
      openRisks: 0,
      recentDecisions: 0,
      recentStateChanges: 0,
      relevantEvidence: 0,
      candidateSkills: 0
    },
    categories: [],
    topicHints: [],
    topicAdmissions: []
  };
}

function createCategoryBudgetMap(budgets: CategoryBudgetPools): Record<RuntimeContextCategory, number> {
  return {
    activeRules: budgets.rules,
    activeConstraints: budgets.constraints,
    openRisks: budgets.risks,
    recentDecisions: budgets.decisions,
    recentStateChanges: budgets.states,
    relevantEvidence: budgets.evidence,
    candidateSkills: budgets.skills
  };
}

function buildCategoryDiagnostics(
  category: RuntimeContextCategory,
  allocatedBudget: number,
  inputItems: ContextSelection[],
  firstPass: BudgetSelectionResult,
  refill: BudgetSelectionResult
) {
  const selected = firstPass.selected
    .map((item) => toSelectionDiagnostic(item, `selected within category budget; ${item.reason}`))
    .concat(
      refill.selected.map((item) =>
        toSelectionDiagnostic(item, `selected during refill after higher-priority categories; ${item.reason}`)
      )
    );

  const initialDeferredReasons = new Map(firstPass.deferred.map((entry) => [entry.item.nodeId, entry.reason]));
  const skipped = refill.deferred.map((entry) => {
    const initialReason = initialDeferredReasons.get(entry.item.nodeId);

    if (initialReason === 'category_budget_reserved') {
      return toSelectionDiagnostic(
        entry.item,
        'held back by category budget and still skipped because total budget was exhausted'
      );
    }

    return toSelectionDiagnostic(entry.item, describeDeferredReason(entry.reason));
  });

  return {
    category,
    allocatedBudget,
    inputCount: inputItems.length,
    selectedCount: selected.length,
    skippedCount: skipped.length,
    selectedTokens: sumEstimatedTokens(selected),
    refillSelectedCount: refill.selected.length,
    selected,
    skipped
  };
}

function toSelectionDiagnostic(item: ContextSelection, reason: string): ContextSelectionDiagnostic {
  return {
    nodeId: item.nodeId,
    type: item.type,
    label: item.label,
    estimatedTokens: item.estimatedTokens,
    provenance: item.provenance,
    governance: item.governance,
    reason,
    ...(item.primaryRecallKind ? { primaryRecallKind: item.primaryRecallKind } : {}),
    ...(item.recallKinds?.length ? { recallKinds: [...item.recallKinds] } : {})
  };
}

function describeDeferredReason(reason: DeferredSelectionReason): string {
  return reason === 'category_budget_reserved'
    ? 'skipped because the category budget was reserved for higher-priority items'
    : 'skipped because total budget was exhausted';
}

function sumEstimatedTokens(items: Array<Pick<ContextSelectionDiagnostic, 'estimatedTokens'>>): number {
  return items.reduce((total, item) => total + item.estimatedTokens, 0);
}

function preferPrimaryNodes(primary: GraphNode[], fallback: GraphNode[]): GraphNode[] {
  return primary.length > 0 ? primary : fallback;
}

function mergePrimaryThenSecondary(
  primary: GraphNode[],
  secondary: GraphNode[],
  fallback: GraphNode[],
  limit: number
): GraphNode[] {
  const merged = dedupeNodes(primary.concat(secondary));
  if (merged.length > 0) {
    return merged.slice(0, limit);
  }

  return dedupeNodes(fallback).slice(0, limit);
}

function dedupeNodes(nodes: GraphNode[]): GraphNode[] {
  const seen = new Set<string>();
  const deduped: GraphNode[] = [];

  for (const node of nodes) {
    if (seen.has(node.id)) {
      continue;
    }

    seen.add(node.id);
    deduped.push(node);
  }

  return deduped;
}

function dedupeSelections(items: ContextSelection[]): ContextSelection[] {
  const seen = new Set<string>();
  const deduped: ContextSelection[] = [];

  for (const item of items) {
    if (seen.has(item.nodeId)) {
      continue;
    }

    seen.add(item.nodeId);
    deduped.push(item);
  }

  return deduped;
}

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function dedupeSlots(slots: RuntimeContextSelectionSlot[]): RuntimeContextSelectionSlot[] {
  return [...new Set(slots)];
}

function dedupeEdgeTypes(edgeTypes: EdgeType[]): EdgeType[] {
  return [...new Set(edgeTypes)];
}

function buildCandidateNodesByNormalizedLabel(nodes: GraphNode[]): Map<string, GraphNode[]> {
  const byLabel = new Map<string, GraphNode[]>();

  for (const node of nodes) {
    const normalizedLabel = normalizeLearningLabel(node.label);

    if (!normalizedLabel) {
      continue;
    }

    const existing = byLabel.get(normalizedLabel) ?? [];
    existing.push(node);
    byLabel.set(normalizedLabel, existing);
  }

  return byLabel;
}

function normalizeLearningLabel(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function emptyRelationRecallResult(): RelationRecallResult {
  return {
    supportByNodeId: new Map<string, RelationRecallSupport>(),
    diagnostics: {
      strategy: 'no_relation_sources',
      sourceCount: 0,
      sourceSlots: [],
      edgeTypes: [],
      edgeLookupCount: 0,
      nodeLookupCount: 0,
      scannedEdgeCount: 0,
      eligibleEdgeCount: 0,
      relatedNodeCount: 0,
      maxHopCount: 0,
      pathBudget: 0,
      maxPathsPerTarget: 0,
      candidatePathCount: 0,
      admittedPathCount: 0,
      pathCount: 0,
      prunedPathCount: 0,
      prunedByBudgetCount: 0,
      prunedByTargetCount: 0,
      fallbackReason: 'no relation-qualified selections were available for recall expansion'
    }
  };
}

function resolveRelationRecallPolicy(
  requestPolicy: Partial<RelationRecallPolicy> | undefined,
  options: RelationRecallBuildOptions
): ResolvedRelationRecallPolicy {
  const allowedSecondHopEdgeTypes = dedupeEdgeTypes(options.secondHopEdgeTypes ?? []);
  const requestedSecondHopEdgeTypes = requestPolicy?.secondHopEdgeTypes
    ? dedupeEdgeTypes(requestPolicy.secondHopEdgeTypes).filter((edgeType) => allowedSecondHopEdgeTypes.includes(edgeType))
    : allowedSecondHopEdgeTypes;
  const optionMaxHops = options.maxHops ?? 1;
  const requestedMaxHops = requestPolicy?.maxHops ?? optionMaxHops;
  const maxHops =
    optionMaxHops === 2 && requestedMaxHops === 2 && requestedSecondHopEdgeTypes.length > 0 ? 2 : 1;

  return {
    edgeTypes: dedupeEdgeTypes(options.edgeTypes),
    targetTypes: options.targetTypes,
    maxHops,
    secondHopEdgeTypes: maxHops === 2 ? requestedSecondHopEdgeTypes : [],
    pathBudget: requestPolicy?.pathBudget ?? options.pathBudget ?? options.maxPaths ?? DEFAULT_RELATION_PATH_BUDGET,
    maxPathsPerTarget:
      requestPolicy?.maxPathsPerTarget ?? options.maxPathsPerTarget ?? DEFAULT_RELATION_MAX_PATHS_PER_TARGET,
    maxPathsPerSource:
      requestPolicy?.maxPathsPerSource ?? options.maxPathsPerSource ?? DEFAULT_RELATION_MAX_PATHS_PER_SOURCE,
    maxExpandedTargets:
      requestPolicy?.maxExpandedTargets ?? options.maxExpandedTargets ?? DEFAULT_RELATION_MAX_EXPANDED_TARGETS,
    minPathBonus: requestPolicy?.minPathBonus ?? options.minPathBonus ?? DEFAULT_RELATION_MIN_PATH_BONUS,
    rankingMode: requestPolicy?.rankingMode ?? options.rankingMode ?? DEFAULT_RELATION_RANKING_MODE
  };
}

function scoreRelationRecallPath(
  sourceMatch: {
    source: {
      slot: RuntimeContextSelectionSlot;
      selection: ContextSelection;
    };
    intermediateNode: GraphNode;
    firstHopEdge: GraphEdge;
    firstHopBonus: number;
  },
  secondHopEdge: GraphEdge,
  secondHopBonus: number,
  targetNode: GraphNode
): number {
  const firstEdgeConfidence = Number.isFinite(sourceMatch.firstHopEdge.confidence) ? sourceMatch.firstHopEdge.confidence : 0;
  const secondEdgeConfidence = Number.isFinite(secondHopEdge.confidence) ? secondHopEdge.confidence : 0;
  const intermediateConfidence = Number.isFinite(sourceMatch.intermediateNode.confidence)
    ? sourceMatch.intermediateNode.confidence
    : 0;
  const targetConfidence = Number.isFinite(targetNode.confidence) ? targetNode.confidence : 0;
  const edgeConfidenceBonus = ((firstEdgeConfidence + secondEdgeConfidence) / 2) * 0.9;
  const nodeConfidenceBonus = ((intermediateConfidence + targetConfidence) / 2) * 0.75;

  return sourceMatch.firstHopBonus + secondHopBonus * 0.75 + edgeConfidenceBonus + nodeConfidenceBonus;
}

function compareRelationPathCandidates(
  left: RelationRecallPath,
  right: RelationRecallPath,
  rankingMode: RelationRecallRankingMode
): number {
  if (rankingMode === 'hops_then_bonus') {
    const hopDelta = left.hopCount - right.hopCount;

    if (hopDelta !== 0) {
      return hopDelta;
    }
  }

  const bonusDelta = right.bonus - left.bonus;

  if (bonusDelta !== 0) {
    return bonusDelta;
  }

  const hopDelta = left.hopCount - right.hopCount;

  if (hopDelta !== 0) {
    return hopDelta;
  }

  return left.targetNodeId.localeCompare(right.targetNodeId);
}

function formatPathDecisionSample(
  state: 'selected' | 'pruned',
  sourceLabel: string,
  targetLabel: string,
  edgeTypes: EdgeType[],
  bonus: number,
  detail: string
): string {
  return `${state} ${edgeTypes.join('->')} ${truncateSelectionLabel(sourceLabel, 48)} -> ${truncateSelectionLabel(targetLabel, 48)} score=${bonus.toFixed(2)} (${detail})`;
}

function pushDecisionSample(target: string[], sample: string, limit = 4): void {
  if (target.length >= limit) {
    return;
  }

  target.push(sample);
}

function addRelationRecallSupport(
  supportByNodeId: Map<string, RelationRecallSupport>,
  nodeId: string,
  hint: RelationRecallHint,
  paths: RelationRecallPath[]
): void {
  const existing = supportByNodeId.get(nodeId);

  if (!existing) {
    supportByNodeId.set(nodeId, {
      totalBonus: hint.bonus,
      hints: [hint],
      paths: [...paths]
    });
    return;
  }

  if (!existing.hints.some((item) => item.sourceNodeId === hint.sourceNodeId && item.edgeType === hint.edgeType)) {
    existing.hints.push(hint);
  }

  for (const path of paths) {
    const key = `${path.sourceNodeId}|${path.targetNodeId}|${path.hops.map((hop) => `${hop.edgeType}:${hop.fromNodeId}->${hop.toNodeId}`).join('|')}`;

    if (
      existing.paths.some(
        (item) =>
          `${item.sourceNodeId}|${item.targetNodeId}|${item.hops
            .map((hop) => `${hop.edgeType}:${hop.fromNodeId}->${hop.toNodeId}`)
            .join('|')}` === key
      )
    ) {
      continue;
    }

    existing.paths.push(path);
  }

  existing.hints.sort((left, right) => right.bonus - left.bonus);
  existing.paths.sort((left, right) => right.bonus - left.bonus);
  existing.totalBonus = existing.hints.reduce((total, item) => total + item.bonus, 0);
}

function mergeRelationSupportMaps(
  ...maps: Array<Map<string, RelationRecallSupport>>
): Map<string, RelationRecallSupport> {
  const merged = new Map<string, RelationRecallSupport>();

  for (const supportMap of maps) {
    for (const [nodeId, support] of supportMap.entries()) {
      const existing = merged.get(nodeId);

      if (!existing) {
        merged.set(nodeId, {
          totalBonus: support.totalBonus,
          hints: [...support.hints],
          paths: [...support.paths]
        });
        continue;
      }

      for (const hint of support.hints) {
        addRelationRecallSupport(merged, nodeId, hint, support.paths.filter((path) => path.sourceNodeId === hint.sourceNodeId));
      }
    }
  }

  return merged;
}

function mergeRelationRetrievalDiagnostics(
  diagnosticsList: RelationRetrievalDiagnostics[]
): RelationRetrievalDiagnostics {
  const populated = diagnosticsList.filter((item) => item.eligibleEdgeCount > 0 || item.relatedNodeCount > 0);

  if (populated.length === 0) {
    return emptyRelationRecallResult().diagnostics;
  }

  return {
    strategy: populated.some((item) => item.strategy === 'batch_adjacency')
      ? 'batch_adjacency'
      : populated.some((item) => item.strategy === 'single_source_fallback')
        ? 'single_source_fallback'
        : populated[0]?.strategy ?? 'no_relation_sources',
    sourceCount: populated.reduce((total, item) => total + item.sourceCount, 0),
    sourceSlots: dedupeSlots(populated.flatMap((item) => item.sourceSlots)),
    edgeTypes: dedupeEdgeTypes(populated.flatMap((item) => item.edgeTypes)),
    edgeLookupCount: populated.reduce((total, item) => total + item.edgeLookupCount, 0),
    nodeLookupCount: populated.reduce((total, item) => total + item.nodeLookupCount, 0),
    scannedEdgeCount: populated.reduce((total, item) => total + item.scannedEdgeCount, 0),
    eligibleEdgeCount: populated.reduce((total, item) => total + item.eligibleEdgeCount, 0),
    relatedNodeCount: populated.reduce((total, item) => total + item.relatedNodeCount, 0),
    maxHopCount: Math.max(...populated.map((item) => item.maxHopCount ?? 1)),
    pathBudget: Math.max(...populated.map((item) => item.pathBudget ?? 0)),
    maxPathsPerTarget: Math.max(...populated.map((item) => item.maxPathsPerTarget ?? 0)),
    maxPathsPerSource: Math.max(...populated.map((item) => item.maxPathsPerSource ?? 0)),
    maxExpandedTargets: Math.max(...populated.map((item) => item.maxExpandedTargets ?? 0)),
    minPathBonus: Math.max(...populated.map((item) => item.minPathBonus ?? 0)),
    rankingMode: populated.find((item) => item.rankingMode)?.rankingMode,
    candidatePathCount: populated.reduce((total, item) => total + (item.candidatePathCount ?? 0), 0),
    admittedPathCount: populated.reduce((total, item) => total + (item.admittedPathCount ?? 0), 0),
    pathCount: populated.reduce((total, item) => total + (item.pathCount ?? 0), 0),
    prunedPathCount: populated.reduce((total, item) => total + (item.prunedPathCount ?? 0), 0),
    prunedByBudgetCount: populated.reduce((total, item) => total + (item.prunedByBudgetCount ?? 0), 0),
    prunedByTargetCount: populated.reduce((total, item) => total + (item.prunedByTargetCount ?? 0), 0),
    prunedBySourceCount: populated.reduce((total, item) => total + (item.prunedBySourceCount ?? 0), 0),
    prunedByExpansionCount: populated.reduce((total, item) => total + (item.prunedByExpansionCount ?? 0), 0),
    prunedByScoreCount: populated.reduce((total, item) => total + (item.prunedByScoreCount ?? 0), 0),
    pathBudgetExhausted: populated.some((item) => item.pathBudgetExhausted === true),
    selectedPathSamples: populated.flatMap((item) => item.selectedPathSamples ?? []).slice(0, 4),
    prunedPathSamples: populated.flatMap((item) => item.prunedPathSamples ?? []).slice(0, 4),
    fallbackReason: populated
      .map((item) => item.fallbackReason)
      .filter((value): value is string => Boolean(value))
      .join(' | ') || undefined
  };
}

function addLearningSupportHint(
  supportByNodeId: Map<string, LearningRecallSupport>,
  nodeId: string,
  hint: LearningRecallHint
): void {
  const existing = supportByNodeId.get(nodeId);

  if (!existing) {
    supportByNodeId.set(nodeId, {
      totalBonus: hint.bonus,
      hints: [hint]
    });
    return;
  }

  if (existing.hints.some((item) => item.sourceNodeId === hint.sourceNodeId && item.kind === hint.kind)) {
    return;
  }

  existing.hints.push(hint);
  existing.hints.sort((left, right) => right.bonus - left.bonus);
  existing.totalBonus = existing.hints.reduce((total, item) => total + item.bonus, 0);
}

function semanticExtractionScore(node: GraphNode): number {
  const metadata = readPayloadMetadata(node.payload);
  const semanticSpanId = readPayloadString(metadata, 'semanticSpanId');
  const conceptIds = readPayloadStringArray(metadata, 'conceptIds');
  let score = 0;

  if (semanticSpanId) {
    score += 1.25;
  }

  if (conceptIds.length > 0) {
    score += 0.75;
  }

  if (
    semanticSpanId &&
    (node.type === 'Goal' || node.type === 'Constraint' || node.type === 'Risk' || node.type === 'Topic' || node.type === 'Concept')
  ) {
    score += 0.5;
  }

  return score;
}

function appendSelectionReason(
  reason: string,
  provenance: ProvenanceRef | undefined,
  governance: NodeGovernance
): string {
  const readiness = `${governance.promptReadiness.preferredForm}/${governance.promptReadiness.selectionPriority}/${governance.promptReadiness.budgetClass}`;

  if (!provenance) {
    return `${reason} (source unknown, readiness:${readiness})`;
  }

  const stage = provenance.sourceStage;

  switch (provenance.originKind) {
    case 'raw':
      return `${reason} (raw:${stage}, readiness:${readiness})`;
    case 'compressed':
      return `${reason} (compressed fallback:${stage}, readiness:${readiness})`;
    case 'derived':
      return `${reason} (derived fallback:${stage}, readiness:${readiness})`;
    default:
      return `${reason} (${stage}, readiness:${readiness})`;
  }
}

function describeRelationRecallSupport(relationSupport: RelationRecallSupport | undefined): string {
  if (!relationSupport || relationSupport.hints.length === 0) {
    return '';
  }

  const [primaryPath] = relationSupport.paths;
  const [primary] = relationSupport.hints;

  if (!primary) {
    return '';
  }

  const additionalCount = relationSupport.hints.length - 1;
  const additionalText = additionalCount > 0 ? ` +${additionalCount} more relation` : '';

  if (primaryPath && primaryPath.hopCount > 1) {
    return ` via ${primaryPath.hops.map((hop) => hop.edgeType).join('->')} from ${primary.sourceSlot}:${truncateSelectionLabel(primary.sourceLabel, 72)}${additionalText}`;
  }

  return ` via ${primary.edgeType} from ${primary.sourceSlot}:${truncateSelectionLabel(primary.sourceLabel, 72)}${additionalText}`;
}

function describeLearningRecallSupport(learningSupport: LearningRecallSupport | undefined): string {
  if (!learningSupport || learningSupport.hints.length === 0) {
    return '';
  }

  const [primary] = learningSupport.hints;

  if (!primary) {
    return '';
  }

  const additionalCount = learningSupport.hints.length - 1;
  const additionalText = additionalCount > 0 ? ` +${additionalCount} more learning signal` : '';

  return ` via learning:${primary.kind} from ${truncateSelectionLabel(primary.sourceLabel, 72)}${additionalText}`;
}

function collectRecallKinds(
  node: GraphNode,
  query: string,
  relationSupport?: RelationRecallSupport,
  learningSupport?: LearningRecallSupport
): ContextRecallKind[] {
  const kinds = new Set<ContextRecallKind>();
  const labelMatch = analyzeTextMatch(node.label, query);
  const payloadMatch = analyzeTextMatch(JSON.stringify(node.payload), query);

  if (
    labelMatch.exactPhrase ||
    payloadMatch.exactPhrase ||
    labelMatch.matchedTerms.length > 0 ||
    payloadMatch.matchedTerms.length > 0
  ) {
    kinds.add('direct_text');
  }

  if (relationSupport?.hints.length) {
    kinds.add('relation_graph');
  }

  if (learningSupport?.hints.length) {
    kinds.add('learning_graph');
  }

  if (kinds.size === 0) {
    kinds.add('direct_text');
  }

  return [...kinds];
}

function resolvePrimaryRecallKind(recallKinds: ContextRecallKind[]): ContextRecallKind | undefined {
  if (recallKinds.includes('relation_graph')) {
    return 'relation_graph';
  }

  if (recallKinds.includes('learning_graph')) {
    return 'learning_graph';
  }

  if (recallKinds.includes('direct_text')) {
    return 'direct_text';
  }

  return undefined;
}

function failureSignalSeverityBonus(severity: FailureSignalSeverity): number {
  switch (severity) {
    case 'high':
      return 2.5;
    case 'medium':
      return 2;
    case 'low':
    default:
      return 1.5;
  }
}

function procedureCandidateBonus(status: 'candidate' | 'validated', confidence: number): number {
  const base = status === 'validated' ? 2.75 : 2.1;
  return base + Math.min(0.5, confidence * 0.5);
}

function truncateSelectionLabel(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(maxLength - 3, 1))}...`;
}

function matchesCompileScope(
  node: GraphNode,
  request: Pick<CompileContextRequest, 'sessionId' | 'workspaceId'>
): boolean {
  const admission = assessHigherScopeRecallAdmission(node);

  if (!admission.admitted) {
    return false;
  }

  if (node.scope === 'session') {
    return readPayloadString(node.payload, 'sessionId') === request.sessionId;
  }

  if (node.scope === 'workspace') {
    return Boolean(request.workspaceId) && readPayloadString(node.payload, 'workspaceId') === request.workspaceId;
  }

  return true;
}

function matchesSupplementalNodeFilter(
  node: GraphNode,
  request: Pick<CompileContextRequest, 'sessionId' | 'workspaceId'>,
  filter: GraphNodeFilter
): boolean {
  if (filter.types && !filter.types.includes(node.type)) {
    return false;
  }

  if (filter.scopes && !filter.scopes.includes(node.scope)) {
    return false;
  }

  if (filter.freshness && !filter.freshness.includes(node.freshness)) {
    return false;
  }

  if (filter.originKinds && !filter.originKinds.includes(node.provenance?.originKind ?? 'raw')) {
    return false;
  }

  if (filter.sessionId && readPayloadString(node.payload, 'sessionId') !== filter.sessionId) {
    return false;
  }

  if (filter.workspaceId && readPayloadString(node.payload, 'workspaceId') !== filter.workspaceId) {
    return false;
  }

  if (filter.text) {
    const payload = JSON.stringify(node.payload);

    if (!matchesTextFilter(node.label, filter.text) && !matchesTextFilter(payload, filter.text)) {
      return false;
    }
  }

  return matchesCompileScope(node, request);
}

function readPayloadString(payload: GraphNode['payload'] | Record<string, unknown> | undefined, key: string): string | undefined {
  const value = payload?.[key];
  return typeof value === 'string' ? value : undefined;
}

function readPayloadStringArray(payload: GraphNode['payload'] | Record<string, unknown> | undefined, key: string): string[] {
  const value = payload?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function readPayloadMetadata(payload: GraphNode['payload']): Record<string, unknown> | undefined {
  const value = payload.metadata;
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function readPayloadNumber(payload: GraphNode['payload'], key: string): number | undefined {
  const value = payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readFailureSignalSeverity(payload: GraphNode['payload']): FailureSignalSeverity {
  const value = payload.severity;
  return value === 'high' || value === 'medium' ? value : 'low';
}

function readProcedureCandidateStatus(payload: GraphNode['payload']): 'candidate' | 'validated' {
  return payload.status === 'validated' ? 'validated' : 'candidate';
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}
