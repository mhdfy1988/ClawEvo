import { randomUUID } from 'node:crypto';

import type { SkillCandidate, SkillCandidateLifecycle } from '../types/core.js';
import type { SkillCandidateResult, SkillMiningRequest } from '../types/io.js';
import { buildSkillCandidateLifecycle } from './memory-lifecycle.js';

export class SkillCrystallizer {
  crystallize(request: SkillMiningRequest): SkillCandidateResult {
    const minEvidenceCount = request.minEvidenceCount ?? 2;
    const baseCandidate = buildBaseCandidate(request, minEvidenceCount);

    if (!baseCandidate) {
      return { candidates: [] };
    }

    const mergeKey = baseCandidate.lifecycle?.merge.mergeKey;
    const activeExistingCandidates = (request.existingCandidates ?? []).filter(
      (candidate) => candidate.lifecycle?.retirement.status !== 'retire_candidate'
    );
    const mergeTargets = mergeKey
      ? activeExistingCandidates.filter((candidate) => candidate.lifecycle?.merge.mergeKey === mergeKey)
      : [];

    if (mergeTargets.length === 0) {
      return {
        candidates: [baseCandidate]
      };
    }

    const mergedCandidate = mergeSkillCandidate(baseCandidate, mergeTargets, minEvidenceCount);
    const retiredCandidates = mergeTargets.map((candidate) => retireSkillCandidate(candidate, mergedCandidate.id));

    return {
      candidates: [mergedCandidate, ...retiredCandidates]
    };
  }
}

function buildBaseCandidate(request: SkillMiningRequest, minEvidenceCount: number): SkillCandidate | undefined {
  const evidenceNodeIds = request.bundle.relevantEvidence.map((item) => item.nodeId);
  const sourceNodeIds = Array.from(
    new Set([
      ...evidenceNodeIds,
      request.bundle.currentProcess?.nodeId,
      ...request.bundle.activeRules.map((item) => item.nodeId),
      ...request.bundle.activeConstraints.map((item) => item.nodeId),
      ...request.bundle.openRisks.map((item) => item.nodeId),
      ...request.bundle.recentDecisions.map((item) => item.nodeId),
      ...request.bundle.recentStateChanges.map((item) => item.nodeId)
    ].filter((value): value is string => Boolean(value)))
  );

  if (!request.bundle.currentProcess || evidenceNodeIds.length < minEvidenceCount) {
    return undefined;
  }

  const processLabel = request.bundle.currentProcess.label.replace(/^workflow:|^skill:|^rule:/i, '').trim();
  const scores = {
    frequency: clamp01(evidenceNodeIds.length / 5),
    stability: request.bundle.activeRules.length > 0 ? 0.8 : 0.45,
    success: request.bundle.openRisks.length === 0 ? 0.75 : 0.5,
    clarity: request.bundle.currentProcess ? 0.85 : 0.4
  };

  return {
    id: randomUUID(),
    name: processLabel || 'Derived Skill Candidate',
    sourceBundleId: request.bundle.id,
    ...(request.checkpointId ? { sourceCheckpointId: request.checkpointId } : {}),
    sourceNodeIds,
    trigger: {
      query: request.bundle.query,
      intent: request.bundle.intent?.label ?? null
    },
    applicableWhen: [
      request.bundle.goal?.label ?? 'goal:unspecified',
      request.bundle.currentProcess.label
    ],
    requiredRuleIds: request.bundle.activeRules.map((item) => item.nodeId),
    requiredConstraintIds: request.bundle.activeConstraints.map((item) => item.nodeId),
    workflowSteps: [request.bundle.currentProcess.label],
    expectedOutcome: {
      target: request.bundle.goal?.label ?? 'unspecified'
    },
    failureSignals: request.bundle.openRisks.map((item) => item.label),
    evidenceNodeIds,
    lifecycle: buildSkillCandidateLifecycle({
      minEvidenceCount,
      evidenceCount: evidenceNodeIds.length,
      stability: scores.stability,
      clarity: scores.clarity,
      success: scores.success,
      failureSignalCount: request.bundle.openRisks.length,
      workflowSteps: [request.bundle.currentProcess.label],
      requiredRuleIds: request.bundle.activeRules.map((item) => item.nodeId),
      requiredConstraintIds: request.bundle.activeConstraints.map((item) => item.nodeId)
    }),
    provenance: {
      originKind: 'derived',
      sourceStage: 'skill_candidate',
      producer: 'compact-context',
      sourceBundleId: request.bundle.id,
      ...(request.checkpointId ? { derivedFromCheckpointId: request.checkpointId } : {}),
      derivedFromNodeIds: sourceNodeIds
    },
    scores,
    createdAt: new Date().toISOString()
  };
}

function mergeSkillCandidate(
  baseCandidate: SkillCandidate,
  mergeTargets: SkillCandidate[],
  minEvidenceCount: number
): SkillCandidate {
  const mergedFromCandidateIds = mergeTargets.map((candidate) => candidate.id);
  const mergedEvidenceNodeIds = dedupeStrings(
    baseCandidate.evidenceNodeIds.concat(...mergeTargets.map((candidate) => candidate.evidenceNodeIds))
  );
  const mergedSourceNodeIds = dedupeStrings(
    (baseCandidate.sourceNodeIds ?? []).concat(...mergeTargets.map((candidate) => candidate.sourceNodeIds ?? []))
  );
  const mergedRequiredRuleIds = dedupeStrings(
    baseCandidate.requiredRuleIds.concat(...mergeTargets.map((candidate) => candidate.requiredRuleIds))
  );
  const mergedRequiredConstraintIds = dedupeStrings(
    baseCandidate.requiredConstraintIds.concat(...mergeTargets.map((candidate) => candidate.requiredConstraintIds))
  );
  const mergedWorkflowSteps = dedupeStrings(
    baseCandidate.workflowSteps.concat(...mergeTargets.map((candidate) => candidate.workflowSteps))
  );
  const mergedApplicableWhen = dedupeStrings(
    baseCandidate.applicableWhen.concat(...mergeTargets.map((candidate) => candidate.applicableWhen))
  );
  const mergedFailureSignals = dedupeStrings(
    baseCandidate.failureSignals.concat(...mergeTargets.map((candidate) => candidate.failureSignals))
  );
  const mergedDerivedNodeIds = dedupeStrings(
    (baseCandidate.provenance?.derivedFromNodeIds ?? []).concat(
      ...mergeTargets.map((candidate) => candidate.provenance?.derivedFromNodeIds ?? [])
    )
  );
  const mergedScores = {
    frequency: clamp01(
      average([baseCandidate.scores.frequency, ...mergeTargets.map((candidate) => candidate.scores.frequency)]) +
        0.1 * mergeTargets.length
    ),
    stability: clamp01(
      average([baseCandidate.scores.stability, ...mergeTargets.map((candidate) => candidate.scores.stability)]) + 0.05
    ),
    success: clamp01(
      average([baseCandidate.scores.success, ...mergeTargets.map((candidate) => candidate.scores.success)])
    ),
    clarity: clamp01(
      Math.max(baseCandidate.scores.clarity, ...mergeTargets.map((candidate) => candidate.scores.clarity))
    )
  };

  return {
    ...baseCandidate,
    id: randomUUID(),
    sourceNodeIds: mergedSourceNodeIds,
    applicableWhen: mergedApplicableWhen,
    requiredRuleIds: mergedRequiredRuleIds,
    requiredConstraintIds: mergedRequiredConstraintIds,
    workflowSteps: mergedWorkflowSteps,
    failureSignals: mergedFailureSignals,
    evidenceNodeIds: mergedEvidenceNodeIds,
    lifecycle: buildSkillCandidateLifecycle({
      minEvidenceCount,
      evidenceCount: mergedEvidenceNodeIds.length,
      stability: mergedScores.stability,
      clarity: mergedScores.clarity,
      success: mergedScores.success,
      failureSignalCount: mergedFailureSignals.length,
      workflowSteps: mergedWorkflowSteps,
      requiredRuleIds: mergedRequiredRuleIds,
      requiredConstraintIds: mergedRequiredConstraintIds,
      mergedFromCandidateIds
    }),
    provenance: {
      originKind: baseCandidate.provenance?.originKind ?? 'derived',
      sourceStage: baseCandidate.provenance?.sourceStage ?? 'skill_candidate',
      producer: baseCandidate.provenance?.producer ?? 'compact-context',
      ...(baseCandidate.provenance?.sourceBundleId ? { sourceBundleId: baseCandidate.provenance.sourceBundleId } : {}),
      ...(baseCandidate.provenance?.derivedFromCheckpointId
        ? { derivedFromCheckpointId: baseCandidate.provenance.derivedFromCheckpointId }
        : {}),
      derivedFromNodeIds: mergedDerivedNodeIds
    },
    scores: mergedScores,
    createdAt: new Date().toISOString()
  };
}

function retireSkillCandidate(candidate: SkillCandidate, replacementId: string): SkillCandidate {
  const lifecycle = candidate.lifecycle;
  const retiredLifecycle: SkillCandidateLifecycle = buildSkillCandidateLifecycle({
    minEvidenceCount: lifecycle?.promotion.minEvidenceCount ?? 1,
    evidenceCount: candidate.evidenceNodeIds.length,
    stability: candidate.scores.stability,
    clarity: candidate.scores.clarity,
    success: candidate.scores.success,
    failureSignalCount: candidate.failureSignals.length,
    workflowSteps: candidate.workflowSteps,
    requiredRuleIds: candidate.requiredRuleIds,
    requiredConstraintIds: candidate.requiredConstraintIds,
    ...(lifecycle?.merge.mergedFromCandidateIds ? { mergedFromCandidateIds: lifecycle.merge.mergedFromCandidateIds } : {}),
    replacedByCandidateId: replacementId
  });

  return {
    ...candidate,
    lifecycle: {
      ...retiredLifecycle,
      retirement: {
        ...retiredLifecycle.retirement,
        status: 'retire_candidate',
        replacedByCandidateId: replacementId,
        reason: `candidate has been merged into ${replacementId}`
      },
      decay: {
        ...retiredLifecycle.decay,
        state: 'stale',
        reason: 'candidate was merged into a fresher lineage and should decay out of active rotation'
      }
    },
    scores: {
      ...candidate.scores,
      success: clamp01(candidate.scores.success * 0.8)
    }
  };
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}
