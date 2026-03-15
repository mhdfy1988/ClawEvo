import type { CanonicalConceptId } from './context-processing.js';
import type { KnowledgePromotionClass, NodeType, RelationRetrievalDiagnostics } from './core.js';

export interface BundleQualityMetrics {
  selectedNodeIds: string[];
  requiredSelectedNodeIds: string[];
  missingRequiredNodeIds: string[];
  forbiddenSelectedNodeIds: string[];
  requiredCoverage: number;
}

export interface RelationRecallMetrics {
  selectedNodeIds: string[];
  matchedExpectedNodeIds: string[];
  noiseNodeIds: string[];
  precision: number;
  recall: number;
}

export interface MemoryQualityMetrics {
  usefulSurfacedNodeIds: string[];
  disallowedSurfacedNodeIds: string[];
  usefulness: number;
  intrusion: number;
}

export interface ExplainCompletenessMetrics {
  completeNodeIds: string[];
  incompleteNodeIds: string[];
  coverage: number;
}

export interface RetrievalCostMetrics {
  bundleRelation?: RelationRetrievalDiagnostics;
  explainSelectionEdgeLookupsTotal: number;
  explainSelectionNodeLookupsTotal: number;
  explainAdjacencyEdgeLookupsTotal: number;
  explainAdjacencyNodeLookupsTotal: number;
  persistenceReadCountTotal: number;
}

export interface ContextProcessingMetrics {
  semanticMaterializedNodeIds: string[];
  matchedSemanticNodeIds: string[];
  missingSemanticNodeIds: string[];
  semanticNodeCoverage: number;
  normalizedConceptIds: CanonicalConceptId[];
  matchedConceptIds: CanonicalConceptId[];
  missingConceptIds: CanonicalConceptId[];
  conceptCoverage: number;
  clauseSplitCompleteNodeIds: string[];
  clauseSplitMissingNodeIds: string[];
  clauseSplitCoverage: number;
  anchorCompleteNodeIds: string[];
  anchorMissingNodeIds: string[];
  anchorCompleteness: number;
  surfacedExperienceNodeTypes: NodeType[];
  missingExperienceNodeTypes: NodeType[];
  experienceLearningCoverage: number;
}

export interface PromotionQualityMetrics {
  surfacedKnowledgeClasses: KnowledgePromotionClass[];
  matchedKnowledgeClasses: KnowledgePromotionClass[];
  missingKnowledgeClasses: KnowledgePromotionClass[];
  knowledgeClassCoverage: number;
  pollutedNodeIds: string[];
  pollutionRate: number;
}

export interface ScopeReuseMetrics {
  surfacedWorkspaceNodeIds: string[];
  surfacedGlobalNodeIds: string[];
  learningBoostNodeIds: string[];
  matchedWorkspaceNodeIds: string[];
  matchedGlobalNodeIds: string[];
  missingWorkspaceNodeIds: string[];
  missingGlobalNodeIds: string[];
  disallowedSurfacedNodeIds: string[];
  benefit: number;
  intrusion: number;
}

export interface MultiSourceMetrics {
  surfacedNodeTypes: Extract<NodeType, 'Document' | 'Repo' | 'Module' | 'File' | 'API' | 'Command'>[];
  matchedNodeTypes: Extract<NodeType, 'Document' | 'Repo' | 'Module' | 'File' | 'API' | 'Command'>[];
  missingNodeTypes: Extract<NodeType, 'Document' | 'Repo' | 'Module' | 'File' | 'API' | 'Command'>[];
  coverage: number;
}

export interface EvaluationReport {
  fixtureName: string;
  pass: boolean;
  failures: string[];
  bundle: {
    id: string;
    checkpointId: string;
    deltaId: string;
    skillCandidateIds: string[];
  };
  metrics: {
    bundleQuality: BundleQualityMetrics;
    relationRecall: RelationRecallMetrics;
    memoryQuality: MemoryQualityMetrics;
    explainCompleteness: ExplainCompletenessMetrics;
    retrievalCost: RetrievalCostMetrics;
    contextProcessing: ContextProcessingMetrics;
    promotionQuality: PromotionQualityMetrics;
    scopeReuse: ScopeReuseMetrics;
    multiSource: MultiSourceMetrics;
  };
}

export interface StageObservabilitySnapshot {
  fixtureCount: number;
  passCount: number;
  passRate: number;
  averageRelationPrecision: number;
  averageRelationRecall: number;
  averageRecallNoiseRate: number;
  averageBundleCoverage: number;
  averageExplainCoverage: number;
  averageConceptCoverage: number;
  averageMemoryUsefulness: number;
  averageMemoryIntrusion: number;
  averagePromotionQuality: number;
  averageKnowledgePollutionRate: number;
  averageHighScopeReuseBenefit: number;
  averageHighScopeReuseIntrusion: number;
  averageMultiSourceCoverage: number;
  averageCandidatePathCount: number;
  averageAdmittedPathCount: number;
  averagePathPruneRate: number;
  totalPathCount: number;
  totalPrunedPathCount: number;
}

export interface StageObservabilityTrendPoint {
  label: string;
  snapshot: StageObservabilitySnapshot;
}

export interface StageObservabilityTrendReport {
  pointCount: number;
  labels: string[];
  latestPassRate: number;
  latestRelationPrecision: number;
  latestRelationRecall: number;
  latestRecallNoiseRate: number;
  latestPathPruneRate: number;
  latestMemoryIntrusion: number;
  latestPromotionQuality: number;
  latestKnowledgePollutionRate: number;
  latestHighScopeReuseBenefit: number;
  latestMultiSourceCoverage: number;
}

export interface StageObservabilityReport {
  stage: string;
  current: StageObservabilitySnapshot;
  trend: StageObservabilityTrendReport;
}
