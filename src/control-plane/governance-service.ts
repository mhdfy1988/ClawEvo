import { randomUUID } from 'node:crypto';

import type {
  GovernanceApplyResult,
  GovernanceAuditRecord,
  GovernanceProposal,
  GovernanceRollbackResult,
  GovernanceServiceContract
} from './contracts.js';
import { assertGovernanceAuthority, buildRollbackCorrections } from './governance-policy.js';

export class GovernanceService implements GovernanceServiceContract {
  private readonly proposals = new Map<string, GovernanceProposal>();
  private readonly auditRecords: GovernanceAuditRecord[] = [];

  async submitProposal(input: {
    targetScope: import('../types/core.js').Scope;
    submittedBy: string;
    authority: import('./contracts.js').GovernanceAuthority;
    reason: string;
    corrections: readonly import('../types/context-processing.js').ManualCorrectionRecord[];
    contextSessionId?: string;
    runtimeSnapshot?: import('./contracts.js').ControlPlaneRuntimeSnapshotRef;
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
    this.auditRecords.push({
      id: `audit_${randomUUID()}`,
      proposalId: proposal.id,
      event: 'submitted',
      actor: input.submittedBy,
      timestamp: submittedAt,
      note: input.reason,
      ...(input.runtimeSnapshot ? { runtimeSnapshot: input.runtimeSnapshot } : {})
    });

    return proposal;
  }

  async reviewProposal(input: {
    proposalId: string;
    reviewedBy: string;
    authority: import('./contracts.js').GovernanceAuthority;
    decision: 'approve' | 'reject';
    runtimeSnapshot?: import('./contracts.js').ControlPlaneRuntimeSnapshotRef;
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
    this.auditRecords.push({
      id: `audit_${randomUUID()}`,
      proposalId: reviewed.id,
      event: input.decision === 'approve' ? 'approved' : 'rejected',
      actor: input.reviewedBy,
      timestamp: reviewedAt,
      ...(input.note ? { note: input.note } : {}),
      ...(input.runtimeSnapshot ? { runtimeSnapshot: input.runtimeSnapshot } : {})
    });

    return reviewed;
  }

  async applyProposal(input: {
    proposalId: string;
    appliedBy: string;
    authority: import('./contracts.js').GovernanceAuthority;
    runtimeSnapshot?: import('./contracts.js').ControlPlaneRuntimeSnapshotRef;
    appliedAt?: string;
    engine: {
      applyManualCorrections(
        corrections: import('../types/context-processing.js').ManualCorrectionRecord[]
      ): Promise<void>;
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
    this.auditRecords.push({
      id: `audit_${randomUUID()}`,
      proposalId: applied.id,
      event: 'applied',
      actor: input.appliedBy,
      timestamp: appliedAt,
      ...(input.runtimeSnapshot ? { runtimeSnapshot: input.runtimeSnapshot } : {})
    });

    return {
      proposalId: applied.id,
      appliedCount: applied.corrections.length,
      appliedAt
    };
  }

  async rollbackProposal(input: {
    proposalId: string;
    rolledBackBy: string;
    authority: import('./contracts.js').GovernanceAuthority;
    runtimeSnapshot?: import('./contracts.js').ControlPlaneRuntimeSnapshotRef;
    rolledBackAt?: string;
    note?: string;
    engine: {
      applyManualCorrections(
        corrections: import('../types/context-processing.js').ManualCorrectionRecord[]
      ): Promise<void>;
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
    this.auditRecords.push({
      id: `audit_${randomUUID()}`,
      proposalId: rolledBack.id,
      event: 'rolled_back',
      actor: input.rolledBackBy,
      timestamp: rolledBackAt,
      ...(input.note ? { note: input.note } : {}),
      ...(input.runtimeSnapshot ? { runtimeSnapshot: input.runtimeSnapshot } : {})
    });

    return {
      proposalId: rolledBack.id,
      rolledBackCount: rollbackCorrections.length,
      rolledBackAt
    };
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
