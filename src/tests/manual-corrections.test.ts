import assert from 'node:assert/strict';
import test from 'node:test';

import { getCanonicalConceptCatalog } from '../core/concept-normalizer.js';
import { applyConceptAliasCorrections, buildPromotionDecisionCorrection } from '../core/manual-corrections.js';
import type { CanonicalConceptDefinition } from '../types/context-processing.js';

test('applyConceptAliasCorrections adds and rolls back concept aliases without mutating the source catalog', () => {
  const catalog = getCanonicalConceptCatalog();
  const originalKnowledgeGraph = catalog.find(
    (definition: CanonicalConceptDefinition) => definition.id === 'knowledge_graph'
  );

  assert.ok(originalKnowledgeGraph);
  assert.equal(originalKnowledgeGraph.aliases.includes('kg graph'), false);

  const corrected = applyConceptAliasCorrections(catalog, [
    {
      id: 'correction-add-1',
      targetKind: 'concept_alias',
      targetId: 'knowledge_graph',
      action: 'apply',
      author: 'tester',
      reason: 'support a short bilingual alias',
      createdAt: '2026-03-14T10:00:00.000Z',
      metadata: {
        alias: 'kg graph'
      }
    }
  ]);
  const rolledBack = applyConceptAliasCorrections(corrected, [
    {
      id: 'correction-rollback-1',
      targetKind: 'concept_alias',
      targetId: 'knowledge_graph',
      action: 'rollback',
      author: 'tester',
      reason: 'remove the temporary alias',
      createdAt: '2026-03-14T10:05:00.000Z',
      metadata: {
        alias: 'kg graph'
      }
    }
  ]);

  const correctedKnowledgeGraph = corrected.find((definition) => definition.id === 'knowledge_graph');
  const rolledBackKnowledgeGraph = rolledBack.find((definition) => definition.id === 'knowledge_graph');

  assert.ok(correctedKnowledgeGraph?.aliases.includes('kg graph'));
  assert.equal(originalKnowledgeGraph.aliases.includes('kg graph'), false);
  assert.equal(rolledBackKnowledgeGraph?.aliases.includes('kg graph'), false);
});

test('buildPromotionDecisionCorrection builds promotion decision corrections with stable metadata', () => {
  const correction = buildPromotionDecisionCorrection({
    id: 'promotion-correction-1',
    targetId: 'pattern:artifact_sidecar',
    action: 'apply',
    author: 'tester',
    reason: 'not stable enough for workspace promotion',
    createdAt: '2026-03-14T11:00:00.000Z',
    decision: 'hold'
  });

  assert.equal(correction.targetKind, 'promotion_decision');
  assert.equal(correction.targetId, 'pattern:artifact_sidecar');
  assert.equal(correction.action, 'apply');
  assert.equal(correction.metadata?.decision, 'hold');
});
