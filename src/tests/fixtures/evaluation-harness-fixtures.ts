import type { GraphNode } from '../../types/core.js';
import type { EvaluationFixture } from '../../evaluation/evaluation-harness.js';
import { createDebugSmokeFixture } from './debug-smoke-fixtures.js';

export async function createRepresentativeEvaluationFixture(): Promise<EvaluationFixture> {
  const smokeFixture = await createDebugSmokeFixture('session-stage4-evaluation');
  const [ruleNode] = await smokeFixture.engine.queryNodes({
    sessionId: smokeFixture.sessionId,
    types: ['Rule']
  });
  const evidenceNodes = await smokeFixture.engine.queryNodes({
    sessionId: smokeFixture.sessionId,
    types: ['Evidence']
  });

  if (!ruleNode) {
    throw new Error('expected representative evaluation fixture to include one Rule node');
  }

  const documentEvidenceNodeIds = evidenceNodes
    .filter((node) => /current build log points to a migration timeout/i.test(node.label))
    .map((node) => node.id);

  if (documentEvidenceNodeIds.length === 0) {
    throw new Error('expected representative evaluation fixture to include explicit document evidence probes');
  }

  const relationEvidenceNodeIds = [
    `${smokeFixture.sessionId}:risk`,
    `${smokeFixture.sessionId}:rule`,
    `${smokeFixture.sessionId}:step`
  ];
  const memoryUsefulNodeIds = [
    smokeFixture.selectedRiskNodeId,
    smokeFixture.skippedStepNodeId,
    ruleNode.id,
    ...relationEvidenceNodeIds
  ];
  const requiredBundleNodeIds = [
    smokeFixture.selectedRiskNodeId,
    smokeFixture.skippedStepNodeId,
    ruleNode.id,
    ...relationEvidenceNodeIds
  ];

  return {
    name: 'stage-4-representative-evaluation',
    engine: smokeFixture.engine,
    compileRequest: {
      sessionId: smokeFixture.sessionId,
      query: smokeFixture.defaultQuery,
      tokenBudget: smokeFixture.compileTokenBudget
    },
    requiredBundleNodeIds,
    forbiddenBundleNodeIds: documentEvidenceNodeIds,
    expectedRelationEvidenceNodeIds: relationEvidenceNodeIds,
    allowedRelationEvidenceNodeIds: relationEvidenceNodeIds,
    memoryUsefulNodeIds,
    memoryDisallowedNodeIds: documentEvidenceNodeIds,
    explainProbeNodeIds: dedupeNodeIds(memoryUsefulNodeIds.concat(documentEvidenceNodeIds)),
    thresholds: {
      relationPrecisionMin: 1,
      relationRecallMin: 1,
      relationNoiseMax: 0,
      memoryUsefulnessMin: 1,
      memoryIntrusionMax: 0,
      bundleRequiredCoverageMin: 1,
      bundleForbiddenIntrusionMax: 0,
      explainCompletenessMin: 1
    }
  };
}

function dedupeNodeIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function summarizeRepresentativeFixtureNodes(nodes: GraphNode[]): string[] {
  return nodes.map((node) => `${node.type}:${node.id}`);
}
