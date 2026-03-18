import { randomUUID } from 'node:crypto';

import type {
  GlobalGovernanceReview,
  GovernanceApplyResult,
  GovernanceAuditRecord,
  GovernanceBatchResult,
  GovernanceDecision,
  GovernanceDiffPreview,
  GovernanceMergeSuggestion,
  GovernancePolicyTemplate,
  GovernancePreviewChange,
  GovernanceProposal,
  GovernanceProposalConflict,
  GovernanceRollbackResult,
  GovernanceServiceContract,
  KnowledgeLifecyclePolicy,
  ManualCorrectionRecord,
  PollutionRecoveryPlan
} from './contracts.js';
import type { ControlPlaneRuntimeSnapshotRef, GovernanceAuthority, Scope } from './contracts.js';
import { assertGovernanceAuthority, buildRollbackCorrections } from './governance-policy.js';

const GOVERNANCE_POLICY_TEMPLATES: readonly GovernancePolicyTemplate[] = [
  {
    id: 'session-safe-alias',
    label: 'Session Safe Alias',
    targetScope: 'session',
    recommendedAuthority: 'session_operator',
    summary: 'Use for low-risk alias or suppression tweaks that only affect the current session.',
    reviewChecklist: ['Confirm the correction is session-scoped', 'Confirm rollback is acceptable in one step']
  },
  {
    id: 'workspace-reviewed-rule',
    label: 'Workspace Reviewed Rule',
    targetScope: 'workspace',
    recommendedAuthority: 'workspace_reviewer',
    summary: 'Use for workspace rules, promotion decisions, and persistent concept alias updates.',
    reviewChecklist: [
      'Check for conflicts with existing workspace proposals',
      'Validate the correction against recent runtime snapshots'
    ]
  },
  {
    id: 'global-policy-change',
    label: 'Global Policy Change',
    targetScope: 'global',
    recommendedAuthority: 'global_reviewer',
    summary: 'Use for global knowledge governance changes that require the strictest review path.',
    reviewChecklist: [
      'Confirm there is no safer workspace/session alternative',
      'Review impact on multi-workspace reuse and rollback plan'
    ]
  }
] as const;

export class GovernanceService implements GovernanceServiceContract {
  private readonly proposals = new Map<string, GovernanceProposal>();
  private readonly auditRecords: GovernanceAuditRecord[] = [];
  private readonly lifecyclePolicies = new Map<string, KnowledgeLifecyclePolicy>();

  async listPolicyTemplates(): Promise<GovernancePolicyTemplate[]> {
    return GOVERNANCE_POLICY_TEMPLATES.map((template) => ({
      ...template,
      reviewChecklist: [...template.reviewChecklist]
    }));
  }

  async previewProposal(input: {
    targetScope: Scope;
    reason: string;
    corrections: readonly ManualCorrectionRecord[];
  }): Promise<GovernanceDiffPreview> {
    const changes = input.corrections.map(buildPreviewChange);
    return {
      targetScope: input.targetScope,
      reason: input.reason,
      changeCount: changes.length,
      targetIds: dedupe(changes.map((change) => `${change.targetKind}:${change.targetId}`)),
      changes
    };
  }

  async detectProposalConflicts(input: {
    targetScope: Scope;
    corrections: readonly ManualCorrectionRecord[];
    excludeProposalId?: string;
  }): Promise<GovernanceProposalConflict[]> {
    const requestedTargets = input.corrections.map((correction) => `${correction.targetKind}:${correction.targetId}`);
    const requestedActions = new Map(input.corrections.map((correction) => [`${correction.targetKind}:${correction.targetId}`, correction.action]));

    const conflicts: GovernanceProposalConflict[] = [];
    for (const proposal of this.proposals.values()) {
      if (proposal.id === input.excludeProposalId || proposal.targetScope !== input.targetScope || proposal.status === 'rejected') {
        continue;
      }

      const overlappingTargets = proposal.corrections
        .map((correction) => `${correction.targetKind}:${correction.targetId}`)
        .filter((targetId) => requestedTargets.includes(targetId));

      if (overlappingTargets.length === 0) {
        continue;
      }

      const severity = proposal.corrections.some((correction) => {
        const targetKey = `${correction.targetKind}:${correction.targetId}`;
        return requestedActions.get(targetKey) && requestedActions.get(targetKey) !== correction.action;
      })
        ? 'blocking'
        : 'warning';

      conflicts.push({
        proposalId: input.excludeProposalId ?? 'preview',
        conflictingProposalId: proposal.id,
        targetScope: input.targetScope,
        targetIds: dedupe(overlappingTargets),
        severity,
        reason:
          severity === 'blocking'
            ? `conflicting action already exists in proposal ${proposal.id}`
            : `overlapping target already exists in proposal ${proposal.id}`
      });
    }

    return conflicts;
  }

  async submitProposal(input: {
    targetScope: Scope;
    submittedBy: string;
    authority: GovernanceAuthority;
    reason: string;
    corrections: readonly ManualCorrectionRecord[];
    contextSessionId?: string;
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    submittedAt?: string;
  }): Promise<GovernanceProposal> {
    assertGovernanceAuthority(input.authority, input.targetScope, 'submit');
    const submittedAt = input.submittedAt ?? new Date().toISOString();
    const proposal: GovernanceProposal = {
      id: `proposal_${randomUUID()}`,
      targetScope: input.targetScope,
      submittedAt,
      submittedBy: input.submittedBy,
      submittedAuthority: input.authority,
      reason: input.reason,
      corrections: [...input.corrections],
      status: 'pending',
      ...(input.contextSessionId ? { contextSessionId: input.contextSessionId } : {}),
      ...(input.runtimeSnapshot ? { runtimeSnapshot: input.runtimeSnapshot } : {})
    };

    this.proposals.set(proposal.id, proposal);
    this.auditRecords.push(buildAuditRecord({
      proposalId: proposal.id,
      event: 'submitted',
      actor: input.submittedBy,
      timestamp: submittedAt,
      note: input.reason,
      runtimeSnapshot: input.runtimeSnapshot
    }));

    return proposal;
  }

  async submitProposalBatch(input: {
    requests: Array<{
      targetScope: Scope;
      submittedBy: string;
      authority: GovernanceAuthority;
      reason: string;
      corrections: readonly ManualCorrectionRecord[];
      contextSessionId?: string;
      runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
      submittedAt?: string;
    }>;
  }): Promise<GovernanceBatchResult<GovernanceProposal>> {
    const payloads: GovernanceProposal[] = [];
    const succeededIds: string[] = [];
    const failed: GovernanceBatchResult<GovernanceProposal>['failed'] = [];

    for (const request of input.requests) {
      try {
        const proposal = await this.submitProposal(request);
        payloads.push(proposal);
        succeededIds.push(proposal.id);
      } catch (error) {
        failed.push({
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      requestedCount: input.requests.length,
      succeededIds,
      failed,
      payloads
    };
  }

  async reviewProposal(input: {
    proposalId: string;
    reviewedBy: string;
    authority: GovernanceAuthority;
    decision: GovernanceDecision;
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    reviewedAt?: string;
    note?: string;
  }): Promise<GovernanceProposal> {
    const proposal = this.requireProposal(input.proposalId);
    assertGovernanceAuthority(input.authority, proposal.targetScope, 'review');
    const reviewedAt = input.reviewedAt ?? new Date().toISOString();
    const nextStatus = input.decision === 'approve' ? 'approved' : 'rejected';

    const reviewed: GovernanceProposal = {
      ...proposal,
      status: nextStatus,
      review: {
        decision: input.decision,
        reviewedAt,
        reviewedBy: input.reviewedBy,
        ...(input.note ? { note: input.note } : {})
      },
      ...(input.runtimeSnapshot ? { runtimeSnapshot: input.runtimeSnapshot } : {})
    };

    this.proposals.set(reviewed.id, reviewed);
    this.auditRecords.push(
      buildAuditRecord({
        proposalId: reviewed.id,
        event: input.decision === 'approve' ? 'approved' : 'rejected',
        actor: input.reviewedBy,
        timestamp: reviewedAt,
        note: input.note,
        runtimeSnapshot: input.runtimeSnapshot
      })
    );

    return reviewed;
  }

  async reviewProposalBatch(input: {
    requests: Array<{
      proposalId: string;
      reviewedBy: string;
      authority: GovernanceAuthority;
      decision: GovernanceDecision;
      runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
      reviewedAt?: string;
      note?: string;
    }>;
  }): Promise<GovernanceBatchResult<GovernanceProposal>> {
    const payloads: GovernanceProposal[] = [];
    const succeededIds: string[] = [];
    const failed: GovernanceBatchResult<GovernanceProposal>['failed'] = [];

    for (const request of input.requests) {
      try {
        const proposal = await this.reviewProposal(request);
        payloads.push(proposal);
        succeededIds.push(proposal.id);
      } catch (error) {
        failed.push({
          id: request.proposalId,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      requestedCount: input.requests.length,
      succeededIds,
      failed,
      payloads
    };
  }

  async applyProposal(input: {
    proposalId: string;
    appliedBy: string;
    authority: GovernanceAuthority;
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    appliedAt?: string;
    engine: {
      applyManualCorrections(corrections: ManualCorrectionRecord[]): Promise<void>;
    };
  }): Promise<GovernanceApplyResult> {
    const proposal = this.requireProposal(input.proposalId);
    assertGovernanceAuthority(input.authority, proposal.targetScope, 'apply');

    if (proposal.status !== 'approved') {
      throw new Error(`proposal ${proposal.id} must be approved before apply`);
    }

    const appliedAt = input.appliedAt ?? new Date().toISOString();
    await input.engine.applyManualCorrections([...proposal.corrections]);

    const applied: GovernanceProposal = {
      ...proposal,
      status: 'applied',
      appliedAt,
      appliedBy: input.appliedBy,
      appliedAuthority: input.authority,
      ...(input.runtimeSnapshot ? { runtimeSnapshot: input.runtimeSnapshot } : {})
    };
    this.proposals.set(applied.id, applied);
    this.auditRecords.push(
      buildAuditRecord({
        proposalId: applied.id,
        event: 'applied',
        actor: input.appliedBy,
        timestamp: appliedAt,
        runtimeSnapshot: input.runtimeSnapshot
      })
    );

    return {
      proposalId: applied.id,
      appliedCount: applied.corrections.length,
      appliedAt
    };
  }

  async rollbackProposal(input: {
    proposalId: string;
    rolledBackBy: string;
    authority: GovernanceAuthority;
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    rolledBackAt?: string;
    note?: string;
    engine: {
      applyManualCorrections(corrections: ManualCorrectionRecord[]): Promise<void>;
    };
  }): Promise<GovernanceRollbackResult> {
    const proposal = this.requireProposal(input.proposalId);
    assertGovernanceAuthority(input.authority, proposal.targetScope, 'rollback');

    if (proposal.status !== 'applied') {
      throw new Error(`proposal ${proposal.id} must be applied before rollback`);
    }

    const rolledBackAt = input.rolledBackAt ?? new Date().toISOString();
    const rollbackReason = input.note ?? `rollback proposal ${proposal.id}`;
    const rollbackCorrections = buildRollbackCorrections(
      proposal.corrections,
      input.rolledBackBy,
      rolledBackAt,
      rollbackReason
    );
    await input.engine.applyManualCorrections(rollbackCorrections);

    const rolledBack: GovernanceProposal = {
      ...proposal,
      status: 'approved',
      rollback: {
        rolledBackAt,
        rolledBackBy: input.rolledBackBy,
        rolledBackAuthority: input.authority,
        ...(input.note ? { note: input.note } : {})
      },
      ...(input.runtimeSnapshot ? { runtimeSnapshot: input.runtimeSnapshot } : {})
    };
    this.proposals.set(rolledBack.id, rolledBack);
    this.auditRecords.push(
      buildAuditRecord({
        proposalId: rolledBack.id,
        event: 'rolled_back',
        actor: input.rolledBackBy,
        timestamp: rolledBackAt,
        note: input.note,
        runtimeSnapshot: input.runtimeSnapshot
      })
    );

    return {
      proposalId: rolledBack.id,
      rolledBackCount: rollbackCorrections.length,
      rolledBackAt
    };
  }

  async rollbackProposalBatch(input: {
    requests: Array<{
      proposalId: string;
      rolledBackBy: string;
      authority: GovernanceAuthority;
      runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
      rolledBackAt?: string;
      note?: string;
    }>;
    engine: {
      applyManualCorrections(corrections: ManualCorrectionRecord[]): Promise<void>;
    };
  }): Promise<GovernanceBatchResult<GovernanceRollbackResult>> {
    const payloads: GovernanceRollbackResult[] = [];
    const succeededIds: string[] = [];
    const failed: GovernanceBatchResult<GovernanceRollbackResult>['failed'] = [];

    for (const request of input.requests) {
      try {
        const result = await this.rollbackProposal({
          ...request,
          engine: input.engine
        });
        payloads.push(result);
        succeededIds.push(result.proposalId);
      } catch (error) {
        failed.push({
          id: request.proposalId,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      requestedCount: input.requests.length,
      succeededIds,
      failed,
      payloads
    };
  }

  async buildGlobalGovernanceReview(): Promise<GlobalGovernanceReview> {
    const proposals = [...this.proposals.values()];
    const pendingGlobalProposalIds = proposals
      .filter((proposal) => proposal.targetScope === 'global' && proposal.status === 'pending')
      .map((proposal) => proposal.id);
    const conflictingWorkspaceProposalIds = proposals
      .filter((proposal) => proposal.targetScope === 'workspace')
      .filter((proposal) =>
        proposals.some(
          (candidate) =>
            candidate.targetScope === 'global' &&
            candidate.status !== 'rejected' &&
            overlapsProposalTargets(candidate, proposal)
        )
      )
      .map((proposal) => proposal.id);

    const mergeSuggestions = proposals
      .filter((proposal) => proposal.targetScope !== 'session')
      .flatMap((proposal) => buildMergeSuggestions(proposal, proposals))
      .filter((item, index, items) => items.findIndex((candidate) => candidate.targetId === item.targetId) === index);

    const workspaceIsolationNotes =
      conflictingWorkspaceProposalIds.length > 0
        ? ['workspace proposals overlap with global candidates; review merge/isolation before promotion']
        : ['no workspace/global overlap detected in current proposal set'];

    const pollutionRiskProposalIds = proposals
      .filter((proposal) => proposal.targetScope === 'global' && proposal.corrections.length >= 2)
      .map((proposal) => proposal.id);

    return {
      generatedAt: new Date().toISOString(),
      pendingGlobalProposalIds,
      conflictingWorkspaceProposalIds,
      mergeSuggestions,
      workspaceIsolationNotes,
      pollutionRiskProposalIds
    };
  }

  async createPollutionRecoveryPlan(input?: {
    proposalIds?: readonly string[];
    limit?: number;
  }): Promise<PollutionRecoveryPlan> {
    const selected = (input?.proposalIds?.length
      ? input.proposalIds.map((proposalId) => this.proposals.get(proposalId)).filter(Boolean)
      : [...this.proposals.values()].filter((proposal) => proposal.status === 'applied')
    )
      .slice(0, input?.limit && input.limit > 0 ? input.limit : 20) as GovernanceProposal[];

    const rollbackProposalIds = selected.filter((proposal) => proposal.targetScope === 'global' || proposal.corrections.length > 1).map((proposal) => proposal.id);
    const affectedTargets = dedupe(selected.flatMap((proposal) => proposal.corrections.map((correction) => correction.targetId)));

    return {
      generatedAt: new Date().toISOString(),
      proposalIds: selected.map((proposal) => proposal.id),
      rollbackProposalIds,
      affectedTargets,
      riskSummary:
        rollbackProposalIds.length > 0
          ? `${rollbackProposalIds.length} 个已应用提案被识别为优先回滚候选。`
          : '当前没有需要优先回滚的 applied proposal。',
      requiresHumanReview: rollbackProposalIds.length > 0
    };
  }

  async saveLifecyclePolicy(input: {
    scope: 'workspace' | 'global';
    label: string;
    decayDays: number;
    retireDays: number;
    refreshDays: number;
    savedAt?: string;
    savedBy?: string;
  }): Promise<KnowledgeLifecyclePolicy> {
    const policy: KnowledgeLifecyclePolicy = {
      id: `lifecycle_${randomUUID()}`,
      scope: input.scope,
      label: input.label,
      decayDays: input.decayDays,
      retireDays: input.retireDays,
      refreshDays: input.refreshDays,
      savedAt: input.savedAt ?? new Date().toISOString(),
      ...(input.savedBy ? { savedBy: input.savedBy } : {})
    };
    this.lifecyclePolicies.set(policy.id, policy);
    return { ...policy };
  }

  async listLifecyclePolicies(): Promise<KnowledgeLifecyclePolicy[]> {
    return [...this.lifecyclePolicies.values()].sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  }

  async bulkRollbackProposals(input: {
    proposalIds: readonly string[];
    rolledBackBy: string;
    authority: GovernanceAuthority;
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    rolledBackAt?: string;
    note?: string;
    engine: {
      applyManualCorrections(corrections: ManualCorrectionRecord[]): Promise<void>;
    };
  }): Promise<GovernanceBatchResult<GovernanceRollbackResult>> {
    return this.rollbackProposalBatch({
      requests: input.proposalIds.map((proposalId) => ({
        proposalId,
        rolledBackBy: input.rolledBackBy,
        authority: input.authority,
        ...(input.runtimeSnapshot ? { runtimeSnapshot: input.runtimeSnapshot } : {}),
        ...(input.rolledBackAt ? { rolledBackAt: input.rolledBackAt } : {}),
        ...(input.note ? { note: input.note } : {})
      })),
      engine: input.engine
    });
  }

  async listProposals(limit = 50): Promise<GovernanceProposal[]> {
    return [...this.proposals.values()]
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
      .slice(0, limit);
  }

  async listAuditRecords(limit = 100): Promise<GovernanceAuditRecord[]> {
    return [...this.auditRecords]
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(0, limit);
  }

  private requireProposal(proposalId: string): GovernanceProposal {
    const proposal = this.proposals.get(proposalId);

    if (!proposal) {
      throw new Error(`unknown governance proposal: ${proposalId}`);
    }

    return proposal;
  }
}

function buildPreviewChange(correction: ManualCorrectionRecord): GovernancePreviewChange {
  const metadataPreview = isPlainRecord(correction.metadata) ? { ...correction.metadata } : {};
  const alias = typeof metadataPreview.alias === 'string' ? metadataPreview.alias : undefined;
  return {
    correctionId: correction.id,
    targetKind: correction.targetKind,
    targetId: correction.targetId,
    action: correction.action,
    summary:
      correction.targetKind === 'concept_alias' && alias
        ? `${correction.action} alias "${alias}" on ${correction.targetId}`
        : `${correction.action} ${correction.targetKind} on ${correction.targetId}`,
    metadataPreview
  };
}

function buildAuditRecord(input: {
  proposalId: string;
  event: GovernanceAuditRecord['event'];
  actor: string;
  timestamp: string;
  note?: string;
  runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
}): GovernanceAuditRecord {
  return {
    id: `audit_${randomUUID()}`,
    proposalId: input.proposalId,
    event: input.event,
    actor: input.actor,
    timestamp: input.timestamp,
    ...(input.note ? { note: input.note } : {}),
    ...(input.runtimeSnapshot ? { runtimeSnapshot: input.runtimeSnapshot } : {})
  };
}

function isPlainRecord(value: unknown): value is Record<string, string | number | boolean | null> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function overlapsProposalTargets(left: GovernanceProposal, right: GovernanceProposal): boolean {
  const leftTargets = left.corrections.map((correction) => `${correction.targetKind}:${correction.targetId}`);
  return right.corrections.some((correction) => leftTargets.includes(`${correction.targetKind}:${correction.targetId}`));
}

function buildMergeSuggestions(
  proposal: GovernanceProposal,
  proposals: readonly GovernanceProposal[]
): GovernanceMergeSuggestion[] {
  if (proposal.targetScope === 'session') {
    return [];
  }

  return proposal.corrections.flatMap((correction) => {
    const overlapping = proposals.filter(
      (candidate) =>
        candidate.id !== proposal.id &&
        candidate.targetScope !== 'session' &&
        candidate.corrections.some(
          (item) => item.targetKind === correction.targetKind && item.targetId === correction.targetId
        )
    );

    if (overlapping.length === 0) {
      return [];
    }

    return [
      {
        targetId: correction.targetId,
        proposalIds: [proposal.id, ...overlapping.map((candidate) => candidate.id)],
        scopes: dedupe([proposal.targetScope, ...overlapping.map((candidate) => candidate.targetScope)]) as Array<
          GovernanceProposal['targetScope']
        >,
        recommendedScope:
          proposal.targetScope === 'global' || overlapping.some((candidate) => candidate.targetScope === 'global')
            ? 'global'
            : 'workspace',
        reason: 'multiple non-session proposals touch the same target and should be reviewed for merge/isolation'
      }
    ];
  });
}
