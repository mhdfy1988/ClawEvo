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
  | 'Mode';

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

export interface SourceRef {
  sourceType: string;
  sourcePath?: string;
  sourceSpan?: string;
  contentHash?: string;
  extractor?: string;
}

export type ProvenanceOriginKind = 'raw' | 'compressed' | 'derived';

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
  rawSourceId?: string;
  rawContentHash?: string;
  transcriptEntryId?: string;
  transcriptParentId?: string;
  derivedFromNodeIds?: string[];
  derivedFromCheckpointId?: string;
  compressionRunId?: string;
  createdByHook?: string;
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
  version: string;
  validFrom: string;
  validTo?: string;
  updatedAt: string;
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

export interface ContextSelectionDiagnostic {
  nodeId: string;
  type: NodeType;
  label: string;
  estimatedTokens: number;
  provenance?: ProvenanceRef;
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

export interface RuntimeContextDiagnostics {
  fixed: RuntimeContextFixedDiagnostics;
  categoryBudgets: Record<RuntimeContextCategory, number>;
  categories: RuntimeContextCategoryDiagnostics[];
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
  summary: CheckpointSummary;
  provenance?: ProvenanceRef;
  tokenEstimate: number;
  createdAt: string;
}

export interface SessionDelta {
  id: string;
  sessionId: string;
  checkpointId?: string;
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
  trigger: JsonObject;
  applicableWhen: string[];
  requiredRuleIds: string[];
  requiredConstraintIds: string[];
  workflowSteps: string[];
  expectedOutcome: JsonObject;
  failureSignals: string[];
  evidenceNodeIds: string[];
  provenance?: ProvenanceRef;
  scores: {
    frequency: number;
    stability: number;
    success: number;
    clarity: number;
  };
  createdAt: string;
}
