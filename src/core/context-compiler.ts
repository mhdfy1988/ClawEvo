import { randomUUID } from 'node:crypto';

import type {
  ContextSelection,
  ContextSelectionDiagnostic,
  EdgeType,
  GraphNode,
  KnowledgeStrength,
  NodeGovernance,
  ProvenanceOriginKind,
  ProvenanceRef,
  RelationRetrievalDiagnostics,
  RelationRetrievalStrategy,
  RuntimeContextCategory,
  RuntimeContextDiagnostics,
  RuntimeContextBundle,
  RuntimeContextSelectionSlot
} from '../types/core.js';
import type { CompileContextRequest, GraphNodeFilter } from '../types/io.js';
import type { GraphStore } from './graph-store.js';
import { isSuppressedByConflict, normalizeNodeGovernance, promptReadinessScore, validityScore } from './governance.js';
import { getRelationRecallPriority, isRecallEligibleEdge } from './relation-contract.js';
import { describeScopeSelectionReason, scopePolicyScore } from './scope-policy.js';
import { scoreTextMatch } from './text-search.js';

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
}

interface RelationRecallResult {
  supportByNodeId: Map<string, RelationRecallSupport>;
  diagnostics: RelationRetrievalDiagnostics;
}

interface RelationRecallBuildOptions {
  targetTypes: Array<GraphNode['type']>;
  edgeTypes: EdgeType[];
  supportSourceNodes?: boolean;
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
      topicNodes
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

    const goal = this.pickBest(selectedGoals, request.query, 'current goal match');
    const intent = this.pickBest(selectedIntents, request.query, 'current intent match');
    const provisionalCurrentProcess =
      this.pickBest(selectedSteps, request.query, 'current process step') ??
      this.pickBest(selectedProcesses, request.query, 'current process');
    const nextStepSupport = await this.buildRelationAwareNodeSupport(
      request,
      provisionalCurrentProcess ? [{ slot: 'currentProcess', selection: provisionalCurrentProcess }] : [],
      {
        targetTypes: ['Step', 'Process'],
        edgeTypes: ['next_step']
      }
    );
    const currentProcess =
      this.pickBest(selectedSteps, request.query, 'current process step', nextStepSupport.supportByNodeId) ??
      this.pickBest(selectedProcesses, request.query, 'current process', nextStepSupport.supportByNodeId);
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
      requiresSupport.supportByNodeId
    );
    const initialConstraints = this.selectNodes(
      dedupeNodes(selectedModes.concat(selectedConstraints)),
      request.query,
      DEFAULT_CATEGORY_LIMITS.constraints,
      'active constraint',
      requiresSupport.supportByNodeId
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
      combinedRuleSupport
    );
    const activeConstraints = this.selectNodes(
      dedupeNodes(selectedModes.concat(selectedConstraints)),
      request.query,
      DEFAULT_CATEGORY_LIMITS.constraints,
      'active constraint',
      combinedRuleSupport
    );
    const recentDecisions = this.selectNodes(
      selectedDecisions,
      request.query,
      DEFAULT_CATEGORY_LIMITS.decisions,
      'recent decision'
    );
      const recentStateChanges = this.selectNodes(
        selectedStates,
        request.query,
        DEFAULT_CATEGORY_LIMITS.states,
        'recent state'
      );
      const inferredOpenRisks = dedupeSelections(
        activeConstraints.concat(recentStateChanges).filter((item) => /risk|block|conflict|constraint|forbid|warning/i.test(item.label))
      );
      const selectedOpenRisks = dedupeSelections(
        this.selectNodes(selectedRisks, request.query, DEFAULT_CATEGORY_LIMITS.risks, 'open risk').concat(inferredOpenRisks)
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
      const topicHints = this.selectNodes(topicNodes, request.query, 4, 'topic-aware recall hint');

    const bundle = this.applyBudget({
      id: randomUUID(),
      sessionId: request.sessionId,
      query: request.query,
      goal,
      intent,
      activeRules,
      activeConstraints,
      currentProcess,
      recentDecisions,
      recentStateChanges,
      relevantEvidence,
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
      bundle.diagnostics.topicHints = topicHints.map((item) =>
        toSelectionDiagnostic(item, 'reserved as a topic-aware recall hint; not yet admitted into the primary runtime bundle')
      );
      bundle.diagnostics.relationRetrieval = mergeRelationRetrievalDiagnostics([
        nextStepSupport.diagnostics,
        requiresSupport.diagnostics,
        overrideSupport.diagnostics,
        relationAwareEvidence.diagnostics
      ]);
    }

    return bundle;
  }

  private async queryNodesForScopeHierarchy(
    request: CompileContextRequest,
    filter: GraphNodeFilter
  ): Promise<GraphNode[]> {
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

    return dedupeNodes(sessionNodes.concat(workspaceNodes, globalNodes));
  }

  private pickBest(
    nodes: GraphNode[],
    query: string,
    reason: string,
    relationSupport?: Map<string, RelationRecallSupport>
  ): ContextSelection | undefined {
    const ranked = this.rankNodes(nodes, query, relationSupport);
    const [best] = ranked;
    return best ? this.toSelection(best, reason, relationSupport?.get(best.id), ranked) : undefined;
  }

  private selectNodes(
    nodes: GraphNode[],
    query: string,
    limit: number,
    reason: string,
    relationSupport?: Map<string, RelationRecallSupport>
  ): ContextSelection[] {
    const ranked = this.rankNodes(nodes, query, relationSupport);

    return ranked
      .slice(0, limit)
      .map((node) => this.toSelection(node, reason, relationSupport?.get(node.id), ranked));
  }

  private rankNodes(
    nodes: GraphNode[],
    query: string,
    relationSupport?: Map<string, RelationRecallSupport>
  ): GraphNode[] {
    return [...nodes]
      .filter((node) => {
        const governance = normalizeNodeGovernance(node);
        return governance.promptReadiness.eligible && !isSuppressedByConflict(governance);
      })
      .sort((left, right) => {
      const leftGovernance = normalizeNodeGovernance(left);
      const rightGovernance = normalizeNodeGovernance(right);
      const scopeDelta = scopePolicyScore(rightGovernance) - scopePolicyScore(leftGovernance);

      if (scopeDelta !== 0) {
        return scopeDelta;
      }

      const scoreDelta =
        this.scoreNode(right, query, relationSupport?.get(right.id)) -
        this.scoreNode(left, query, relationSupport?.get(left.id));

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

  private scoreNode(node: GraphNode, query: string, relationSupport?: RelationRecallSupport): number {
    const governance = normalizeNodeGovernance(node);
    let score = 0;

    score += strengthScore(node.strength);
    score += provenanceScore(governance.knowledgeState);
    score += promptReadinessScore(governance);
    score += validityScore(governance);
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
    score += governance.validity.confidence;
    return score;
  }

  private toSelection(
    node: GraphNode,
    reason: string,
    relationSupport?: RelationRecallSupport,
    rankedNodes: GraphNode[] = [node]
  ): ContextSelection {
    const governance = normalizeNodeGovernance(node);
    const relationReason = describeRelationRecallSupport(relationSupport);
    const scopeReason = describeScopeSelectionReason(node, rankedNodes);

    return {
      nodeId: node.id,
      type: node.type,
      label: node.label,
      scope: node.scope,
      kind: node.kind,
      strength: node.strength,
      reason: appendSelectionReason(`${reason}${relationReason}${scopeReason}`, node.provenance, governance),
      estimatedTokens: estimateTextTokens(node.label) + estimateTextTokens(JSON.stringify(node.payload)),
      sourceRef: node.sourceRef,
      provenance: node.provenance,
      governance
    };
  }

  private async buildRelationAwareEvidenceSupport(
    request: Pick<CompileContextRequest, 'sessionId' | 'workspaceId'>,
    sources: Array<{
      slot: RuntimeContextSelectionSlot;
      selection: ContextSelection;
    }>
  ): Promise<RelationRecallResult> {
    return this.buildRelationAwareNodeSupport(request, sources, {
      targetTypes: ['Evidence'],
      edgeTypes: ['supported_by']
    });
  }

  private async buildRelationAwareNodeSupport(
    request: Pick<CompileContextRequest, 'sessionId' | 'workspaceId'>,
    sources: Array<{
      slot: RuntimeContextSelectionSlot;
      selection: ContextSelection;
    }>,
    options: RelationRecallBuildOptions
  ): Promise<RelationRecallResult> {
    if (sources.length === 0) {
      return emptyRelationRecallResult();
    }

    const supportByNodeId = new Map<string, RelationRecallSupport>();
    const sourceByNodeId = new Map(sources.map((item) => [item.selection.nodeId, item]));
    const sourceIds = sources.map((item) => item.selection.nodeId);
    const strategy: RelationRetrievalStrategy = sources.length > 1 ? 'batch_adjacency' : 'single_source_fallback';
    const fallbackReason =
      strategy === 'single_source_fallback'
        ? 'only one relation source was available, so compiler used the single-node adjacency fallback'
        : undefined;
    const edges =
      strategy === 'batch_adjacency'
        ? await this.graphStore.getEdgesForNodes(sourceIds)
        : await this.graphStore.getEdgesForNode(sourceIds[0] as string);
    const eligibleEdges = edges.filter(
      (edge) => isRecallEligibleEdge(edge) && options.edgeTypes.includes(edge.type)
    );
    const relatedNodeIds = dedupeIds(
      eligibleEdges.flatMap((edge) => {
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

      relatedNodeById.set(relatedNode.id, relatedNode);
    }

    for (const edge of eligibleEdges) {
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

        const targetNode = match.targetNodeId === match.source.selection.nodeId
          ? undefined
          : relatedNodeById.get(match.targetNodeId);
        const candidateNode =
          options.supportSourceNodes && match.targetNodeId === match.source.selection.nodeId
            ? undefined
            : targetNode;

        if (options.supportSourceNodes !== true) {
          if (!candidateNode || !options.targetTypes.includes(candidateNode.type)) {
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
        const hint: RelationRecallHint = {
          edgeType: edge.type,
          sourceSlot: match.source.slot,
          sourceNodeId: match.source.selection.nodeId,
          sourceLabel: match.source.selection.label,
          bonus: slotBonus + edgeBonus
        };
        const existing = supportByNodeId.get(supportNodeId);

        if (!existing) {
          supportByNodeId.set(supportNodeId, {
            totalBonus: hint.bonus,
            hints: [hint]
          });
          continue;
        }

        if (existing.hints.some((item) => item.sourceNodeId === hint.sourceNodeId && item.edgeType === hint.edgeType)) {
          continue;
        }

        existing.hints.push(hint);
        existing.hints.sort((left, right) => right.bonus - left.bonus);
        existing.totalBonus = existing.hints.reduce((total, item) => total + item.bonus, 0);
      }
    }

    return {
      supportByNodeId,
      diagnostics: {
        strategy,
        sourceCount: sources.length,
        sourceSlots: dedupeSlots(sources.map((item) => item.slot)),
        edgeTypes: dedupeEdgeTypes(options.edgeTypes),
        edgeLookupCount: 1,
        nodeLookupCount: relatedNodeIds.length === 0 ? 0 : 1,
        scannedEdgeCount: edges.length,
        eligibleEdgeCount: eligibleEdges.length,
        relatedNodeCount: options.supportSourceNodes === true ? supportByNodeId.size : relatedNodeById.size,
        ...(fallbackReason ? { fallbackReason } : {})
      }
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
    topicHints: []
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
    reason
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
      fallbackReason: 'no relation-qualified selections were available for recall expansion'
    }
  };
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
          hints: [...support.hints]
        });
        continue;
      }

      for (const hint of support.hints) {
        if (existing.hints.some((item) => item.sourceNodeId === hint.sourceNodeId && item.edgeType === hint.edgeType)) {
          continue;
        }

        existing.hints.push(hint);
      }

      existing.hints.sort((left, right) => right.bonus - left.bonus);
      existing.totalBonus = existing.hints.reduce((total, item) => total + item.bonus, 0);
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
    fallbackReason: populated
      .map((item) => item.fallbackReason)
      .filter((value): value is string => Boolean(value))
      .join(' | ') || undefined
  };
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

  const [primary] = relationSupport.hints;

  if (!primary) {
    return '';
  }

  const additionalCount = relationSupport.hints.length - 1;
  const additionalText = additionalCount > 0 ? ` +${additionalCount} more relation` : '';

  return ` via ${primary.edgeType} from ${primary.sourceSlot}:${truncateSelectionLabel(primary.sourceLabel, 72)}${additionalText}`;
}

function truncateSelectionLabel(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(maxLength - 3, 1))}...`;
}

function matchesCompileScope(
  node: GraphNode,
  request: Pick<CompileContextRequest, 'sessionId' | 'workspaceId'>
): boolean {
  if (node.scope === 'session') {
    return readPayloadString(node.payload, 'sessionId') === request.sessionId;
  }

  if (node.scope === 'workspace') {
    return Boolean(request.workspaceId) && readPayloadString(node.payload, 'workspaceId') === request.workspaceId;
  }

  return true;
}

function readPayloadString(payload: GraphNode['payload'], key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}
