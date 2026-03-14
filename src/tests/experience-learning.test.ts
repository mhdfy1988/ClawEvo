import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveExperienceLearning } from '../core/experience-learning.js';
import type { ContextSelection, RuntimeContextBundle } from '../types/core.js';

test('deriveExperienceLearning builds partial attempts with failure signals and a candidate procedure', () => {
  const bundle = createBundle({
    currentProcess: selection('Step', 'workflow:Step 2 preserve provenance before transcript persistence', 'step-1'),
    activeRules: [selection('Rule', 'rule:Always preserve provenance when selecting context.', 'rule-1')],
    openRisks: [selection('Risk', 'tool_output:build failed because the sqlite migration timed out.', 'risk-1')],
    recentStateChanges: [selection('State', 'tool_output:rollback requested after timeout.', 'state-1')]
  });

  const result = deriveExperienceLearning(bundle);

  assert.equal(result.attempt.status, 'partial');
  assert.equal(result.episode.status, 'open');
  assert.equal(result.failureSignals.length, 2);
  assert.ok(result.failureSignals.some((signal) => signal.sourceNodeIds.includes('risk-1')));
  assert.equal(result.attempt.criticalStepNodeIds[0], 'step-1');
  assert.equal(result.procedureCandidate?.status, 'candidate');
  assert.deepEqual(result.procedureCandidate?.stepNodeIds, ['step-1']);
  assert.ok(result.procedureCandidate?.prerequisiteNodeIds.includes('rule-1'));
  assert.ok(result.episode.keyFailureSignalIds.length >= 1);
});

test('deriveExperienceLearning resolves successful attempts into validated procedures and resolved episodes', () => {
  const bundle = createBundle({
    currentProcess: selection('Step', 'workflow:Step 3 register the artifact sidecar.', 'step-success'),
    activeRules: [selection('Rule', 'rule:Always register the artifact sidecar before persistence.', 'rule-success')],
    activeConstraints: [selection('Constraint', 'rule:Never drop provenance when compacting context.', 'constraint-success')],
    recentStateChanges: [selection('Outcome', 'document:artifact sidecar registered successfully.', 'outcome-success')]
  });

  const result = deriveExperienceLearning(bundle);

  assert.equal(result.attempt.status, 'success');
  assert.equal(result.episode.status, 'resolved');
  assert.equal(result.failureSignals.length, 0);
  assert.equal(result.procedureCandidate?.status, 'validated');
  assert.ok(result.procedureCandidate?.successSignals.includes('bundle:no_open_risks'));
  assert.equal(result.episode.winningAttemptId, result.attempt.id);
  assert.deepEqual(result.episode.successPathStepNodeIds, ['step-success']);
});

function createBundle(overrides: Partial<RuntimeContextBundle>): RuntimeContextBundle {
  return {
    id: 'bundle-experience-test',
    sessionId: 'session-experience-test',
    query: 'how do we preserve provenance during a blocked migration',
    activeRules: [],
    activeConstraints: [],
    recentDecisions: [],
    recentStateChanges: [],
    relevantEvidence: [],
    candidateSkills: [],
    openRisks: [],
    tokenBudget: {
      total: 512,
      used: 128,
      reserved: 64
    },
    createdAt: '2026-03-14T10:00:00.000Z',
    ...overrides
  };
}

function selection(type: ContextSelection['type'], label: string, nodeId: string): ContextSelection {
  return {
    nodeId,
    type,
    label,
    scope: 'session',
    kind: type === 'Rule' || type === 'Constraint' ? 'norm' : type === 'Step' ? 'process' : 'state',
    strength: type === 'Rule' || type === 'Constraint' ? 'hard' : 'soft',
    reason: 'test fixture',
    estimatedTokens: 24
  };
}
