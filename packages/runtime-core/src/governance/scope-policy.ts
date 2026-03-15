import type {
  GraphNode,
  NodeGovernance,
  NodeGovernanceScopePolicy,
  NodeType,
  Scope
} from '@openclaw-compact-context/contracts';
import { assessPromotedKnowledgeGovernance } from './knowledge-promotion.js';

const WORKSPACE_PROMOTABLE_TYPES = new Set<NodeType>(['Rule', 'Constraint', 'Mode', 'Process', 'Step', 'Skill']);
const GLOBAL_PROMOTABLE_TYPES = new Set<NodeType>(['Rule', 'Constraint', 'Mode', 'Skill']);
const SESSION_ONLY_HIGHER_SCOPE_TYPES = new Set<NodeType>(['Attempt', 'Episode', 'FailureSignal', 'ProcedureCandidate']);

export interface HigherScopeRecallAdmission {
  admitted: boolean;
  reason: string;
}

export function buildScopePolicy(input: {
  scope: Scope;
  type: NodeType;
  workspaceId?: string;
}): NodeGovernanceScopePolicy {
  const currentScope = input.scope;
  const recallTier = scopeToRecallTier(currentScope);

  return {
    currentScope,
    writeAuthority: scopeToWriteAuthority(currentScope),
    recallTier,
    recallPrecedence: scopeRecallPrecedence(currentScope),
    higherScopeFallbackAllowed: currentScope !== 'session',
    promotion: describeScopePromotion(input.scope, input.type, input.workspaceId)
  };
}

export function normalizeScopePolicy(
  provided: Partial<NodeGovernanceScopePolicy> | undefined,
  fallback: NodeGovernanceScopePolicy
): NodeGovernanceScopePolicy {
  return {
    currentScope: isScope(provided?.currentScope) ? provided.currentScope : fallback.currentScope,
    writeAuthority: isWriteAuthority(provided?.writeAuthority) ? provided.writeAuthority : fallback.writeAuthority,
    recallTier: isRecallTier(provided?.recallTier) ? provided.recallTier : fallback.recallTier,
    recallPrecedence:
      typeof provided?.recallPrecedence === 'number' && Number.isFinite(provided.recallPrecedence)
        ? provided.recallPrecedence
        : fallback.recallPrecedence,
    higherScopeFallbackAllowed:
      typeof provided?.higherScopeFallbackAllowed === 'boolean'
        ? provided.higherScopeFallbackAllowed
        : fallback.higherScopeFallbackAllowed,
    promotion: {
      eligible:
        typeof provided?.promotion?.eligible === 'boolean'
          ? provided.promotion.eligible
          : fallback.promotion.eligible,
      ...(isPromotionTarget(provided?.promotion?.target)
        ? { target: provided?.promotion?.target }
        : fallback.promotion.target
          ? { target: fallback.promotion.target }
          : {}),
      requiresManualReview:
        typeof provided?.promotion?.requiresManualReview === 'boolean'
          ? provided.promotion.requiresManualReview
          : fallback.promotion.requiresManualReview,
      reason:
        typeof provided?.promotion?.reason === 'string' && provided.promotion.reason.trim()
          ? provided.promotion.reason
          : fallback.promotion.reason
    }
  };
}

export function scopePolicyScore(governance: NodeGovernance): number {
  return governance.scopePolicy.recallPrecedence;
}

export function assessHigherScopeRecallAdmission(
  node: Pick<GraphNode, 'scope' | 'type' | 'payload' | 'confidence'>
): HigherScopeRecallAdmission {
  if (node.scope === 'session') {
    return {
      admitted: true,
      reason: 'session scope remains the primary recall tier'
    };
  }

  if (SESSION_ONLY_HIGHER_SCOPE_TYPES.has(node.type)) {
    return {
      admitted: false,
      reason: 'trace-level experience remains session-scoped and is not reused across tasks'
    };
  }

  if (node.type === 'Pattern' || node.type === 'FailurePattern' || node.type === 'SuccessfulProcedure') {
    const promotionGovernance = assessPromotedKnowledgeGovernance(node as GraphNode);

    if (!promotionGovernance) {
      return {
        admitted: false,
        reason: `${node.scope} reuse is blocked because promotion governance is missing`
      };
    }

    if (node.scope === 'workspace') {
      return promotionGovernance.workspaceEligible
        ? {
            admitted: true,
            reason: `workspace reuse admitted as ${promotionGovernance.knowledgeClass} with ${promotionGovernance.contaminationRisk}-risk governance`
          }
        : {
            admitted: false,
            reason: `workspace reuse is gated because ${promotionGovernance.knowledgeClass} remains ${promotionGovernance.contaminationRisk}-risk`
          };
    }

    const globalAdmitted =
      promotionGovernance.promotionDecision === 'promote' &&
      promotionGovernance.contaminationRisk === 'low' &&
      (promotionGovernance.knowledgeClass === 'stable_skill' ||
        promotionGovernance.knowledgeClass === 'hard_constraint_candidate');

    return globalAdmitted
      ? {
          admitted: true,
          reason: `global reuse admitted as ${promotionGovernance.knowledgeClass}`
        }
      : {
          admitted: false,
          reason: `global reuse is gated because ${promotionGovernance.knowledgeClass} is not stable enough for global fallback`
        };
  }

  if (node.scope === 'workspace') {
    return {
      admitted: true,
      reason: 'workspace scope is eligible for guarded reuse inside the same workspace'
    };
  }

  return {
    admitted: true,
    reason: 'global scope remains a last-resort fallback tier'
  };
}

export function describeScopePolicySummary(governance: NodeGovernance): string {
  const { scopePolicy } = governance;
  const promotion = scopePolicy.promotion.eligible
    ? `${scopePolicy.promotion.target ?? 'stay'}${scopePolicy.promotion.requiresManualReview ? ' (manual review)' : ''}`
    : 'stay';

  return `Scope: current=${scopePolicy.currentScope}, recall=${scopePolicy.recallTier}, write=${scopePolicy.writeAuthority}, promote=${promotion}.`;
}

export function describeScopeSelectionReason(
  node: Pick<GraphNode, 'scope' | 'type' | 'payload' | 'confidence'>,
  candidates: readonly Pick<GraphNode, 'scope'>[]
): string {
  const availableScopes = new Set(candidates.map((candidate) => candidate.scope));
  const admission = assessHigherScopeRecallAdmission(node);

  switch (node.scope) {
    case 'session':
      return availableScopes.has('workspace') || availableScopes.has('global')
        ? ' via session scope precedence over higher-scope fallback'
        : '';
    case 'workspace':
      return availableScopes.has('session')
        ? ` via workspace scope fallback after session candidates ranked lower (${admission.reason})`
        : ` via workspace fallback because no session candidate was available (${admission.reason})`;
    case 'global':
    default:
      if (availableScopes.has('session') || availableScopes.has('workspace')) {
        return ` via global scope fallback after lower-scope candidates ranked lower or were unavailable (${admission.reason})`;
      }

      return ` via global fallback because no session or workspace candidate was available (${admission.reason})`;
  }
}

export function describeHigherScopeSkipReason(
  node: Pick<GraphNode, 'scope' | 'type' | 'payload' | 'confidence'>
): string | undefined {
  const admission = assessHigherScopeRecallAdmission(node);

  if (!admission.admitted) {
    return admission.reason;
  }

  switch (node.scope) {
    case 'workspace':
      return 'node was not selected because workspace-scoped recall is only used after stronger session candidates';
    case 'global':
      return 'node was not selected because global-scoped recall is only used after stronger session/workspace candidates';
    case 'session':
    default:
      return undefined;
  }
}

function describeScopePromotion(
  scope: Scope,
  type: NodeType,
  workspaceId?: string
): NodeGovernanceScopePolicy['promotion'] {
  if (scope === 'global') {
    return {
      eligible: false,
      requiresManualReview: false,
      reason: 'node already lives at the highest available scope'
    };
  }

  if (scope === 'session') {
    if (!workspaceId) {
      return {
        eligible: false,
        requiresManualReview: true,
        reason: 'session-scoped knowledge cannot be promoted without a workspace anchor'
      };
    }

    if (!WORKSPACE_PROMOTABLE_TYPES.has(type)) {
      return {
        eligible: false,
        requiresManualReview: true,
        reason: 'this node type is not stable enough for workspace-level reuse'
      };
    }

    return {
      eligible: true,
      target: 'workspace',
      requiresManualReview: true,
      reason: 'stable session knowledge may be promoted to workspace after explicit review'
    };
  }

  if (!GLOBAL_PROMOTABLE_TYPES.has(type)) {
    return {
      eligible: false,
      requiresManualReview: true,
      reason: 'this workspace node type is not stable enough for global reuse'
    };
  }

  return {
    eligible: true,
    target: 'global',
    requiresManualReview: true,
    reason: 'stable workspace knowledge may be promoted to global after explicit review'
  };
}

function scopeRecallPrecedence(scope: Scope): number {
  switch (scope) {
    case 'session':
      return 12;
    case 'workspace':
      return 8;
    case 'global':
    default:
      return 4;
  }
}

function scopeToRecallTier(scope: Scope): NodeGovernanceScopePolicy['recallTier'] {
  switch (scope) {
    case 'session':
      return 'session_primary';
    case 'workspace':
      return 'workspace_fallback';
    case 'global':
    default:
      return 'global_fallback';
  }
}

function scopeToWriteAuthority(scope: Scope): NodeGovernanceScopePolicy['writeAuthority'] {
  switch (scope) {
    case 'session':
      return 'session_open';
    case 'workspace':
      return 'workspace_guarded';
    case 'global':
    default:
      return 'global_guarded';
  }
}

function isScope(value: unknown): value is Scope {
  return value === 'session' || value === 'workspace' || value === 'global';
}

function isWriteAuthority(value: unknown): value is NodeGovernanceScopePolicy['writeAuthority'] {
  return value === 'session_open' || value === 'workspace_guarded' || value === 'global_guarded';
}

function isRecallTier(value: unknown): value is NodeGovernanceScopePolicy['recallTier'] {
  return value === 'session_primary' || value === 'workspace_fallback' || value === 'global_fallback';
}

function isPromotionTarget(value: unknown): value is NonNullable<NodeGovernanceScopePolicy['promotion']['target']> {
  return value === 'workspace' || value === 'global';
}
