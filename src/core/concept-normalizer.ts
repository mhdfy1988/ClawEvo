import type {
  CanonicalConceptDefinition,
  CanonicalConceptId,
  ConceptMatch
} from '../types/context-processing.js';
import { normalizeUtteranceText } from './utterance-parser.js';

export const MINIMAL_CANONICAL_CONCEPTS: readonly CanonicalConceptDefinition[] = [
  {
    id: 'context_compression',
    preferredLabel: 'context compression',
    aliases: [
      'context compression',
      'prompt compression',
      'compact context',
      'compressed context',
      'ctx compression',
      '上下文压缩',
      '提示词压缩',
      '压缩上下文',
      '紧凑上下文'
    ]
  },
  {
    id: 'knowledge_graph',
    preferredLabel: 'knowledge graph',
    aliases: ['knowledge graph', 'kg', 'semantic graph', '知识图谱', '语义图谱', '图谱']
  },
  {
    id: 'provenance',
    preferredLabel: 'provenance',
    aliases: ['provenance', 'source lineage', 'source trail', '来源追踪', '来源链路', '溯源', '出处']
  },
  {
    id: 'checkpoint',
    preferredLabel: 'checkpoint',
    aliases: ['checkpoint', 'state checkpoint', 'memory checkpoint', '检查点', '状态检查点', '记忆检查点']
  },
  {
    id: 'runtime_bundle',
    preferredLabel: 'runtime bundle',
    aliases: ['runtime bundle', 'context bundle', 'bundle', '运行时上下文包', '上下文包', 'bundle 诊断']
  },
  {
    id: 'traceability',
    preferredLabel: 'traceability',
    aliases: ['traceability', 'trace view', 'trace', '可追溯性', '追踪视图', '追踪链路']
  },
  {
    id: 'artifact_sidecar',
    preferredLabel: 'artifact sidecar',
    aliases: ['artifact sidecar', 'sidecar artifact', 'sidecar', '工件 sidecar', '旁路产物', '侧挂产物']
  }
] as const;

const CANONICAL_CONCEPT_BY_ID = new Map<CanonicalConceptId, CanonicalConceptDefinition>(
  MINIMAL_CANONICAL_CONCEPTS.map((concept) => [concept.id, concept])
);

export interface ConceptNormalizationResult {
  normalizedText: string;
  matches: ConceptMatch[];
}

export function normalizeConcepts(
  text: string,
  definitions: readonly CanonicalConceptDefinition[] = MINIMAL_CANONICAL_CONCEPTS
): ConceptNormalizationResult {
  const normalizedText = normalizeConceptSearchText(text);
  const matches: ConceptMatch[] = [];
  const seen = new Set<string>();

  for (const concept of definitions) {
    for (const alias of concept.aliases) {
      const normalizedAlias = normalizeConceptSearchText(alias);

      if (!normalizedAlias || !matchesAlias(normalizedText, normalizedAlias)) {
        continue;
      }

      const dedupeKey = `${concept.id}:${normalizedAlias}`;
      if (seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);
      matches.push({
        conceptId: concept.id,
        preferredLabel: concept.preferredLabel,
        matchedAlias: alias
      });
    }
  }

  return {
    normalizedText,
    matches: prioritizeConceptMatches(matches)
  };
}

export function getCanonicalConceptDefinition(
  conceptId: CanonicalConceptId
): CanonicalConceptDefinition | undefined {
  return CANONICAL_CONCEPT_BY_ID.get(conceptId);
}

export function getCanonicalConceptCatalog(): readonly CanonicalConceptDefinition[] {
  return MINIMAL_CANONICAL_CONCEPTS;
}

function prioritizeConceptMatches(matches: ConceptMatch[]): ConceptMatch[] {
  return [...matches].sort((left, right) => {
    if (left.conceptId === right.conceptId) {
      return right.matchedAlias.length - left.matchedAlias.length;
    }

    return left.conceptId.localeCompare(right.conceptId);
  });
}

function matchesAlias(normalizedText: string, normalizedAlias: string): boolean {
  if (!normalizedText || !normalizedAlias) {
    return false;
  }

  if (looksLikeAsciiToken(normalizedAlias)) {
    return new RegExp(`(?:^|\\s)${escapeRegExp(normalizedAlias)}(?:$|\\s)`, 'u').test(normalizedText);
  }

  return normalizedText.includes(normalizedAlias);
}

function looksLikeAsciiToken(value: string): boolean {
  return /^[a-z0-9_ -]+$/u.test(value);
}

function normalizeConceptSearchText(value: string): string {
  return normalizeUtteranceText(value)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
