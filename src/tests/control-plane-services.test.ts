import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTROL_PLANE_READONLY_SOURCES,
  CONTROL_PLANE_SERVICE_BOUNDARY,
  DEBUG_API_BOUNDARY,
  type GovernanceAuthority,
  RUNTIME_API_BOUNDARY
} from '../control-plane/contracts.js';
import { ControlPlaneFacade } from '../control-plane/control-plane-facade.js';
import { GovernanceService } from '../control-plane/governance-service.js';
import { assertGovernanceAuthority, GOVERNANCE_SCOPE_BOUNDARIES } from '../control-plane/governance-policy.js';
import { ImportService } from '../control-plane/import-service.js';
import { ObservabilityService } from '../control-plane/observability-service.js';
import { buildConceptAliasCorrection } from '../core/manual-corrections.js';
import type { EvaluationReport } from '../evaluation/evaluation-harness.js';

test('control-plane contracts classify runtime, debug, and control-plane boundaries', () => {
  assert.equal(RUNTIME_API_BOUNDARY.some((item) => item.name === 'assemble' && item.surface === 'runtime_api'), true);
  assert.equal(
    DEBUG_API_BOUNDARY.some((item) => item.name === 'compact-context.inspect_runtime_window' && item.surface === 'debug_api'),
    true
  );
  assert.equal(
    DEBUG_API_BOUNDARY.some(
      (item) => item.name === 'compact-context.inspect_observability_dashboard' && item.surface === 'debug_api'
    ),
    true
  );
  assert.equal(
    DEBUG_API_BOUNDARY.some((item) => item.name === 'compact-context.inspect_observability_history'),
    true
  );
  assert.equal(
    DEBUG_API_BOUNDARY.some((item) => item.name === 'compact-context.retry_import_job'),
    true
  );
  assert.equal(
    CONTROL_PLANE_SERVICE_BOUNDARY.some(
      (item) => item.name === 'governance-service' && item.surface === 'control_plane_service'
    ),
    true
  );
  assert.equal(
    CONTROL_PLANE_SERVICE_BOUNDARY.some(
      (item) => item.name === 'control-plane-facade' && item.surface === 'control_plane_service'
    ),
    true
  );
  assert.deepEqual(CONTROL_PLANE_READONLY_SOURCES, [
    'live_runtime_snapshot',
    'persisted_runtime_snapshot',
    'transcript_session_file'
  ]);
  assert.equal(
    [...RUNTIME_API_BOUNDARY, ...DEBUG_API_BOUNDARY, ...CONTROL_PLANE_SERVICE_BOUNDARY].every(
      (item) => item.directStoreAccess === false
    ),
    true
  );
  assert.equal(GOVERNANCE_SCOPE_BOUNDARIES.some((item) => item.targetScope === 'global'), true);
});

test('governance service enforces scope-aware proposal, approval, apply, and rollback lifecycle', async () => {
  const service = new GovernanceService();
  const appliedCorrections: Array<unknown> = [];
  const correction = buildConceptAliasCorrection({
    id: 'correction-governance-1',
    targetId: 'knowledge_graph',
    action: 'apply',
    author: 'tester',
    reason: 'promote a controlled alias',
    createdAt: '2026-03-15T14:00:00.000Z',
    alias: 'knowledge weave'
  });

  const proposal = await service.submitProposal({
    targetScope: 'workspace',
    submittedBy: 'alice',
    authority: 'workspace_reviewer',
    reason: 'introduce a reviewed alias',
    corrections: [correction],
    submittedAt: '2026-03-15T14:01:00.000Z'
  });
  const approved = await service.reviewProposal({
    proposalId: proposal.id,
    reviewedBy: 'bob',
    authority: 'workspace_reviewer',
    decision: 'approve',
    reviewedAt: '2026-03-15T14:02:00.000Z',
    note: 'looks safe'
  });
  const applyResult = await service.applyProposal({
    proposalId: proposal.id,
    appliedBy: 'carol',
    authority: 'workspace_reviewer',
    appliedAt: '2026-03-15T14:03:00.000Z',
    engine: {
      applyManualCorrections: async (corrections) => {
        appliedCorrections.push(...corrections);
      }
    }
  });
  const rollbackResult = await service.rollbackProposal({
    proposalId: proposal.id,
    rolledBackBy: 'dave',
    authority: 'workspace_reviewer',
    rolledBackAt: '2026-03-15T14:04:00.000Z',
    note: 'back out the alias until docs catch up',
    engine: {
      applyManualCorrections: async (corrections) => {
        appliedCorrections.push(...corrections);
      }
    }
  });

  assert.equal(approved.status, 'approved');
  assert.equal(applyResult.appliedCount, 1);
  assert.equal(rollbackResult.rolledBackCount, 1);
  assert.equal(appliedCorrections.length, 2);
  assert.equal((await service.listProposals())[0]?.status, 'approved');
  assert.equal((await service.listProposals())[0]?.rollback?.rolledBackBy, 'dave');
  assert.deepEqual(
    (await service.listAuditRecords()).map((record) => record.event),
    ['rolled_back', 'applied', 'approved', 'submitted']
  );
});

test('governance service rejects authority escalation across scope boundaries', async () => {
  const service = new GovernanceService();
  const correction = buildConceptAliasCorrection({
    id: 'correction-governance-2',
    targetId: 'knowledge_graph',
    action: 'apply',
    author: 'tester',
    reason: 'attempt a global alias change',
    createdAt: '2026-03-15T15:00:00.000Z',
    alias: 'graph fabric'
  });

  await assert.rejects(
    () =>
      service.submitProposal({
        targetScope: 'global',
        submittedBy: 'alice',
        authority: 'workspace_reviewer',
        reason: 'workspace reviewer should not touch global knowledge',
        corrections: [correction],
        submittedAt: '2026-03-15T15:01:00.000Z'
      }),
    /cannot submit governance proposals for global scope/
  );
});

test('observability service builds stage reports and runtime window summaries from readonly sources', () => {
  const service = new ObservabilityService();
  const report = service.buildStageReport({
    stage: 'stage-6-contracts',
    reports: [createEvaluationReportFixture()],
    history: []
  });
  const runtimeWindowSummary = service.summarizeRuntimeWindows([
    {
      version: 'runtime_context_window.v1',
      source: 'live_runtime',
      sessionId: 'session-runtime-1',
      query: 'inspect context',
      capturedAt: '2026-03-15T14:10:00.000Z',
      totalBudget: 1000,
      compression: {
        recentRawMessageCount: 3,
        compressedCount: 2,
        preservedConversationCount: 3
      },
      latestPointers: {
        latestUserMessageId: 'user-1',
        latestAssistantMessageId: 'assistant-1',
        latestToolResultIds: ['tool-1'],
        latestUserInFinalWindow: true,
        latestAssistantInFinalWindow: false,
        latestToolResultIdsInFinalWindow: ['tool-1']
      },
      toolCallResultPairs: [],
      inbound: {
        messages: [],
        summary: [],
        counts: { total: 3, system: 0, conversation: 3 }
      },
      preferred: {
        messages: [],
        summary: [],
        counts: { total: 2, system: 0, conversation: 2 }
      },
      final: {
        messages: [],
        summary: [],
        counts: { total: 1, system: 0, conversation: 1 }
      }
    },
    {
      version: 'runtime_context_window.v1',
      source: 'persisted_snapshot',
      sessionId: 'session-runtime-2',
      query: 'inspect persisted context',
      capturedAt: '2026-03-15T14:11:00.000Z',
      totalBudget: 1000,
      compression: {
        recentRawMessageCount: 3,
        compressedCount: 1,
        preservedConversationCount: 2
      },
      latestPointers: {
        latestToolResultIds: [],
        latestUserInFinalWindow: false,
        latestAssistantInFinalWindow: false,
        latestToolResultIdsInFinalWindow: []
      },
      toolCallResultPairs: [],
      inbound: {
        messages: [],
        summary: [],
        counts: { total: 2, system: 0, conversation: 2 }
      },
      preferred: {
        messages: [],
        summary: [],
        counts: { total: 2, system: 0, conversation: 2 }
      },
      final: {
        messages: [],
        summary: [],
        counts: { total: 2, system: 0, conversation: 2 }
      }
    }
  ]);
  const bundle = service.buildContractBundle({
    stage: 'stage-6-contracts',
    reports: [createEvaluationReportFixture()],
    history: [],
    windows: [
      {
        version: 'runtime_context_window.v1',
        source: 'live_runtime',
        sessionId: 'session-runtime-1',
        query: 'inspect context',
        totalBudget: 1000,
        compression: {
          recentRawMessageCount: 3,
          compressedCount: 2,
          preservedConversationCount: 3
        },
        latestPointers: {
          latestToolResultIds: [],
          latestUserInFinalWindow: false,
          latestAssistantInFinalWindow: false,
          latestToolResultIdsInFinalWindow: []
        },
        toolCallResultPairs: [],
        inbound: { messages: [], summary: [], counts: { total: 1, system: 0, conversation: 1 } },
        preferred: { messages: [], summary: [], counts: { total: 1, system: 0, conversation: 1 } },
        final: { messages: [], summary: [], counts: { total: 1, system: 0, conversation: 1 } }
      }
    ]
  });

  assert.equal(report.stage, 'stage-6-contracts');
  assert.equal(runtimeWindowSummary.sampleCount, 2);
  assert.equal(runtimeWindowSummary.liveCount, 1);
  assert.equal(runtimeWindowSummary.persistedCount, 1);
  assert.equal(bundle.readonlySources.length, 3);
  assert.equal(bundle.latestStageReport.stage, 'stage-6-contracts');
});

test('observability service builds dashboard cards and alerts from stage metrics and runtime snapshots', () => {
  const service = new ObservabilityService();
  const dashboard = service.buildDashboard({
    stage: 'stage-6-dashboard',
    reports: [createEvaluationReportFixture()],
    history: [
      {
        label: 'stage-6-dashboard-prev',
        snapshot: {
          fixtureCount: 1,
          passCount: 1,
          passRate: 1,
          averageRelationPrecision: 0.9,
          averageRelationRecall: 0.9,
          averageRecallNoiseRate: 0.1,
          averageBundleCoverage: 1,
          averageExplainCoverage: 1,
          averageConceptCoverage: 1,
          averageMemoryUsefulness: 0.75,
          averageMemoryIntrusion: 0.05,
          averagePromotionQuality: 0.85,
          averageKnowledgePollutionRate: 0.05,
          averageHighScopeReuseBenefit: 0.3,
          averageHighScopeReuseIntrusion: 0.1,
          averageMultiSourceCoverage: 0.4,
          averageCandidatePathCount: 2,
          averageAdmittedPathCount: 1,
          averagePathPruneRate: 0.2,
          totalPathCount: 2,
          totalPrunedPathCount: 1
        }
      }
    ],
    windows: [
      {
        version: 'runtime_context_window.v1',
        source: 'live_runtime',
        sessionId: 'session-dashboard-1',
        query: 'inspect live dashboard state',
        capturedAt: '2026-03-18T08:00:00.000Z',
        totalBudget: 1200,
        compression: {
          recentRawMessageCount: 4,
          compressedCount: 3,
          preservedConversationCount: 4
        },
        latestPointers: {
          latestToolResultIds: [],
          latestUserInFinalWindow: true,
          latestAssistantInFinalWindow: true,
          latestToolResultIdsInFinalWindow: []
        },
        toolCallResultPairs: [],
        inbound: { messages: [], summary: [], counts: { total: 5, system: 1, conversation: 4 } },
        preferred: { messages: [], summary: [], counts: { total: 4, system: 1, conversation: 3 } },
        final: { messages: [], summary: [], counts: { total: 3, system: 1, conversation: 2 } }
      },
      {
        version: 'runtime_context_window.v1',
        source: 'transcript_fallback',
        sessionId: 'session-dashboard-2',
        query: 'inspect fallback dashboard state',
        capturedAt: '2026-03-18T08:05:00.000Z',
        totalBudget: 1200,
        compression: {
          recentRawMessageCount: 4,
          compressedCount: 1,
          preservedConversationCount: 2
        },
        latestPointers: {
          latestToolResultIds: [],
          latestUserInFinalWindow: false,
          latestAssistantInFinalWindow: false,
          latestToolResultIdsInFinalWindow: []
        },
        toolCallResultPairs: [],
        inbound: { messages: [], summary: [], counts: { total: 3, system: 0, conversation: 3 } },
        preferred: { messages: [], summary: [], counts: { total: 2, system: 0, conversation: 2 } },
        final: { messages: [], summary: [], counts: { total: 2, system: 0, conversation: 2 } }
      }
    ],
    thresholds: {
      maxTranscriptFallbackRatio: 0.2,
      minMultiSourceCoverage: 0.9
    }
  });

  assert.equal(dashboard.metricCards.length, 10);
  assert.equal(dashboard.runtimeWindowSummary.sampleCount, 2);
  assert.equal(
    dashboard.metricCards.some(
      (card) => card.key === 'runtime_live_window_ratio' && card.status === 'healthy' && card.value === 0.5
    ),
    true
  );
  assert.equal(
    dashboard.metricCards.some(
      (card) =>
        card.key === 'multi_source_coverage' &&
        card.status === 'warning' &&
        card.previousValue === 0.4 &&
        typeof card.trendDelta === 'number' &&
        Math.abs(card.trendDelta - 0.1) < 1e-9
    ),
    true
  );
  assert.equal(
    dashboard.alerts.some(
      (alert) => alert.key === 'runtime_transcript_fallback_ratio' && alert.severity === 'critical'
    ),
    true
  );
  assert.equal(
    dashboard.alerts.some((alert) => alert.key === 'multi_source_coverage' && alert.severity === 'warning'),
    true
  );
});

test('observability service records dashboard snapshots and builds history series', () => {
  const service = new ObservabilityService();
  const dashboard = service.buildDashboard({
    stage: 'stage-6-history',
    reports: [createEvaluationReportFixture()],
    history: [],
    windows: [
      {
        version: 'runtime_context_window.v1',
        source: 'live_runtime',
        sessionId: 'session-history-1',
        query: 'inspect history state',
        capturedAt: '2026-03-18T09:30:00.000Z',
        totalBudget: 1000,
        compression: {
          recentRawMessageCount: 4,
          compressedCount: 2,
          preservedConversationCount: 3
        },
        latestPointers: {
          latestToolResultIds: [],
          latestUserInFinalWindow: true,
          latestAssistantInFinalWindow: false,
          latestToolResultIdsInFinalWindow: []
        },
        toolCallResultPairs: [],
        inbound: { messages: [], summary: [], counts: { total: 3, system: 0, conversation: 3 } },
        preferred: { messages: [], summary: [], counts: { total: 2, system: 0, conversation: 2 } },
        final: { messages: [], summary: [], counts: { total: 2, system: 0, conversation: 2 } }
      }
    ]
  });

  const snapshot1 = service.recordDashboardSnapshot({
    stage: 'stage-6-history',
    sessionIds: ['session-history-1'],
    windowCount: 1,
    dashboard,
    capturedAt: '2026-03-18T09:31:00.000Z'
  });
  const snapshot2 = service.recordDashboardSnapshot({
    stage: 'stage-6-history',
    sessionIds: ['session-history-2'],
    windowCount: 1,
    dashboard,
    capturedAt: '2026-03-18T09:32:00.000Z'
  });
  const history = service.buildDashboardHistory({
    snapshots: service.listDashboardSnapshots({
      stage: 'stage-6-history',
      limit: 10
    })
  });

  assert.equal(snapshot1.stage, 'stage-6-history');
  assert.equal(snapshot2.stage, 'stage-6-history');
  assert.equal(history.pointCount, 2);
  assert.equal(history.latestCapturedAt, '2026-03-18T09:32:00.000Z');
  assert.equal(history.metricSeries.runtime_live_window_ratio.length, 2);
  assert.equal(history.points[0]?.stage, 'stage-6-history');
});

test('import service creates jobs and routes ingestion through the runtime engine', async () => {
  const service = new ImportService();
  const job = await service.createJob({
    sessionId: 'session-import-1',
    workspaceId: 'workspace-import-1',
    sourceKind: 'structured_input',
    source: {
      format: 'json'
    },
    versionInfo: {
      sourceVersion: 'v1'
    },
    incremental: {
      enabled: true,
      previousJobId: 'import_prev'
    },
    requestedBy: 'tester',
    createdAt: '2026-03-15T14:20:00.000Z',
    input: {
      sessionId: 'session-import-1',
      workspaceId: 'workspace-import-1',
      records: [
        {
          id: 'record-import-1',
          scope: 'workspace',
          sourceType: 'document',
          role: 'system',
          content: 'Import the current repository structure as a readonly source.'
        }
      ]
    }
  });
  const result = await service.runJob({
    jobId: job.id,
    normalize: async (ingestInput) => ({
      ...ingestInput,
      records: ingestInput.records.map((record) => ({
        ...record,
        metadata: {
          ...(record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
            ? record.metadata
            : {}),
          normalizedBy: 'test-normalizer'
        }
      }))
    }),
    completedAt: '2026-03-15T14:21:00.000Z',
    engine: {
      ingest: async (input) => ({
        candidateNodes: [],
        candidateEdges: [],
        persistedNodeIds: input.records.map((record) => `${record.id}-node`),
        persistedEdgeIds: ['edge-import-1'],
        warnings: []
      })
    }
  });

  assert.equal(job.status, 'pending');
  assert.equal(job.flow.parser, 'structured_payload_parser');
  assert.equal(job.incremental.enabled, true);
  assert.equal(job.versionInfo.sourceVersion, 'v1');
  assert.equal(result.status, 'completed');
  assert.equal(result.ingestedRecordCount, 1);
  assert.equal(result.persistedNodeCount, 1);
  assert.equal(result.flow.materializer, 'runtime_ingest');
  assert.equal(result.stageTrace.length, 3);
  assert.equal(result.stageTrace.every((item) => item.status === 'completed'), true);
  assert.equal((await service.getJob(job.id))?.job.status, 'completed');
  assert.equal(
    (
      await service.getJob(job.id)
    )?.normalizedInput?.records[0] &&
      typeof (await service.getJob(job.id))?.normalizedInput?.records[0]?.metadata === 'object',
    true
  );
  assert.equal((await service.listJobs())[0]?.id, job.id);
});

test('import service supports retry, rerun, schedules, and attempt history', async () => {
  const service = new ImportService();
  const job = await service.createJob({
    sessionId: 'session-import-history',
    sourceKind: 'structured_input',
    createdAt: '2026-03-18T10:00:00.000Z',
    input: {
      sessionId: 'session-import-history',
      records: [
        {
          id: 'record-import-history-1',
          scope: 'session',
          sourceType: 'document',
          role: 'system',
          content: 'retry and rerun this import job'
        }
      ]
    }
  });
  let ingestCallCount = 0;

  await assert.rejects(
    () =>
      service.runJob({
        jobId: job.id,
        completedAt: '2026-03-18T10:01:00.000Z',
        engine: {
          ingest: async () => {
            ingestCallCount += 1;
            throw new Error('transient ingest failure');
          }
        }
      }),
    /transient ingest failure/
  );

  const retryResult = await service.retryJob({
    jobId: job.id,
    completedAt: '2026-03-18T10:02:00.000Z',
    engine: {
      ingest: async (input) => {
        ingestCallCount += 1;
        return {
          candidateNodes: [],
          candidateEdges: [],
          persistedNodeIds: input.records.map((record) => `${record.id}-node`),
          persistedEdgeIds: [],
          warnings: []
        };
      }
    }
  });
  const schedule = await service.scheduleJob({
    jobId: job.id,
    dueAt: '2026-03-18T10:03:00.000Z',
    createdAt: '2026-03-18T10:02:30.000Z',
    createdBy: 'tester'
  });
  const dueResults = await service.runDueJobs({
    now: '2026-03-18T10:03:00.000Z',
    engine: {
      ingest: async (input) => {
        ingestCallCount += 1;
        return {
          candidateNodes: [],
          candidateEdges: [],
          persistedNodeIds: input.records.map((record) => `${record.id}-node`),
          persistedEdgeIds: ['edge-history-1'],
          warnings: []
        };
      }
    }
  });
  const history = await service.getJobHistory(job.id, 10);
  const record = await service.getJob(job.id);

  assert.equal(retryResult.attemptAction, 'retry');
  assert.equal(schedule.status, 'pending');
  assert.equal(dueResults.processedCount, 1);
  assert.equal(dueResults.completedCount, 1);
  assert.equal(history.length, 3);
  assert.deepEqual(
    history.map((attempt) => attempt.action),
    ['rerun', 'retry', 'run']
  );
  assert.equal(record?.job.attemptCount, 3);
  assert.equal(record?.job.status, 'completed');
  assert.equal(ingestCallCount, 3);
});

test('control-plane facade delegates governance, observability, and import services', async () => {
  const facade = new ControlPlaneFacade(new GovernanceService(), new ObservabilityService(), new ImportService());

  const dashboard = facade.buildDashboard({
    stage: 'stage-6-facade',
    reports: [createEvaluationReportFixture()],
    history: [],
    windows: []
  });

  const job = await facade.createImportJob({
    sessionId: 'session-facade',
    sourceKind: 'structured_input',
    input: {
      sessionId: 'session-facade',
      records: [
        {
          id: 'record-facade-1',
          scope: 'session',
          sourceType: 'document',
          role: 'system',
          content: 'facade import record'
        }
      ]
    }
  });

  assert.equal(facade.readonlySources.includes('live_runtime_snapshot'), true);
  assert.equal(dashboard.metricCards.length > 0, true);
  assert.equal(job.id.startsWith('import_'), true);
});

test('import service captures failure trace when a stage fails', async () => {
  const service = new ImportService();
  const job = await service.createJob({
    sessionId: 'session-import-failure',
    sourceKind: 'document',
    input: {
      sessionId: 'session-import-failure',
      records: [
        {
          id: 'record-import-failure-1',
          scope: 'session',
          sourceType: 'document',
          role: 'system',
          content: 'document import should fail at normalize'
        }
      ]
    }
  });

  await assert.rejects(
    () =>
      service.runJob({
        jobId: job.id,
        normalize: async () => {
          throw new Error('normalize exploded');
        },
        engine: {
          ingest: async () => ({
            candidateNodes: [],
            candidateEdges: [],
            persistedNodeIds: [],
            persistedEdgeIds: [],
            warnings: []
          })
        }
      }),
    /normalize exploded/
  );

  const record = await service.getJob(job.id);
  assert.equal(record?.job.status, 'failed');
  assert.equal(record?.job.failureTrace?.stage, 'normalize');
  assert.equal(record?.job.failureTrace?.retriable, true);
});

function createEvaluationReportFixture(): EvaluationReport {
  return {
    fixtureName: 'runtime-window-contract',
    pass: true,
    failures: [],
    bundle: {
      id: 'bundle-stage-6-1',
      checkpointId: 'checkpoint-stage-6-1',
      deltaId: 'delta-stage-6-1',
      skillCandidateIds: []
    },
    metrics: {
      relationRecall: {
        selectedNodeIds: ['node-1'],
        matchedExpectedNodeIds: ['node-1'],
        noiseNodeIds: [],
        precision: 1,
        recall: 1
      },
      memoryQuality: {
        usefulSurfacedNodeIds: ['node-1'],
        disallowedSurfacedNodeIds: [],
        usefulness: 0.8,
        intrusion: 0.1
      },
      bundleQuality: {
        selectedNodeIds: ['node-1'],
        requiredSelectedNodeIds: ['node-1'],
        missingRequiredNodeIds: [],
        forbiddenSelectedNodeIds: [],
        requiredCoverage: 0.9
      },
      explainCompleteness: {
        completeNodeIds: ['node-1'],
        incompleteNodeIds: [],
        coverage: 0.95
      },
      retrievalCost: {
        explainSelectionEdgeLookupsTotal: 0,
        explainSelectionNodeLookupsTotal: 0,
        explainAdjacencyEdgeLookupsTotal: 0,
        explainAdjacencyNodeLookupsTotal: 0,
        persistenceReadCountTotal: 0
      },
      contextProcessing: {
        semanticMaterializedNodeIds: ['node-1'],
        matchedSemanticNodeIds: ['node-1'],
        missingSemanticNodeIds: [],
        semanticNodeCoverage: 1,
        normalizedConceptIds: ['knowledge_graph'],
        matchedConceptIds: ['knowledge_graph'],
        missingConceptIds: [],
        conceptCoverage: 1,
        clauseSplitCompleteNodeIds: ['node-1'],
        clauseSplitMissingNodeIds: [],
        clauseSplitCoverage: 1,
        anchorCompleteNodeIds: ['node-1'],
        anchorMissingNodeIds: [],
        anchorCompleteness: 1,
        surfacedExperienceNodeTypes: ['Attempt'],
        missingExperienceNodeTypes: [],
        experienceLearningCoverage: 1
      },
      promotionQuality: {
        surfacedKnowledgeClasses: ['stable_skill'],
        matchedKnowledgeClasses: ['stable_skill'],
        missingKnowledgeClasses: [],
        knowledgeClassCoverage: 0.9,
        pollutedNodeIds: [],
        pollutionRate: 0.1
      },
      scopeReuse: {
        surfacedWorkspaceNodeIds: ['node-1'],
        surfacedGlobalNodeIds: [],
        learningBoostNodeIds: [],
        matchedWorkspaceNodeIds: ['node-1'],
        matchedGlobalNodeIds: [],
        missingWorkspaceNodeIds: [],
        missingGlobalNodeIds: [],
        disallowedSurfacedNodeIds: [],
        benefit: 0.8,
        intrusion: 0.1
      },
      multiSource: {
        surfacedNodeTypes: ['Document'],
        matchedNodeTypes: ['Document'],
        missingNodeTypes: [],
        coverage: 0.5
      }
    }
  };
}

test('governance authority helper mirrors the scope boundary rules', () => {
  const matrix: Array<[GovernanceAuthority, 'session' | 'workspace' | 'global', boolean]> = [
    ['session_operator', 'session', true],
    ['session_operator', 'workspace', false],
    ['workspace_reviewer', 'workspace', true],
    ['workspace_reviewer', 'global', false],
    ['global_reviewer', 'global', true]
  ];

  for (const [authority, scope, allowed] of matrix) {
    if (allowed) {
      assert.doesNotThrow(() => assertGovernanceAuthority(authority, scope, 'apply'));
      continue;
    }

    assert.throws(() => assertGovernanceAuthority(authority, scope, 'apply'));
  }
});
