import type {
  Freshness,
  GraphNode,
  JsonObject,
  KnowledgeStrength,
  NodeGovernanceConflict,
  NodeGovernance,
  NodeGovernancePromptReadiness,
  NodeGovernanceValidity,
  NodePromptBudgetClass,
  NodePromptPreferredForm,
  NodePromptSelectionPriority,
  NodeType,
  ProvenanceOriginKind,
  ProvenanceRef,
  Scope
} from '../types/core.js';
import { buildScopePolicy, normalizeScopePolicy } from './scope-policy.js';

interface GovernanceBuildInput {
  type: NodeType;
  scope?: Scope;
  strength: KnowledgeStrength;
  confidence: number;
  freshness: Freshness;
  validFrom: string;
  validTo?: string;
  provenance?: ProvenanceRef;
  sourceType?: string;
  workspaceId?: string;
  conflict?: NodeGovernanceConflict;
}

export function buildNodeGovernance(input: GovernanceBuildInput): NodeGovernance {
  const knowledgeState = deriveKnowledgeState(input.provenance);
  const scope = input.scope ?? 'session';

  return {
    provenance: input.provenance,
    knowledgeState,
    validity: {
      confidence: input.confidence,
      freshness: input.freshness,
      validFrom: input.validFrom,
      ...(input.validTo ? { validTo: input.validTo } : {}),
      ...(input.conflict?.conflictStatus ? { conflictStatus: input.conflict.conflictStatus } : {}),
      ...(input.conflict?.resolutionState ? { resolutionState: input.conflict.resolutionState } : {})
    },
    ...(input.conflict ? { conflict: normalizeConflict(input.conflict) } : {}),
    promptReadiness: buildPromptReadiness(input.type, knowledgeState, input.sourceType),
    scopePolicy: buildScopePolicy({
      scope,
      type: input.type,
      workspaceId: input.workspaceId
    }),
    traceability: {
      ...(input.provenance?.rawSourceId ? { rawSourceId: input.provenance.rawSourceId } : {}),
      ...(input.provenance?.derivedFromNodeIds ? { derivedFromNodeIds: input.provenance.derivedFromNodeIds } : {}),
      ...(input.provenance?.derivedFromCheckpointId
        ? { derivedFromCheckpointId: input.provenance.derivedFromCheckpointId }
        : {})
    }
  };
}

export function normalizeNodeGovernance(
  node: Pick<
    GraphNode,
    | 'type'
    | 'scope'
    | 'payload'
    | 'strength'
    | 'confidence'
    | 'freshness'
    | 'validFrom'
    | 'validTo'
    | 'provenance'
    | 'governance'
  >
): NodeGovernance {
  const payloadGovernance = readPayloadGovernance(node.payload);
  const base = buildNodeGovernance({
    type: node.type,
    scope: node.scope,
    strength: node.strength,
    confidence: node.confidence,
    freshness: node.freshness,
    validFrom: node.validFrom,
    validTo: node.validTo,
    provenance: node.provenance,
    sourceType: readPayloadString(node.payload, 'sourceType'),
    workspaceId: readPayloadString(node.payload, 'workspaceId')
  });
  const provided = node.governance ?? payloadGovernance;
  const provenance = provided?.provenance ?? base.provenance;
  const knowledgeState = provided?.knowledgeState ?? deriveKnowledgeState(provenance);

  return {
    provenance,
    knowledgeState,
    validity: normalizeValidity(provided?.validity, base.validity),
    ...(provided?.conflict || base.conflict
      ? {
          conflict: normalizeConflict(
            provided?.conflict ?? base.conflict,
            provided?.validity ?? base.validity
          )
        }
      : {}),
    promptReadiness: normalizePromptReadiness(provided?.promptReadiness, {
      ...base.promptReadiness,
      preferredForm: normalizePreferredFormForState(base.promptReadiness.preferredForm, knowledgeState)
    }),
    scopePolicy: normalizeScopePolicy(provided?.scopePolicy, base.scopePolicy),
    traceability: {
      ...(provided?.traceability?.rawSourceId || provenance?.rawSourceId
        ? { rawSourceId: provided?.traceability?.rawSourceId ?? provenance?.rawSourceId }
        : {}),
      ...(provided?.traceability?.derivedFromNodeIds || provenance?.derivedFromNodeIds
        ? {
            derivedFromNodeIds:
              provided?.traceability?.derivedFromNodeIds ?? provenance?.derivedFromNodeIds
          }
        : {}),
      ...(provided?.traceability?.derivedFromCheckpointId || provenance?.derivedFromCheckpointId
        ? {
            derivedFromCheckpointId:
              provided?.traceability?.derivedFromCheckpointId ?? provenance?.derivedFromCheckpointId
          }
        : {})
    }
  };
}

export function describeGovernanceSummary(governance: NodeGovernance): string {
  const validity = governance.validity;
  const readiness = governance.promptReadiness;
  const validityParts = [
    `freshness=${validity.freshness}`,
    `confidence=${formatConfidence(validity.confidence)}`,
    validity.conflictStatus ? `conflict=${validity.conflictStatus}` : undefined,
    validity.resolutionState ? `resolution=${validity.resolutionState}` : undefined
  ].filter((value): value is string => Boolean(value));
  const readinessParts = [
    readiness.eligible ? 'eligible' : 'blocked',
    readiness.preferredForm,
    readiness.selectionPriority,
    readiness.budgetClass,
    readiness.requiresEvidence ? 'needs-evidence' : undefined,
    readiness.requiresCompression ? 'needs-compression' : undefined
  ].filter((value): value is string => Boolean(value));
  const scopePolicy = governance.scopePolicy;
  const scopeParts = [
    `current=${scopePolicy.currentScope}`,
    `recall=${scopePolicy.recallTier}`,
    `write=${scopePolicy.writeAuthority}`,
    scopePolicy.promotion.eligible
      ? `promote=${scopePolicy.promotion.target ?? 'stay'}${scopePolicy.promotion.requiresManualReview ? ':manual' : ''}`
      : 'promote=stay'
  ];

  return `Governance: state=${governance.knowledgeState}; validity=${validityParts.join(', ')}; prompt=${readinessParts.join(', ')}; scope=${scopeParts.join(', ')}.`;
}

export function describeConflictSummary(governance: NodeGovernance): string {
  const conflict = governance.conflict;

  if (!conflict?.conflictStatus || conflict.conflictStatus === 'none') {
    return '';
  }

  const parts = [
    `status=${conflict.conflictStatus}`,
    conflict.resolutionState ? `resolution=${conflict.resolutionState}` : undefined,
    conflict.conflictSetKey ? `set=${conflict.conflictSetKey}` : undefined,
    typeof conflict.overridePriority === 'number' ? `priority=${conflict.overridePriority}` : undefined,
    conflict.supersededByNodeId ? `supersededBy=${conflict.supersededByNodeId}` : undefined,
    conflict.conflictingNodeIds?.length ? `against=${conflict.conflictingNodeIds.join('|')}` : undefined
  ].filter((value): value is string => Boolean(value));

  return ` Conflict: ${parts.join(', ')}.`;
}

export function isSuppressedByConflict(governance: NodeGovernance): boolean {
  return (
    governance.validity.resolutionState === 'suppressed' ||
    governance.conflict?.resolutionState === 'suppressed' ||
    governance.validity.freshness === 'superseded' ||
    governance.conflict?.conflictStatus === 'superseded'
  );
}

export function applyConflictGovernance(
  node: GraphNode,
  patch: Partial<NodeGovernanceConflict> & {
    freshness?: Freshness;
    validTo?: string;
  }
): GraphNode {
  const governance = normalizeNodeGovernance(node);
  const nextConflict = normalizeConflict(
    {
      ...(governance.conflict ?? {}),
      ...patch
    },
    {
      ...governance.validity,
      ...(patch.conflictStatus ? { conflictStatus: patch.conflictStatus } : {}),
      ...(patch.resolutionState ? { resolutionState: patch.resolutionState } : {})
    }
  );
  const nextGovernance: NodeGovernance = {
    ...governance,
    validity: {
      ...governance.validity,
      ...(patch.conflictStatus ? { conflictStatus: patch.conflictStatus } : {}),
      ...(patch.resolutionState ? { resolutionState: patch.resolutionState } : {}),
      ...(patch.freshness ? { freshness: patch.freshness } : {}),
      ...(patch.validTo ? { validTo: patch.validTo } : {})
    },
    conflict: nextConflict
  };

  return {
    ...node,
    freshness: patch.freshness ?? node.freshness,
    ...(patch.validTo ? { validTo: patch.validTo } : {}),
    governance: nextGovernance
  };
}

export function promptReadinessScore(governance: NodeGovernance): number {
  if (!governance.promptReadiness.eligible) {
    return -100;
  }

  return selectionPriorityScore(governance.promptReadiness.selectionPriority) + budgetClassScore(governance.promptReadiness.budgetClass);
}

export function validityScore(governance: NodeGovernance): number {
  const { validity } = governance;

  if (validity.resolutionState === 'suppressed') {
    return -40;
  }

  switch (validity.freshness) {
    case 'active':
      return 2;
    case 'stale':
      return -1;
    case 'superseded':
      return -8;
    default:
      return 0;
  }
}

function deriveKnowledgeState(provenance?: ProvenanceRef): ProvenanceOriginKind {
  return provenance?.originKind ?? 'raw';
}

function buildPromptReadiness(
  type: NodeType,
  knowledgeState: ProvenanceOriginKind,
  sourceType?: string
): NodeGovernancePromptReadiness {
  const preferredForm = defaultPreferredForm(type, knowledgeState);
  const selectionPriority = defaultSelectionPriority(type);
  const budgetClass = defaultBudgetClass(type);

  return {
    eligible: !isExperienceTraceNodeType(type),
    preferredForm,
    requiresEvidence: type === 'Rule' || type === 'Constraint' || type === 'Risk',
    requiresCompression: sourceType === 'tool_output' && knowledgeState === 'raw',
    selectionPriority,
    budgetClass
  };
}

function normalizeValidity(
  provided: Partial<NodeGovernanceValidity> | undefined,
  fallback: NodeGovernanceValidity
): NodeGovernanceValidity {
  return {
    confidence: typeof provided?.confidence === 'number' ? provided.confidence : fallback.confidence,
    freshness: isFreshness(provided?.freshness) ? provided.freshness : fallback.freshness,
    validFrom: typeof provided?.validFrom === 'string' && provided.validFrom ? provided.validFrom : fallback.validFrom,
    ...(typeof provided?.validTo === 'string'
      ? { validTo: provided.validTo }
      : fallback.validTo
        ? { validTo: fallback.validTo }
        : {}),
    ...(isConflictStatus(provided?.conflictStatus)
      ? { conflictStatus: provided.conflictStatus }
      : fallback.conflictStatus
        ? { conflictStatus: fallback.conflictStatus }
        : {}),
    ...(isResolutionState(provided?.resolutionState)
      ? { resolutionState: provided.resolutionState }
      : fallback.resolutionState
        ? { resolutionState: fallback.resolutionState }
        : {})
  };
}

function normalizeConflict(
  provided: Partial<NodeGovernanceConflict> | undefined,
  validity?: Partial<NodeGovernanceValidity>
): NodeGovernanceConflict | undefined {
  if (!provided && !validity?.conflictStatus && !validity?.resolutionState) {
    return undefined;
  }

  return {
    ...(isConflictStatus(provided?.conflictStatus ?? validity?.conflictStatus)
      ? { conflictStatus: provided?.conflictStatus ?? validity?.conflictStatus }
      : {}),
    ...(isResolutionState(provided?.resolutionState ?? validity?.resolutionState)
      ? { resolutionState: provided?.resolutionState ?? validity?.resolutionState }
      : {}),
    ...(typeof provided?.conflictSetKey === 'string' && provided.conflictSetKey
      ? { conflictSetKey: provided.conflictSetKey }
      : {}),
    ...(typeof provided?.overridePriority === 'number' ? { overridePriority: provided.overridePriority } : {}),
    ...(typeof provided?.supersededByNodeId === 'string' && provided.supersededByNodeId
      ? { supersededByNodeId: provided.supersededByNodeId }
      : {}),
    ...(Array.isArray(provided?.conflictingNodeIds) && provided.conflictingNodeIds.length > 0
      ? { conflictingNodeIds: provided.conflictingNodeIds }
      : {})
  };
}

function normalizePromptReadiness(
  provided: Partial<NodeGovernancePromptReadiness> | undefined,
  fallback: NodeGovernancePromptReadiness
): NodeGovernancePromptReadiness {
  return {
    eligible: typeof provided?.eligible === 'boolean' ? provided.eligible : fallback.eligible,
    preferredForm: isPreferredForm(provided?.preferredForm) ? provided.preferredForm : fallback.preferredForm,
    requiresEvidence:
      typeof provided?.requiresEvidence === 'boolean' ? provided.requiresEvidence : fallback.requiresEvidence,
    requiresCompression:
      typeof provided?.requiresCompression === 'boolean'
        ? provided.requiresCompression
        : fallback.requiresCompression,
    selectionPriority: isSelectionPriority(provided?.selectionPriority)
      ? provided.selectionPriority
      : fallback.selectionPriority,
    budgetClass: isBudgetClass(provided?.budgetClass) ? provided.budgetClass : fallback.budgetClass
  };
}

function normalizePreferredFormForState(
  preferredForm: NodePromptPreferredForm,
  knowledgeState: ProvenanceOriginKind
): NodePromptPreferredForm {
  if (preferredForm === 'raw' && knowledgeState !== 'raw') {
    return knowledgeState === 'compressed' ? 'summary' : 'derived';
  }

  return preferredForm;
}

function defaultPreferredForm(type: NodeType, knowledgeState: ProvenanceOriginKind): NodePromptPreferredForm {
  if (type === 'Evidence') {
    return 'citation_only';
  }

  if (isExperienceTraceNodeType(type)) {
    return 'derived';
  }

  if (type === 'Tool') {
    return 'summary';
  }

  if (type === 'Topic' || type === 'Concept') {
    return 'summary';
  }

  if (knowledgeState === 'compressed') {
    return 'summary';
  }

  if (knowledgeState === 'derived') {
    return type === 'Skill' ? 'derived' : 'summary';
  }

  return 'raw';
}

function defaultSelectionPriority(type: NodeType): NodePromptSelectionPriority {
  switch (type) {
    case 'Goal':
    case 'Intent':
      return 'must';
    case 'Rule':
    case 'Constraint':
    case 'Mode':
    case 'Risk':
    case 'Process':
    case 'Step':
      return 'high';
    case 'Decision':
    case 'State':
    case 'Outcome':
    case 'Tool':
      return 'normal';
    case 'Evidence':
    case 'Skill':
    case 'Topic':
    case 'Concept':
    case 'Attempt':
    case 'Episode':
    case 'FailureSignal':
    case 'ProcedureCandidate':
    case 'Pattern':
    case 'FailurePattern':
    case 'SuccessfulProcedure':
    default:
      return 'low';
  }
}

function defaultBudgetClass(type: NodeType): NodePromptBudgetClass {
  switch (type) {
    case 'Goal':
    case 'Intent':
    case 'Process':
    case 'Step':
      return 'fixed';
    case 'Rule':
    case 'Constraint':
    case 'Mode':
    case 'Risk':
      return 'reserved';
    case 'Decision':
    case 'State':
    case 'Outcome':
    case 'Evidence':
    case 'Tool':
    case 'Skill':
    case 'Topic':
    case 'Concept':
    case 'Attempt':
    case 'Episode':
    case 'FailureSignal':
    case 'ProcedureCandidate':
    case 'Pattern':
    case 'FailurePattern':
    case 'SuccessfulProcedure':
    default:
      return 'candidate';
  }
}

function isExperienceTraceNodeType(type: NodeType): boolean {
  return (
    type === 'Attempt' ||
    type === 'Episode' ||
    type === 'FailureSignal' ||
    type === 'ProcedureCandidate' ||
    type === 'Pattern' ||
    type === 'FailurePattern' ||
    type === 'SuccessfulProcedure'
  );
}

function selectionPriorityScore(priority: NodePromptSelectionPriority): number {
  switch (priority) {
    case 'must':
      return 4;
    case 'high':
      return 3;
    case 'normal':
      return 1.5;
    case 'low':
    default:
      return 0.5;
  }
}

function budgetClassScore(budgetClass: NodePromptBudgetClass): number {
  switch (budgetClass) {
    case 'fixed':
      return 2;
    case 'reserved':
      return 1;
    case 'candidate':
    default:
      return 0.25;
  }
}

function formatConfidence(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function readPayloadGovernance(payload: JsonObject): NodeGovernance | undefined {
  const value = payload.governance;

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as unknown as NodeGovernance;
}

function readPayloadString(payload: JsonObject, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function isFreshness(value: unknown): value is Freshness {
  return value === 'active' || value === 'stale' || value === 'superseded';
}

function isConflictStatus(
  value: unknown
): value is NonNullable<NodeGovernanceValidity['conflictStatus']> {
  return value === 'none' || value === 'potential' || value === 'confirmed' || value === 'superseded';
}

function isResolutionState(
  value: unknown
): value is NonNullable<NodeGovernanceValidity['resolutionState']> {
  return value === 'unresolved' || value === 'suppressed' || value === 'selected' || value === 'deferred';
}

function isPreferredForm(value: unknown): value is NodePromptPreferredForm {
  return value === 'raw' || value === 'summary' || value === 'citation_only' || value === 'derived';
}

function isSelectionPriority(value: unknown): value is NodePromptSelectionPriority {
  return value === 'must' || value === 'high' || value === 'normal' || value === 'low';
}

function isBudgetClass(value: unknown): value is NodePromptBudgetClass {
  return value === 'fixed' || value === 'reserved' || value === 'candidate';
}
