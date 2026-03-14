export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export type Scope = 'global' | 'workspace' | 'session';

export type KnowledgeKind = 'fact' | 'norm' | 'process' | 'state' | 'inference';

export type KnowledgeStrength = 'hard' | 'soft' | 'heuristic';

export type Freshness = 'active' | 'stale' | 'superseded';

export type NodeType =
  | 'Document'
  | 'Repo'
  | 'Module'
  | 'File'
  | 'API'
  | 'Command'
  | 'Rule'
  | 'Constraint'
  | 'Process'
  | 'Step'
  | 'Risk'
  | 'Skill'
  | 'State'
  | 'Decision'
  | 'Outcome'
  | 'Evidence'
  | 'Goal'
  | 'Intent'
  | 'Tool'
  | 'Mode'
  | 'Topic'
  | 'Concept'
  | 'Attempt'
  | 'Episode'
  | 'FailureSignal'
  | 'ProcedureCandidate'
  | 'Pattern'
  | 'FailurePattern'
  | 'SuccessfulProcedure';

export type EdgeType =
  | 'documents'
  | 'contains'
  | 'defines'
  | 'applies_when'
  | 'requires'
  | 'forbids'
  | 'permits'
  | 'overrides'
  | 'next_step'
  | 'uses_skill'
  | 'supported_by'
  | 'derived_from'
  | 'conflicts_with'
  | 'supersedes'
  | 'produces';

export type EdgeUsage = 'recall_eligible' | 'explain_only' | 'governance_only';

export interface SourceRef {
  sourceType: string;
  sourcePath?: string;
  sourceSpan?: string;
  contentHash?: string;
  extractor?: string;
}

export type ProvenanceOriginKind = 'raw' | 'compressed' | 'derived';

export type KnowledgeState = ProvenanceOriginKind;

export type ProvenanceSourceStage =
  | 'legacy_unknown'
  | 'transcript_message'
  | 'transcript_custom'
  | 'transcript_compaction'
  | 'hook_message_snapshot'
  | 'document_raw'
  | 'document_extract'
  | 'tool_output_raw'
  | 'tool_result_persist'
  | 'tool_output_summary'
  | 'runtime_bundle'
  | 'checkpoint'
  | 'delta'
  | 'skill_candidate';

export interface ProvenanceRef {
  originKind: ProvenanceOriginKind;
  sourceStage: ProvenanceSourceStage;
  producer: string;
  sourceBundleId?: string;
  rawSourceId?: string;
  rawContentHash?: string;
  transcriptEntryId?: string;
  transcriptParentId?: string;
  derivedFromNodeIds?: string[];
  derivedFromCheckpointId?: string;
  compressionRunId?: string;
  createdByHook?: string;
}

export type NodeConflictStatus = 'none' | 'potential' | 'confirmed' | 'superseded';

export type NodeResolutionState = 'unresolved' | 'suppressed' | 'selected' | 'deferred';

export type NodePromptPreferredForm = 'raw' | 'summary' | 'citation_only' | 'derived';

export type NodePromptSelectionPriority = 'must' | 'high' | 'normal' | 'low';

export type NodePromptBudgetClass = 'fixed' | 'reserved' | 'candidate';

export interface NodeGovernanceValidity {
  confidence: number;
  freshness: Freshness;
  validFrom: string;
  validTo?: string;
  conflictStatus?: NodeConflictStatus;
  resolutionState?: NodeResolutionState;
}

export interface NodeGovernanceConflict {
  conflictStatus?: NodeConflictStatus;
  resolutionState?: NodeResolutionState;
  conflictSetKey?: string;
  overridePriority?: number;
  supersededByNodeId?: string;
  conflictingNodeIds?: string[];
}

export interface NodeGovernancePromptReadiness {
  eligible: boolean;
  preferredForm: NodePromptPreferredForm;
  requiresEvidence: boolean;
  requiresCompression: boolean;
  selectionPriority: NodePromptSelectionPriority;
  budgetClass: NodePromptBudgetClass;
}

export type NodeScopeWriteAuthority = 'session_open' | 'workspace_guarded' | 'global_guarded';

export type NodeScopeRecallTier = 'session_primary' | 'workspace_fallback' | 'global_fallback';

export type NodeScopePromotionTarget = 'workspace' | 'global';

export interface NodeGovernanceScopePolicy {
  currentScope: Scope;
  writeAuthority: NodeScopeWriteAuthority;
  recallTier: NodeScopeRecallTier;
  recallPrecedence: number;
  higherScopeFallbackAllowed: boolean;
  promotion: {
    eligible: boolean;
    target?: NodeScopePromotionTarget;
    requiresManualReview: boolean;
    reason: string;
  };
}

export interface NodeGovernanceTraceability {
  rawSourceId?: string;
  derivedFromNodeIds?: string[];
  derivedFromCheckpointId?: string;
}

export interface NodeGovernance {
  provenance?: ProvenanceRef;
  knowledgeState: KnowledgeState;
  validity: NodeGovernanceValidity;
  conflict?: NodeGovernanceConflict;
  promptReadiness: NodeGovernancePromptReadiness;
  scopePolicy: NodeGovernanceScopePolicy;
  traceability: NodeGovernanceTraceability;
}

export interface GraphNode<TPayload extends JsonObject = JsonObject> {
  id: string;
  type: NodeType;
  scope: Scope;
  kind: KnowledgeKind;
  label: string;
  payload: TPayload;
  strength: KnowledgeStrength;
  confidence: number;
  sourceRef?: SourceRef;
  provenance?: ProvenanceRef;
  governance?: NodeGovernance;
  version: string;
  freshness: Freshness;
  validFrom: string;
  validTo?: string;
  updatedAt: string;
}

export interface GraphEdge<TPayload extends JsonObject = JsonObject> {
  id: string;
  fromId: string;
  toId: string;
  type: EdgeType;
  scope: Scope;
  strength: KnowledgeStrength;
  confidence: number;
  payload?: TPayload;
  sourceRef?: SourceRef;
  governance?: EdgeGovernance;
  version: string;
  validFrom: string;
  validTo?: string;
  updatedAt: string;
}

export interface EdgeGovernance {
  stableProduction: boolean;
  usage: EdgeUsage;
  freshness: Freshness;
  explainVisible: boolean;
  recallEligible: boolean;
  recallPriority?: number;
  plannedRecallOrder?: number;
}

export interface ContextSelection {
  nodeId: string;
  type: NodeType;
  label: string;
  scope: Scope;
  kind: KnowledgeKind;
  strength: KnowledgeStrength;
  reason: string;
  estimatedTokens: number;
  sourceRef?: SourceRef;
  provenance?: ProvenanceRef;
  governance?: NodeGovernance;
  relationPaths?: RelationRecallPath[];
}

export type RuntimeContextCategory =
  | 'activeRules'
  | 'activeConstraints'
  | 'openRisks'
  | 'recentDecisions'
  | 'recentStateChanges'
  | 'relevantEvidence'
  | 'candidateSkills';

export type RuntimeContextFixedSlot = 'goal' | 'intent' | 'currentProcess';

export type RuntimeContextSelectionSlot = RuntimeContextFixedSlot | RuntimeContextCategory;

export interface TraceSourceView {
  originKind?: ProvenanceOriginKind;
  sourceStage?: ProvenanceSourceStage;
  producer?: string;
  scope?: Scope;
  sourceType?: string;
  rawSourceId?: string;
  sourcePath?: string;
  sourceSpan?: string;
  sourceUrl?: string;
  contentHash?: string;
  artifactPath?: string;
}

export interface TraceTransformationView {
  recordId?: string;
  evidenceNodeId?: string;
  semanticNodeId?: string;
  derivedFromNodeIds: string[];
  createdByHook?: string;
  anchorRecordId?: string;
  anchorSourcePath?: string;
  anchorSourceSpan?: string;
  anchorStartOffset?: number;
  anchorEndOffset?: number;
  anchorSentenceId?: string;
  anchorClauseId?: string;
  semanticSpanIds?: string[];
  normalizedConceptIds?: string[];
  noiseDispositions?: string[];
}

export interface TraceSelectionView {
  evaluated: boolean;
  included?: boolean;
  slot?: RuntimeContextSelectionSlot;
  reason?: string;
  scopeReason?: string;
  query?: string;
  tokenBudget?: number;
  categoryBudget?: number;
}

export interface TraceOutputView {
  promptReady: boolean;
  preferredForm?: NodePromptPreferredForm;
  assembledIntoPrompt: boolean;
  summarizedIntoCompactView: boolean;
  requiresEvidence: boolean;
  requiresCompression: boolean;
  summaryOnlyReason?: string;
}

export interface TracePersistenceView {
  sourceStage?: ProvenanceSourceStage;
  persistedInCheckpoint: boolean;
  surfacedInDelta: boolean;
  surfacedInSkillCandidate: boolean;
  checkpointId?: string;
  deltaId?: string;
  skillCandidateId?: string;
  checkpointSourceBundleId?: string;
  deltaSourceBundleId?: string;
  skillCandidateSourceBundleId?: string;
  derivedFromCheckpointId?: string;
  retentionReason?: string;
}

export type AttemptStatus = 'running' | 'success' | 'failure' | 'partial';

export type EpisodeStatus = 'open' | 'resolved' | 'abandoned';

export type FailureSignalSeverity = 'low' | 'medium' | 'high';

export interface FailureSignal {
  id: string;
  label: string;
  sourceNodeIds: string[];
  severity: FailureSignalSeverity;
  reason: string;
  signalType: 'risk' | 'state' | 'decision' | 'bundle';
}

export interface ProcedureCandidate {
  id: string;
  attemptId: string;
  episodeId?: string;
  stepNodeIds: string[];
  stepLabels: string[];
  prerequisiteNodeIds: string[];
  prerequisiteLabels: string[];
  failureSignalIds: string[];
  successSignals: string[];
  criticalStepNodeIds: string[];
  confidence: number;
  status: 'candidate' | 'validated';
}

export interface PromotedPattern {
  id: string;
  sourceAttemptId: string;
  sourceEpisodeId: string;
  goalLabel?: string;
  query: string;
  sourceNodeIds: string[];
  evidenceNodeIds: string[];
  promotionState: 'candidate' | 'reinforced' | 'retired' | 'downgraded';
  confidence: number;
  provenance: ProvenanceRef;
  createdAt: string;
  observationCount?: number;
  downgradeCount?: number;
  decayState?: MemoryDecayState;
  patternTags?: string[];
}

export interface FailurePattern extends PromotedPattern {
  kind: 'failure_pattern';
  failureSignalIds: string[];
  riskNodeIds: string[];
  blockedStepNodeIds: string[];
}

export interface SuccessfulProcedure extends PromotedPattern {
  kind: 'successful_procedure';
  stepNodeIds: string[];
  stepLabels: string[];
  prerequisiteNodeIds: string[];
  prerequisiteLabels: string[];
  criticalStepNodeIds: string[];
}

export interface Pattern extends PromotedPattern {
  kind: 'pattern';
  patternType: 'failure' | 'success' | 'mixed';
  failureSignalIds: string[];
  successSignals: string[];
}

export interface Attempt {
  id: string;
  sessionId: string;
  workspaceId?: string;
  bundleId: string;
  goalLabel?: string;
  query: string;
  status: AttemptStatus;
  stepNodeIds: string[];
  decisionNodeIds: string[];
  stateNodeIds: string[];
  outcomeNodeIds: string[];
  riskNodeIds: string[];
  evidenceNodeIds: string[];
  failureSignals: FailureSignal[];
  successSignals: string[];
  criticalStepNodeIds: string[];
  criticalStepLabels: string[];
  procedureCandidate?: ProcedureCandidate;
  provenance: ProvenanceRef;
  createdAt: string;
}

export interface Episode {
  id: string;
  sessionId: string;
  workspaceId?: string;
  goalLabel?: string;
  query: string;
  attemptIds: string[];
  winningAttemptId?: string;
  status: EpisodeStatus;
  successPathStepNodeIds: string[];
  failedAttemptIds: string[];
  keyFailureSignalIds: string[];
  keySuccessSignals: string[];
  criticalStepNodeIds: string[];
  provenance: ProvenanceRef;
  createdAt: string;
}

export interface TraceLearningView {
  attemptId?: string;
  attemptStatus?: AttemptStatus;
  episodeId?: string;
  episodeStatus?: EpisodeStatus;
  failureSignalIds: string[];
  criticalStepNodeIds: string[];
  procedureCandidateId?: string;
  nodeRoles?: string[];
}

export interface TraceView {
  source: TraceSourceView;
  transformation: TraceTransformationView;
  selection: TraceSelectionView;
  output: TraceOutputView;
  persistence: TracePersistenceView;
  learning?: TraceLearningView;
}

export interface ContextSelectionDiagnostic {
  nodeId: string;
  type: NodeType;
  label: string;
  estimatedTokens: number;
  provenance?: ProvenanceRef;
  governance?: NodeGovernance;
  reason: string;
}

export interface RuntimeContextFixedDiagnostics {
  selected: ContextSelectionDiagnostic[];
  skipped: ContextSelectionDiagnostic[];
}

export interface RuntimeContextCategoryDiagnostics {
  category: RuntimeContextCategory;
  allocatedBudget: number;
  inputCount: number;
  selectedCount: number;
  skippedCount: number;
  selectedTokens: number;
  refillSelectedCount: number;
  selected: ContextSelectionDiagnostic[];
  skipped: ContextSelectionDiagnostic[];
}

export interface RuntimeContextFailureSignalDiagnostic {
  nodeId: string;
  label: string;
  severity: FailureSignalSeverity;
  sourceNodeIds: string[];
}

export interface RuntimeContextProcedureDiagnostic {
  nodeId: string;
  label: string;
  status: ProcedureCandidate['status'];
  confidence: number;
  stepNodeIds: string[];
  stepLabels: string[];
  prerequisiteNodeIds: string[];
  prerequisiteLabels: string[];
  criticalStepNodeIds: string[];
}

export interface RuntimeContextPatternDiagnostic {
  nodeId: string;
  type: Extract<NodeType, 'Pattern' | 'FailurePattern' | 'SuccessfulProcedure'>;
  label: string;
  scope: Scope;
  promotionState?: string;
  confidence: number;
  sourceNodeIds: string[];
}

export interface RuntimeContextLearningDiagnostics {
  attemptNodeIds: string[];
  episodeNodeIds: string[];
  successSignals: string[];
  criticalStepNodeIds: string[];
  criticalStepLabels: string[];
  failureSignals: RuntimeContextFailureSignalDiagnostic[];
  procedureCandidates: RuntimeContextProcedureDiagnostic[];
  promotedPatterns?: RuntimeContextPatternDiagnostic[];
}

export type RelationRetrievalStrategy =
  | 'batch_adjacency'
  | 'single_source_fallback'
  | 'single_node_adjacency'
  | 'no_relation_sources';

export type RelationRecallRankingMode = 'bonus_then_hops' | 'hops_then_bonus';

export interface RelationRecallPolicy {
  maxHops: 1 | 2;
  secondHopEdgeTypes: EdgeType[];
  pathBudget: number;
  maxPathsPerTarget: number;
  maxPathsPerSource: number;
  maxExpandedTargets: number;
  minPathBonus: number;
  rankingMode: RelationRecallRankingMode;
}

export interface RelationRetrievalDiagnostics {
  strategy: RelationRetrievalStrategy;
  sourceCount: number;
  sourceSlots: RuntimeContextSelectionSlot[];
  edgeTypes: EdgeType[];
  edgeLookupCount: number;
  nodeLookupCount: number;
  scannedEdgeCount: number;
  eligibleEdgeCount: number;
  relatedNodeCount: number;
  maxHopCount?: number;
  pathBudget?: number;
  maxPathsPerTarget?: number;
  maxPathsPerSource?: number;
  maxExpandedTargets?: number;
  minPathBonus?: number;
  rankingMode?: RelationRecallRankingMode;
  candidatePathCount?: number;
  admittedPathCount?: number;
  pathCount?: number;
  prunedPathCount?: number;
  prunedByBudgetCount?: number;
  prunedByTargetCount?: number;
  prunedBySourceCount?: number;
  prunedByExpansionCount?: number;
  prunedByScoreCount?: number;
  pathBudgetExhausted?: boolean;
  selectedPathSamples?: string[];
  prunedPathSamples?: string[];
  fallbackReason?: string;
}

export interface RelationRecallPathHop {
  edgeType: EdgeType;
  fromNodeId: string;
  toNodeId: string;
  fromLabel: string;
  toLabel: string;
}

export interface RelationRecallPath {
  sourceNodeId: string;
  sourceSlot: RuntimeContextSelectionSlot;
  targetNodeId: string;
  hopCount: number;
  bonus: number;
  hops: RelationRecallPathHop[];
}

export interface RuntimeContextDiagnostics {
  fixed: RuntimeContextFixedDiagnostics;
  categoryBudgets: Record<RuntimeContextCategory, number>;
  categories: RuntimeContextCategoryDiagnostics[];
  topicHints?: ContextSelectionDiagnostic[];
  topicAdmissions?: ContextSelectionDiagnostic[];
  relationRetrieval?: RelationRetrievalDiagnostics;
  learning?: RuntimeContextLearningDiagnostics;
}

export interface TokenBudgetUsage {
  total: number;
  used: number;
  reserved: number;
}

export interface RuntimeContextBundle {
  id: string;
  sessionId: string;
  workspaceId?: string;
  query: string;
  goal?: ContextSelection;
  intent?: ContextSelection;
  activeRules: ContextSelection[];
  activeConstraints: ContextSelection[];
  currentProcess?: ContextSelection;
  recentDecisions: ContextSelection[];
  recentStateChanges: ContextSelection[];
  relevantEvidence: ContextSelection[];
  candidateSkills: ContextSelection[];
  openRisks: ContextSelection[];
  tokenBudget: TokenBudgetUsage;
  diagnostics?: RuntimeContextDiagnostics;
  createdAt: string;
}

export type MemoryDecayState = 'fresh' | 'cooling' | 'stale';

export type MemoryRetentionClass = 'rolling' | 'sticky';

export type MemoryPromotionTarget = 'Skill' | 'CandidateOnly';

export type MemoryRetirementStatus = 'keep' | 'retire_candidate';

export type KnowledgePromotionClass =
  | 'failure_experience'
  | 'local_procedure'
  | 'stable_skill'
  | 'hard_constraint_candidate';

export type KnowledgePromotionDecision = 'hold' | 'promote' | 'retire';

export type KnowledgeContaminationRisk = 'low' | 'medium' | 'high';

export interface KnowledgePromotionGovernance {
  knowledgeClass: KnowledgePromotionClass;
  promotionDecision: KnowledgePromotionDecision;
  contaminationRisk: KnowledgeContaminationRisk;
  rollbackSupported: boolean;
  observationCount: number;
  downgradeCount: number;
  workspaceEligible: boolean;
  globalEligible: boolean;
  reasons: string[];
}

export interface CheckpointLifecycle {
  retentionClass: MemoryRetentionClass;
  decayState: MemoryDecayState;
  reason: string;
}

export interface SkillCandidateLifecycle {
  stage: 'candidate';
  governance: {
    knowledgeClass: Extract<KnowledgePromotionClass, 'local_procedure' | 'stable_skill'>;
    contaminationRisk: KnowledgeContaminationRisk;
    rollbackSupported: boolean;
    reason: string;
  };
  promotion: {
    ready: boolean;
    target: MemoryPromotionTarget;
    minEvidenceCount: number;
    minStability: number;
    minClarity: number;
    reason: string;
  };
  merge: {
    mergeKey: string;
    eligible: boolean;
    reason: string;
    mergedFromCandidateIds?: string[];
  };
  retirement: {
    status: MemoryRetirementStatus;
    reason: string;
    replacedByCandidateId?: string;
  };
  decay: {
    state: MemoryDecayState;
    reason: string;
  };
}

export interface CheckpointSummary {
  goal?: string;
  intent?: string;
  activeRuleIds: string[];
  activeConstraintIds: string[];
  currentProcessId?: string;
  recentDecisionIds: string[];
  recentStateIds: string[];
  openRiskIds: string[];
}

export interface SessionCheckpoint {
  id: string;
  sessionId: string;
  sourceBundleId?: string;
  summary: CheckpointSummary;
  lifecycle?: CheckpointLifecycle;
  provenance?: ProvenanceRef;
  tokenEstimate: number;
  createdAt: string;
}

export interface SessionDelta {
  id: string;
  sessionId: string;
  checkpointId?: string;
  sourceBundleId?: string;
  provenance?: ProvenanceRef;
  addedRuleIds: string[];
  addedConstraintIds: string[];
  addedDecisionIds: string[];
  addedStateIds: string[];
  addedRiskIds: string[];
  tokenEstimate: number;
  createdAt: string;
}

export interface SkillCandidate {
  id: string;
  name: string;
  sourceBundleId?: string;
  sourceCheckpointId?: string;
  sourceNodeIds?: string[];
  trigger: JsonObject;
  applicableWhen: string[];
  requiredRuleIds: string[];
  requiredConstraintIds: string[];
  workflowSteps: string[];
  expectedOutcome: JsonObject;
  failureSignals: string[];
  evidenceNodeIds: string[];
  lifecycle?: SkillCandidateLifecycle;
  provenance?: ProvenanceRef;
  scores: {
    frequency: number;
    stability: number;
    success: number;
    clarity: number;
  };
  createdAt: string;
}
