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
}
