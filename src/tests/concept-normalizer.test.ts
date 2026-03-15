import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCanonicalConceptCatalog,
  getCanonicalConceptDefinition,
  normalizeConcepts
} from '../context-processing/concept-normalizer.js';

test('concept normalizer exposes the minimal bilingual concept catalog', () => {
  const catalog = getCanonicalConceptCatalog();

  assert.ok(catalog.length >= 7);
  assert.equal(getCanonicalConceptDefinition('knowledge_graph')?.preferredLabel, 'knowledge graph');
  assert.ok(catalog.some((concept) => concept.id === 'context_compression'));
  assert.ok(catalog.some((concept) => concept.id === 'artifact_sidecar'));
});

test('concept normalizer unifies Chinese, English, and abbreviations into canonical concepts', () => {
  const result = normalizeConcepts(
    '我们需要把上下文压缩做好，同时梳理 knowledge graph，并保持 provenance 和 checkpoint 的一致性。'
  );

  assert.equal(result.normalizedText.includes('knowledge graph'), true);
  assert.deepEqual(
    result.matches.map((match) => match.conceptId),
    ['checkpoint', 'context_compression', 'knowledge_graph', 'provenance']
  );
});

test('concept normalizer handles alias variants and abbreviations like KG, ctx compression, and sidecar', () => {
  const result = normalizeConcepts(
    'KG recall should stay aligned with ctx compression, traceability, runtime bundle diagnostics, and artifact sidecar retention.'
  );

  assert.ok(result.matches.some((match) => match.conceptId === 'knowledge_graph' && match.matchedAlias === 'kg'));
  assert.ok(
    result.matches.some(
      (match) => match.conceptId === 'context_compression' && match.matchedAlias === 'ctx compression'
    )
  );
  assert.ok(result.matches.some((match) => match.conceptId === 'traceability'));
  assert.ok(result.matches.some((match) => match.conceptId === 'runtime_bundle'));
  assert.ok(result.matches.some((match) => match.conceptId === 'artifact_sidecar'));
});
