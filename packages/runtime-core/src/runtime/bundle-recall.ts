import type {
  BundleRecalledNodeView,
  ContextRecallKind,
  ContextSelection,
  ContextSelectionDiagnostic,
  RuntimeContextBundle
} from '@openclaw-compact-context/contracts';

type RecallLike = Pick<ContextSelection, 'nodeId' | 'type' | 'label' | 'primaryRecallKind' | 'recallKinds' | 'reason'>;

export function collectBundleRecalledNodes(bundle: RuntimeContextBundle): BundleRecalledNodeView[] {
  const includedNodeIds = new Set(collectBundleSelections(bundle).map((item) => item.nodeId));
  const byNodeId = new Map<
    string,
    {
      nodeId: string;
      type: BundleRecalledNodeView['type'];
      label: string;
      reasons: Set<string>;
      recallKinds: Set<ContextRecallKind>;
    }
  >();

  for (const item of collectBundleSelections(bundle)) {
    rememberRecallNode(byNodeId, item);
  }

  for (const item of bundle.diagnostics?.fixed.selected ?? []) {
    rememberRecallNode(byNodeId, item);
  }

  for (const category of bundle.diagnostics?.categories ?? []) {
    for (const item of category.selected) {
      rememberRecallNode(byNodeId, item);
    }
  }

  for (const item of bundle.diagnostics?.topicAdmissions ?? []) {
    rememberRecallNode(byNodeId, item);
  }

  for (const item of bundle.diagnostics?.fixed.skipped ?? []) {
    rememberRecallNode(byNodeId, item);
  }

  for (const category of bundle.diagnostics?.categories ?? []) {
    for (const item of category.skipped) {
      rememberRecallNode(byNodeId, item);
    }
  }

  for (const item of bundle.diagnostics?.topicHints ?? []) {
    rememberRecallNode(byNodeId, item);
  }

  return [...byNodeId.values()].map((item) => {
    const recallKinds = [...item.recallKinds];
    const primaryRecallKind = resolvePrimaryRecallKind(recallKinds);
    return {
      nodeId: item.nodeId,
      type: item.type,
      label: item.label,
      included: includedNodeIds.has(item.nodeId),
      reasons: [...item.reasons],
      ...(primaryRecallKind ? { primaryRecallKind } : {}),
      ...(recallKinds.length > 0 ? { recallKinds } : {})
    };
  });
}

function rememberRecallNode(
  byNodeId: Map<
    string,
    {
      nodeId: string;
      type: BundleRecalledNodeView['type'];
      label: string;
      reasons: Set<string>;
      recallKinds: Set<ContextRecallKind>;
    }
  >,
  item: RecallLike | ContextSelectionDiagnostic
): void {
  const existing = byNodeId.get(item.nodeId);

  if (!existing) {
    byNodeId.set(item.nodeId, {
      nodeId: item.nodeId,
      type: item.type,
      label: item.label,
      reasons: new Set(item.reason ? [item.reason] : []),
      recallKinds: new Set(item.recallKinds ?? (item.primaryRecallKind ? [item.primaryRecallKind] : []))
    });
    return;
  }

  if (item.reason) {
    existing.reasons.add(item.reason);
  }

  for (const kind of item.recallKinds ?? (item.primaryRecallKind ? [item.primaryRecallKind] : [])) {
    existing.recallKinds.add(kind);
  }
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

function collectBundleSelections(bundle: RuntimeContextBundle): ContextSelection[] {
  return [
    ...(bundle.goal ? [bundle.goal] : []),
    ...(bundle.intent ? [bundle.intent] : []),
    ...(bundle.currentProcess ? [bundle.currentProcess] : []),
    ...bundle.activeRules,
    ...bundle.activeConstraints,
    ...bundle.openRisks,
    ...bundle.recentDecisions,
    ...bundle.recentStateChanges,
    ...bundle.relevantEvidence,
    ...bundle.candidateSkills
  ];
}
