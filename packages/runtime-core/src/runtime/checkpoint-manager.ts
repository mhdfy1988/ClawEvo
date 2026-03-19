import { randomUUID } from 'node:crypto';

import type {
  RuntimeContextBundle,
  SessionCheckpoint,
  SessionDelta,
  SessionDeltaSemanticChangeKind
} from '@openclaw-compact-context/contracts';
import type { CheckpointRequest, CheckpointResult } from '@openclaw-compact-context/contracts';
import { buildCheckpointLifecycle } from '../governance/memory-lifecycle.js';

export class CheckpointManager {
  createCheckpoint(request: CheckpointRequest): CheckpointResult {
    const checkpoint = this.buildCheckpoint(request);
    const delta = this.buildDelta(request, checkpoint.id);

    return {
      checkpoint,
      delta
    };
  }

  private buildCheckpoint(request: CheckpointRequest): SessionCheckpoint {
    const bundle = request.bundle;

    return {
      id: randomUUID(),
      sessionId: bundle.sessionId,
      sourceBundleId: bundle.id,
      ...(request.triggerSource ? { triggerSource: request.triggerSource } : {}),
      ...(request.triggerCompressionMode ? { triggerCompressionMode: request.triggerCompressionMode } : {}),
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
        derivedFromNodeIds: collectBundleNodeIds(bundle),
        ...(request.triggerSource ? { triggerSource: request.triggerSource } : {}),
        ...(request.triggerCompressionMode ? { triggerCompressionMode: request.triggerCompressionMode } : {})
      },
      tokenEstimate: bundle.tokenBudget.used,
      createdAt: bundle.createdAt
    };
  }

  private buildDelta(request: CheckpointRequest, checkpointId: string): SessionDelta {
    const bundle = request.bundle;
    const previousCheckpoint = request.previousCheckpoint;
    const previous = previousCheckpoint?.summary;
    const semanticChangeKinds = collectSemanticChangeKinds(bundle, previous);

    return {
      id: randomUUID(),
      sessionId: bundle.sessionId,
      checkpointId,
      sourceBundleId: bundle.id,
      ...(request.triggerSource ? { triggerSource: request.triggerSource } : {}),
      ...(request.triggerCompressionMode ? { triggerCompressionMode: request.triggerCompressionMode } : {}),
      provenance: {
        originKind: 'derived',
        sourceStage: 'delta',
        producer: 'compact-context',
        sourceBundleId: bundle.id,
        derivedFromNodeIds: collectBundleNodeIds(bundle),
        ...(request.triggerSource ? { triggerSource: request.triggerSource } : {}),
        ...(request.triggerCompressionMode ? { triggerCompressionMode: request.triggerCompressionMode } : {}),
        ...(previousCheckpoint?.id ? { derivedFromCheckpointId: previousCheckpoint.id } : {})
      },
      addedRuleIds: diff(bundle.activeRules.map((item) => item.nodeId), previous?.activeRuleIds),
      addedConstraintIds: diff(bundle.activeConstraints.map((item) => item.nodeId), previous?.activeConstraintIds),
      addedDecisionIds: diff(bundle.recentDecisions.map((item) => item.nodeId), previous?.recentDecisionIds),
      addedStateIds: diff(bundle.recentStateChanges.map((item) => item.nodeId), previous?.recentStateIds),
      addedRiskIds: diff(bundle.openRisks.map((item) => item.nodeId), previous?.openRiskIds),
      ...(semanticChangeKinds.length > 0 ? { semanticChangeKinds } : {}),
      tokenEstimate: estimateDeltaTokens(bundle, previous, semanticChangeKinds),
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
  previousCheckpoint: SessionCheckpoint['summary'] | undefined,
  semanticChangeKinds: SessionDeltaSemanticChangeKind[]
): number {
  return (
    (semanticChangeKinds.includes('goal_changed') ? 12 : 0) +
    (semanticChangeKinds.includes('intent_changed') ? 12 : 0) +
    (semanticChangeKinds.includes('current_process_changed') ? 16 : 0) +
    diff(bundle.activeRules.map((item) => item.nodeId), previousCheckpoint?.activeRuleIds).length * 12 +
    diff(bundle.activeConstraints.map((item) => item.nodeId), previousCheckpoint?.activeConstraintIds).length * 12 +
    diff(bundle.recentDecisions.map((item) => item.nodeId), previousCheckpoint?.recentDecisionIds).length * 16 +
    diff(bundle.recentStateChanges.map((item) => item.nodeId), previousCheckpoint?.recentStateIds).length * 16 +
    diff(bundle.openRisks.map((item) => item.nodeId), previousCheckpoint?.openRiskIds).length * 16
  );
}

function collectSemanticChangeKinds(
  bundle: RuntimeContextBundle,
  previousCheckpoint: SessionCheckpoint['summary'] | undefined
): SessionDeltaSemanticChangeKind[] {
  const kinds: SessionDeltaSemanticChangeKind[] = [];

  if ((bundle.goal?.label ?? undefined) !== previousCheckpoint?.goal) {
    kinds.push('goal_changed');
  }

  if ((bundle.intent?.label ?? undefined) !== previousCheckpoint?.intent) {
    kinds.push('intent_changed');
  }

  if ((bundle.currentProcess?.nodeId ?? undefined) !== previousCheckpoint?.currentProcessId) {
    kinds.push('current_process_changed');
  }

  if (!sameIds(bundle.activeRules.map((item) => item.nodeId), previousCheckpoint?.activeRuleIds)) {
    kinds.push('active_rules_changed');
  }

  if (!sameIds(bundle.activeConstraints.map((item) => item.nodeId), previousCheckpoint?.activeConstraintIds)) {
    kinds.push('active_constraints_changed');
  }

  if (!sameIds(bundle.recentDecisions.map((item) => item.nodeId), previousCheckpoint?.recentDecisionIds)) {
    kinds.push('recent_decisions_changed');
  }

  if (!sameIds(bundle.recentStateChanges.map((item) => item.nodeId), previousCheckpoint?.recentStateIds)) {
    kinds.push('recent_state_changes_changed');
  }

  if (!sameIds(bundle.openRisks.map((item) => item.nodeId), previousCheckpoint?.openRiskIds)) {
    kinds.push('open_risks_changed');
  }

  return kinds;
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

function sameIds(current: string[], previous: string[] | undefined): boolean {
  const normalizedCurrent = [...new Set(current)].sort();
  const normalizedPrevious = [...new Set(previous ?? [])].sort();

  if (normalizedCurrent.length !== normalizedPrevious.length) {
    return false;
  }

  return normalizedCurrent.every((value, index) => value === normalizedPrevious[index]);
}
