import assert from 'node:assert/strict';
import test from 'node:test';

import { getCanonicalConceptCatalog } from '@openclaw-compact-context/runtime-core/context-processing';
import { ContextEngine } from '@openclaw-compact-context/runtime-core/engine/context-engine';
import {
  applyConceptAliasCorrections,
  buildConceptAliasCorrection,
  buildLabelOverrideCorrection,
  buildNodeSuppressionCorrection,
  buildPromotionDecisionCorrection,
  resolveNodeRuntimeCorrection
} from '@openclaw-compact-context/runtime-core/governance';
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

test('manual runtime corrections resolve suppression and label overrides in chronological order', () => {
  const correction = resolveNodeRuntimeCorrection(
    ['rule:preserve-provenance'],
    [
      buildNodeSuppressionCorrection({
        id: 'suppression-1',
        targetId: 'rule:preserve-provenance',
        action: 'apply',
        author: 'tester',
        reason: 'temporarily suppress a noisy rule',
        createdAt: '2026-03-14T11:30:00.000Z',
        suppressed: true
      }),
      buildLabelOverrideCorrection({
        id: 'label-1',
        targetId: 'rule:preserve-provenance',
        action: 'apply',
        author: 'tester',
        reason: 'clarify the rule wording',
        createdAt: '2026-03-14T11:31:00.000Z',
        label: 'Rule: preserve provenance before transcript persistence.'
      }),
      buildNodeSuppressionCorrection({
        id: 'suppression-rollback-1',
        targetId: 'rule:preserve-provenance',
        action: 'rollback',
        author: 'tester',
        reason: 'allow the rule back into runtime selection',
        createdAt: '2026-03-14T11:32:00.000Z',
        suppressed: true
      })
    ]
  );

  assert.equal(correction.suppressed, false);
  assert.equal(correction.labelOverride, 'Rule: preserve provenance before transcript persistence.');
});

test('context engine persists manual concept alias corrections and explain exposes correction trace', async () => {
  const engine = new ContextEngine();
  const sessionId = 'session-manual-correction-trace';
  const temporaryAlias = 'knowledge weave';

  try {
    await engine.applyManualCorrections([
      buildConceptAliasCorrection({
        id: 'concept-alias-correction-1',
        targetId: 'knowledge_graph',
        action: 'apply',
        author: 'tester',
        reason: 'support a temporary bilingual alias',
        createdAt: '2026-03-14T12:00:00.000Z',
        alias: temporaryAlias
      })
    ]);

    await engine.ingest({
      sessionId,
      records: [
        {
          id: `${sessionId}:goal`,
          scope: 'session',
          sourceType: 'conversation',
          role: 'user',
          content: `We need to keep the ${temporaryAlias} explainable.`,
          metadata: {
            nodeType: 'Goal'
          }
        }
      ]
    });

    const conceptNodes = await engine.queryNodes({
      sessionId,
      types: ['Concept']
    });
    const knowledgeGraphConcept = conceptNodes.find((node) => /concept:knowledge graph/i.test(node.label));

    assert.ok(knowledgeGraphConcept);

    const explanation = await engine.explain({
      nodeId: knowledgeGraphConcept.id,
      selectionContext: {
        sessionId,
        query: `keep the ${temporaryAlias} explainable`,
        tokenBudget: 512
      }
    });

    assert.ok(explanation.corrections);
    assert.ok(explanation.corrections?.applied.some((correction) => correction.id === 'concept-alias-correction-1'));
    assert.match(explanation.summary, /Corrections:/);
    assert.equal((await engine.listManualCorrections()).length, 1);

    await engine.applyManualCorrections([
      buildConceptAliasCorrection({
        id: 'concept-alias-correction-rollback-1',
        targetId: 'knowledge_graph',
        action: 'rollback',
        author: 'tester',
        reason: 'remove the temporary alias again',
        createdAt: '2026-03-14T12:05:00.000Z',
        alias: temporaryAlias
      })
    ]);

    await engine.ingest({
      sessionId: `${sessionId}-rollback`,
      records: [
        {
          id: `${sessionId}-rollback:goal`,
          scope: 'session',
          sourceType: 'conversation',
          role: 'user',
          content: `Please keep the ${temporaryAlias} traceable after rollback.`,
          metadata: {
            nodeType: 'Goal'
          }
        }
      ]
    });

    const rollbackConceptNodes = await engine.queryNodes({
      sessionId: `${sessionId}-rollback`,
      types: ['Concept'],
      text: temporaryAlias
    });

    assert.equal(rollbackConceptNodes.some((node) => /concept:knowledge graph/i.test(node.label)), false);
  } finally {
    await engine.close();
  }
});

