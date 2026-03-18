import type {
  GovernanceAuthority,
  GovernanceLifecycleAction,
  GovernanceScopeBoundary,
  ManualCorrectionRecord,
  Scope
} from './contracts.js';

const SESSION_AUTHORITIES: readonly GovernanceAuthority[] = [
  'session_operator',
  'workspace_reviewer',
  'global_reviewer'
] as const;

const WORKSPACE_AUTHORITIES: readonly GovernanceAuthority[] = ['workspace_reviewer', 'global_reviewer'] as const;
const GLOBAL_AUTHORITIES: readonly GovernanceAuthority[] = ['global_reviewer'] as const;

export const GOVERNANCE_SCOPE_BOUNDARIES: readonly GovernanceScopeBoundary[] = [
  {
    targetScope: 'session',
    submitAuthorities: SESSION_AUTHORITIES,
    reviewAuthorities: SESSION_AUTHORITIES,
    applyAuthorities: SESSION_AUTHORITIES,
    rollbackAuthorities: SESSION_AUTHORITIES
  },
  {
    targetScope: 'workspace',
    submitAuthorities: WORKSPACE_AUTHORITIES,
    reviewAuthorities: WORKSPACE_AUTHORITIES,
    applyAuthorities: WORKSPACE_AUTHORITIES,
    rollbackAuthorities: WORKSPACE_AUTHORITIES
  },
  {
    targetScope: 'global',
    submitAuthorities: GLOBAL_AUTHORITIES,
    reviewAuthorities: GLOBAL_AUTHORITIES,
    applyAuthorities: GLOBAL_AUTHORITIES,
    rollbackAuthorities: GLOBAL_AUTHORITIES
  }
] as const;

export function getGovernanceScopeBoundary(scope: Scope): GovernanceScopeBoundary {
  const boundary = GOVERNANCE_SCOPE_BOUNDARIES.find((item) => item.targetScope === scope);

  if (!boundary) {
    throw new Error(`unsupported governance scope: ${scope}`);
  }

  return boundary;
}

export function assertGovernanceAuthority(
  authority: GovernanceAuthority,
  targetScope: Scope,
  action: GovernanceLifecycleAction
): void {
  const boundary = getGovernanceScopeBoundary(targetScope);
  const allowedAuthorities = readAllowedAuthorities(boundary, action);

  if (!allowedAuthorities.includes(authority)) {
    throw new Error(
      `authority ${authority} cannot ${action} governance proposals for ${targetScope} scope`
    );
  }
}

export function buildRollbackCorrections(
  corrections: readonly ManualCorrectionRecord[],
  actor: string,
  createdAt: string,
  reason: string
): ManualCorrectionRecord[] {
  return corrections.map((correction, index) => ({
    ...correction,
    id: `${correction.id}:rollback:${index + 1}`,
    action: correction.action === 'rollback' ? 'apply' : 'rollback',
    author: actor,
    createdAt,
    reason
  }));
}

function readAllowedAuthorities(
  boundary: GovernanceScopeBoundary,
  action: GovernanceLifecycleAction
): readonly GovernanceAuthority[] {
  switch (action) {
    case 'submit':
      return boundary.submitAuthorities;
    case 'review':
      return boundary.reviewAuthorities;
    case 'apply':
      return boundary.applyAuthorities;
    case 'rollback':
      return boundary.rollbackAuthorities;
  }
}
