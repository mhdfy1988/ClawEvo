import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSummaryCandidates } from '@openclaw-compact-context/runtime-core/context-processing';
import type { ContextProcessingNodeCandidate } from '@openclaw-compact-context/contracts';

function buildCandidate(
  input: Partial<ContextProcessingNodeCandidate> & Pick<ContextProcessingNodeCandidate, 'id' | 'spanId' | 'nodeType' | 'label'>
): ContextProcessingNodeCandidate {
  return {
    route: 'conversation',
    normalizedLabel: input.label.toLowerCase(),
    disposition: 'materialize',
    reason: 'test candidate',
    ...input
  };
}

test('summary planner maps candidates into runtime summary slots', () => {
  const summary = buildSummaryCandidates([
    buildCandidate({
      id: 'goal-1',
      spanId: 'span-goal-1',
      nodeType: 'Goal',
      label: 'Preserve provenance'
    }),
    buildCandidate({
      id: 'step-1',
      spanId: 'span-step-1',
      nodeType: 'Step',
      label: 'Rebuild checkpoint bundle'
    }),
    buildCandidate({
      id: 'concept-1',
      spanId: 'span-concept-1',
      nodeType: 'Concept',
      label: 'knowledge graph',
      disposition: 'summary_only'
    })
  ]);

  assert.ok(summary.some((candidate) => candidate.slot === 'goal'));
  assert.ok(summary.some((candidate) => candidate.slot === 'currentProcess'));
  assert.ok(summary.some((candidate) => candidate.slot === 'relevantEvidence'));
  assert.equal(
    summary.find((candidate) => candidate.label === 'knowledge graph')?.preferredForm,
    'summary'
  );
});

test('summary planner dedupes equivalent summary candidates by slot and normalized label', () => {
  const summary = buildSummaryCandidates([
    buildCandidate({
      id: 'constraint-1',
      spanId: 'span-constraint-1',
      nodeType: 'Constraint',
      label: 'Keep raw evidence'
    }),
    buildCandidate({
      id: 'constraint-2',
      spanId: 'span-constraint-2',
      nodeType: 'Constraint',
      label: 'keep raw evidence'
    })
  ]);

  assert.equal(summary.length, 1);
  assert.deepEqual(summary[0]?.spanIds.sort(), ['span-constraint-1', 'span-constraint-2']);
});



