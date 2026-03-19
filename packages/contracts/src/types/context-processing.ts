import type {
  NodePromptPreferredForm,
  NodeType,
  RuntimeContextBundle,
  RuntimeContextCategory,
  RuntimeContextFixedSlot,
  RuntimeContextSelectionSlot
} from './core.js';

export type ContextInputRouteKind =
  | 'conversation'
  | 'tool_result'
  | 'transcript'
  | 'document'
  | 'experience_trace'
  | 'system';

export type ContextProcessingFallbackKind =
  | 'raw_record'
  | 'sentence_split'
  | 'coarse_node'
  | 'unresolved_concept'
  | 'supported_by_only';

export type SemanticExtractionNodeTarget = Extract<
  NodeType,
  | 'Rule'
  | 'Constraint'
  | 'Process'
  | 'Step'
  | 'Risk'
  | 'Skill'
  | 'State'
  | 'Decision'
  | 'Outcome'
  | 'Goal'
  | 'Intent'
  | 'Tool'
  | 'Mode'
  | 'Topic'
  | 'Concept'
>;

export interface EvidenceAnchor {
  recordId?: string;
  sourcePath?: string;
  sourceSpan?: string;
  startOffset?: number;
  endOffset?: number;
  sentenceId?: string;
  clauseId?: string;
}

export type CanonicalConceptId =
  | 'context_compression'
  | 'knowledge_graph'
  | 'provenance'
  | 'checkpoint'
  | 'runtime_bundle'
  | 'traceability'
  | 'artifact_sidecar';

export interface CanonicalConceptDefinition {
  id: CanonicalConceptId;
  preferredLabel: string;
  aliases: readonly string[];
}

export interface ConceptMatch {
  conceptId: CanonicalConceptId;
  preferredLabel: string;
  matchedAlias: string;
}

export interface SemanticSpan {
  id: string;
  route: ContextInputRouteKind;
  text: string;
  normalizedText: string;
  sentenceId: string;
  clauseId: string;
  startOffset: number;
  endOffset: number;
  anchor: EvidenceAnchor;
  candidateNodeTypes: SemanticExtractionNodeTarget[];
  conceptMatches: ConceptMatch[];
}

export type UtteranceClauseBoundary =
  | 'sentence'
  | 'punctuation'
  | 'connector'
  | 'fallback';

export interface UtteranceSentence {
  id: string;
  text: string;
  normalizedText: string;
  startOffset: number;
  endOffset: number;
}

export interface UtteranceClause {
  id: string;
  sentenceId: string;
  text: string;
  normalizedText: string;
  startOffset: number;
  endOffset: number;
  boundary: UtteranceClauseBoundary;
}

export interface UtteranceParseResult {
  version: string;
  route: ContextInputRouteKind;
  clauseSplitApplied: boolean;
  appliedFallbacks: ContextProcessingFallbackKind[];
  sentences: UtteranceSentence[];
  clauses: UtteranceClause[];
}

export interface SemanticExtractionContract {
  version: string;
  route: ContextInputRouteKind;
  preserveRawEvidence: true;
  clauseSplit: boolean;
  evidenceAnchorRequired: boolean;
  conceptNormalization: boolean;
  multiNodeMaterialization: boolean;
  fallbackOrder: readonly ContextProcessingFallbackKind[];
  supportedNodeTypes: readonly SemanticExtractionNodeTarget[];
}

export type ContextNoiseDisposition =
  | 'drop'
  | 'evidence_only'
  | 'hint_only'
  | 'materialize';

export type ContextNoiseSignal =
  | 'empty_span'
  | 'acknowledgement'
  | 'duplicate_clause'
  | 'low_information'
  | 'weak_topic_only'
  | 'manual_override';

export interface ContextNoiseDecision {
  spanId: string;
  route: ContextInputRouteKind;
  disposition: ContextNoiseDisposition;
  reason: string;
  signals: ContextNoiseSignal[];
  targetId?: string;
}

export type ContextProcessingNodeCandidateDisposition =
  | 'materialize'
  | 'summary_only';

export interface ContextProcessingNodeCandidate {
  id: string;
  spanId: string;
  route: ContextInputRouteKind;
  nodeType: SemanticExtractionNodeTarget;
  label: string;
  normalizedLabel: string;
  disposition: ContextProcessingNodeCandidateDisposition;
  reason: string;
  conceptId?: CanonicalConceptId;
}

export interface ContextSummaryCandidate {
  id: string;
  slot: RuntimeContextSelectionSlot;
  label: string;
  preferredForm: NodePromptPreferredForm;
  requiresEvidence: boolean;
  reason: string;
  spanIds: string[];
  sourceNodeCandidateIds: string[];
}

export interface ContextMaterializationPlan {
  route: ContextInputRouteKind;
  preserveEvidence: boolean;
  materializeNodeCandidates: ContextProcessingNodeCandidate[];
  summaryOnlyNodeCandidates: ContextProcessingNodeCandidate[];
}

export interface ContextProcessingDiagnostics {
  version: string;
  route: ContextInputRouteKind;
  cacheKey?: string;
  cacheHit?: boolean;
  clauseSplitApplied: boolean;
  appliedFallbacks: ContextProcessingFallbackKind[];
  sentenceCount: number;
  clauseCount: number;
  semanticSpanCount: number;
  conceptMatchCount: number;
  noiseDecisionCount: number;
  droppedSpanCount: number;
  evidenceOnlySpanCount: number;
  hintOnlySpanCount: number;
  materializeSpanCount: number;
  nodeCandidateCount: number;
  materializeNodeCandidateCount: number;
  summaryCandidateCount: number;
}

export interface ContextProcessingExperienceHint {
  attemptId: string;
  episodeId: string;
  status: 'failure_only' | 'procedure_only' | 'mixed';
  failureSignalSpanIds: string[];
  failureSignalLabels: string[];
  procedureStepSpanIds: string[];
  procedureStepLabels: string[];
  criticalStepSpanIds: string[];
  criticalStepLabels: string[];
}

export interface ContextProcessingVersions {
  pipeline: string;
  parser: string;
  conceptLexicon: string;
  semanticClassifier: string;
  noisePolicy: string;
  summaryPlanner: string;
  nodeMaterializer: string;
}

export interface ContextProcessingResult {
  version: string;
  versions: ContextProcessingVersions;
  route: ContextInputRouteKind;
  contract: SemanticExtractionContract;
  parseResult: UtteranceParseResult;
  evidenceAnchor: EvidenceAnchor;
  semanticSpans: SemanticSpan[];
  noiseDecisions: ContextNoiseDecision[];
  nodeCandidates: ContextProcessingNodeCandidate[];
  summaryCandidates: ContextSummaryCandidate[];
  materializationPlan: ContextMaterializationPlan;
  experienceHint?: ContextProcessingExperienceHint;
  diagnostics: ContextProcessingDiagnostics;
}

export interface ContextProcessingPipelineOptions {
  primaryNodeType?: NodeType;
  manualCorrections?: readonly ManualCorrectionRecord[];
}

export interface ContextSummaryContractItem {
  nodeId: string;
  type: NodeType;
  label: string;
  reason: string;
  preferredForm?: NodePromptPreferredForm;
  requiresEvidence?: boolean;
}

export interface ContextSummaryContract {
  version: string;
  bundleId: string;
  sessionId: string;
  query: string;
  goal?: ContextSummaryContractItem;
  intent?: ContextSummaryContractItem;
  currentProcess?: ContextSummaryContractItem;
  activeRules: ContextSummaryContractItem[];
  activeConstraints: ContextSummaryContractItem[];
  openRisks: ContextSummaryContractItem[];
  recentDecisions: ContextSummaryContractItem[];
  recentStateChanges: ContextSummaryContractItem[];
  relevantEvidence: ContextSummaryContractItem[];
  candidateSkills: ContextSummaryContractItem[];
  requiredSlots: RuntimeContextSelectionSlot[];
  tokenBudget: RuntimeContextBundle['tokenBudget'];
  metadata: NonNullable<RuntimeContextBundle['metadata']>;
}

export interface BundleContractSnapshot {
  version: string;
  bundleId: string;
  sessionId: string;
  query: string;
  requiredFixedSlots: readonly RuntimeContextFixedSlot[];
  requiredCategories: readonly RuntimeContextCategory[];
  fixedSlotCoverage: Record<RuntimeContextFixedSlot, boolean>;
  categoryCounts: Record<RuntimeContextCategory, number>;
  topicHintCount: number;
  relationRetrievalEnabled: boolean;
  metadata: NonNullable<RuntimeContextBundle['metadata']>;
}

export type ManualCorrectionTargetKind =
  | 'concept_alias'
  | 'promotion_decision'
  | 'noise_policy'
  | 'semantic_classification'
  | 'node_suppression'
  | 'label_override';

export type ManualCorrectionAction = 'apply' | 'rollback';

export interface ManualCorrectionRecord {
  id: string;
  targetKind: ManualCorrectionTargetKind;
  targetId: string;
  action: ManualCorrectionAction;
  reason: string;
  author: string;
  createdAt: string;
  metadata?: Record<string, string | number | boolean | null>;
}
