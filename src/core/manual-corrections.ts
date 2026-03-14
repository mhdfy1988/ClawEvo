import type {
  CanonicalConceptDefinition,
  ManualCorrectionRecord
} from '../types/context-processing.js';

export function applyConceptAliasCorrections(
  definitions: readonly CanonicalConceptDefinition[],
  corrections: readonly ManualCorrectionRecord[]
): CanonicalConceptDefinition[] {
  const corrected = new Map(definitions.map((definition) => [definition.id, [...definition.aliases]]));

  for (const correction of corrections) {
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

export function buildPromotionDecisionCorrection(input: {
  id: string;
  targetId: string;
  action: ManualCorrectionRecord['action'];
  author: string;
  reason: string;
  createdAt: string;
  decision: 'promote' | 'hold' | 'retire';
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

function readCorrectionAlias(correction: ManualCorrectionRecord): string | undefined {
  const alias = correction.metadata?.alias;
  return typeof alias === 'string' && alias.trim().length > 0 ? alias.trim() : undefined;
}
