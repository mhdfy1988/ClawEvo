import type {
  CanonicalConceptDefinition,
  ContextNoiseDisposition,
  SemanticExtractionNodeTarget,
  ManualCorrectionRecord
} from '../types/context-processing.js';

export type PromotionDecision = 'promote' | 'hold' | 'retire';

export function applyConceptAliasCorrections(
  definitions: readonly CanonicalConceptDefinition[],
  corrections: readonly ManualCorrectionRecord[]
): CanonicalConceptDefinition[] {
  const corrected = new Map(definitions.map((definition) => [definition.id, [...definition.aliases]]));
  const orderedCorrections = [...corrections].sort((left, right) => {
    const createdAtDelta = left.createdAt.localeCompare(right.createdAt);
    return createdAtDelta !== 0 ? createdAtDelta : left.id.localeCompare(right.id);
  });

  for (const correction of orderedCorrections) {
    if (correction.targetKind !== 'concept_alias') {
      continue;
    }

    const alias = readCorrectionAlias(correction);
    const conceptId = correction.targetId as CanonicalConceptDefinition['id'];

    if (!alias || !corrected.has(conceptId)) {
      continue;
    }

    const aliases = corrected.get(conceptId) ?? [];

    if (correction.action === 'rollback') {
      corrected.set(
        conceptId,
        aliases.filter((item) => item !== alias)
      );
      continue;
    }

    if (!aliases.includes(alias)) {
      aliases.push(alias);
      corrected.set(conceptId, aliases);
    }
  }

  return definitions.map((definition) => ({
    ...definition,
    aliases: corrected.get(definition.id) ?? [...definition.aliases]
  }));
}

export function buildConceptAliasCorrection(input: {
  id: string;
  targetId: string;
  action: ManualCorrectionRecord['action'];
  author: string;
  reason: string;
  createdAt: string;
  alias: string;
}): ManualCorrectionRecord {
  return {
    id: input.id,
    targetKind: 'concept_alias',
    targetId: input.targetId,
    action: input.action,
    author: input.author,
    reason: input.reason,
    createdAt: input.createdAt,
    metadata: {
      alias: input.alias
    }
  };
}

export function buildPromotionDecisionCorrection(input: {
  id: string;
  targetId: string;
  action: ManualCorrectionRecord['action'];
  author: string;
  reason: string;
  createdAt: string;
  decision: PromotionDecision;
}): ManualCorrectionRecord {
  return {
    id: input.id,
    targetKind: 'promotion_decision',
    targetId: input.targetId,
    action: input.action,
    author: input.author,
    reason: input.reason,
    createdAt: input.createdAt,
    metadata: {
      decision: input.decision
    }
  };
}

export function buildNoisePolicyCorrection(input: {
  id: string;
  targetId: string;
  action: ManualCorrectionRecord['action'];
  author: string;
  reason: string;
  createdAt: string;
  disposition: ContextNoiseDisposition;
}): ManualCorrectionRecord {
  return {
    id: input.id,
    targetKind: 'noise_policy',
    targetId: input.targetId,
    action: input.action,
    author: input.author,
    reason: input.reason,
    createdAt: input.createdAt,
    metadata: {
      disposition: input.disposition
    }
  };
}

export function buildSemanticClassificationCorrection(input: {
  id: string;
  targetId: string;
  action: ManualCorrectionRecord['action'];
  author: string;
  reason: string;
  createdAt: string;
  nodeType: SemanticExtractionNodeTarget;
  operation: 'include' | 'exclude';
}): ManualCorrectionRecord {
  return {
    id: input.id,
    targetKind: 'semantic_classification',
    targetId: input.targetId,
    action: input.action,
    author: input.author,
    reason: input.reason,
    createdAt: input.createdAt,
    metadata: {
      nodeType: input.nodeType,
      operation: input.operation
    }
  };
}

export function readCorrectionAlias(correction: ManualCorrectionRecord): string | undefined {
  const alias = correction.metadata?.alias;
  return typeof alias === 'string' && alias.trim().length > 0 ? alias.trim() : undefined;
}

export function readPromotionDecision(correction: ManualCorrectionRecord): PromotionDecision | undefined {
  if (correction.targetKind !== 'promotion_decision') {
    return undefined;
  }

  const decision = correction.metadata?.decision;
  return decision === 'promote' || decision === 'hold' || decision === 'retire' ? decision : undefined;
}

export function readSemanticClassificationOverride(
  correction: ManualCorrectionRecord
): { nodeType: SemanticExtractionNodeTarget; operation: 'include' | 'exclude' } | undefined {
  if (correction.targetKind !== 'semantic_classification') {
    return undefined;
  }

  const nodeType = correction.metadata?.nodeType;
  const operation = correction.metadata?.operation;
  return isSemanticExtractionNodeTarget(nodeType) && (operation === 'include' || operation === 'exclude')
    ? { nodeType, operation }
    : undefined;
}

export function resolveSemanticClassificationOverrides(
  targetIds: readonly string[],
  corrections: readonly ManualCorrectionRecord[]
): { include: SemanticExtractionNodeTarget[]; exclude: SemanticExtractionNodeTarget[] } {
  const relevant = corrections
    .filter((correction) => correction.targetKind === 'semantic_classification' && targetIds.includes(correction.targetId))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const include = new Set<SemanticExtractionNodeTarget>();
  const exclude = new Set<SemanticExtractionNodeTarget>();

  for (const correction of relevant) {
    const override = readSemanticClassificationOverride(correction);

    if (!override) {
      continue;
    }

    if (correction.action === 'rollback') {
      include.delete(override.nodeType);
      exclude.delete(override.nodeType);
      continue;
    }

    if (override.operation === 'include') {
      exclude.delete(override.nodeType);
      include.add(override.nodeType);
      continue;
    }

    include.delete(override.nodeType);
    exclude.add(override.nodeType);
  }

  return {
    include: [...include],
    exclude: [...exclude]
  };
}

export function resolvePromotionDecision(
  targetId: string,
  corrections: readonly ManualCorrectionRecord[]
): PromotionDecision | undefined {
  const relevant = corrections
    .filter((correction) => correction.targetKind === 'promotion_decision' && correction.targetId === targetId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  for (const correction of relevant) {
    const decision = readPromotionDecision(correction);

    if (!decision) {
      continue;
    }

    if (correction.action === 'rollback') {
      return undefined;
    }

    return decision;
  }

  return undefined;
}

export function collectCorrectionsForNode(
  targetId: string,
  corrections: readonly ManualCorrectionRecord[]
): ManualCorrectionRecord[] {
  return corrections
    .filter((correction) => correction.targetId === targetId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function isSemanticExtractionNodeTarget(value: unknown): value is SemanticExtractionNodeTarget {
  return (
    value === 'Rule' ||
    value === 'Constraint' ||
    value === 'Process' ||
    value === 'Step' ||
    value === 'Risk' ||
    value === 'Skill' ||
    value === 'State' ||
    value === 'Decision' ||
    value === 'Outcome' ||
    value === 'Goal' ||
    value === 'Intent' ||
    value === 'Tool' ||
    value === 'Mode' ||
    value === 'Topic' ||
    value === 'Concept'
  );
}
