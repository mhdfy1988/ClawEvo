import type {
  CheckpointLifecycle,
  MemoryDecayState,
  MemoryRetentionClass,
  RuntimeContextBundle,
  SkillCandidate,
  SkillCandidateLifecycle
} from '../types/core.js';
import { buildSkillCandidatePromotionGovernance } from './knowledge-promotion.js';

interface SkillLifecycleBuildInput {
  minEvidenceCount: number;
  evidenceCount: number;
  stability: number;
  clarity: number;
  success: number;
  failureSignalCount: number;
  workflowSteps: string[];
  requiredRuleIds: string[];
  requiredConstraintIds: string[];
  mergedFromCandidateIds?: string[];
  replacedByCandidateId?: string;
}

const PROMOTION_MIN_STABILITY = 0.75;
const PROMOTION_MIN_CLARITY = 0.7;

export function buildCheckpointLifecycle(bundle: RuntimeContextBundle): CheckpointLifecycle {
  const retentionClass = resolveCheckpointRetentionClass(bundle);

  return {
    retentionClass,
    decayState: 'fresh',
    reason:
      retentionClass === 'sticky'
        ? 'checkpoint carries active goal/process/risk context and should remain easy to recover'
        : 'checkpoint mainly carries rolling session context and can decay normally over time'
  };
}

export function buildSkillCandidateLifecycle(input: SkillLifecycleBuildInput): SkillCandidateLifecycle {
  const promotionGovernance = buildSkillCandidatePromotionGovernance({
    evidenceCount: input.evidenceCount,
    minEvidenceCount: input.minEvidenceCount,
    stability: input.stability,
    clarity: input.clarity,
    success: input.success,
    failureSignalCount: input.failureSignalCount
  });
  const promotionReady = promotionGovernance.promotionDecision === 'promote';
  const mergeKey = buildSkillMergeKey(input.workflowSteps, input.requiredRuleIds, input.requiredConstraintIds);
  const decayState = resolveDecayState(input);
  const retirementStatus = input.success < 0.25 && input.evidenceCount < input.minEvidenceCount ? 'retire_candidate' : 'keep';

  return {
    stage: 'candidate',
    governance: {
      knowledgeClass: promotionGovernance.knowledgeClass,
      contaminationRisk: promotionGovernance.contaminationRisk,
      rollbackSupported: promotionGovernance.rollbackSupported,
      reason: promotionGovernance.reasons.join(' | ')
    },
    promotion: {
      ready: promotionReady,
      target: promotionReady ? 'Skill' : 'CandidateOnly',
      minEvidenceCount: input.minEvidenceCount,
      minStability: PROMOTION_MIN_STABILITY,
      minClarity: PROMOTION_MIN_CLARITY,
      reason: promotionReady
        ? 'candidate meets the second-pass promotion thresholds for a durable Skill'
        : 'candidate remains below the durable Skill gate because knowledge governance keeps promotion on hold'
    },
    merge: {
      mergeKey,
      eligible: input.evidenceCount >= input.minEvidenceCount,
      ...(input.mergedFromCandidateIds && input.mergedFromCandidateIds.length > 0
        ? { mergedFromCandidateIds: input.mergedFromCandidateIds }
        : {}),
      reason:
        input.mergedFromCandidateIds && input.mergedFromCandidateIds.length > 0
          ? `candidate merged ${input.mergedFromCandidateIds.length} prior candidate(s) into a refreshed lineage`
          : input.evidenceCount >= input.minEvidenceCount
          ? 'candidate has enough supporting evidence to participate in merge and dedupe passes'
          : 'candidate remains below the merge threshold until more evidence accumulates'
    },
    retirement: {
      status: retirementStatus,
      ...(input.replacedByCandidateId ? { replacedByCandidateId: input.replacedByCandidateId } : {}),
      reason:
        input.replacedByCandidateId
          ? `candidate has been retired in favor of ${input.replacedByCandidateId}`
          : retirementStatus === 'keep'
          ? 'candidate remains active until a later merge or retire pass decides otherwise'
          : 'candidate is weak enough to be retired unless future bundles reinforce it'
    },
    decay: {
      state: decayState,
      reason: describeDecayReason(decayState)
    }
  };
}

export function describeCheckpointLifecycle(lifecycle: CheckpointLifecycle | undefined): string {
  if (!lifecycle) {
    return '';
  }

  return `checkpoint ${lifecycle.retentionClass}/${lifecycle.decayState}: ${lifecycle.reason}`;
}

export function describeSkillCandidateLifecycle(lifecycle: SkillCandidateLifecycle | undefined): string {
  if (!lifecycle) {
    return '';
  }

  const promotion = lifecycle.promotion.ready ? 'promotion-ready' : 'not-yet-promoted';
  const governance = `${lifecycle.governance.knowledgeClass}/${lifecycle.governance.contaminationRisk}-risk`;
  const mergeSuffix =
    lifecycle.merge.mergedFromCandidateIds && lifecycle.merge.mergedFromCandidateIds.length > 0
      ? `/${lifecycle.merge.mergedFromCandidateIds.length} merged`
      : '';
  const retirementSuffix = lifecycle.retirement.replacedByCandidateId
    ? `/replaced-by:${lifecycle.retirement.replacedByCandidateId}`
    : '';
  return (
    `skill candidate ${lifecycle.stage}/${promotion}/${governance}/${lifecycle.decay.state}${mergeSuffix}; ` +
    `merge=${lifecycle.merge.eligible ? 'eligible' : 'hold'}; ` +
    `retirement=${lifecycle.retirement.status}${retirementSuffix}`
  );
}

export function collectMemoryLifecycleSummary(input: {
  checkpoints: Array<{
    id: string;
    lifecycle?: CheckpointLifecycle;
  }>;
  skillCandidates: Array<Pick<SkillCandidate, 'id' | 'lifecycle'>>;
}): string {
  const parts = [
    ...input.checkpoints
      .map((checkpoint) => checkpoint.lifecycle)
      .filter((value): value is CheckpointLifecycle => Boolean(value))
      .map((lifecycle) => describeCheckpointLifecycle(lifecycle)),
    ...input.skillCandidates
      .map((candidate) => candidate.lifecycle)
      .filter((value): value is SkillCandidateLifecycle => Boolean(value))
      .map((lifecycle) => describeSkillCandidateLifecycle(lifecycle))
  ].filter(Boolean);

  return parts.length > 0 ? ` Memory lifecycle: ${parts.join(' | ')}.` : '';
}

function resolveCheckpointRetentionClass(bundle: RuntimeContextBundle): MemoryRetentionClass {
  if (bundle.openRisks.length > 0 || bundle.goal || bundle.currentProcess || bundle.activeRules.length > 0) {
    return 'sticky';
  }

  return 'rolling';
}

function resolveDecayState(input: SkillLifecycleBuildInput): MemoryDecayState {
  if (input.failureSignalCount >= 2 && input.success < 0.45) {
    return 'stale';
  }

  if (input.evidenceCount >= input.minEvidenceCount + 1 && input.success >= 0.6) {
    return 'fresh';
  }

  if (input.evidenceCount >= input.minEvidenceCount) {
    return 'cooling';
  }

  return 'stale';
}

function buildSkillMergeKey(workflowSteps: string[], ruleIds: string[], constraintIds: string[]): string {
  const workflowKey = normalizeMemoryText(workflowSteps[0] ?? 'unspecified-workflow');
  const ruleKey = [...ruleIds].sort().join(',');
  const constraintKey = [...constraintIds].sort().join(',');

  return `workflow:${workflowKey}|rules:${ruleKey || 'none'}|constraints:${constraintKey || 'none'}`;
}

function normalizeMemoryText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'unspecified';
}

function describeDecayReason(state: MemoryDecayState): string {
  switch (state) {
    case 'fresh':
      return 'candidate has strong recent evidence and can stay prominent in memory maintenance';
    case 'cooling':
      return 'candidate has enough evidence to keep, but should cool unless new bundles reinforce it';
    case 'stale':
    default:
      return 'candidate is weakly supported and should decay first if memory pressure increases';
  }
}
