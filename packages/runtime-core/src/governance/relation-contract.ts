import type { EdgeGovernance, EdgeType, Freshness, GraphEdge } from '@openclaw-compact-context/contracts';

interface RelationContract {
  stableProduction: boolean;
  usage: EdgeGovernance['usage'];
  freshness: Freshness;
  explainVisible: boolean;
  defaultConfidence: number;
  recallPriority?: number;
  plannedRecallOrder?: number;
}

const RELATION_CONTRACTS: Record<EdgeType, RelationContract> = {
  documents: {
    stableProduction: true,
    usage: 'explain_only',
    freshness: 'active',
    explainVisible: true,
    defaultConfidence: 0.92
  },
  contains: {
    stableProduction: true,
    usage: 'explain_only',
    freshness: 'active',
    explainVisible: true,
    defaultConfidence: 0.9
  },
  defines: {
    stableProduction: true,
    usage: 'explain_only',
    freshness: 'active',
    explainVisible: true,
    defaultConfidence: 0.9
  },
  supported_by: {
    stableProduction: true,
    usage: 'recall_eligible',
    freshness: 'active',
    explainVisible: true,
    defaultConfidence: 1,
    recallPriority: 2.5,
    plannedRecallOrder: 1
  },
  requires: {
    stableProduction: true,
    usage: 'recall_eligible',
    freshness: 'active',
    explainVisible: true,
    defaultConfidence: 0.85,
    recallPriority: 1.75,
    plannedRecallOrder: 2
  },
  next_step: {
    stableProduction: true,
    usage: 'recall_eligible',
    freshness: 'active',
    explainVisible: true,
    defaultConfidence: 0.8,
    recallPriority: 1.5,
    plannedRecallOrder: 3
  },
  overrides: {
    stableProduction: true,
    usage: 'recall_eligible',
    freshness: 'active',
    explainVisible: true,
    defaultConfidence: 0.95,
    recallPriority: 1.25,
    plannedRecallOrder: 4
  },
  supersedes: {
    stableProduction: true,
    usage: 'governance_only',
    freshness: 'superseded',
    explainVisible: true,
    defaultConfidence: 0.95,
    plannedRecallOrder: 5
  },
  conflicts_with: {
    stableProduction: true,
    usage: 'governance_only',
    freshness: 'active',
    explainVisible: true,
    defaultConfidence: 0.9
  },
  derived_from: {
    stableProduction: false,
    usage: 'explain_only',
    freshness: 'active',
    explainVisible: true,
    defaultConfidence: 0.75
  },
  applies_when: {
    stableProduction: false,
    usage: 'explain_only',
    freshness: 'active',
    explainVisible: true,
    defaultConfidence: 0.7
  },
  forbids: {
    stableProduction: false,
    usage: 'explain_only',
    freshness: 'active',
    explainVisible: true,
    defaultConfidence: 0.7
  },
  permits: {
    stableProduction: false,
    usage: 'explain_only',
    freshness: 'active',
    explainVisible: true,
    defaultConfidence: 0.7
  },
  uses_skill: {
    stableProduction: false,
    usage: 'explain_only',
    freshness: 'active',
    explainVisible: true,
    defaultConfidence: 0.7
  },
  produces: {
    stableProduction: false,
    usage: 'explain_only',
    freshness: 'active',
    explainVisible: true,
    defaultConfidence: 0.7
  }
};

export function getRelationContract(type: EdgeType): RelationContract {
  return RELATION_CONTRACTS[type];
}

export function buildEdgeGovernance(type: EdgeType, overrides: Partial<EdgeGovernance> = {}): EdgeGovernance {
  const contract = getRelationContract(type);

  return {
    stableProduction: overrides.stableProduction ?? contract.stableProduction,
    usage: overrides.usage ?? contract.usage,
    freshness: overrides.freshness ?? contract.freshness,
    explainVisible: overrides.explainVisible ?? contract.explainVisible,
    recallEligible:
      overrides.recallEligible ??
      (overrides.usage ?? contract.usage) === 'recall_eligible',
    ...(typeof (overrides.recallPriority ?? contract.recallPriority) === 'number'
      ? { recallPriority: overrides.recallPriority ?? contract.recallPriority }
      : {}),
    ...(typeof (overrides.plannedRecallOrder ?? contract.plannedRecallOrder) === 'number'
      ? { plannedRecallOrder: overrides.plannedRecallOrder ?? contract.plannedRecallOrder }
      : {})
  };
}

export function normalizeEdgeGovernance(edge: Pick<GraphEdge, 'type' | 'governance'> | EdgeType): EdgeGovernance {
  if (typeof edge === 'string') {
    return buildEdgeGovernance(edge);
  }

  return buildEdgeGovernance(edge.type, edge.governance);
}

export function getDefaultEdgeConfidence(type: EdgeType): number {
  return getRelationContract(type).defaultConfidence;
}

export function isRecallEligibleEdge(edge: Pick<GraphEdge, 'type' | 'governance'> | EdgeType): boolean {
  return normalizeEdgeGovernance(edge).recallEligible;
}

export function getRelationRecallPriority(edge: Pick<GraphEdge, 'type' | 'governance'> | EdgeType): number | undefined {
  const governance = normalizeEdgeGovernance(edge);
  return governance.recallEligible ? governance.recallPriority : undefined;
}
