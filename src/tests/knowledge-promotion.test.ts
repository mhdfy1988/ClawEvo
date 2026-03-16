import assert from 'node:assert/strict';
import test from 'node:test';

import { assessPromotedKnowledgeGovernance } from '@openclaw-compact-context/runtime-core/governance';
import { buildSkillCandidateLifecycle } from '@openclaw-compact-context/runtime-core/governance';
import type { GraphNode } from '../types/core.js';

test('assessPromotedKnowledgeGovernance promotes stable successful procedures and allows global promotion', () => {
  const node = createPromotedNode({
    id: 'successful-procedure-1',
    type: 'SuccessfulProcedure',
    scope: 'workspace',
    confidence: 0.87,
    payload: {
      observationCount: 3,
      downgradeCount: 0,
      promotionState: 'reinforced'
    }
  });

  const governance = assessPromotedKnowledgeGovernance(node);

  assert.ok(governance);
  assert.equal(governance.knowledgeClass, 'stable_skill');
  assert.equal(governance.promotionDecision, 'promote');
  assert.equal(governance.contaminationRisk, 'low');
  assert.equal(governance.workspaceEligible, true);
  assert.equal(governance.globalEligible, true);
});

test('assessPromotedKnowledgeGovernance keeps weak failure patterns as high-risk negative experience', () => {
  const node = createPromotedNode({
    id: 'failure-pattern-1',
    type: 'FailurePattern',
    scope: 'workspace',
    confidence: 0.74,
    payload: {
      observationCount: 1,
      downgradeCount: 0,
      promotionState: 'candidate'
    }
  });

  const governance = assessPromotedKnowledgeGovernance(node);

  assert.ok(governance);
  assert.equal(governance.knowledgeClass, 'failure_experience');
  assert.equal(governance.promotionDecision, 'hold');
  assert.equal(governance.contaminationRisk, 'high');
  assert.equal(governance.workspaceEligible, false);
  assert.equal(governance.globalEligible, false);
});

test('buildSkillCandidateLifecycle keeps noisy candidates below durable skill promotion', () => {
  const lifecycle = buildSkillCandidateLifecycle({
    minEvidenceCount: 2,
    evidenceCount: 3,
    stability: 0.78,
    clarity: 0.82,
    success: 0.42,
    failureSignalCount: 2,
    workflowSteps: ['workflow:register artifact sidecar'],
    requiredRuleIds: ['rule-1'],
    requiredConstraintIds: ['constraint-1']
  });

  assert.equal(lifecycle.governance.knowledgeClass, 'local_procedure');
  assert.equal(lifecycle.governance.contaminationRisk, 'high');
  assert.equal(lifecycle.promotion.ready, false);
  assert.equal(lifecycle.promotion.target, 'CandidateOnly');
  assert.equal(lifecycle.decay.state, 'stale');
});

function createPromotedNode(
  overrides: Partial<GraphNode> & {
    id: string;
    type: GraphNode['type'];
    scope: GraphNode['scope'];
    confidence: number;
    payload: GraphNode['payload'];
  }
): GraphNode {
  const { id, type, scope, confidence, payload, ...rest } = overrides;
  return {
    id,
    type,
    scope,
    kind: 'inference',
    label: `${type}:${id}`,
    payload,
    strength: 'soft',
    confidence,
    version: 'v1',
    freshness: 'active',
    validFrom: '2026-03-15T10:00:00.000Z',
    updatedAt: '2026-03-15T10:00:00.000Z',
    ...rest
  };
}

