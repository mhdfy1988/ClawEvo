import type { GraphNode } from '@openclaw-compact-context/contracts';
import type { EvaluationFixture } from '../../internal/evaluation/evaluation-harness.js';
import { ContextEngine } from '@openclaw-compact-context/runtime-core/engine/context-engine';
import { createDebugSmokeFixture } from './debug-smoke-fixtures.js';

export async function createRepresentativeEvaluationFixture(): Promise<EvaluationFixture> {
  const smokeFixture = await createDebugSmokeFixture('session-stage4-evaluation');
  const [goalNode] = await smokeFixture.engine.queryNodes({
    sessionId: smokeFixture.sessionId,
    types: ['Goal']
  });
  const [ruleNode] = await smokeFixture.engine.queryNodes({
    sessionId: smokeFixture.sessionId,
    types: ['Rule']
  });
  const evidenceNodes = await smokeFixture.engine.queryNodes({
    sessionId: smokeFixture.sessionId,
    types: ['Evidence']
  });
  const conceptNodes = await smokeFixture.engine.queryNodes({
    sessionId: smokeFixture.sessionId,
    types: ['Concept']
  });

  if (!goalNode || !ruleNode) {
    throw new Error('expected representative evaluation fixture to include goal and rule nodes');
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
    explainProbeNodeIds: dedupeNodeIds([goalNode.id].concat(memoryUsefulNodeIds, documentEvidenceNodeIds)),
    contextProcessing: {
      semanticNodeIds: [goalNode.id, ruleNode.id, smokeFixture.selectedRiskNodeId, smokeFixture.skippedStepNodeId],
      conceptIds: ['provenance'],
      clauseSplitProbeNodeIds: [],
      anchorProbeNodeIds: [goalNode.id, ruleNode.id, smokeFixture.selectedRiskNodeId],
      expectedExperienceNodeTypes: ['Attempt', 'Episode', 'FailureSignal', 'ProcedureCandidate']
    },
    thresholds: {
      relationPrecisionMin: 1,
      relationRecallMin: 1,
      relationNoiseMax: 0,
      memoryUsefulnessMin: 1,
      memoryIntrusionMax: 0,
      bundleRequiredCoverageMin: 1,
      bundleForbiddenIntrusionMax: 0,
      explainCompletenessMin: 1,
      semanticNodeCoverageMin: 1,
      conceptNormalizationCoverageMin: 1,
      clauseSplitCoverageMin: 0,
      evidenceAnchorCompletenessMin: 1,
      experienceLearningCoverageMin: 1
    }
  };
}

export async function createContextProcessingEvaluationFixture(): Promise<EvaluationFixture> {
  const engine = new ContextEngine();
  const sessionId = 'session-stage4-context-processing-evaluation';

  await engine.ingest({
    sessionId,
    records: [
      {
        id: `${sessionId}:goal`,
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to explain how context compression works, how the knowledge graph forms, and how provenance remains traceable.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: `${sessionId}:intent`,
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'Inspect summarize output first, then review the bundle contract, and explain why checkpoint drift happened.',
        metadata: {
          nodeType: 'Intent'
        }
      },
      {
        id: `${sessionId}:constraint`,
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Provenance must be preserved, and compressed content cannot be treated as raw content.',
        metadata: {
          nodeType: 'Constraint'
        }
      },
      {
        id: `${sessionId}:step`,
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 1: inspect bundle diagnostics, then record checkpoint changes.',
        metadata: {
          nodeType: 'Step'
        }
      },
      {
        id: `${sessionId}:risk`,
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'first attempt failed with a timeout, 绗簩娆′篃涓嶈锛屾渶缁?migration step 4 still looks blocked.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1
        }
      },
      {
        id: `${sessionId}:evidence`,
        scope: 'session',
        sourceType: 'document',
        role: 'system',
        content: 'Evidence: the current build log shows migration step 4 timing out, and the checkpoint trace still points to provenance drift.',
        metadata: {
          nodeType: 'Evidence'
        }
      }
    ]
  });

  const [goalNode] = await engine.queryNodes({
    sessionId,
    types: ['Goal']
  });
  const [constraintNode] = await engine.queryNodes({
    sessionId,
    types: ['Constraint']
  });
  const [intentNode] = await engine.queryNodes({
    sessionId,
    types: ['Intent']
  });
  const [stepNode] = await engine.queryNodes({
    sessionId,
    types: ['Step']
  });
  const [riskNode] = await engine.queryNodes({
    sessionId,
    types: ['Risk']
  });
  const [evidenceNode] = await engine.queryNodes({
    sessionId,
    types: ['Evidence']
  });

  if (!goalNode || !intentNode || !constraintNode || !stepNode || !riskNode || !evidenceNode) {
    throw new Error('expected context processing evaluation fixture to include goal, intent, constraint, step, risk, and evidence nodes');
  }

  return {
    name: 'stage-4-context-processing-evaluation',
    engine,
    compileRequest: {
      sessionId,
      query: 'explain context compression and knowledge graph provenance flow',
      tokenBudget: 720
    },
    requiredBundleNodeIds: [goalNode.id, constraintNode.id, riskNode.id, evidenceNode.id],
    expectedRelationEvidenceNodeIds: [],
    allowedRelationEvidenceNodeIds: [],
    memoryUsefulNodeIds: [goalNode.id, constraintNode.id, riskNode.id],
    explainProbeNodeIds: [goalNode.id, intentNode.id, constraintNode.id, stepNode.id, riskNode.id, evidenceNode.id],
    contextProcessing: {
      semanticNodeIds: [goalNode.id, intentNode.id, constraintNode.id, stepNode.id, riskNode.id],
      conceptIds: ['context_compression', 'knowledge_graph', 'provenance', 'checkpoint'],
      clauseSplitProbeNodeIds: [goalNode.id, intentNode.id],
      anchorProbeNodeIds: [goalNode.id, intentNode.id, constraintNode.id, evidenceNode.id],
      expectedExperienceNodeTypes: ['Attempt', 'Episode', 'FailureSignal', 'ProcedureCandidate']
    },
    thresholds: {
      relationPrecisionMin: 0,
      relationRecallMin: 0,
      relationNoiseMax: 10,
      memoryUsefulnessMin: 0.66,
      memoryIntrusionMax: 1,
      bundleRequiredCoverageMin: 0.75,
      bundleForbiddenIntrusionMax: 0,
      clauseSplitCoverageMin: 1
    }
  };
}

export async function createStageFiveEvaluationFixture(): Promise<EvaluationFixture> {
  const engine = new ContextEngine();
  const workspaceId = 'workspace-stage5-evaluation';
  const sourceSessionId = 'session-stage5-evaluation-source';
  const targetSessionId = 'session-stage5-evaluation-target';

  await engine.ingest({
    sessionId: sourceSessionId,
    workspaceId,
    records: [
      {
        id: 'goal-stage5-evaluation-source',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to preserve provenance while unblocking the migration pipeline.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'step-stage5-evaluation-source',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 2: register the artifact sidecar before transcript persistence.',
        metadata: {
          nodeType: 'Step'
        }
      },
      {
        id: 'evidence-stage5-evaluation-source',
        scope: 'session',
        sourceType: 'document',
        role: 'system',
        content: 'Evidence: artifact sidecar registration keeps provenance stable during migration recovery.',
        metadata: {
          nodeType: 'Evidence',
          documentKind: 'design',
          documentTitle: 'Artifact Sidecar Recovery Notes',
          repoName: 'openclaw_compact_context',
          repoPath: 'openclaw_compact_context',
          modulePath: 'packages/openclaw-adapter/src/openclaw',
          filePath: 'packages/openclaw-adapter/src/openclaw/tool-result-artifact-store.ts',
          apiName: 'ToolResultArtifactStore.store',
          apiSignature: 'store(input: ToolResultArtifactInput)',
          command: 'npm run check'
        }
      }
    ]
  });

  const sourceBundle = await engine.compileContext({
    sessionId: sourceSessionId,
    workspaceId,
    query: 'which step preserves provenance before transcript persistence',
    tokenBudget: 420
  });
  await engine.createCheckpoint({
    sessionId: sourceSessionId,
    bundle: sourceBundle
  });
  const workspaceReusableNodes = await engine.queryNodes({
    workspaceId,
    scopes: ['workspace'],
    types: ['SuccessfulProcedure', 'Pattern']
  });

  await engine.ingest({
    sessionId: targetSessionId,
    workspaceId,
    records: [
      {
        id: 'goal-stage5-evaluation-target',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to explain which step preserves provenance before transcript persistence.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'step-stage5-evaluation-target',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 2: register the artifact sidecar before transcript persistence.',
        metadata: {
          nodeType: 'Step',
          requiresNodeIds: ['rule-stage5-evaluation-target']
        }
      },
      {
        id: 'rule-stage5-evaluation-target',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always register the artifact sidecar before transcript persistence when preserving provenance.',
        metadata: {
          nodeType: 'Rule'
        }
      }
    ]
  });

  const [goalNode] = await engine.queryNodes({
    sessionId: targetSessionId,
    types: ['Goal']
  });
  const [stepNode] = await engine.queryNodes({
    sessionId: targetSessionId,
    types: ['Step']
  });
  const [ruleNode] = await engine.queryNodes({
    sessionId: targetSessionId,
    types: ['Rule']
  });

  if (!goalNode || !stepNode || !ruleNode) {
    throw new Error('expected stage 5 evaluation fixture to include goal, step, and rule nodes');
  }

  const workspaceUsefulNodeIds = workspaceReusableNodes.map((node) => node.id);

  return {
    name: 'stage-5-relation-and-memory-evaluation',
    engine,
    compileRequest: {
      sessionId: targetSessionId,
      workspaceId,
      query: 'which evidence explains the artifact sidecar step before transcript persistence and how do we preserve provenance',
      tokenBudget: 640
    },
    requiredBundleNodeIds: [goalNode.id, stepNode.id, 'rule-stage5-evaluation-target'],
    expectedRelationEvidenceNodeIds: ['rule-stage5-evaluation-target'],
    allowedRelationEvidenceNodeIds: ['rule-stage5-evaluation-target', 'step-stage5-evaluation-target'],
    memoryUsefulNodeIds: [stepNode.id, ruleNode.id],
    explainProbeNodeIds: [goalNode.id, stepNode.id, ruleNode.id, 'rule-stage5-evaluation-target'],
    contextProcessing: {
      semanticNodeIds: [goalNode.id, stepNode.id, ruleNode.id],
      conceptIds: ['provenance', 'artifact_sidecar'],
      clauseSplitProbeNodeIds: [goalNode.id],
      anchorProbeNodeIds: [goalNode.id, stepNode.id, ruleNode.id],
      expectedExperienceNodeTypes: ['Attempt', 'Episode', 'ProcedureCandidate', 'Pattern', 'SuccessfulProcedure']
    },
    promotion: {
      expectedKnowledgeClasses: ['local_procedure']
    },
    scopeReuse: {
      workspaceUsefulNodeIds
    },
    multiSource: {
      expectedNodeTypes: ['Document', 'Repo', 'Module', 'File', 'API', 'Command']
    },
    thresholds: {
      relationPrecisionMin: 1,
      relationRecallMin: 1,
      relationNoiseMax: 0,
      memoryUsefulnessMin: 0.5,
      memoryIntrusionMax: 0,
      bundleRequiredCoverageMin: 1,
      bundleForbiddenIntrusionMax: 0,
      explainCompletenessMin: 1,
      knowledgeClassCoverageMin: 1,
      knowledgePollutionRateMax: 0,
      highScopeReuseBenefitMin: workspaceUsefulNodeIds.length > 0 ? 0.5 : 0,
      highScopeReuseIntrusionMax: 0,
      multiSourceCoverageMin: 1,
      maxBundleRelationEdgeLookups: 3,
      maxBundleRelationNodeLookups: 3,
      maxExplainSelectionEdgeLookupsTotal: 12,
      maxExplainSelectionNodeLookupsTotal: 12,
      maxExplainAdjacencyEdgeLookupsTotal: 4,
      maxExplainAdjacencyNodeLookupsTotal: 4
    }
  };
}

function dedupeNodeIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function readMetadata(node: GraphNode): Record<string, unknown> | undefined {
  const metadata = node.payload.metadata;
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : undefined;
}

export function summarizeRepresentativeFixtureNodes(nodes: GraphNode[]): string[] {
  return nodes.map((node) => `${node.type}:${node.id}`);
}



