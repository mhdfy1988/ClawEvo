import type {
  GraphNode,
  JsonValue,
  KnowledgeContaminationRisk,
  KnowledgePromotionClass,
  KnowledgePromotionDecision,
  KnowledgePromotionGovernance
} from '../types/core.js';

interface SkillCandidatePromotionInput {
  evidenceCount: number;
  minEvidenceCount: number;
  stability: number;
  clarity: number;
  success: number;
  failureSignalCount: number;
}

const STABLE_SKILL_MIN_OBSERVATIONS = 3;
const STABLE_SKILL_MIN_CONFIDENCE = 0.78;
const HARD_CONSTRAINT_MIN_OBSERVATIONS = 4;
const HARD_CONSTRAINT_MIN_CONFIDENCE = 0.9;

export function buildSkillCandidatePromotionGovernance(
  input: SkillCandidatePromotionInput
): KnowledgePromotionGovernance & {
  knowledgeClass: Extract<KnowledgePromotionClass, 'local_procedure' | 'stable_skill'>;
} {
  const reasons: string[] = [];
  const observationCount = input.evidenceCount;
  const downgradeCount = 0;
  const contaminationRisk = resolveSkillCandidateContaminationRisk(input);
  const requiredObservationCount = Math.max(2, input.minEvidenceCount);
  const meetsStableSkillGate =
    observationCount >= requiredObservationCount &&
    input.stability >= 0.75 &&
    input.clarity >= 0.7 &&
    input.success >= 0.68 &&
    contaminationRisk !== 'high';
  const knowledgeClass = meetsStableSkillGate ? 'stable_skill' : 'local_procedure';

  if (meetsStableSkillGate) {
    reasons.push('candidate has enough supporting evidence and stable successful execution');
  } else {
    reasons.push('candidate is still best treated as a local procedure until more evidence accumulates');
  }

  if (contaminationRisk === 'high') {
    reasons.push('candidate still carries enough failure pressure to risk polluting durable memory');
  } else if (contaminationRisk === 'medium') {
    reasons.push('candidate is usable, but should cool until more successful bundles reinforce it');
  } else {
    reasons.push('candidate is clean enough to participate in promotion and merge passes');
  }

  if (input.failureSignalCount > 0) {
    reasons.push(`bundle still exposed ${input.failureSignalCount} failure signal(s) during crystallization`);
  }

  return {
    knowledgeClass,
    promotionDecision: meetsStableSkillGate ? 'promote' : 'hold',
    contaminationRisk,
    rollbackSupported: true,
    observationCount,
    downgradeCount,
    globalEligible: false,
    reasons
  };
}

export function assessPromotedKnowledgeGovernance(
  node: GraphNode,
  manualDecision?: KnowledgePromotionDecision
): KnowledgePromotionGovernance | undefined {
  if (!isPromotedKnowledgeNode(node)) {
    return undefined;
  }

  const observationCount = readNumericPayload(node, 'observationCount', 1);
  const downgradeCount = readNumericPayload(node, 'downgradeCount', 0);
  const promotionState = readStringPayload(node, 'promotionState') ?? 'candidate';
  const reasons: string[] = [];
  const knowledgeClass = resolvePromotedKnowledgeClass(node, observationCount, downgradeCount, reasons);
  const contaminationRisk = resolvePromotedKnowledgeContaminationRisk(
    node,
    knowledgeClass,
    observationCount,
    downgradeCount,
    promotionState,
    reasons
  );
  const computedDecision = resolvePromotionDecision(
    knowledgeClass,
    contaminationRisk,
    observationCount,
    downgradeCount,
    promotionState,
    reasons
  );
  const promotionDecision = manualDecision ?? computedDecision;

  if (manualDecision) {
    reasons.push(`manual promotion decision overrides automatic decision to "${manualDecision}"`);
  }

  const globalEligible =
    node.scope === 'workspace' &&
    promotionDecision === 'promote' &&
    contaminationRisk === 'low' &&
    (knowledgeClass === 'stable_skill' || knowledgeClass === 'hard_constraint_candidate');

  if (globalEligible) {
    reasons.push('workspace-scoped knowledge is stable enough to be promoted into the global recall tier');
  } else if (node.scope === 'workspace' && promotionDecision !== 'promote') {
    reasons.push('workspace-scoped knowledge is kept below global promotion until the promotion gate becomes clean');
  }

  return {
    knowledgeClass,
    promotionDecision,
    contaminationRisk,
    rollbackSupported: true,
    observationCount,
    downgradeCount,
    globalEligible,
    reasons
  };
}

export function annotatePromotedKnowledgeNode(
  node: GraphNode,
  manualDecision?: KnowledgePromotionDecision
): GraphNode {
  const governance = assessPromotedKnowledgeGovernance(node, manualDecision);

  if (!governance) {
    return node;
  }

  return {
    ...node,
    payload: {
      ...node.payload,
      knowledgeClass: governance.knowledgeClass,
      contaminationRisk: governance.contaminationRisk,
      promotionDecision: governance.promotionDecision,
      rollbackSupported: governance.rollbackSupported,
      globalEligible: governance.globalEligible,
      promotionReasons: governance.reasons
    }
  };
}

export function describePromotionGovernance(
  governance: KnowledgePromotionGovernance | undefined
): string {
  if (!governance) {
    return '';
  }

  return (
    ` Promotion governance: ${governance.knowledgeClass}/${governance.promotionDecision}` +
    `/${governance.contaminationRisk}-risk, observations=${governance.observationCount},` +
    ` downgrades=${governance.downgradeCount}, globalEligible=${governance.globalEligible}.`
  );
}

function isPromotedKnowledgeNode(node: GraphNode): boolean {
  return node.type === 'Pattern' || node.type === 'FailurePattern' || node.type === 'SuccessfulProcedure';
}

function resolveSkillCandidateContaminationRisk(
  input: SkillCandidatePromotionInput
): KnowledgeContaminationRisk {
  if (input.failureSignalCount >= 2 || input.success < 0.45) {
    return 'high';
  }

  if (input.failureSignalCount > 0 || input.success < 0.68 || input.clarity < 0.7) {
    return 'medium';
  }

  return 'low';
}

function resolvePromotedKnowledgeClass(
  node: GraphNode,
  observationCount: number,
  downgradeCount: number,
  reasons: string[]
): KnowledgePromotionClass {
  if (node.type === 'FailurePattern') {
    if (observationCount >= HARD_CONSTRAINT_MIN_OBSERVATIONS && node.confidence >= HARD_CONSTRAINT_MIN_CONFIDENCE) {
      reasons.push('failure pattern has repeated, high-confidence evidence and can act as a hard constraint candidate');
      return 'hard_constraint_candidate';
    }

    reasons.push('failure pattern is still best treated as negative experience rather than a hard constraint');
    return 'failure_experience';
  }

  if (node.type === 'SuccessfulProcedure') {
    if (observationCount >= STABLE_SKILL_MIN_OBSERVATIONS && node.confidence >= STABLE_SKILL_MIN_CONFIDENCE) {
      reasons.push('successful procedure has enough repeated evidence to be treated as a stable skill');
      return 'stable_skill';
    }

    reasons.push('successful procedure remains a local procedure until more observations reinforce it');
    return 'local_procedure';
  }

  const patternType = readStringPayload(node, 'patternType');

  if (patternType === 'failure') {
    reasons.push('pattern is failure-heavy and should remain negative experience until stronger evidence appears');
    return 'failure_experience';
  }

  if (patternType === 'mixed' || downgradeCount > 0) {
    reasons.push('pattern mixes success and failure signals, so it stays below durable knowledge promotion');
    return 'local_procedure';
  }

  if (observationCount >= STABLE_SKILL_MIN_OBSERVATIONS && node.confidence >= STABLE_SKILL_MIN_CONFIDENCE) {
    reasons.push('success-oriented pattern has enough observations to be treated as a stable skill');
    return 'stable_skill';
  }

  reasons.push('pattern is still local and should not be treated as durable knowledge yet');
  return 'local_procedure';
}

function resolvePromotedKnowledgeContaminationRisk(
  node: GraphNode,
  knowledgeClass: KnowledgePromotionClass,
  observationCount: number,
  downgradeCount: number,
  promotionState: string,
  reasons: string[]
): KnowledgeContaminationRisk {
  if (promotionState === 'retired') {
    reasons.push('knowledge has already been retired and should be treated as stale');
    return 'high';
  }

  if (promotionState === 'downgraded' || downgradeCount >= 2) {
    reasons.push('repeated downgrades indicate unstable behavior and elevated pollution risk');
    return 'high';
  }

  if (knowledgeClass === 'hard_constraint_candidate') {
    reasons.push('constraint-grade failure knowledge is stable enough to keep pollution risk low');
    return 'low';
  }

  if (knowledgeClass === 'failure_experience') {
    const risk = observationCount >= HARD_CONSTRAINT_MIN_OBSERVATIONS && node.confidence >= 0.88 ? 'medium' : 'high';
    reasons.push(
      risk === 'medium'
        ? 'failure experience is repeated enough to be useful, but still needs guarded admission'
        : 'failure experience is too weak to promote without risking memory pollution'
    );
    return risk;
  }

  if (knowledgeClass === 'stable_skill') {
    reasons.push('stable successful knowledge keeps contamination risk low');
    return 'low';
  }

  const risk = observationCount >= 2 && node.confidence >= 0.72 ? 'medium' : 'high';
  reasons.push(
    risk === 'medium'
      ? 'local procedure is promising, but still should not outrank stable long-term knowledge'
      : 'local procedure is under-evidenced and would likely pollute durable memory'
  );
  return risk;
}

function resolvePromotionDecision(
  knowledgeClass: KnowledgePromotionClass,
  contaminationRisk: KnowledgeContaminationRisk,
  observationCount: number,
  downgradeCount: number,
  promotionState: string,
  reasons: string[]
): KnowledgePromotionDecision {
  if (promotionState === 'retired') {
    reasons.push('retired knowledge remains retired until a manual override reopens it');
    return 'retire';
  }

  if (contaminationRisk === 'high') {
    reasons.push('automatic promotion is held because contamination risk is high');
    return downgradeCount >= 3 ? 'retire' : 'hold';
  }

  if (
    (knowledgeClass === 'stable_skill' && observationCount >= STABLE_SKILL_MIN_OBSERVATIONS) ||
    (knowledgeClass === 'hard_constraint_candidate' && observationCount >= HARD_CONSTRAINT_MIN_OBSERVATIONS)
  ) {
    reasons.push('automatic promotion gate is satisfied');
    return 'promote';
  }

  reasons.push('automatic promotion gate remains on hold until more observations accumulate');
  return 'hold';
}

function readNumericPayload(node: GraphNode, key: string, fallback: number): number {
  const value = node.payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readStringPayload(node: GraphNode, key: string): string | undefined {
  const value = node.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isJsonStringArray(value: JsonValue | undefined): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function readPromotionReasons(node: GraphNode): string[] {
  const value = node.payload.promotionReasons;
  return isJsonStringArray(value) ? value : [];
}
