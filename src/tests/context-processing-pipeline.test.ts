import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNoisePolicyCorrection,
  buildSemanticClassificationCorrection
} from '@openclaw-compact-context/runtime-core/governance';
import { processContextGraphNode, processContextRecord } from '@openclaw-compact-context/runtime-core/context-processing';
import type { GraphNode } from '../types/core.js';

test('processContextRecord returns a stable materialization plan and diagnostics for conversation input', () => {
  const result = processContextRecord({
    id: 'record-pipeline-1',
    scope: 'session',
    sourceType: 'conversation',
    role: 'user',
    content: 'We need to preserve provenance, and the next step is to rebuild the checkpoint bundle.'
  });

  assert.equal(result.route, 'conversation');
  assert.equal(result.contract.preserveRawEvidence, true);
  assert.equal(result.parseResult.route, 'conversation');
  assert.equal(result.diagnostics.route, 'conversation');
  assert.ok(result.semanticSpans.length >= 2);
  assert.equal(result.diagnostics.semanticSpanCount, result.semanticSpans.length);
  assert.ok(result.nodeCandidates.length > 0);
  assert.equal(result.diagnostics.nodeCandidateCount, result.nodeCandidates.length);
  assert.ok(result.materializationPlan.materializeNodeCandidates.length > 0);
  assert.equal(
    result.diagnostics.materializeNodeCandidateCount,
    result.materializationPlan.materializeNodeCandidates.length
  );
  assert.ok(
    result.summaryCandidates.some((candidate) =>
      candidate.slot === 'goal' || candidate.slot === 'currentProcess' || candidate.slot === 'relevantEvidence'
    )
  );
  assert.equal(result.diagnostics.cacheHit, false);
  assert.ok(result.experienceHint);
  assert.equal(result.experienceHint?.status, 'procedure_only');
});

test('processContextGraphNode reuses evidence anchors and emits concept-aware candidates', () => {
  const semanticNode: GraphNode = {
    id: 'semantic-node-pipeline-1',
    type: 'Goal',
    scope: 'session',
    kind: 'state',
    label: 'goal:knowledge graph hardening',
    payload: {
      sessionId: 'session-pipeline',
      sourceType: 'conversation',
      contentPreview: 'We need to tighten the knowledge graph path explain and preserve provenance.'
    },
    strength: 'heuristic',
    confidence: 0.82,
    provenance: {
      originKind: 'raw',
      sourceStage: 'transcript_message',
      producer: 'compact-context',
      rawSourceId: 'raw-pipeline-source-1',
      derivedFromNodeIds: ['evidence-node-pipeline-1']
    },
    version: 'v1',
    freshness: 'active',
    validFrom: '2026-03-14T00:00:00.000Z',
    updatedAt: '2026-03-14T00:00:00.000Z'
  };
  const evidenceNode: GraphNode = {
    id: 'evidence-node-pipeline-1',
    type: 'Evidence',
    scope: 'session',
    kind: 'fact',
    label: 'conversation:knowledge graph path explain',
    payload: {
      sessionId: 'session-pipeline',
      role: 'user',
      content: 'We need to tighten the knowledge graph path explain and preserve provenance.'
    },
    strength: 'soft',
    confidence: 1,
    sourceRef: {
      sourceType: 'conversation',
      sourcePath: 'memory/session.log',
      sourceSpan: 'L42',
      contentHash: 'hash-pipeline-1'
    },
    provenance: {
      originKind: 'raw',
      sourceStage: 'transcript_message',
      producer: 'compact-context',
      rawSourceId: 'raw-pipeline-source-1'
    },
    version: 'v1',
    freshness: 'active',
    validFrom: '2026-03-14T00:00:00.000Z',
    updatedAt: '2026-03-14T00:00:00.000Z'
  };

  const result = processContextGraphNode(semanticNode, evidenceNode);

  assert.equal(result.evidenceAnchor.recordId, 'raw-pipeline-source-1');
  assert.equal(result.evidenceAnchor.sourcePath, 'memory/session.log');
  assert.ok(
    result.nodeCandidates.some(
      (candidate) => candidate.nodeType === 'Concept' && candidate.conceptId === 'knowledge_graph'
    )
  );
  assert.ok(result.summaryCandidates.some((candidate) => candidate.slot === 'relevantEvidence'));
  assert.ok(result.diagnostics.conceptMatchCount > 0);
});

test('processContextRecord uses a stable cache key for repeated inputs', () => {
  const first = processContextRecord({
    id: 'record-pipeline-cache-1',
    scope: 'session',
    sourceType: 'conversation',
    role: 'user',
    content: 'Please keep the knowledge graph traceable.'
  });
  const second = processContextRecord({
    id: 'record-pipeline-cache-1',
    scope: 'session',
    sourceType: 'conversation',
    role: 'user',
    content: 'Please keep the knowledge graph traceable.'
  });

  assert.ok(first.diagnostics.cacheKey);
  assert.equal(first.diagnostics.cacheHit, false);
  assert.equal(second.diagnostics.cacheHit, true);
  assert.equal(first.diagnostics.cacheKey, second.diagnostics.cacheKey);
});

test('processContextRecord applies manual noise and semantic classification corrections', () => {
  const baseline = processContextRecord(
    {
      id: 'record-pipeline-corrections-1',
      scope: 'session',
      sourceType: 'conversation',
      role: 'user',
      content: 'OK, keep the provenance visible.'
    }
  );
  const acknowledgementSpan = baseline.semanticSpans.find((span) => /^ok\b/i.test(span.normalizedText));
  const constraintSpan = baseline.semanticSpans.find((span) => /keep the provenance visible/.test(span.normalizedText));

  assert.ok(acknowledgementSpan);
  assert.ok(constraintSpan);

  const result = processContextRecord(
    {
      id: 'record-pipeline-corrections-1',
      scope: 'session',
      sourceType: 'conversation',
      role: 'user',
      content: 'OK, keep the provenance visible.'
    },
    {
      manualCorrections: [
        buildNoisePolicyCorrection({
          id: 'noise-correction-1',
          targetId: acknowledgementSpan.id,
          action: 'apply',
          author: 'tester',
          reason: 'acknowledgement should remain a hint',
          createdAt: '2026-03-15T11:00:00.000Z',
          disposition: 'hint_only'
        }),
        buildSemanticClassificationCorrection({
          id: 'classification-correction-1',
          targetId: constraintSpan.id,
          action: 'apply',
          author: 'tester',
          reason: 'treat the clause as a hard constraint',
          createdAt: '2026-03-15T11:01:00.000Z',
          nodeType: 'Constraint',
          operation: 'include'
        })
      ]
    }
  );

  assert.ok(result.noiseDecisions.some((decision) => decision.disposition === 'hint_only'));
  assert.ok(result.nodeCandidates.some((candidate) => candidate.nodeType === 'Constraint'));
});

