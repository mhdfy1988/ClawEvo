import { randomUUID } from 'node:crypto';

import type {
  ContextSelection,
  ContextSelectionDiagnostic,
  GraphNode,
  KnowledgeStrength,
  ProvenanceOriginKind,
  ProvenanceRef,
  RuntimeContextCategory,
  RuntimeContextDiagnostics,
  RuntimeContextBundle,
  Scope
} from '../types/core.js';
import type { CompileContextRequest } from '../types/io.js';
import type { GraphStore } from './graph-store.js';
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
      skills
    ] = await Promise.all([
      this.graphStore.queryNodes({
        types: ['Goal'],
        sessionId: request.sessionId,
        text: request.goalLabel ?? request.query,
        originKinds: ['raw'],
        limit: 3
      }),
      this.graphStore.queryNodes({
        types: ['Goal'],
        sessionId: request.sessionId,
        limit: 3
      }),
      this.graphStore.queryNodes({
        types: ['Intent'],
        sessionId: request.sessionId,
        text: request.intentLabel ?? request.query,
        originKinds: ['raw'],
        limit: 3
      }),
      this.graphStore.queryNodes({
        types: ['Intent'],
        sessionId: request.sessionId,
        limit: 3
      }),
      this.graphStore.queryNodes({
        types: ['Rule'],
        freshness: ['active'],
        sessionId: request.sessionId,
        originKinds: ['raw']
      }),
      this.graphStore.queryNodes({ types: ['Rule'], freshness: ['active'], sessionId: request.sessionId }),
      this.graphStore.queryNodes({
        types: ['Constraint'],
        freshness: ['active'],
        sessionId: request.sessionId,
        originKinds: ['raw']
      }),
      this.graphStore.queryNodes({ types: ['Constraint'], freshness: ['active'], sessionId: request.sessionId }),
      this.graphStore.queryNodes({
        types: ['Mode'],
        freshness: ['active'],
        sessionId: request.sessionId,
        originKinds: ['raw'],
        limit: 20
      }),
      this.graphStore.queryNodes({ types: ['Mode'], freshness: ['active'], sessionId: request.sessionId, limit: 20 }),
      this.graphStore.queryNodes({
        types: ['Risk'],
        freshness: ['active'],
        sessionId: request.sessionId,
        originKinds: ['raw'],
        limit: 20
      }),
      this.graphStore.queryNodes({ types: ['Risk'], freshness: ['active'], sessionId: request.sessionId, limit: 20 }),
      this.graphStore.queryNodes({
        types: ['Process'],
        freshness: ['active'],
        sessionId: request.sessionId,
        originKinds: ['raw'],
        limit: 20
      }),
      this.graphStore.queryNodes({ types: ['Process'], freshness: ['active'], sessionId: request.sessionId, limit: 20 }),
      this.graphStore.queryNodes({
        types: ['Step'],
        freshness: ['active'],
        sessionId: request.sessionId,
        originKinds: ['raw'],
        limit: 20
      }),
      this.graphStore.queryNodes({ types: ['Step'], freshness: ['active'], sessionId: request.sessionId, limit: 20 }),
      this.graphStore.queryNodes({
        types: ['Decision'],
        freshness: ['active'],
        sessionId: request.sessionId,
        limit: 20
      }),
      this.graphStore.queryNodes({
        types: ['Decision'],
        freshness: ['active'],
        sessionId: request.sessionId,
        originKinds: ['raw'],
        limit: 20
      }),
      this.graphStore.queryNodes({
        types: ['Outcome'],
        freshness: ['active'],
        sessionId: request.sessionId,
        limit: 20
      }),
      this.graphStore.queryNodes({
        types: ['Outcome'],
        freshness: ['active'],
        sessionId: request.sessionId,
        originKinds: ['raw'],
        limit: 20
      }),
      this.graphStore.queryNodes({ types: ['State'], freshness: ['active'], sessionId: request.sessionId, limit: 20 }),
      this.graphStore.queryNodes({
        types: ['State'],
        freshness: ['active'],
        sessionId: request.sessionId,
        originKinds: ['raw'],
        limit: 20
      }),
      this.graphStore.queryNodes({
        types: ['State'],
        freshness: ['active'],
        sessionId: request.sessionId,
        originKinds: ['compressed'],
        limit: 20
      }),
      this.graphStore.queryNodes({
        types: ['Tool'],
        freshness: ['active'],
        sessionId: request.sessionId,
        limit: 20
      }),
      this.graphStore.queryNodes({
        types: ['Tool'],
        freshness: ['active'],
        sessionId: request.sessionId,
        originKinds: ['raw'],
        limit: 20
      }),
      this.graphStore.queryNodes({
        types: ['Evidence'],
        freshness: ['active'],
        sessionId: request.sessionId,
        limit: 40
      }),
      this.graphStore.queryNodes({
        types: ['Evidence'],
        freshness: ['active'],
        sessionId: request.sessionId,
        originKinds: ['raw'],
        limit: 40
      }),
      this.graphStore.queryNodes({
        types: ['Evidence'],
        freshness: ['active'],
        sessionId: request.sessionId,
        originKinds: ['compressed'],
        limit: 40
      }),
      this.graphStore.queryNodes({ types: ['Skill'], freshness: ['active'], sessionId: request.sessionId, limit: 20 })
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
    const activeRules = this.selectNodes(selectedRules, request.query, DEFAULT_CATEGORY_LIMITS.rules, 'active rule');
    const activeConstraints = this.selectNodes(
      dedupeNodes(selectedModes.concat(selectedConstraints)),
      request.query,
      DEFAULT_CATEGORY_LIMITS.constraints,
      'active constraint'
    );
    const currentProcess =
      this.pickBest(selectedSteps, request.query, 'current process step') ??
      this.pickBest(selectedProcesses, request.query, 'current process');
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
    const relevantEvidence = this.selectNodes(
      selectedEvidence,
      request.query,
      DEFAULT_CATEGORY_LIMITS.evidence,
      'supporting evidence'
    );
    const candidateSkills = this.selectNodes(
      skills,
      request.query,
      DEFAULT_CATEGORY_LIMITS.skills,
      'candidate skill'
    );
    const inferredOpenRisks = dedupeSelections(
      activeConstraints.concat(recentStateChanges).filter((item) => /risk|block|conflict|constraint|forbid|warning/i.test(item.label))
    );
    const selectedOpenRisks = dedupeSelections(
      this.selectNodes(selectedRisks, request.query, DEFAULT_CATEGORY_LIMITS.risks, 'open risk').concat(inferredOpenRisks)
    ).slice(0, DEFAULT_CATEGORY_LIMITS.risks);

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

    return bundle;
  }

  private pickBest(nodes: GraphNode[], query: string, reason: string): ContextSelection | undefined {
    const [best] = this.rankNodes(nodes, query);
    return best ? this.toSelection(best, reason) : undefined;
  }

  private selectNodes(
    nodes: GraphNode[],
    query: string,
    limit: number,
    reason: string
  ): ContextSelection[] {
    return this.rankNodes(nodes, query)
      .slice(0, limit)
      .map((node) => this.toSelection(node, reason));
  }

  private rankNodes(nodes: GraphNode[], query: string): GraphNode[] {
    return [...nodes].sort((left, right) => {
      const scoreDelta = this.scoreNode(right, query) - this.scoreNode(left, query);

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

  private scoreNode(node: GraphNode, query: string): number {
    let score = 0;

    score += scopeScore(node.scope);
    score += strengthScore(node.strength);
    score += provenanceScore(node.provenance?.originKind);
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

    if (node.freshness === 'active') {
      score += 2;
    }

    score += node.confidence;
    return score;
  }

  private toSelection(node: GraphNode, reason: string): ContextSelection {
    return {
      nodeId: node.id,
      type: node.type,
      label: node.label,
      scope: node.scope,
      kind: node.kind,
      strength: node.strength,
      reason: appendProvenanceReason(reason, node.provenance),
      estimatedTokens: estimateTextTokens(node.label) + estimateTextTokens(JSON.stringify(node.payload)),
      sourceRef: node.sourceRef,
      provenance: node.provenance
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

function scopeScore(scope: Scope): number {
  switch (scope) {
    case 'session':
      return 4;
    case 'workspace':
      return 3;
    case 'global':
    default:
      return 2;
  }
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
    categories: []
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
    .map((item) => toSelectionDiagnostic(item, 'selected within category budget'))
    .concat(refill.selected.map((item) => toSelectionDiagnostic(item, 'selected during refill after higher-priority categories')));

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

function appendProvenanceReason(reason: string, provenance: ProvenanceRef | undefined): string {
  if (!provenance) {
    return `${reason} (source unknown)`;
  }

  const stage = provenance.sourceStage;

  switch (provenance.originKind) {
    case 'raw':
      return `${reason} (raw:${stage})`;
    case 'compressed':
      return `${reason} (compressed fallback:${stage})`;
    case 'derived':
      return `${reason} (derived fallback:${stage})`;
    default:
      return `${reason} (${stage})`;
  }
}
