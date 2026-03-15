import { randomUUID } from 'node:crypto';

import type { RuntimeContextBundle, SessionCheckpoint, SessionDelta } from '../types/core.js';
import type { CheckpointRequest, CheckpointResult } from '../types/io.js';
import { buildCheckpointLifecycle } from '../governance/memory-lifecycle.js';

export class CheckpointManager {
  createCheckpoint(request: CheckpointRequest): CheckpointResult {
    const checkpoint = this.buildCheckpoint(request.bundle);
    const delta = this.buildDelta(request.bundle, request.previousCheckpoint, checkpoint.id);

    return {
      checkpoint,
      delta
    };
  }

  private buildCheckpoint(bundle: RuntimeContextBundle): SessionCheckpoint {
    return {
      id: randomUUID(),
      sessionId: bundle.sessionId,
      sourceBundleId: bundle.id,
      summary: {
        goal: bundle.goal?.label,
        intent: bundle.intent?.label,
        activeRuleIds: bundle.activeRules.map((item) => item.nodeId),
        activeConstraintIds: bundle.activeConstraints.map((item) => item.nodeId),
        currentProcessId: bundle.currentProcess?.nodeId,
        recentDecisionIds: bundle.recentDecisions.map((item) => item.nodeId),
        recentStateIds: bundle.recentStateChanges.map((item) => item.nodeId),
        openRiskIds: bundle.openRisks.map((item) => item.nodeId)
      },
      lifecycle: buildCheckpointLifecycle(bundle),
      provenance: {
        originKind: 'derived',
        sourceStage: 'checkpoint',
        producer: 'compact-context',
        sourceBundleId: bundle.id,
        derivedFromNodeIds: collectBundleNodeIds(bundle)
      },
      tokenEstimate: bundle.tokenBudget.used,
      createdAt: bundle.createdAt
    };
  }

  private buildDelta(
    bundle: RuntimeContextBundle,
    previousCheckpoint: SessionCheckpoint | undefined,
    checkpointId: string
  ): SessionDelta {
    const previous = previousCheckpoint?.summary;

    return {
      id: randomUUID(),
      sessionId: bundle.sessionId,
      checkpointId,
      sourceBundleId: bundle.id,
      provenance: {
        originKind: 'derived',
        sourceStage: 'delta',
        producer: 'compact-context',
        sourceBundleId: bundle.id,
        derivedFromNodeIds: collectBundleNodeIds(bundle),
        ...(previousCheckpoint?.id ? { derivedFromCheckpointId: previousCheckpoint.id } : {})
      },
      addedRuleIds: diff(bundle.activeRules.map((item) => item.nodeId), previous?.activeRuleIds),
      addedConstraintIds: diff(bundle.activeConstraints.map((item) => item.nodeId), previous?.activeConstraintIds),
      addedDecisionIds: diff(bundle.recentDecisions.map((item) => item.nodeId), previous?.recentDecisionIds),
      addedStateIds: diff(bundle.recentStateChanges.map((item) => item.nodeId), previous?.recentStateIds),
      addedRiskIds: diff(bundle.openRisks.map((item) => item.nodeId), previous?.openRiskIds),
      tokenEstimate: estimateDeltaTokens(bundle, previous),
      createdAt: new Date().toISOString()
    };
  }
}

function diff(current: string[], previous: string[] | undefined): string[] {
  const previousSet = new Set(previous ?? []);
  return current.filter((value) => !previousSet.has(value));
}

function estimateDeltaTokens(
  bundle: RuntimeContextBundle,
  previousCheckpoint: SessionCheckpoint['summary'] | undefined
): number {
  return (
    diff(bundle.activeRules.map((item) => item.nodeId), previousCheckpoint?.activeRuleIds).length * 12 +
    diff(bundle.activeConstraints.map((item) => item.nodeId), previousCheckpoint?.activeConstraintIds).length * 12 +
    diff(bundle.recentDecisions.map((item) => item.nodeId), previousCheckpoint?.recentDecisionIds).length * 16 +
    diff(bundle.recentStateChanges.map((item) => item.nodeId), previousCheckpoint?.recentStateIds).length * 16
  );
}

function collectBundleNodeIds(bundle: RuntimeContextBundle): string[] {
  const ids = [
    bundle.goal?.nodeId,
    bundle.intent?.nodeId,
    bundle.currentProcess?.nodeId,
    ...bundle.activeRules.map((item) => item.nodeId),
    ...bundle.activeConstraints.map((item) => item.nodeId),
    ...bundle.recentDecisions.map((item) => item.nodeId),
    ...bundle.recentStateChanges.map((item) => item.nodeId),
    ...bundle.relevantEvidence.map((item) => item.nodeId),
    ...bundle.candidateSkills.map((item) => item.nodeId),
    ...bundle.openRisks.map((item) => item.nodeId)
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(ids));
}
