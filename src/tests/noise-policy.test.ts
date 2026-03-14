import assert from 'node:assert/strict';
import test from 'node:test';

import { buildNoisePolicyCorrection } from '../core/manual-corrections.js';
import { evaluateNoisePolicy } from '../core/noise-policy.js';
import type { SemanticSpan } from '../types/context-processing.js';

function buildSpan(input: Partial<SemanticSpan> & Pick<SemanticSpan, 'id' | 'text' | 'normalizedText'>): SemanticSpan {
  return {
    route: 'conversation',
    sentenceId: 'sentence-1',
    clauseId: `clause-${input.id}`,
    startOffset: 0,
    endOffset: input.text.length,
    anchor: {
      recordId: 'record-noise-1',
      clauseId: `clause-${input.id}`
    },
    candidateNodeTypes: [],
    conceptMatches: [],
    ...input
  };
}

test('noise policy downgrades acknowledgements and duplicate clauses', () => {
  const decisions = evaluateNoisePolicy('conversation', [
    buildSpan({
      id: 'span-ack',
      text: 'OK',
      normalizedText: 'ok'
    }),
    buildSpan({
      id: 'span-dup-1',
      text: 'Preserve provenance',
      normalizedText: 'preserve provenance',
      candidateNodeTypes: ['Constraint']
    }),
    buildSpan({
      id: 'span-dup-2',
      text: 'Preserve provenance',
      normalizedText: 'preserve provenance',
      candidateNodeTypes: ['Constraint']
    })
  ]);

  assert.equal(decisions[0]?.disposition, 'evidence_only');
  assert.equal(decisions[0]?.signals.includes('acknowledgement'), true);
  assert.equal(decisions[2]?.disposition, 'evidence_only');
  assert.equal(decisions[2]?.signals.includes('duplicate_clause'), true);
});

test('noise policy respects manual overrides by span id or normalized text', () => {
  const span = buildSpan({
    id: 'span-manual',
    text: '好的',
    normalizedText: '好的'
  });
  const decisions = evaluateNoisePolicy(
    'conversation',
    [span],
    [
      buildNoisePolicyCorrection({
        id: 'noise-policy-override',
        targetId: span.id,
        action: 'apply',
        author: 'tester',
        reason: 'keep this clause materialized for debugging',
        createdAt: '2026-03-15T10:00:00.000Z',
        disposition: 'materialize'
      })
    ]
  );

  assert.equal(decisions[0]?.disposition, 'materialize');
  assert.deepEqual(decisions[0]?.signals, ['manual_override']);
});
