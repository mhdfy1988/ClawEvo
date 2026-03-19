import type { RawContextRecord } from '@openclaw-compact-context/contracts';
import type {
  ContextInputRouteKind,
  SemanticExtractionContract,
  ContextProcessingFallbackKind,
  SemanticExtractionNodeTarget,
  ContextSummaryContract,
  ContextSummaryContractItem,
  BundleContractSnapshot
} from '@openclaw-compact-context/contracts';
import type {
  RuntimeContextBundle,
  RuntimeContextBundleMetadata,
  RuntimeContextCategory,
  RuntimeContextFixedSlot,
  RuntimeContextSelectionSlot
} from '@openclaw-compact-context/contracts';

export const CONTEXT_PROCESSING_CONTRACT_VERSION = 'stage4-second-pass-v1';

export const REQUIRED_BUNDLE_FIXED_SLOTS = ['goal', 'intent', 'currentProcess'] as const satisfies readonly RuntimeContextFixedSlot[];
export const REQUIRED_BUNDLE_CATEGORIES = [
  'activeRules',
  'activeConstraints',
  'openRisks',
  'recentDecisions',
  'recentStateChanges',
  'relevantEvidence',
  'candidateSkills'
] as const satisfies readonly RuntimeContextCategory[];

const SUMMARY_REQUIRED_SLOTS = [
  ...REQUIRED_BUNDLE_FIXED_SLOTS,
  ...REQUIRED_BUNDLE_CATEGORIES
] as const satisfies readonly RuntimeContextSelectionSlot[];

const CONVERSATION_NODE_TYPES = [
  'Intent',
  'Goal',
  'Constraint',
  'Risk',
  'Process',
  'Step',
  'Topic',
  'Concept'
] as const satisfies readonly SemanticExtractionNodeTarget[];

const TOOL_RESULT_NODE_TYPES = [
  'State',
  'Risk',
  'Outcome',
  'Tool',
  'Process',
  'Step',
  'Topic',
  'Concept'
] as const satisfies readonly SemanticExtractionNodeTarget[];

const TRANSCRIPT_NODE_TYPES = [
  'Intent',
  'Decision',
  'State',
  'Constraint',
  'Process',
  'Step',
  'Risk',
  'Topic',
  'Concept'
] as const satisfies readonly SemanticExtractionNodeTarget[];

const DOCUMENT_NODE_TYPES = [
  'Rule',
  'Constraint',
  'Process',
  'Step',
  'Skill',
  'Outcome',
  'Tool',
  'Topic',
  'Concept'
] as const satisfies readonly SemanticExtractionNodeTarget[];

const EXPERIENCE_TRACE_NODE_TYPES = [
  'Decision',
  'State',
  'Risk',
  'Process',
  'Step',
  'Skill',
  'Topic',
  'Concept'
] as const satisfies readonly SemanticExtractionNodeTarget[];

const SYSTEM_NODE_TYPES = [
  'Rule',
  'Constraint',
  'Mode',
  'Process',
  'Step',
  'Topic',
  'Concept'
] as const satisfies readonly SemanticExtractionNodeTarget[];

const DEFAULT_FALLBACKS = ['raw_record', 'sentence_split', 'coarse_node'] as const satisfies readonly ContextProcessingFallbackKind[];

const SEMANTIC_EXTRACTION_CONTRACTS: Record<ContextInputRouteKind, SemanticExtractionContract> = {
  conversation: {
    version: CONTEXT_PROCESSING_CONTRACT_VERSION,
    route: 'conversation',
    preserveRawEvidence: true,
    clauseSplit: true,
    evidenceAnchorRequired: true,
    conceptNormalization: true,
    multiNodeMaterialization: true,
    fallbackOrder: [...DEFAULT_FALLBACKS, 'unresolved_concept'],
    supportedNodeTypes: CONVERSATION_NODE_TYPES
  },
  tool_result: {
    version: CONTEXT_PROCESSING_CONTRACT_VERSION,
    route: 'tool_result',
    preserveRawEvidence: true,
    clauseSplit: false,
    evidenceAnchorRequired: true,
    conceptNormalization: true,
    multiNodeMaterialization: true,
    fallbackOrder: ['raw_record', 'coarse_node', 'supported_by_only'],
    supportedNodeTypes: TOOL_RESULT_NODE_TYPES
  },
  transcript: {
    version: CONTEXT_PROCESSING_CONTRACT_VERSION,
    route: 'transcript',
    preserveRawEvidence: true,
    clauseSplit: true,
    evidenceAnchorRequired: true,
    conceptNormalization: true,
    multiNodeMaterialization: true,
    fallbackOrder: [...DEFAULT_FALLBACKS, 'unresolved_concept'],
    supportedNodeTypes: TRANSCRIPT_NODE_TYPES
  },
  document: {
    version: CONTEXT_PROCESSING_CONTRACT_VERSION,
    route: 'document',
    preserveRawEvidence: true,
    clauseSplit: false,
    evidenceAnchorRequired: true,
    conceptNormalization: true,
    multiNodeMaterialization: true,
    fallbackOrder: ['raw_record', 'coarse_node', 'unresolved_concept'],
    supportedNodeTypes: DOCUMENT_NODE_TYPES
  },
  experience_trace: {
    version: CONTEXT_PROCESSING_CONTRACT_VERSION,
    route: 'experience_trace',
    preserveRawEvidence: true,
    clauseSplit: true,
    evidenceAnchorRequired: true,
    conceptNormalization: true,
    multiNodeMaterialization: true,
    fallbackOrder: [...DEFAULT_FALLBACKS, 'supported_by_only'],
    supportedNodeTypes: EXPERIENCE_TRACE_NODE_TYPES
  },
  system: {
    version: CONTEXT_PROCESSING_CONTRACT_VERSION,
    route: 'system',
    preserveRawEvidence: true,
    clauseSplit: false,
    evidenceAnchorRequired: true,
    conceptNormalization: true,
    multiNodeMaterialization: true,
    fallbackOrder: ['raw_record', 'coarse_node'],
    supportedNodeTypes: SYSTEM_NODE_TYPES
  }
};

export function resolveContextInputRoute(record: RawContextRecord): ContextInputRouteKind {
  const explicitRoute = readStringMetadata(record, 'contextRoute');

  if (isContextInputRouteKind(explicitRoute)) {
    return explicitRoute;
  }

  const sourceStage = record.provenance?.sourceStage;
  const transcriptType = readStringMetadata(record, 'transcriptType');

  if (
    sourceStage === 'transcript_message' ||
    sourceStage === 'transcript_custom' ||
    sourceStage === 'transcript_compaction' ||
    typeof transcriptType === 'string'
  ) {
    return 'transcript';
  }

  if (
    sourceStage === 'runtime_bundle' ||
    sourceStage === 'checkpoint' ||
    sourceStage === 'delta' ||
    sourceStage === 'skill_candidate' ||
    readBooleanMetadata(record, 'isExperienceTrace') === true
  ) {
    return 'experience_trace';
  }

  if (
    record.sourceType === 'tool_output' ||
    sourceStage === 'tool_output_raw' ||
    sourceStage === 'tool_output_summary' ||
    sourceStage === 'tool_result_persist'
  ) {
    return 'tool_result';
  }

  if (
    record.sourceType === 'document' ||
    record.sourceType === 'rule' ||
    record.sourceType === 'workflow' ||
    record.sourceType === 'skill' ||
    sourceStage === 'document_raw' ||
    sourceStage === 'document_extract'
  ) {
    return 'document';
  }

  if (record.sourceType === 'system') {
    return 'system';
  }

  return 'conversation';
}

export function annotateContextInputRoute(record: RawContextRecord): RawContextRecord {
  const route = resolveContextInputRoute(record);

  return {
    ...record,
    metadata: {
      ...(record.metadata ?? {}),
      contextRoute: route,
      contextContractVersion: CONTEXT_PROCESSING_CONTRACT_VERSION
    }
  };
}

export function getSemanticExtractionContract(route: ContextInputRouteKind): SemanticExtractionContract {
  return SEMANTIC_EXTRACTION_CONTRACTS[route];
}

export function buildContextSummaryContract(bundle: RuntimeContextBundle): ContextSummaryContract {
  const metadata = buildRuntimeContextBundleMetadata(bundle);

  return {
    version: CONTEXT_PROCESSING_CONTRACT_VERSION,
    bundleId: bundle.id,
    sessionId: bundle.sessionId,
    query: bundle.query,
    ...(bundle.goal ? { goal: selectionToSummaryItem(bundle.goal) } : {}),
    ...(bundle.intent ? { intent: selectionToSummaryItem(bundle.intent) } : {}),
    ...(bundle.currentProcess ? { currentProcess: selectionToSummaryItem(bundle.currentProcess) } : {}),
    activeRules: bundle.activeRules.map(selectionToSummaryItem),
    activeConstraints: bundle.activeConstraints.map(selectionToSummaryItem),
    openRisks: bundle.openRisks.map(selectionToSummaryItem),
    recentDecisions: bundle.recentDecisions.map(selectionToSummaryItem),
    recentStateChanges: bundle.recentStateChanges.map(selectionToSummaryItem),
    relevantEvidence: bundle.relevantEvidence.map(selectionToSummaryItem),
    candidateSkills: bundle.candidateSkills.map(selectionToSummaryItem),
    requiredSlots: [...SUMMARY_REQUIRED_SLOTS],
    tokenBudget: bundle.tokenBudget,
    metadata
  };
}

export function buildBundleContractSnapshot(bundle: RuntimeContextBundle): BundleContractSnapshot {
  const metadata = buildRuntimeContextBundleMetadata(bundle);

  return {
    version: CONTEXT_PROCESSING_CONTRACT_VERSION,
    bundleId: bundle.id,
    sessionId: bundle.sessionId,
    query: bundle.query,
    requiredFixedSlots: REQUIRED_BUNDLE_FIXED_SLOTS,
    requiredCategories: REQUIRED_BUNDLE_CATEGORIES,
    fixedSlotCoverage: {
      goal: Boolean(bundle.goal),
      intent: Boolean(bundle.intent),
      currentProcess: Boolean(bundle.currentProcess)
    },
    categoryCounts: {
      activeRules: bundle.activeRules.length,
      activeConstraints: bundle.activeConstraints.length,
      openRisks: bundle.openRisks.length,
      recentDecisions: bundle.recentDecisions.length,
      recentStateChanges: bundle.recentStateChanges.length,
      relevantEvidence: bundle.relevantEvidence.length,
      candidateSkills: bundle.candidateSkills.length
    },
    topicHintCount: bundle.diagnostics?.topicHints?.length ?? 0,
    relationRetrievalEnabled: Boolean(bundle.diagnostics?.relationRetrieval),
    metadata
  };
}

export function buildRuntimeContextBundleMetadata(
  bundle: RuntimeContextBundle,
  options?: Pick<RuntimeContextBundleMetadata, 'compressionMode' | 'baselineId'>
): RuntimeContextBundleMetadata {
  const selections = collectBundleSelections(bundle);
  const requiresEvidenceSelectionCount = selections.filter(
    (selection) => selection.governance?.promptReadiness.requiresEvidence === true
  ).length;
  const supportingEvidenceCount = bundle.relevantEvidence.length;

  return {
    ...(options?.compressionMode ?? bundle.metadata?.compressionMode
      ? { compressionMode: options?.compressionMode ?? bundle.metadata?.compressionMode }
      : {}),
    ...(options?.baselineId ?? bundle.metadata?.baselineId
      ? { baselineId: options?.baselineId ?? bundle.metadata?.baselineId }
      : {}),
    evidenceCoverage: {
      requiresEvidenceSelectionCount,
      supportingEvidenceCount,
      evidenceSatisfied: requiresEvidenceSelectionCount === 0 || supportingEvidenceCount > 0
    }
  };
}

function selectionToSummaryItem(selection: RuntimeContextBundle['activeRules'][number]): ContextSummaryContractItem {
  return {
    nodeId: selection.nodeId,
    type: selection.type,
    label: selection.label,
    reason: selection.reason,
    ...(selection.governance?.promptReadiness.preferredForm
      ? { preferredForm: selection.governance.promptReadiness.preferredForm }
      : {}),
    ...(selection.governance ? { requiresEvidence: selection.governance.promptReadiness.requiresEvidence } : {})
  };
}

function collectBundleSelections(bundle: RuntimeContextBundle) {
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

function readStringMetadata(record: RawContextRecord, key: string): string | undefined {
  const value = record.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readBooleanMetadata(record: RawContextRecord, key: string): boolean | undefined {
  const value = record.metadata?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

function isContextInputRouteKind(value: string | undefined): value is ContextInputRouteKind {
  return (
    value === 'conversation' ||
    value === 'tool_result' ||
    value === 'transcript' ||
    value === 'document' ||
    value === 'experience_trace' ||
    value === 'system'
  );
}
