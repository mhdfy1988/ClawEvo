import test from 'node:test';
import assert from 'node:assert/strict';

import { ContextEngine } from '../engine/context-engine.js';

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
