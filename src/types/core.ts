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
  | 'Concept';

export type EdgeType =
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

export interface TraceView {
  source: TraceSourceView;
  transformation: TraceTransformationView;
  selection: TraceSelectionView;
  output: TraceOutputView;
  persistence: TracePersistenceView;
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

export type RelationRetrievalStrategy =
  | 'batch_adjacency'
  | 'single_source_fallback'
  | 'single_node_adjacency'
  | 'no_relation_sources';

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
  fallbackReason?: string;
}

export interface RuntimeContextDiagnostics {
  fixed: RuntimeContextFixedDiagnostics;
  categoryBudgets: Record<RuntimeContextCategory, number>;
  categories: RuntimeContextCategoryDiagnostics[];
  topicHints?: ContextSelectionDiagnostic[];
  relationRetrieval?: RelationRetrievalDiagnostics;
}

export interface TokenBudgetUsage {
  total: number;
  used: number;
  reserved: number;
}

export interface RuntimeContextBundle {
  id: string;
  sessionId: string;
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

export interface CheckpointLifecycle {
  retentionClass: MemoryRetentionClass;
  decayState: MemoryDecayState;
  reason: string;
}

export interface SkillCandidateLifecycle {
  stage: 'candidate';
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
