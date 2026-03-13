import test from 'node:test';
import assert from 'node:assert/strict';

import { ContextEngine } from '../engine/context-engine.js';
import {
  buildCompressedToolResultMetadata,
  readCompressedToolResultContent,
  summarizeToolResultMessageContent
} from '../openclaw/tool-result-policy.js';
import { createCompressedFailureToolMessage } from './fixtures/tool-result-fixtures.js';

test('engine explain reports bundle selection details for included nodes', async () => {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId: 'session-explain-selected',
    records: [
      {
        id: 'goal-explain-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to understand why the build is blocked.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'risk-explain-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'build failed and is blocked by a sqlite timeout during migration step 4.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1
        }
      }
    ]
  });

  const [riskNode] = await engine.queryNodes({
    sessionId: 'session-explain-selected',
    types: ['Risk']
  });

  assert.ok(riskNode);

  const result = await engine.explain({
    nodeId: riskNode.id,
    selectionContext: {
      sessionId: 'session-explain-selected',
      query: 'why is the build blocked by timeout',
      tokenBudget: 220
    }
  });

  assert.equal(result.selection?.included, true);
  assert.equal(result.selection?.slot, 'openRisks');
  assert.match(result.selection?.reason ?? '', /open risk/i);
  assert.equal(typeof result.selection?.categoryBudget, 'number');
  assert.match(result.summary, /Selection: included in openRisks/i);

  await engine.close();
});

test('engine explain reports bundle selection details for skipped nodes', async () => {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId: 'session-explain-skipped',
    records: [
      {
        id: 'step-explain-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content:
          'Step 4: produce a long current process explanation with enough detail to overflow the tiny debug budget for this explain test.'
      }
    ]
  });

  const [stepNode] = await engine.queryNodes({
    sessionId: 'session-explain-skipped',
    types: ['Step']
  });

  assert.ok(stepNode);

  const result = await engine.explain({
    nodeId: stepNode.id,
    selectionContext: {
      sessionId: 'session-explain-skipped',
      query: 'why is the current step missing',
      tokenBudget: 24
    }
  });

  assert.equal(result.selection?.included, false);
  assert.equal(result.selection?.slot, 'currentProcess');
  assert.match(result.selection?.reason ?? '', /budget/i);
  assert.match(result.summary, /Selection: skipped from currentProcess/i);

  await engine.close();
});

test('engine explain surfaces tool result compression policy, truncation, and lookup details', async () => {
  const engine = new ContextEngine();
  const compressedMessage = createCompressedFailureToolMessage();
  const compressedContent = readCompressedToolResultContent(compressedMessage.content);

  assert.ok(compressedContent);

  await engine.ingest({
    sessionId: 'session-explain-tool-result',
    records: [
      {
        id: 'tool-explain-compressed-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: summarizeToolResultMessageContent(compressedMessage.content) ?? 'compressed tool result',
        provenance: compressedContent.provenance,
        metadata: {
          nodeType: 'State',
          ...buildCompressedToolResultMetadata(compressedContent)
        }
      }
    ]
  });

  const [stateNode] = await engine.queryNodes({
    sessionId: 'session-explain-tool-result',
    types: ['State']
  });

  assert.ok(stateNode);

  const result = await engine.explain({
    nodeId: stateNode.id
  });

  assert.equal(result.toolResultCompression?.policyId, compressedContent.truncation.policyId);
  assert.equal(result.toolResultCompression?.reason, compressedContent.truncation.reason);
  assert.ok(result.toolResultCompression?.droppedSections.includes('stdout.middle'));
  assert.equal(result.toolResultCompression?.lookup.rawSourceId, compressedContent.provenance.rawSourceId);
  assert.equal(result.toolResultCompression?.lookup.contentHash, compressedContent.artifact?.contentHash);
  assert.equal(result.toolResultCompression?.lookup.sourcePath, compressedContent.artifact?.sourcePath);
  assert.match(result.summary, /Tool result compression:/i);
  assert.match(result.summary, /used policy/i);
  assert.match(result.summary, /Dropped sections:/i);
  assert.match(result.summary, /Lookup:/i);

  await engine.close();
});
