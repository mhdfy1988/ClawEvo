import { randomUUID } from 'node:crypto';

import type { SkillCandidate } from '../types/core.js';
import type { SkillCandidateResult, SkillMiningRequest } from '../types/io.js';

export class SkillCrystallizer {
  crystallize(request: SkillMiningRequest): SkillCandidateResult {
    const minEvidenceCount = request.minEvidenceCount ?? 2;
    const evidenceNodeIds = request.bundle.relevantEvidence.map((item) => item.nodeId);

    if (!request.bundle.currentProcess || evidenceNodeIds.length < minEvidenceCount) {
      return { candidates: [] };
    }

    const processLabel = request.bundle.currentProcess.label.replace(/^workflow:|^skill:|^rule:/i, '').trim();
    const candidate: SkillCandidate = {
      id: randomUUID(),
      name: processLabel || 'Derived Skill Candidate',
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
      provenance: {
        originKind: 'derived',
        sourceStage: 'skill_candidate',
        producer: 'compact-context',
        derivedFromNodeIds: Array.from(
          new Set([
            ...evidenceNodeIds,
            request.bundle.currentProcess.nodeId,
            ...request.bundle.activeRules.map((item) => item.nodeId),
            ...request.bundle.activeConstraints.map((item) => item.nodeId)
          ])
        )
      },
      scores: {
        frequency: clamp01(evidenceNodeIds.length / 5),
        stability: request.bundle.activeRules.length > 0 ? 0.8 : 0.45,
        success: request.bundle.openRisks.length === 0 ? 0.75 : 0.5,
        clarity: request.bundle.currentProcess ? 0.85 : 0.4
      },
      createdAt: new Date().toISOString()
    };

    return {
      candidates: [candidate]
    };
  }
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
