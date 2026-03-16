import assert from 'node:assert/strict';
import test from 'node:test';

import { buildContextProcessingExperienceHint } from '@openclaw-compact-context/runtime-core/context-processing';
import type {
  ContextNoiseDecision,
  ContextProcessingNodeCandidate,
  SemanticSpan
} from '../types/context-processing.js';

function buildSpan(id: string, text: string, candidateNodeTypes: SemanticSpan['candidateNodeTypes']): SemanticSpan {
  return {
    id,
    route: 'conversation',
    text,
    normalizedText: text.toLowerCase(),
    sentenceId: 'sentence-1',
    clauseId: `clause-${id}`,
    startOffset: 0,
    endOffset: text.length,
    anchor: {
      recordId: 'record-experience-1',
      clauseId: `clause-${id}`
    },
    candidateNodeTypes,
    conceptMatches: []
  };
}

function buildCandidate(id: string, spanId: string, nodeType: ContextProcessingNodeCandidate['nodeType']): ContextProcessingNodeCandidate {
  return {
    id,
    spanId,
    route: 'conversation',
    nodeType,
    label: `${nodeType}:${spanId}`,
    normalizedLabel: `${nodeType}:${spanId}`.toLowerCase(),
    disposition: 'materialize',
    reason: 'test candidate'
  };
}

test('context processing experience hint captures raw-first failure and procedure spans', () => {
  const semanticSpans = [
    buildSpan('span-step', 'First rebuild the checkpoint', ['Step']),
    buildSpan('span-risk', 'This path failed because the checkpoint is stale', ['Risk'])
  ];
  const nodeCandidates = [
    buildCandidate('candidate-step', 'span-step', 'Step'),
    buildCandidate('candidate-risk', 'span-risk', 'Risk')
  ];
  const noiseDecisions: ContextNoiseDecision[] = [
    {
      spanId: 'span-step',
      route: 'conversation',
      disposition: 'materialize',
      reason: 'step is actionable',
      signals: [],
      targetId: 'span-step'
    },
    {
      spanId: 'span-risk',
      route: 'conversation',
      disposition: 'materialize',
      reason: 'risk is actionable',
      signals: [],
      targetId: 'span-risk'
    }
  ];

  const hint = buildContextProcessingExperienceHint({
    route: 'conversation',
    semanticSpans,
    nodeCandidates,
    noiseDecisions
  });

  assert.ok(hint);
  assert.equal(hint?.status, 'mixed');
  assert.deepEqual(hint?.procedureStepSpanIds, ['span-step']);
  assert.deepEqual(hint?.procedureStepLabels, ['First rebuild the checkpoint']);
  assert.deepEqual(hint?.failureSignalSpanIds, ['span-risk']);
  assert.deepEqual(hint?.criticalStepSpanIds, ['span-step']);
});

