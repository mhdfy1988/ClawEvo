import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSemanticSpansFromGraphNode, buildSemanticSpansFromRecord } from '../core/semantic-spans.js';
import type { GraphNode } from '../types/core.js';

test('buildSemanticSpansFromRecord returns stable clause anchors for conversation records', () => {
  const result = buildSemanticSpansFromRecord({
    id: 'record-semantic-span-1',
    scope: 'session',
    sourceType: 'conversation',
    role: 'user',
    content: 'How do we preserve provenance, and what step comes next after the timeout?'
  });

  assert.equal(result.route, 'conversation');
  assert.equal(result.evidenceAnchor.recordId, 'record-semantic-span-1');
  assert.ok(result.semanticSpans.length >= 2);
  assert.equal(result.semanticSpans[0]?.anchor.recordId, 'record-semantic-span-1');
  assert.equal(result.semanticSpans[0]?.sentenceId, 'sentence-1');
  assert.equal(result.semanticSpans[0]?.clauseId, 'sentence-1-clause-1');
  assert.match(result.semanticSpans[0]?.text ?? '', /preserve provenance/i);
  assert.ok(result.semanticSpans[0]?.candidateNodeTypes.includes('Intent'));
  assert.ok(
    result.semanticSpans.some((span) =>
      span.conceptMatches.some((match) => match.conceptId === 'provenance')
    )
  );
  assert.ok(result.semanticSpans.some((span) => span.candidateNodeTypes.includes('Step')));
});

test('buildSemanticSpansFromGraphNode reuses evidence anchors from evidence nodes', () => {
  const semanticNode: GraphNode = {
    id: 'semantic-node-1',
    type: 'Goal',
    scope: 'session',
    kind: 'state',
    label: 'goal:preserve provenance',
    payload: {
      sessionId: 'session-semantic-graph',
      sourceType: 'conversation',
      contentPreview: 'We need to preserve provenance, and then inspect the migration timeout.'
    },
    strength: 'heuristic',
    confidence: 0.8,
    provenance: {
      originKind: 'raw',
      sourceStage: 'transcript_message',
      producer: 'compact-context',
      rawSourceId: 'raw-record-semantic-1',
      derivedFromNodeIds: ['evidence-node-1']
    },
    version: 'v1',
    freshness: 'active',
    validFrom: '2026-03-14T00:00:00.000Z',
    updatedAt: '2026-03-14T00:00:00.000Z'
  };
  const evidenceNode: GraphNode = {
    id: 'evidence-node-1',
    type: 'Evidence',
    scope: 'session',
    kind: 'fact',
    label: 'conversation:preserve provenance',
    payload: {
      sessionId: 'session-semantic-graph',
      role: 'user',
      content: 'We need to preserve provenance, and then inspect the migration timeout.'
    },
    strength: 'soft',
    confidence: 1,
    sourceRef: {
      sourceType: 'conversation',
      sourcePath: 'memory/session.log',
      sourceSpan: 'L1',
      contentHash: 'hash-semantic-span-1'
    },
    provenance: {
      originKind: 'raw',
      sourceStage: 'transcript_message',
      producer: 'compact-context',
      rawSourceId: 'raw-record-semantic-1'
    },
    version: 'v1',
    freshness: 'active',
    validFrom: '2026-03-14T00:00:00.000Z',
    updatedAt: '2026-03-14T00:00:00.000Z'
  };

  const result = buildSemanticSpansFromGraphNode(semanticNode, evidenceNode);

  assert.equal(result.evidenceAnchor.recordId, 'raw-record-semantic-1');
  assert.equal(result.evidenceAnchor.sourcePath, 'memory/session.log');
  assert.equal(result.evidenceAnchor.sourceSpan, 'L1');
  assert.ok(result.semanticSpans.length >= 2);
  assert.equal(result.semanticSpans[0]?.anchor.recordId, 'raw-record-semantic-1');
  assert.equal(result.semanticSpans[0]?.anchor.sourcePath, 'memory/session.log');
  assert.ok(
    result.semanticSpans.some((span) =>
      span.conceptMatches.some((match) => match.conceptId === 'provenance')
    )
  );
  assert.ok(result.semanticSpans.every((span) => span.id.startsWith('raw-record-semantic-1:')));
});
