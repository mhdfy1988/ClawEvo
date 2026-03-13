import type {
  ContextSelection,
  RuntimeContextBundle,
  RuntimeContextCategory,
  RuntimeContextFixedSlot
} from '../types/core.js';
import type { ExplainRequest, ExplainResult } from '../types/io.js';
import type { ContextCompiler } from './context-compiler.js';
import type { GraphStore } from './graph-store.js';

const DEFAULT_EXPLAIN_TOKEN_BUDGET = 512;

export class AuditExplainer {
  constructor(
    private readonly graphStore: GraphStore,
    private readonly contextCompiler?: ContextCompiler
  ) {}

  async explain(request: ExplainRequest): Promise<ExplainResult> {
    const node = await this.graphStore.getNode(request.nodeId);

    if (!node) {
      return {
        summary: `Node "${request.nodeId}" was not found.`,
        sources: [],
        relatedNodes: []
      };
    }

    const edges = await this.graphStore.getEdgesForNode(node.id);
    const relatedNodes = await Promise.all(
      edges.map(async (edge) => {
        const relatedId = edge.fromId === node.id ? edge.toId : edge.fromId;
        return this.graphStore.getNode(relatedId);
      })
    );
    const provenanceSummary = describeProvenance(node.provenance);
    const derivedFromText =
      node.provenance?.derivedFromNodeIds && node.provenance.derivedFromNodeIds.length > 0
        ? ` Derived from ${node.provenance.derivedFromNodeIds.length} node(s).`
        : '';
    const rawSourceText = node.provenance?.rawSourceId ? ` Raw source id: ${node.provenance.rawSourceId}.` : '';
    const selection = await this.describeSelection(node.id, node.label, request.selectionContext);

    return {
      node,
      provenance: node.provenance,
      summary:
        `${node.type} "${node.label}" is active in ${node.scope} scope with ${edges.length} linked edges. ` +
        `Provenance: ${provenanceSummary}.${derivedFromText}${rawSourceText}${formatSelectionSummary(selection)}`,
      sources: node.sourceRef ? [node.sourceRef] : [],
      selection,
      relatedNodes: relatedNodes
        .filter((value): value is NonNullable<typeof value> => Boolean(value))
        .map((value) => ({
          id: value.id,
          type: value.type,
          label: value.label,
          provenance: value.provenance
        }))
    };
  }

  private async describeSelection(
    nodeId: string,
    fallbackQuery: string,
    selectionContext: ExplainRequest['selectionContext']
  ): Promise<ExplainResult['selection'] | undefined> {
    if (!selectionContext || !this.contextCompiler) {
      return undefined;
    }

    const query = selectionContext.query?.trim() || fallbackQuery;
    const tokenBudget = selectionContext.tokenBudget ?? DEFAULT_EXPLAIN_TOKEN_BUDGET;
    const bundle = await this.contextCompiler.compile({
      sessionId: selectionContext.sessionId,
      query,
      tokenBudget
    });

    return describeBundleSelection(bundle, nodeId, query, tokenBudget);
  }
}

function describeBundleSelection(
  bundle: RuntimeContextBundle,
  nodeId: string,
  query: string,
  tokenBudget: number
): ExplainResult['selection'] {
  const fixedSelected = findFixedSelection(bundle, nodeId);

  if (fixedSelected) {
    return {
      included: true,
      slot: fixedSelected.slot,
      reason: fixedSelected.selection.reason,
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
      query,
      tokenBudget,
      categoryBudget: category.allocatedBudget
    };
  }

  return {
    included: false,
    reason: 'node was not selected in the compiled runtime bundle',
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

function formatSelectionSummary(selection: ExplainResult['selection']): string {
  if (!selection) {
    return '';
  }

  const slotText = selection.slot ? ` ${selection.included ? 'in' : 'from'} ${selection.slot}` : '';
  const budgetText = typeof selection.categoryBudget === 'number' ? ` Category budget: ${selection.categoryBudget}.` : '';

  if (selection.included) {
    return ` Selection: included${slotText}. Reason: ${selection.reason}. Query: "${selection.query}".${budgetText}`;
  }

  return ` Selection: skipped${slotText}. Reason: ${selection.reason}. Query: "${selection.query}".${budgetText}`;
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
