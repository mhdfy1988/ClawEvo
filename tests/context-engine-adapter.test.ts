import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ControlPlaneFacade,
  GovernanceService,
  ImportService,
  buildDefaultImporterRegistry,
  ObservabilityService
} from '@openclaw-compact-context/compact-context-core';
import { ContextEngine } from '@openclaw-compact-context/runtime-core/engine/context-engine';
import {
  OpenClawContextEngineAdapter,
  buildInspectRuntimeWindowPayload,
  buildGatewaySuccessPayload,
  buildInspectBundlePayload,
  formatBundle,
  normalizeGatewayPayload,
  registerGatewayDebugMethods
} from '@openclaw-compact-context/openclaw-adapter/openclaw/context-engine-adapter';
import {
  buildConceptAliasCorrection,
  buildLabelOverrideCorrection,
  buildNodeSuppressionCorrection,
  buildNoisePolicyCorrection,
  buildSemanticClassificationCorrection
} from '@openclaw-compact-context/runtime-core/governance';
import {
  buildCompressedToolResultMetadata,
  readCompressedToolResultContent,
  summarizeToolResultMessageContent
} from '@openclaw-compact-context/openclaw-adapter/openclaw/tool-result-policy';
import type { RuntimeContextBundle } from '@openclaw-compact-context/contracts';
import { createCompressedFailureToolMessage } from './fixtures/tool-result-fixtures.js';

test('formatBundle keeps prompt diagnostics concise', () => {
  const bundle = createBundleFixture();

  const text = formatBundle(bundle, undefined, {
    diagnosticsMode: 'prompt'
  });

  assert.match(text, /Selection note:/);
  assert.match(text, /omitted Step because the current budget was too small/i);
  assert.doesNotMatch(text, /\[Selection Diagnostics\]/);
  assert.doesNotMatch(text, /relevantEvidence: selected/i);
});

test('formatBundle includes category diagnostics in summary mode', () => {
  const bundle = createBundleFixture();

  const text = formatBundle(bundle, undefined, {
    diagnosticsMode: 'summary'
  });

  assert.match(text, /\[Selection Diagnostics\]/);
  assert.match(text, /Fixed context: selected 1 \| skipped 1/);
  assert.match(text, /Summary contract: goal=true intent=false currentProcess=false rules=0 constraints=0 risks=1 evidence=0 skills=0/i);
  assert.match(text, /Bundle contract: fixed=1\/3 categories=1\/7/i);
  assert.match(text, /Fixed skips: Step:/);
  assert.match(text, /openRisks: selected 1\/1, skipped 0, budget 12, refill 0/);
  assert.match(text, /relevantEvidence: selected 1\/4, skipped 3, budget 18, refill 0/);
  assert.doesNotMatch(text, /^Summary:\s/m);
});

test('formatBundle includes learning diagnostics in summary mode when present', () => {
  const bundle = createBundleFixture();
  const diagnostics = bundle.diagnostics;

  assert.ok(diagnostics);
  bundle.diagnostics = {
    ...diagnostics,
    learning: {
      attemptNodeIds: ['attempt-1'],
      episodeNodeIds: ['episode-1'],
      successSignals: ['bundle:no_open_risks'],
      criticalStepNodeIds: ['step-1'],
      criticalStepLabels: ['workflow:produce a long current process explanation'],
      failureSignals: [
        {
          nodeId: 'failure-signal-1',
          label: 'tool_output:build blocked by sqlite timeout',
          severity: 'high',
          sourceNodeIds: ['risk-1']
        }
      ],
      procedureCandidates: [
        {
          nodeId: 'procedure-1',
          label: 'procedure_candidate:inspect sqlite timeout',
          status: 'candidate',
          confidence: 0.84,
          stepNodeIds: ['step-1'],
          stepLabels: ['workflow:produce a long current process explanation'],
          prerequisiteNodeIds: ['rule-1'],
          prerequisiteLabels: ['rule:Always preserve provenance when selecting context.'],
          criticalStepNodeIds: ['step-1']
        }
      ]
    }
  };

  const text = formatBundle(bundle, undefined, {
    diagnosticsMode: 'summary'
  });

  assert.match(text, /Learning signals: failure=1 procedures=1 criticalSteps=1/i);
  assert.match(text, /Failure signals: tool_output:build blocked by sqlite timeout\(high\)/i);
  assert.match(text, /Procedure candidates: procedure_candidate:inspect sqlite timeout\[candidate\]/i);
  assert.match(text, /Critical steps: workflow:produce a long current process expla/i);
});

test('formatBundle includes topic hint diagnostics in summary mode', () => {
  const bundle = createBundleFixture();
  const diagnostics = bundle.diagnostics;

  assert.ok(diagnostics);
  bundle.diagnostics = {
    ...diagnostics,
    topicHints: [
      {
        nodeId: 'topic-1',
        type: 'Topic',
        label: 'topic:provenance governance',
        estimatedTokens: 10,
        reason: 'reserved as a topic-aware recall hint; not yet admitted into the primary runtime bundle'
      }
    ]
  };

  const text = formatBundle(bundle, undefined, {
    diagnosticsMode: 'summary'
  });

  assert.match(text, /topicHints: reserved 1 hint\(s\) for future topic-aware recall/i);
});

test('normalizeGatewayPayload folds top-level explain selection context into nested payload', () => {
  const payload = normalizeGatewayPayload(
    'explain',
    {
      nodeId: 'risk-1',
      sessionId: 'session-gateway-1',
      query: 'why is the build blocked',
      tokenBudget: 1000
    },
    createPluginConfigFixture()
  );

  assert.deepEqual(payload, {
    nodeId: 'risk-1',
    selectionContext: {
      sessionId: 'session-gateway-1',
      query: 'why is the build blocked',
      tokenBudget: 300
    }
  });
});

test('normalizeGatewayPayload carries workspaceId into explain selection context', () => {
  const payload = normalizeGatewayPayload(
    'explain',
    {
      nodeId: 'rule-1',
      sessionId: 'session-scope-gateway',
      workspaceId: 'workspace-scope-gateway',
      query: 'preserve provenance',
      tokenBudget: 1000
    },
    createPluginConfigFixture()
  );

  assert.deepEqual(payload, {
    nodeId: 'rule-1',
    selectionContext: {
      sessionId: 'session-scope-gateway',
      workspaceId: 'workspace-scope-gateway',
      query: 'preserve provenance',
      tokenBudget: 300
    }
  });
});

test('normalizeGatewayPayload preserves explicit explain selection context over top-level shorthands', () => {
  const payload = normalizeGatewayPayload(
    'explain',
    {
      nodeId: 'step-1',
      sessionId: 'session-top-level',
      query: 'top-level query',
      tokenBudget: 1000,
      compileTokenBudget: 420,
      selectionContext: {
        sessionId: 'session-explicit',
        query: 'explicit query',
        tokenBudget: 128
      }
    },
    createPluginConfigFixture()
  );

  assert.deepEqual(payload, {
    nodeId: 'step-1',
    selectionContext: {
      sessionId: 'session-explicit',
      query: 'explicit query',
      tokenBudget: 128
    }
  });
});

test('registerGatewayDebugMethods applies and lists manual corrections through gateway helpers', async () => {
  const engine = new ContextEngine();
  const handlers = new Map<string, (options: { params: Record<string, unknown>; respond: GatewayRespond }) => Promise<void>>();

  registerGatewayDebugMethods(
    {
      get: async () => engine
    } as never,
    createPluginConfigFixture(),
    createLoggerFixture(),
    createControlPlaneFacadeFixture(),
    (method, handler) => {
      handlers.set(method, handler);
    }
  );

  const applyHandler = handlers.get('compact-context.apply_corrections');
  const listHandler = handlers.get('compact-context.list_corrections');

  assert.ok(applyHandler);
  assert.ok(listHandler);

  const applyResponse = await invokeGatewayHandler(applyHandler, {
    corrections: [
      buildConceptAliasCorrection({
        id: 'gateway-correction-1',
        targetId: 'knowledge_graph',
        action: 'apply',
        author: 'tester',
        reason: 'support a gateway-only alias',
        createdAt: '2026-03-14T18:00:00.000Z',
        alias: 'knowledge weave'
      }),
      buildNodeSuppressionCorrection({
        id: 'gateway-correction-2',
        targetId: 'rule:preserve-provenance',
        action: 'apply',
        author: 'tester',
        reason: 'temporarily suppress this rule from runtime selection',
        createdAt: '2026-03-14T18:01:00.000Z',
        suppressed: true
      }),
      buildLabelOverrideCorrection({
        id: 'gateway-correction-3',
        targetId: 'rule:preserve-provenance',
        action: 'apply',
        author: 'tester',
        reason: 'clarify the wording of the rule',
        createdAt: '2026-03-14T18:02:00.000Z',
        label: 'Rule: preserve provenance before transcript persistence.'
      }),
      buildNoisePolicyCorrection({
        id: 'gateway-correction-4',
        targetId: 'span:acknowledgement',
        action: 'apply',
        author: 'tester',
        reason: 'keep acknowledgements out of node materialization',
        createdAt: '2026-03-14T18:03:00.000Z',
        disposition: 'drop'
      }),
      buildSemanticClassificationCorrection({
        id: 'gateway-correction-5',
        targetId: 'span:workflow-clause',
        action: 'apply',
        author: 'tester',
        reason: 'force a workflow clause into Step materialization',
        createdAt: '2026-03-14T18:04:00.000Z',
        nodeType: 'Step',
        operation: 'include'
      })
    ]
  });

  assert.equal(applyResponse.ok, true);
  assert.deepEqual(applyResponse.data, {
    appliedCount: 5
  });

  const listResponse = await invokeGatewayHandler(listHandler, {
    limit: 20
  });

  assert.equal(listResponse.ok, true);
  assert.equal(Array.isArray((listResponse.data as { corrections?: unknown }).corrections), true);
  assert.equal(
    ((listResponse.data as { corrections: Array<{ id: string }> }).corrections ?? []).some(
      (correction) => correction.id === 'gateway-correction-1'
    ),
    true
  );
  assert.equal(
    ((listResponse.data as { corrections: Array<{ id: string }> }).corrections ?? []).some(
      (correction) => correction.id === 'gateway-correction-5'
    ),
    true
  );

  await engine.close();
});

test('registerGatewayDebugMethods exposes correction proposal lifecycle helpers', async () => {
  const engine = new ContextEngine();
  const handlers = new Map<string, (options: { params: Record<string, unknown>; respond: GatewayRespond }) => Promise<void>>();

  registerGatewayDebugMethods(
    {
      get: async () => engine
    } as never,
    createPluginConfigFixture(),
    createLoggerFixture(),
    createControlPlaneFacadeFixture(),
    (method, handler) => {
      handlers.set(method, handler);
    }
  );

  const submitHandler = handlers.get('compact-context.submit_correction_proposal');
  const reviewHandler = handlers.get('compact-context.review_correction_proposal');
  const applyHandler = handlers.get('compact-context.apply_correction_proposal');
  const rollbackHandler = handlers.get('compact-context.rollback_correction_proposal');
  const listProposalHandler = handlers.get('compact-context.list_correction_proposals');
  const listAuditHandler = handlers.get('compact-context.list_correction_audit');
  const listCorrectionsHandler = handlers.get('compact-context.list_corrections');

  assert.ok(submitHandler);
  assert.ok(reviewHandler);
  assert.ok(applyHandler);
  assert.ok(rollbackHandler);
  assert.ok(listProposalHandler);
  assert.ok(listAuditHandler);
  assert.ok(listCorrectionsHandler);

  const submitResponse = await invokeGatewayHandler(submitHandler, {
    targetScope: 'workspace',
    submittedBy: 'alice',
    authority: 'workspace_reviewer',
    reason: 'review a workspace alias before rollout',
    corrections: [
      buildConceptAliasCorrection({
        id: 'gateway-proposal-correction-1',
        targetId: 'knowledge_graph',
        action: 'apply',
        author: 'alice',
        reason: 'add a reviewed workspace alias',
        createdAt: '2026-03-16T09:00:00.000Z',
        alias: 'workspace knowledge weave'
      })
    ]
  });

  assert.equal(submitResponse.ok, true);
  const proposalId = (submitResponse.data as { proposal?: { id: string } }).proposal?.id;
  assert.equal(typeof proposalId, 'string');

  const reviewResponse = await invokeGatewayHandler(reviewHandler, {
    proposalId,
    reviewedBy: 'bob',
    authority: 'workspace_reviewer',
    decision: 'approve',
    note: 'looks safe for workspace scope'
  });

  assert.equal(reviewResponse.ok, true);
  assert.equal((reviewResponse.data as { proposal?: { status: string } }).proposal?.status, 'approved');

  const applyResponse = await invokeGatewayHandler(applyHandler, {
    proposalId,
    appliedBy: 'carol',
    authority: 'workspace_reviewer'
  });

  assert.equal(applyResponse.ok, true);
  assert.equal((applyResponse.data as { appliedCount?: number }).appliedCount, 1);

  const correctionListAfterApply = await invokeGatewayHandler(listCorrectionsHandler, {
    limit: 10
  });
  assert.equal(correctionListAfterApply.ok, true);
  assert.equal(
    ((correctionListAfterApply.data as { corrections: Array<{ id: string }> }).corrections ?? []).some(
      (correction) => correction.id === 'gateway-proposal-correction-1'
    ),
    true
  );

  const rollbackResponse = await invokeGatewayHandler(rollbackHandler, {
    proposalId,
    rolledBackBy: 'dave',
    authority: 'workspace_reviewer',
    note: 'roll back until the team signs off'
  });

  assert.equal(rollbackResponse.ok, true);
  assert.equal((rollbackResponse.data as { rolledBackCount?: number }).rolledBackCount, 1);

  const proposalsResponse = await invokeGatewayHandler(listProposalHandler, {
    limit: 10
  });
  assert.equal(proposalsResponse.ok, true);
  assert.equal((proposalsResponse.data as { proposals: Array<{ id: string }> }).proposals[0]?.id, proposalId);

  const auditResponse = await invokeGatewayHandler(listAuditHandler, {
    limit: 10
  });
  assert.equal(auditResponse.ok, true);
  const auditEvents = ((auditResponse.data as { audit: Array<{ event: string }> }).audit ?? []).map(
    (record) => record.event
  );
  assert.equal(auditEvents.includes('submitted'), true);
  assert.equal(auditEvents.includes('approved'), true);
  assert.equal(auditEvents.includes('applied'), true);
  assert.equal(auditEvents.includes('rolled_back'), true);

  await engine.close();
});

test('registerGatewayDebugMethods exposes inspect_runtime_window through gateway helpers', async () => {
  const handlers = new Map<string, (options: { params: Record<string, unknown>; respond: GatewayRespond }) => Promise<void>>();

  registerGatewayDebugMethods(
    {
      get: async () => new ContextEngine(),
      getRuntimeWindowSnapshot: (sessionId: string) =>
        sessionId === 'session-gateway-runtime-window'
          ? {
              sessionId,
              capturedAt: '2026-03-15T12:20:00.000Z',
              query: 'inspect runtime window',
              totalBudget: 900,
              recentRawMessageCount: 2,
              recentRawTurnCount: 1,
              compressedCount: 1,
              preservedConversationCount: 2,
              compressionMode: 'incremental',
              compressionReason: 'history_before_recent_raw_tail',
              inboundMessages: [
                {
                  id: 'msg-1',
                  role: 'user',
                  content: [{ type: 'text', text: 'please inspect runtime window' }]
                }
              ],
              preferredMessages: [
                {
                  id: 'msg-1',
                  role: 'user',
                  content: [{ type: 'text', text: 'please inspect runtime window' }]
                }
              ],
              finalMessages: [
                {
                  id: 'msg-1',
                  role: 'user',
                  content: [{ type: 'text', text: 'please inspect runtime window' }]
                }
              ]
            }
          : undefined,
      getPersistedRuntimeWindowSnapshot: async () => undefined,
      resolveSessionFile: async () => undefined
    } as never,
    createPluginConfigFixture(),
    createLoggerFixture(),
    createControlPlaneFacadeFixture(),
    (method, handler) => {
      handlers.set(method, handler);
    }
  );

  const inspectHandler = handlers.get('compact-context.inspect_runtime_window');

  assert.ok(inspectHandler);

  const response = await invokeGatewayHandler(inspectHandler, {
    sessionId: 'session-gateway-runtime-window'
  });

  assert.equal(response.ok, true);
  assert.equal((response.data as { source?: string }).source, 'live_runtime');
  assert.equal((response.data as { counts?: { inbound: number } }).counts?.inbound, 1);
  assert.equal((response.data as { compressionMode?: string }).compressionMode, 'incremental');
  assert.equal((response.data as { compressionReason?: string }).compressionReason, 'history_before_recent_raw_tail');
  assert.equal((response.data as { window?: { compression?: { compressionMode?: string } } }).window?.compression?.compressionMode, 'incremental');
  assert.equal(
    (response.data as { window?: { compression?: { compressionReason?: string } } }).window?.compression?.compressionReason,
    'history_before_recent_raw_tail'
  );
  assert.ok(Array.isArray((response.data as { inboundSummary?: unknown[] }).inboundSummary));
  assert.ok(Array.isArray((response.data as { preferredSummary?: unknown[] }).preferredSummary));
  assert.ok(Array.isArray((response.data as { finalSummary?: unknown[] }).finalSummary));
});

test('registerGatewayDebugMethods exposes inspect_observability_dashboard through gateway helpers', async () => {
  const handlers = new Map<string, (options: { params: Record<string, unknown>; respond: GatewayRespond }) => Promise<void>>();

  registerGatewayDebugMethods(
    {
      get: async () => new ContextEngine(),
      getRuntimeWindowSnapshot: (sessionId: string) =>
        sessionId === 'session-gateway-dashboard'
          ? {
              sessionId,
              capturedAt: '2026-03-18T09:00:00.000Z',
              query: 'inspect observability dashboard',
              totalBudget: 900,
              recentRawMessageCount: 3,
              recentRawTurnCount: 1,
              compressedCount: 2,
              preservedConversationCount: 3,
              compressionMode: 'incremental',
              inboundMessages: [
                {
                  id: 'msg-dashboard-1',
                  role: 'user',
                  content: [{ type: 'text', text: 'inspect the dashboard state' }]
                }
              ],
              preferredMessages: [
                {
                  id: 'msg-dashboard-1',
                  role: 'user',
                  content: [{ type: 'text', text: 'inspect the dashboard state' }]
                }
              ],
              finalMessages: [
                {
                  id: 'msg-dashboard-1',
                  role: 'user',
                  content: [{ type: 'text', text: 'inspect the dashboard state' }]
                }
              ]
            }
          : undefined,
      getPersistedRuntimeWindowSnapshot: async () => undefined,
      listRuntimeWindowSnapshots: async () => [],
      resolveSessionFile: async () => undefined
    } as never,
    createPluginConfigFixture(),
    createLoggerFixture(),
    createControlPlaneFacadeFixture(),
    (method, handler) => {
      handlers.set(method, handler);
    }
  );

  const inspectHandler = handlers.get('compact-context.inspect_observability_dashboard');

  assert.ok(inspectHandler);

  const response = await invokeGatewayHandler(inspectHandler, {
    sessionId: 'session-gateway-dashboard',
    thresholds: {
      minLiveRuntimeRatio: 0.5
    }
  });

  assert.equal(response.ok, true);
  assert.equal((response.data as { windowCount?: number }).windowCount, 1);
  assert.equal(
    ((response.data as { dashboard?: { runtimeWindowSummary?: { sampleCount?: number } } }).dashboard?.runtimeWindowSummary
      ?.sampleCount ?? 0),
    1
  );
  assert.equal(
    ((response.data as { dashboard?: { metricCards?: Array<{ key: string }> } }).dashboard?.metricCards ?? []).some(
      (card) => card.key === 'runtime_live_window_ratio'
    ),
    true
  );
});

test('registerGatewayDebugMethods captures observability snapshots and exposes history', async () => {
  const handlers = new Map<string, (options: { params: Record<string, unknown>; respond: GatewayRespond }) => Promise<void>>();

  registerGatewayDebugMethods(
    {
      get: async () => new ContextEngine(),
      getRuntimeWindowSnapshot: () => ({
        sessionId: 'session-gateway-dashboard-history',
        capturedAt: '2026-03-18T09:10:00.000Z',
        query: 'inspect observability history',
        totalBudget: 900,
        recentRawMessageCount: 3,
        recentRawTurnCount: 1,
        compressedCount: 1,
        preservedConversationCount: 2,
        compressionMode: 'incremental',
        inboundMessages: [
          {
            id: 'msg-dashboard-history-1',
            role: 'user',
            content: [{ type: 'text', text: 'capture dashboard snapshot' }]
          }
        ],
        preferredMessages: [
          {
            id: 'msg-dashboard-history-1',
            role: 'user',
            content: [{ type: 'text', text: 'capture dashboard snapshot' }]
          }
        ],
        finalMessages: [
          {
            id: 'msg-dashboard-history-1',
            role: 'user',
            content: [{ type: 'text', text: 'capture dashboard snapshot' }]
          }
        ]
      }),
      getPersistedRuntimeWindowSnapshot: async () => undefined,
      listRuntimeWindowSnapshots: async () => [],
      resolveSessionFile: async () => undefined
    } as never,
    createPluginConfigFixture(),
    createLoggerFixture(),
    createControlPlaneFacadeFixture(),
    (method, handler) => {
      handlers.set(method, handler);
    }
  );

  const captureHandler = handlers.get('compact-context.capture_observability_snapshot');
  const historyHandler = handlers.get('compact-context.inspect_observability_history');

  assert.ok(captureHandler);
  assert.ok(historyHandler);

  const firstCapture = await invokeGatewayHandler(captureHandler, {
    stage: 'stage-6-dashboard-history',
    sessionId: 'session-gateway-dashboard-history',
    capturedAt: '2026-03-18T09:11:00.000Z'
  });
  const secondCapture = await invokeGatewayHandler(captureHandler, {
    stage: 'stage-6-dashboard-history',
    sessionId: 'session-gateway-dashboard-history',
    capturedAt: '2026-03-18T09:12:00.000Z'
  });
  const historyResponse = await invokeGatewayHandler(historyHandler, {
    stage: 'stage-6-dashboard-history',
    limit: 10
  });

  assert.equal(firstCapture.ok, true);
  assert.equal(secondCapture.ok, true);
  assert.equal(historyResponse.ok, true);
  assert.equal((historyResponse.data as { snapshotCount?: number }).snapshotCount, 2);
  assert.equal((historyResponse.data as { history?: { pointCount?: number } }).history?.pointCount, 2);
});

test('registerGatewayDebugMethods exposes import job lifecycle through gateway helpers', async () => {
  const engine = new ContextEngine();
  const handlers = new Map<string, (options: { params: Record<string, unknown>; respond: GatewayRespond }) => Promise<void>>();

  registerGatewayDebugMethods(
    {
      get: async () => engine,
      getRuntimeWindowSnapshot: () => undefined,
      getPersistedRuntimeWindowSnapshot: async () => undefined,
      listRuntimeWindowSnapshots: async () => [],
      resolveSessionFile: async () => undefined
    } as never,
    createPluginConfigFixture(),
    createLoggerFixture(),
    createControlPlaneFacadeFixture(),
    (method, handler) => {
      handlers.set(method, handler);
    }
  );

  const createHandler = handlers.get('compact-context.create_import_job');
  const runHandler = handlers.get('compact-context.run_import_job');
  const scheduleHandler = handlers.get('compact-context.schedule_import_job');
  const runDueHandler = handlers.get('compact-context.run_due_import_jobs');
  const getHandler = handlers.get('compact-context.get_import_job');
  const listHandler = handlers.get('compact-context.list_import_jobs');
  const historyHandler = handlers.get('compact-context.list_import_job_history');

  assert.ok(createHandler);
  assert.ok(runHandler);
  assert.ok(scheduleHandler);
  assert.ok(runDueHandler);
  assert.ok(getHandler);
  assert.ok(listHandler);
  assert.ok(historyHandler);

  const createResponse = await invokeGatewayHandler(createHandler, {
    sessionId: 'session-import-gateway',
    sourceKind: 'structured_input',
    source: {
      format: 'json'
    },
    input: {
      sessionId: 'session-import-gateway',
      records: [
        {
          id: 'gateway-import-record-1',
          scope: 'workspace',
          sourceType: 'document',
          role: 'system',
          content: 'Gateway import should route through runtime ingest.',
          metadata: {
            nodeType: 'Rule',
            documentKind: 'runbook'
          }
        }
      ]
    }
  });

  assert.equal(createResponse.ok, true);
  const jobId = (createResponse.data as { job?: { id: string } }).job?.id;
  assert.equal(typeof jobId, 'string');

  const runResponse = await invokeGatewayHandler(runHandler, {
    jobId
  });

  assert.equal(runResponse.ok, true);
  assert.equal((runResponse.data as { ingestedRecordCount?: number }).ingestedRecordCount, 1);

  const scheduleResponse = await invokeGatewayHandler(scheduleHandler, {
    jobId,
    dueAt: '2026-03-18T11:00:00.000Z',
    createdAt: '2026-03-18T10:59:00.000Z',
    createdBy: 'tester'
  });
  assert.equal(scheduleResponse.ok, true);

  const runDueResponse = await invokeGatewayHandler(runDueHandler, {
    now: '2026-03-18T11:00:00.000Z'
  });
  assert.equal(runDueResponse.ok, true);
  assert.equal((runDueResponse.data as { processedCount?: number }).processedCount, 1);

  const getResponse = await invokeGatewayHandler(getHandler, {
    jobId
  });
  assert.equal(getResponse.ok, true);
  assert.equal((getResponse.data as { record?: { job?: { status?: string } } }).record?.job?.status, 'completed');

  const listResponse = await invokeGatewayHandler(listHandler, {
    limit: 10
  });
  assert.equal(listResponse.ok, true);
  assert.equal(
    ((listResponse.data as { jobs?: Array<{ id: string }> }).jobs ?? []).some((job) => job.id === jobId),
    true
  );

  const historyResponse = await invokeGatewayHandler(historyHandler, {
    jobId,
    limit: 10
  });
  assert.equal(historyResponse.ok, true);
  assert.equal(((historyResponse.data as { history?: Array<unknown> }).history ?? []).length >= 2, true);

  await engine.close();
});

test('buildGatewaySuccessPayload augments query_nodes with explanations and inferred selection context', async () => {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId: 'session-gateway-query-explain',
    records: [
      {
        id: 'risk-gateway-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'build failed and is blocked by a sqlite timeout in migration step 4.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1
        }
      }
    ]
  });

  const nodes = await engine.queryNodes({
    sessionId: 'session-gateway-query-explain',
    types: ['Risk']
  });

  const payload = (await buildGatewaySuccessPayload(
    'query_nodes',
    {
      explain: true,
      filter: {
        sessionId: 'session-gateway-query-explain',
        text: 'why is the build blocked'
      }
    },
    { nodes },
    engine,
    createPluginConfigFixture()
  )) as {
    nodes: unknown[];
    queryMatch: {
      query: string;
      queryTerms: string[];
      matchedNodeCount: number;
      diagnostics: Array<{
        bestField: string;
        matchedTerms: string[];
        coverage: number;
      }>;
    };
    explain: {
      selectionContext?: {
        sessionId: string;
        query?: string;
      };
      explanations: Array<{
        trace?: {
          source: {
            sourceStage?: string;
          };
          selection: {
            evaluated: boolean;
            included?: boolean;
          };
        };
        retrieval?: {
          adjacency: {
            strategy: string;
            edgeLookupCount: number;
          };
          selectionCompile?: {
            strategy: string;
            edgeLookupCount: number;
          };
        };
        selection?: {
          included: boolean;
          slot?: string;
          query: string;
        };
      }>;
    };
  };

  assert.equal(Array.isArray(payload.nodes), true);
  assert.equal(payload.queryMatch.query, 'why is the build blocked');
  assert.deepEqual(payload.queryMatch.queryTerms, ['build', 'blocked']);
  assert.equal(payload.queryMatch.matchedNodeCount, 1);
  assert.equal(payload.queryMatch.diagnostics[0]?.bestField, 'label');
  assert.deepEqual(payload.queryMatch.diagnostics[0]?.matchedTerms, ['build', 'blocked']);
  assert.equal(payload.queryMatch.diagnostics[0]?.coverage, 1);
  assert.equal(payload.explain.selectionContext?.sessionId, 'session-gateway-query-explain');
  assert.equal(payload.explain.selectionContext?.query, 'why is the build blocked');
  assert.equal(payload.explain.explanations.length, 1);
  assert.equal(payload.explain.explanations[0]?.selection?.included, true);
  assert.equal(payload.explain.explanations[0]?.selection?.slot, 'openRisks');
  assert.equal(payload.explain.explanations[0]?.selection?.query, 'why is the build blocked');
  assert.equal(payload.explain.explanations[0]?.trace?.source.sourceStage, 'tool_output_raw');
  assert.equal(payload.explain.explanations[0]?.trace?.selection.evaluated, true);
  assert.equal(payload.explain.explanations[0]?.trace?.selection.included, true);
  assert.equal(payload.explain.explanations[0]?.retrieval?.adjacency.strategy, 'single_node_adjacency');
  assert.equal(payload.explain.explanations[0]?.retrieval?.adjacency.edgeLookupCount, 1);
  assert.equal(payload.explain.explanations[0]?.retrieval?.selectionCompile?.strategy, 'single_source_fallback');
  assert.equal(payload.explain.explanations[0]?.retrieval?.selectionCompile?.edgeLookupCount, 1);

  await engine.close();
});

test('gateway query_nodes and inspect_bundle expose persistence trace from explain results', async () => {
  const engine = new ContextEngine();
  const sessionId = 'session-gateway-persistence-trace';
  const query = 'why is the migration pipeline blocked and how do we preserve provenance';

  await engine.ingest({
    sessionId,
    records: [
      {
        id: 'goal-gateway-persistence-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to unblock the migration pipeline and preserve provenance.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'rule-gateway-persistence-1',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when unblocking the migration pipeline.',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: 'step-gateway-persistence-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 1: inspect the migration timeout before changing any context assembly rule.'
      },
      {
        id: 'evidence-gateway-persistence-1',
        scope: 'session',
        sourceType: 'document',
        role: 'system',
        content: 'Evidence: the build trace shows migration step 4 timing out while provenance still points to sqlite.',
        metadata: {
          nodeType: 'Evidence'
        }
      }
    ]
  });

  const bundle = await engine.compileContext({
    sessionId,
    query,
    tokenBudget: 420
  });

  const { checkpoint, delta } = await engine.createCheckpoint({
    sessionId,
    bundle
  });

  await engine.crystallizeSkills({
    sessionId,
    bundle,
    checkpointId: checkpoint.id,
    minEvidenceCount: 1
  });

  const nodes = await engine.queryNodes({
    sessionId,
    types: ['Rule']
  });

  const queryPayload = (await buildGatewaySuccessPayload(
    'query_nodes',
    {
      explain: true,
      filter: {
        sessionId,
        text: query
      }
    },
    { nodes },
    engine,
    createPluginConfigFixture()
  )) as {
    explain: {
      explanations: Array<{
        trace?: {
          persistence: {
            persistedInCheckpoint: boolean;
            surfacedInDelta: boolean;
            surfacedInSkillCandidate: boolean;
            checkpointId?: string;
            deltaId?: string;
            checkpointSourceBundleId?: string;
            deltaSourceBundleId?: string;
            skillCandidateSourceBundleId?: string;
          };
        };
        memoryLifecycle?: {
          checkpoints: Array<{
            lifecycle?: {
              retentionClass?: string;
            };
          }>;
          skillCandidates: Array<{
            lifecycle?: {
              promotion: {
                ready: boolean;
              };
            };
          }>;
        };
      }>;
    };
  };

  assert.equal(queryPayload.explain.explanations[0]?.trace?.persistence.persistedInCheckpoint, true);
  assert.equal(queryPayload.explain.explanations[0]?.trace?.persistence.checkpointId, checkpoint.id);
  assert.equal(queryPayload.explain.explanations[0]?.trace?.persistence.surfacedInSkillCandidate, true);
  assert.equal(queryPayload.explain.explanations[0]?.trace?.persistence.surfacedInDelta, true);
  assert.equal(queryPayload.explain.explanations[0]?.trace?.persistence.deltaId, delta.id);
  assert.equal(queryPayload.explain.explanations[0]?.trace?.persistence.checkpointSourceBundleId, bundle.id);
  assert.equal(queryPayload.explain.explanations[0]?.trace?.persistence.deltaSourceBundleId, bundle.id);
  assert.equal(queryPayload.explain.explanations[0]?.trace?.persistence.skillCandidateSourceBundleId, bundle.id);
  assert.equal(queryPayload.explain.explanations[0]?.memoryLifecycle?.checkpoints[0]?.lifecycle?.retentionClass, 'sticky');
  assert.equal(queryPayload.explain.explanations[0]?.memoryLifecycle?.skillCandidates[0]?.lifecycle?.promotion.ready, true);

  const inspectPayload = await buildInspectBundlePayload(
    {
      sessionId,
      query,
      tokenBudget: 1000,
      explainLimit: 2
    },
    engine,
    createPluginConfigFixture()
  );
  const explainWithPersistence = inspectPayload.explain?.explanations.find(
    (item) =>
      item.trace?.persistence.persistedInCheckpoint && item.trace?.persistence.surfacedInSkillCandidate
  );

  assert.ok(explainWithPersistence);
  assert.equal(explainWithPersistence?.trace?.persistence.persistedInCheckpoint, true);
  assert.equal(explainWithPersistence?.trace?.persistence.surfacedInSkillCandidate, true);
  assert.equal(explainWithPersistence?.trace?.persistence.checkpointSourceBundleId, bundle.id);
  assert.equal(explainWithPersistence?.trace?.persistence.skillCandidateSourceBundleId, bundle.id);

  await engine.close();
});

test('buildGatewaySuccessPayload exposes tool result compression details inside query_nodes explanations', async () => {
  const engine = new ContextEngine();
  const compressedMessage = createCompressedFailureToolMessage();
  const compressedContent = readCompressedToolResultContent(compressedMessage.content);

  assert.ok(compressedContent);

  await engine.ingest({
    sessionId: 'session-gateway-tool-compression',
    records: [
      {
        id: 'tool-gateway-compressed-1',
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

  const nodes = await engine.queryNodes({
    sessionId: 'session-gateway-tool-compression',
    types: ['State']
  });

  const payload = (await buildGatewaySuccessPayload(
    'query_nodes',
    {
      includeExplain: true,
      filter: {
        sessionId: 'session-gateway-tool-compression',
        text: 'pytest failure preview'
      }
    },
    { nodes },
    engine,
    createPluginConfigFixture()
  )) as {
    explain: {
      explanations: Array<{
        toolResultCompression?: {
          policyId: string;
          reason?: string;
          droppedSections: string[];
          lookup: {
            rawSourceId?: string;
            sourcePath?: string;
          };
        };
      }>;
    };
  };

  assert.equal(payload.explain.explanations.length, 1);
  assert.equal(
    payload.explain.explanations[0]?.toolResultCompression?.policyId,
    compressedContent.truncation.policyId
  );
  assert.equal(
    payload.explain.explanations[0]?.toolResultCompression?.reason,
    compressedContent.truncation.reason
  );
  assert.ok(
    payload.explain.explanations[0]?.toolResultCompression?.droppedSections.includes('stderr.middle')
  );
  assert.equal(
    payload.explain.explanations[0]?.toolResultCompression?.lookup.rawSourceId,
    compressedContent.provenance.rawSourceId
  );
  assert.equal(
    payload.explain.explanations[0]?.toolResultCompression?.lookup.sourcePath,
    compressedContent.artifact?.sourcePath
  );

  await engine.close();
});

test('buildGatewaySuccessPayload honors query_nodes explainLimit', async () => {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId: 'session-gateway-query-limit',
    records: [
      {
        id: 'risk-gateway-limit-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'first build failure due to sqlite timeout.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1
        }
      },
      {
        id: 'risk-gateway-limit-2',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'second build failure due to test timeout.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1
        }
      }
    ]
  });

  const nodes = await engine.queryNodes({
    sessionId: 'session-gateway-query-limit',
    types: ['Risk']
  });

  const payload = (await buildGatewaySuccessPayload(
    'query_nodes',
    {
      includeExplain: true,
      explainLimit: 1,
      sessionId: 'session-gateway-query-limit',
      query: 'why are failures happening'
    },
    { nodes },
    engine,
    createPluginConfigFixture()
  )) as {
    explain: {
      explainedCount: number;
      totalNodeCount: number;
      truncated: boolean;
    };
  };

  assert.equal(payload.explain.explainedCount, 1);
  assert.equal(payload.explain.totalNodeCount, nodes.length);
  assert.equal(payload.explain.truncated, nodes.length > 1);

  await engine.close();
});

test('buildGatewaySuccessPayload adds query match diagnostics even without explain', async () => {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId: 'session-gateway-query-match-only',
    records: [
      {
        id: 'goal-query-match-only',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to preserve provenance and explain why the build is blocked.',
        metadata: {
          nodeType: 'Goal'
        }
      }
    ]
  });

  const nodes = await engine.queryNodes({
    sessionId: 'session-gateway-query-match-only',
    types: ['Goal']
  });

  const payload = (await buildGatewaySuccessPayload(
    'query_nodes',
    {
      filter: {
        sessionId: 'session-gateway-query-match-only',
        text: 'build blocked provenance'
      }
    },
    { nodes },
    engine,
    createPluginConfigFixture()
  )) as {
    nodes: unknown[];
    queryMatch: {
      query: string;
      queryTerms: string[];
      matchedNodeCount: number;
      diagnostics: Array<{
        matchedTerms: string[];
        coverage: number;
        bestField: string;
      }>;
    };
    explain?: unknown;
  };

  assert.equal(Array.isArray(payload.nodes), true);
  assert.equal(payload.explain, undefined);
  assert.equal(payload.queryMatch.query, 'build blocked provenance');
  assert.deepEqual(payload.queryMatch.queryTerms, ['build', 'blocked', 'provenance']);
  assert.equal(payload.queryMatch.matchedNodeCount, 1);
  assert.deepEqual(payload.queryMatch.diagnostics[0]?.matchedTerms, ['build', 'blocked', 'provenance']);
  assert.equal(payload.queryMatch.diagnostics[0]?.coverage, 1);
  assert.equal(payload.queryMatch.diagnostics[0]?.bestField, 'label');

  await engine.close();
});

test('buildInspectBundlePayload returns bundle, summary, and explain samples', async () => {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId: 'session-inspect-bundle',
    records: [
      {
        id: 'goal-inspect-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to debug why the build is blocked.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'risk-inspect-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'build failed and is blocked by a sqlite timeout in migration step 4.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1
        }
      }
    ]
  });
  await engine.saveCompressionState({
    id: 'compression-state-inspect-bundle',
    sessionId: 'session-inspect-bundle',
    baseline: undefined,
    incremental: {
      summary: {
        summaryText: 'Earlier history is summarized.',
        tokenEstimate: 24
      },
      derivedFrom: ['goal-inspect-1'],
      createdAt: '2026-03-19T00:00:00.000Z'
    },
    rawTail: {
      turnCount: 2,
      turns: [
        {
          turnId: 'turn-1',
          messageIds: ['goal-inspect-1']
        },
        {
          turnId: 'turn-2',
          messageIds: ['risk-inspect-1']
        }
      ],
      derivedFrom: ['goal-inspect-1', 'risk-inspect-1'],
      createdAt: '2026-03-19T00:00:00.000Z'
    },
    compressionMode: 'incremental',
    rawTailStartMessageId: 'goal-inspect-1',
    baselineVersion: 0,
    derivedFrom: ['goal-inspect-1', 'risk-inspect-1'],
    createdAt: '2026-03-19T00:00:00.000Z',
    updatedAt: '2026-03-19T00:00:00.000Z'
  });

  const payload = await buildInspectBundlePayload(
    {
      sessionId: 'session-inspect-bundle',
      query: 'why is the build blocked',
      tokenBudget: 1000,
      explainLimit: 2
    },
    engine,
    createPluginConfigFixture()
  );

  assert.equal(payload.selectionContext.sessionId, 'session-inspect-bundle');
  assert.equal(payload.selectionContext.query, 'why is the build blocked');
  assert.equal(payload.selectionContext.tokenBudget, 300);
  assert.ok(payload.bundle.metadata);
  assert.equal(payload.bundle.metadata?.compressionMode, 'incremental');
  assert.equal(payload.bundle.metadata?.baselineId, undefined);
  assert.ok((payload.bundle.metadata?.evidenceCoverage.requiresEvidenceSelectionCount ?? 0) >= 1);
  assert.equal(
    payload.bundle.metadata?.evidenceCoverage.supportingEvidenceCount,
    payload.bundle.relevantEvidence.length
  );
  assert.equal(payload.bundle.metadata?.evidenceCoverage.evidenceSatisfied, true);
  assert.equal(payload.summaryContract.bundleId, payload.bundle.id);
  assert.equal(payload.summaryContract.requiredSlots.includes('goal'), true);
  assert.equal(
    payload.summaryContract.metadata.evidenceCoverage.supportingEvidenceCount,
    payload.bundle.relevantEvidence.length
  );
  assert.equal(Object.prototype.hasOwnProperty.call(payload.summaryContract, 'summary'), false);
  assert.equal(payload.bundleContract.bundleId, payload.bundle.id);
  assert.equal(payload.bundleContract.requiredFixedSlots.includes('currentProcess'), true);
  assert.equal(
    payload.bundleContract.metadata.evidenceCoverage.supportingEvidenceCount,
    payload.bundle.relevantEvidence.length
  );
  assert.equal(Object.prototype.hasOwnProperty.call(payload.bundleContract, 'summary'), false);
  assert.match(payload.summary, /\[Selection Diagnostics\]/);
  assert.match(payload.summary, /Summary contract:/);
  assert.match(payload.summary, /Bundle contract:/);
  assert.doesNotMatch(payload.promptPreview, /\[Selection Diagnostics\]/);
  assert.ok(payload.recalledNodes.length > 0);
  assert.equal(payload.recalledNodes.some((item) => item.nodeId === 'goal-inspect-1'), true);
  assert.equal(
    payload.recalledNodes.some(
      (item) => item.nodeId === 'goal-inspect-1' && item.primaryRecallKind === 'direct_text'
    ),
    true
  );
  assert.equal(
    payload.recalledNodes.some(
      (item) => item.nodeId === 'goal-inspect-1' && item.recallKinds?.includes('direct_text')
    ),
    true
  );
  assert.equal(payload.compaction?.mode, 'incremental');
  assert.equal(payload.compaction?.reason, 'history_before_recent_raw_tail');
  assert.equal(payload.compaction?.retainedRawTurnCount, 2);
  assert.equal(payload.compaction?.retainedRawTurns.length, 2);
  assert.ok(payload.explain);
  assert.equal(payload.explain?.enabled, true);
  assert.equal(payload.explain?.explainLimit, 2);
  assert.ok((payload.explain?.explainedCount ?? 0) > 0);
  assert.match(payload.explain?.explanations[0]?.summary ?? '', /Selection:/);
  assert.equal(payload.explain?.explanations[0]?.trace?.selection.evaluated, true);
  assert.equal(typeof payload.explain?.explanations[0]?.trace?.transformation.semanticNodeId, 'string');

  await engine.close();
});

test('buildInspectBundlePayload can skip explain samples', async () => {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId: 'session-inspect-no-explain',
    records: [
      {
        id: 'rule-inspect-1',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when inspecting bundle output.',
        metadata: {
          nodeType: 'Rule'
        }
      }
    ]
  });

  const payload = await buildInspectBundlePayload(
    {
      sessionId: 'session-inspect-no-explain',
      includeExplain: false
    },
    engine,
    createPluginConfigFixture()
  );

  assert.ok(payload.bundle);
  assert.equal(payload.explain, undefined);
  assert.match(payload.summary, /Budget used:/);

  await engine.close();
});

test('assemble keeps recent two turns as raw tail and starts a single incremental block on the third turn', async () => {
  const engine = new ContextEngine();
  const snapshots: Array<Record<string, unknown>> = [];
  const adapter = new OpenClawContextEngineAdapter(
    {
      get: async () => engine,
      recordRuntimeWindowSnapshot: async (snapshot: Record<string, unknown>) => {
        snapshots.push(snapshot);
      }
    } as never,
    createPluginConfigFixture(),
    createLoggerFixture()
  );
  const sessionId = 'session-assemble-incremental';
  const round1 = createTurnMessages(1, 'first requirement', 'ack first requirement');
  const round2 = round1.concat(createTurnMessages(2, 'second requirement', 'ack second requirement'));
  const round3 = round2.concat(createTurnMessages(3, 'third requirement', 'ack third requirement'));

  await adapter.assemble({
    sessionId,
    messages: round1,
    tokenBudget: 1000
  });
  await adapter.assemble({
    sessionId,
    messages: round2,
    tokenBudget: 1000
  });
  const round3Result = await adapter.assemble({
    sessionId,
    messages: round3,
    tokenBudget: 1000
  });

  const stateAfterRound3 = await engine.getCompressionState(sessionId);
  assert.ok(stateAfterRound3);
  assert.equal(stateAfterRound3.compressionMode, 'incremental');
  assert.equal(stateAfterRound3.baseline, undefined);
  assert.deepEqual(stateAfterRound3.incremental?.derivedFrom, ['user-1', 'assistant-1']);
  assert.equal(stateAfterRound3.rawTail.turnCount, 2);
  assert.deepEqual(stateAfterRound3.rawTail.turns.map((turn) => turn.messageIds), [
    ['user-2', 'assistant-2'],
    ['user-3', 'assistant-3']
  ]);
  assert.equal(stateAfterRound3.rawTailStartMessageId, 'user-2');
  assert.equal(stateAfterRound3.incrementalCoveredUntilMessageId, 'assistant-1');
  assert.equal(stateAfterRound3.baselineCoveredUntilMessageId, undefined);
  assertCompressionLayersDoNotOverlap(stateAfterRound3);
  assert.deepEqual(
    round3Result.messages.map((message) => message.id),
    ['user-2', 'assistant-2', 'user-3', 'assistant-3']
  );
  assert.match(String(round3Result.systemPromptAddition), /\[Conversation Compression State\]/);
  assert.match(String(round3Result.systemPromptAddition), /\[Recent Incremental Compression\]/);

  const repeatedRound3 = await adapter.assemble({
    sessionId,
    messages: round3,
    tokenBudget: 1000
  });
  const stateAfterRepeat = await engine.getCompressionState(sessionId);
  assert.ok(stateAfterRepeat);
  assert.equal(stateAfterRepeat.id, stateAfterRound3.id);
  assert.deepEqual(repeatedRound3.messages.map((message) => message.id), [
    'user-2',
    'assistant-2',
    'user-3',
    'assistant-3'
  ]);

  const latestSnapshot = snapshots[snapshots.length - 1];
  assert.equal(latestSnapshot?.compressionMode, 'incremental');
  assert.equal(latestSnapshot?.compressionReason, 'history_before_recent_raw_tail');
  assert.equal(latestSnapshot?.recentRawTurnCount, 2);
  const checkpoints = await engine.listCheckpoints(sessionId, 10);
  const deltas = await engine.listDeltas(sessionId, 10);
  assert.equal(checkpoints.length, 1);
  assert.equal(deltas.length, 1);
  assert.equal(checkpoints[0]?.triggerSource, 'assemble');
  assert.equal(checkpoints[0]?.triggerCompressionMode, 'incremental');
  assert.equal(checkpoints[0]?.provenance?.triggerSource, 'assemble');
  assert.equal(checkpoints[0]?.provenance?.triggerCompressionMode, 'incremental');
  assert.equal(deltas[0]?.triggerSource, 'assemble');
  assert.equal(deltas[0]?.triggerCompressionMode, 'incremental');
  assert.equal(deltas[0]?.provenance?.triggerSource, 'assemble');
  assert.equal(deltas[0]?.provenance?.triggerCompressionMode, 'incremental');
  assert.ok((deltas[0]?.semanticChangeKinds?.length ?? 0) > 0);

  await engine.close();
});

test('assemble triggers full compaction over the threshold, rebuilds baseline, and clears incremental', async () => {
  const engine = new ContextEngine();
  const snapshots: Array<Record<string, unknown>> = [];
  const adapter = new OpenClawContextEngineAdapter(
    {
      get: async () => engine,
      recordRuntimeWindowSnapshot: async (snapshot: Record<string, unknown>) => {
        snapshots.push(snapshot);
      }
    } as never,
    createPluginConfigFixture(),
    createLoggerFixture()
  );
  const sessionId = 'session-assemble-full';
  const messages = createTurnMessages(
    1,
    'first requirement '.repeat(10),
    'ack first requirement '.repeat(10)
  )
    .concat(createTurnMessages(2, 'second requirement '.repeat(10), 'ack second requirement '.repeat(10)))
    .concat(createTurnMessages(3, 'third requirement '.repeat(10), 'ack third requirement '.repeat(10)))
    .concat(createTurnMessages(4, 'fourth requirement '.repeat(10), 'ack fourth requirement '.repeat(10)));

  const result = await adapter.assemble({
    sessionId,
    messages,
    tokenBudget: 500
  });

  const state = await engine.getCompressionState(sessionId);
  assert.ok(state);
  assert.equal(state.compressionMode, 'full');
  assert.ok(state.baseline);
  assert.equal(state.incremental, undefined);
  assert.equal(state.baselineCoveredUntilMessageId, 'assistant-2');
  assert.equal(state.rawTailStartMessageId, 'user-3');
  assert.equal(state.baselineVersion, 1);
  assert.equal(state.rawTail.turnCount, 2);
  assertCompressionLayersDoNotOverlap(state);
  assert.deepEqual(state.rawTail.turns.map((turn) => turn.messageIds), [
    ['user-3', 'assistant-3'],
    ['user-4', 'assistant-4']
  ]);
  assert.deepEqual(result.messages.map((message) => message.id), [
    'user-3',
    'assistant-3',
    'user-4',
    'assistant-4'
  ]);
  assert.match(String(result.systemPromptAddition), /\[Conversation Baseline\]/);
  assert.equal(snapshots[snapshots.length - 1]?.compressionMode, 'full');
  assert.equal(snapshots[snapshots.length - 1]?.compressionReason, 'budget_over_60_percent');
  const checkpoints = await engine.listCheckpoints(sessionId, 10);
  const deltas = await engine.listDeltas(sessionId, 10);
  assert.equal(checkpoints.length, 1);
  assert.equal(deltas.length, 1);
  assert.equal(checkpoints[0]?.triggerSource, 'assemble');
  assert.equal(checkpoints[0]?.triggerCompressionMode, 'full');
  assert.equal(checkpoints[0]?.provenance?.triggerSource, 'assemble');
  assert.equal(checkpoints[0]?.provenance?.triggerCompressionMode, 'full');
  assert.equal(deltas[0]?.triggerSource, 'assemble');
  assert.equal(deltas[0]?.triggerCompressionMode, 'full');
  assert.equal(deltas[0]?.provenance?.triggerSource, 'assemble');
  assert.equal(deltas[0]?.provenance?.triggerCompressionMode, 'full');
  assert.ok((deltas[0]?.semanticChangeKinds?.length ?? 0) > 0);

  await engine.close();
});

test('assemble keeps recent raw tail as two turn blocks, preserves tool results with their turn, and keeps system outside rawTail state', async () => {
  const engine = new ContextEngine();
  const adapter = new OpenClawContextEngineAdapter(
    {
      get: async () => engine,
      recordRuntimeWindowSnapshot: async () => undefined
    } as never,
    createPluginConfigFixture(),
    createLoggerFixture()
  );
  const sessionId = 'session-assemble-raw-tail-role-policy';
  const messages = [
    {
      id: 'system-1',
      role: 'system',
      content: [{ type: 'text', text: 'you must preserve provenance and recent tool results' }]
    },
    ...createTurnMessages(1, 'first requirement', 'ack first requirement'),
    {
      id: 'tool-1',
      role: 'toolResult',
      content: [{ type: 'text', text: 'tool output for first requirement' }]
    },
    ...createTurnMessages(2, 'second requirement', 'ack second requirement'),
    {
      id: 'tool-2',
      role: 'toolResult',
      content: [{ type: 'text', text: 'tool output for second requirement' }]
    },
    ...createTurnMessages(3, 'third requirement', 'ack third requirement')
  ];

  const result = await adapter.assemble({
    sessionId,
    messages,
    tokenBudget: 1000
  });

  const state = await engine.getCompressionState(sessionId);
  assert.ok(state);
  assert.equal(state.compressionMode, 'incremental');
  assert.equal(state.rawTail.turnCount, 2);
  assert.deepEqual(state.rawTail.turns.map((turn) => turn.messageIds), [
    ['user-2', 'assistant-2', 'tool-2'],
    ['user-3', 'assistant-3']
  ]);
  assert.equal(state.rawTailStartMessageId, 'user-2');
  assert.deepEqual(state.incremental?.derivedFrom, ['user-1', 'assistant-1', 'tool-1']);
  assert.equal(state.rawTail.derivedFrom.includes('system-1'), false);
  assertCompressionLayersDoNotOverlap(state);
  assert.deepEqual(
    result.messages.map((message) => message.id),
    ['system-1', 'user-2', 'assistant-2', 'tool-2', 'user-3', 'assistant-3']
  );

  await engine.close();
});

test('afterTurn ingests delta messages without refreshing checkpoint or skill candidates by default', async () => {
  const checkpointRequests: Array<Record<string, unknown>> = [];
  const skillRequests: Array<Record<string, unknown>> = [];
  const adapter = new OpenClawContextEngineAdapter(
    {
      get: async () =>
        ({
          ingest: async () => ({
            candidateNodes: [],
            candidateEdges: [],
            persistedNodeIds: ['node-1'],
            persistedEdgeIds: [],
            warnings: []
          }),
          compileContext: async () => createBundleFixture(),
          createCheckpoint: async (request: Record<string, unknown>) => {
            checkpointRequests.push(request);
            return {
              checkpoint: { id: 'checkpoint-unused' },
              delta: { id: 'delta-unused' }
            };
          },
          crystallizeSkills: async (request: Record<string, unknown>) => {
            skillRequests.push(request);
            return { candidates: [] };
          }
        }) as never
    } as never,
    createPluginConfigFixture(),
    createLoggerFixture()
  );

  await adapter.afterTurn({
    sessionId: 'session-after-turn-default',
    sessionFile: 'session-after-turn-default.jsonl',
    messages: createTurnMessages(1, 'first requirement', 'ack first requirement'),
    prePromptMessageCount: 0
  });

  assert.equal(checkpointRequests.length, 0);
  assert.equal(skillRequests.length, 0);
});

test('afterTurn only refreshes checkpoint, delta, and skill candidates when auto compaction summary is present', async () => {
  const checkpointRequests: Array<Record<string, unknown>> = [];
  const skillRequests: Array<Record<string, unknown>> = [];
  const adapter = new OpenClawContextEngineAdapter(
    {
      get: async () =>
        ({
          ingest: async () => ({
            candidateNodes: [],
            candidateEdges: [],
            persistedNodeIds: ['node-1'],
            persistedEdgeIds: [],
            warnings: []
          }),
          compileContext: async () => createBundleFixture(),
          getLatestCheckpoint: async () => undefined,
          createCheckpoint: async (request: Record<string, unknown>) => {
            checkpointRequests.push(request);
            return {
              checkpoint: { id: 'checkpoint-after-turn' },
              delta: { id: 'delta-after-turn' }
            };
          },
          crystallizeSkills: async (request: Record<string, unknown>) => {
            skillRequests.push(request);
            return { candidates: [] };
          }
        }) as never
    } as never,
    createPluginConfigFixture(),
    createLoggerFixture()
  );

  await adapter.afterTurn({
    sessionId: 'session-after-turn-auto-summary',
    sessionFile: 'session-after-turn-auto-summary.jsonl',
    messages: createTurnMessages(1, 'first requirement', 'ack first requirement'),
    prePromptMessageCount: 0,
    autoCompactionSummary: 'older context has been compacted into a short summary'
  });

  assert.equal(checkpointRequests.length, 1);
  assert.equal(skillRequests.length, 1);
  assert.equal(checkpointRequests[0]?.triggerSource, 'after_turn');
  assert.equal(checkpointRequests[0]?.triggerCompressionMode, undefined);
  assert.equal(skillRequests[0]?.triggerSource, 'after_turn');
  assert.equal(skillRequests[0]?.triggerCompressionMode, undefined);
});

test('compact always refreshes checkpoint, delta, and skill candidates with manual compact provenance', async () => {
  const checkpointRequests: Array<Record<string, unknown>> = [];
  const skillRequests: Array<Record<string, unknown>> = [];
  const adapter = new OpenClawContextEngineAdapter(
    {
      get: async () =>
        ({
          getLatestCheckpoint: async () => ({
            id: 'checkpoint-before-compact',
            tokenEstimate: 2400,
            summary: {
              goal: undefined,
              intent: undefined,
              activeRuleIds: [],
              activeConstraintIds: [],
              currentProcessId: undefined,
              recentDecisionIds: [],
              recentStateIds: [],
              openRiskIds: []
            },
            createdAt: '2026-03-19T10:00:00.000Z'
          }),
          compileContext: async () => createBundleFixture(),
          createCheckpoint: async (request: Record<string, unknown>) => {
            checkpointRequests.push(request);
            return {
              checkpoint: { id: 'checkpoint-compact', tokenEstimate: 48 },
              delta: { id: 'delta-compact' }
            };
          },
          crystallizeSkills: async (request: Record<string, unknown>) => {
            skillRequests.push(request);
            return { candidates: [] };
          }
        }) as never,
      markOwnCompaction: () => undefined
    } as never,
    createPluginConfigFixture(),
    createLoggerFixture()
  );

  await adapter.compact({
    sessionId: 'session-compact-trigger',
    sessionFile: 'session-compact-trigger.jsonl',
    tokenBudget: 1000,
    force: true
  });

  assert.equal(checkpointRequests.length, 1);
  assert.equal(skillRequests.length, 1);
  assert.equal(checkpointRequests[0]?.triggerSource, 'compact');
  assert.equal(checkpointRequests[0]?.triggerCompressionMode, 'full');
  assert.equal(skillRequests[0]?.triggerSource, 'compact');
  assert.equal(skillRequests[0]?.triggerCompressionMode, 'full');
});

test('bootstrap replays transcript history through ingest before runtime assembly', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'compact-context-bootstrap-'));
  const sessionFile = join(tempDir, 'session-bootstrap.jsonl');
  const ingestedInputs: Array<{
    sessionId: string;
    records: Array<{
      sourceType?: string;
      role?: string;
      provenance?: {
        sourceStage?: string;
      };
    }>;
  }> = [];

  try {
    await writeFile(
      sessionFile,
      [
        JSON.stringify({
          type: 'session',
          id: 'session-bootstrap',
          timestamp: '2026-03-19T09:00:00.000Z'
        }),
        JSON.stringify({
          id: 'message-bootstrap-1',
          type: 'message',
          timestamp: '2026-03-19T09:00:01.000Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'first bootstrap question' }]
          }
        })
      ].join('\n'),
      'utf8'
    );

    const adapter = new OpenClawContextEngineAdapter(
      {
        get: async () =>
          ({
            getLatestCheckpoint: async () => undefined,
            ingest: async (input: { sessionId: string; records: Array<Record<string, unknown>> }) => {
              ingestedInputs.push(input);
              return {
                candidateNodes: [],
                candidateEdges: [],
                persistedNodeIds: [],
                persistedEdgeIds: [],
                warnings: []
              };
            }
          }) as never
      } as never,
      createPluginConfigFixture(),
      createLoggerFixture()
    );

    const result = await adapter.bootstrap({
      sessionId: 'session-bootstrap',
      sessionFile
    });

    assert.equal(result.bootstrapped, true);
    assert.equal(result.importedMessages, 1);
    assert.equal(ingestedInputs.length, 1);
    assert.equal(ingestedInputs[0]?.sessionId, 'session-bootstrap');
    assert.equal(ingestedInputs[0]?.records.length, 1);
    assert.equal(ingestedInputs[0]?.records[0]?.sourceType, 'conversation');
    assert.equal(ingestedInputs[0]?.records[0]?.role, 'user');
    assert.equal(ingestedInputs[0]?.records[0]?.provenance?.sourceStage, 'transcript_message');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('assemble only materializes derived runtime bundle artifacts beyond ingested raw facts', async () => {
  const engine = new ContextEngine();
  const adapter = new OpenClawContextEngineAdapter(
    {
      get: async () => engine,
      recordRuntimeWindowSnapshot: async () => undefined
    } as never,
    createPluginConfigFixture(),
    createLoggerFixture()
  );

  const sessionId = 'session-assemble-derived-only';
  const messages = [
    ...createTurnMessages(1, 'first requirement', 'ack first requirement'),
    ...createTurnMessages(2, 'second requirement', 'ack second requirement'),
    {
      id: 'tool-2',
      role: 'toolResult',
      timestamp: '2026-03-19T10:00:05.000Z',
      content: [{ type: 'text', text: 'tool output says migration step 4 timed out' }]
    },
    ...createTurnMessages(3, 'third requirement', 'ack third requirement')
  ];

  await adapter.assemble({
    sessionId,
    messages,
    tokenBudget: 1000
  });

  const nodes = await engine.queryNodes({ sessionId, limit: 500 });
  const runtimeBundleNodes = nodes.filter((node) => node.provenance?.sourceStage === 'runtime_bundle');
  const rawOrCompressedRuntimeBundleNodes = runtimeBundleNodes.filter(
    (node) => node.provenance?.originKind === 'raw' || node.provenance?.originKind === 'compressed'
  );

  assert.ok(runtimeBundleNodes.length > 0);
  assert.equal(rawOrCompressedRuntimeBundleNodes.length, 0);
  assert.equal(runtimeBundleNodes.some((node) => node.type === 'Evidence'), false);
  assert.ok(nodes.some((node) => node.provenance?.sourceStage === 'tool_output_raw'));

  await engine.close();
});

test('buildInspectRuntimeWindowPayload exposes live runtime snapshots when available', async () => {
  const payload = await buildInspectRuntimeWindowPayload(
    {
      sessionId: 'session-runtime-live'
    },
    {
      getRuntimeWindowSnapshot: (sessionId: string) =>
        sessionId === 'session-runtime-live'
          ? {
              sessionId,
              capturedAt: '2026-03-15T12:00:00.000Z',
              query: 'how is the current runtime window built',
              totalBudget: 1200,
              recentRawMessageCount: 3,
              recentRawTurnCount: 2,
              compressedCount: 2,
              preservedConversationCount: 3,
              compressionMode: 'incremental',
              inboundMessages: [
                {
                  id: 'msg-user-1',
                  role: 'user',
                  content: [{ type: 'text', text: 'first user question' }],
                  timestamp: '2026-03-15T11:59:00.000Z'
                },
                {
                  id: 'msg-assistant-1',
                  role: 'assistant',
                  content: [
                    { type: 'thinking', thinking: '...' },
                    { type: 'toolCall', id: 'tool-1', name: 'read', arguments: { path: 'README.md' } }
                  ],
                  timestamp: '2026-03-15T11:59:05.000Z'
                },
                {
                  id: 'msg-tool-1',
                  role: 'toolResult',
                  content: [{ type: 'text', text: 'tool output preview' }],
                  timestamp: '2026-03-15T11:59:06.000Z'
                }
              ],
              preferredMessages: [
                {
                  id: 'msg-assistant-1',
                  role: 'assistant',
                  content: [{ type: 'toolCall', id: 'tool-1', name: 'read', arguments: { path: 'README.md' } }]
                },
                {
                  id: 'msg-tool-1',
                  role: 'toolResult',
                  content: [{ type: 'text', text: 'tool output preview' }]
                }
              ],
              finalMessages: [
                {
                  id: 'msg-tool-1',
                  role: 'toolResult',
                  content: [{ type: 'text', text: 'tool output preview' }]
                }
              ],
              systemPromptAddition: '[Compact Context Engine]\\nGoal: inspect runtime window',
              estimatedTokens: 88
            }
          : undefined,
      getPersistedRuntimeWindowSnapshot: async () => undefined,
      resolveSessionFile: async () => undefined
    },
    createPluginConfigFixture()
  );

  assert.equal(payload.source, 'live_runtime');
  assert.equal(payload.sessionId, 'session-runtime-live');
  assert.equal(payload.counts.inbound, 3);
  assert.equal(payload.counts.preferred, 2);
  assert.equal(payload.counts.final, 1);
  assert.equal(payload.compressedCount, 2);
  assert.equal(payload.finalSummary[0]?.role, 'tool');
  assert.deepEqual(payload.inboundSummary[1]?.toolCalls, [{ id: 'tool-1', name: 'read' }]);
  assert.equal(payload.window.version, 'runtime_context_window.v1');
  assert.equal(Array.isArray(payload.window.inbound.messages), true);
  assert.equal(Array.isArray(payload.window.preferred.messages), true);
  assert.equal(Array.isArray(payload.window.final.messages), true);
  assert.equal(payload.window.latestPointers.latestAssistantMessageId, 'msg-assistant-1');
  assert.deepEqual(payload.window.latestPointers.latestToolResultIds, ['msg-tool-1']);
  assert.equal(payload.toolCallResultPairs[0]?.toolCallId, 'tool-1');
  assert.equal(payload.toolCallResultPairs[0]?.matchKind, 'sequence_fallback');
  assert.equal(payload.promptAssembly.version, 'prompt_assembly.v1');
  assert.deepEqual(payload.promptAssembly.providerNeutralOutputs, [
    'messages',
    'systemPromptAddition',
    'estimatedTokens'
  ]);
  assert.deepEqual(payload.promptAssembly.hostAssemblyResponsibilities, [
    'merge systemPromptAddition into the host system/instructions layer',
    'assemble provider-specific system/messages/tools payloads',
    'preserve finalMessages ordering when sending the runtime window to the model'
  ]);
  assert.deepEqual(payload.promptAssembly.debugOnlyFields, [
    'runtimeWindow.inbound',
    'runtimeWindow.preferred',
    'runtimeWindow.latestPointers',
    'runtimeWindow.toolCallResultPairs'
  ]);
  assert.equal(payload.promptAssembly.includesSystemPromptAddition, true);
  assert.match(String(payload.systemPromptAddition), /\[Compact Context Engine\]/);
});

test('buildInspectRuntimeWindowPayload prefers persisted snapshots before transcript fallback', async () => {
  const payload = await buildInspectRuntimeWindowPayload(
    {
      sessionId: 'session-runtime-persisted'
    },
    {
      getRuntimeWindowSnapshot: () => undefined,
      getPersistedRuntimeWindowSnapshot: async (sessionId: string) =>
        sessionId === 'session-runtime-persisted'
          ? {
              sessionId,
              capturedAt: '2026-03-15T12:05:00.000Z',
              query: 'inspect persisted runtime window',
              totalBudget: 800,
              recentRawMessageCount: 2,
              recentRawTurnCount: 1,
              compressedCount: 1,
              preservedConversationCount: 2,
              compressionMode: 'incremental',
              inboundMessages: [
                {
                  id: 'persisted-user-1',
                  role: 'user',
                  content: [{ type: 'text', text: 'persisted question' }]
                },
                {
                  id: 'persisted-assistant-1',
                  role: 'assistant',
                  content: [{ type: 'toolCall', id: 'tool-persisted-1', name: 'grep', arguments: { pattern: 'TODO' } }]
                },
                {
                  id: 'persisted-tool-1',
                  role: 'toolResult',
                  toolCallId: 'tool-persisted-1',
                  content: [{ type: 'text', text: 'persisted tool output' }]
                }
              ],
              preferredMessages: [
                {
                  id: 'persisted-assistant-1',
                  role: 'assistant',
                  content: [{ type: 'toolCall', id: 'tool-persisted-1', name: 'grep', arguments: { pattern: 'TODO' } }]
                },
                {
                  id: 'persisted-tool-1',
                  role: 'toolResult',
                  toolCallId: 'tool-persisted-1',
                  content: [{ type: 'text', text: 'persisted tool output' }]
                }
              ],
              finalMessages: [
                {
                  id: 'persisted-tool-1',
                  role: 'toolResult',
                  toolCallId: 'tool-persisted-1',
                  content: [{ type: 'text', text: 'persisted tool output' }]
                }
              ],
              systemPromptAddition: '[Compact Context Engine]\\nIntent: inspect persisted runtime window',
              estimatedTokens: 64
            }
          : undefined,
      resolveSessionFile: async () => undefined
    },
    createPluginConfigFixture()
  );

  assert.equal(payload.source, 'persisted_snapshot');
  assert.equal(payload.window.source, 'persisted_snapshot');
  assert.equal(payload.toolCallResultPairs[0]?.matchKind, 'tool_call_id');
  assert.equal(payload.toolCallResultPairs[0]?.resultMessageId, 'persisted-tool-1');
  assert.equal(payload.promptAssembly.finalMessageCount, 1);
});

test('buildInspectRuntimeWindowPayload falls back to transcript messages when no live snapshot exists', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'compact-context-runtime-window-'));
  const sessionFile = join(tempDir, 'session-runtime-fallback.jsonl');

  await writeFile(
    sessionFile,
    [
      JSON.stringify({
        type: 'session',
        version: 3,
        id: 'session-runtime-fallback',
        timestamp: '2026-03-15T12:10:00.000Z',
        cwd: 'D:\\workspace'
      }),
      JSON.stringify({
        type: 'message',
        id: 'user-1',
        timestamp: '2026-03-15T12:10:01.000Z',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'please inspect the runtime context window' }]
        }
      }),
      JSON.stringify({
        type: 'message',
        id: 'assistant-1',
        parentId: 'user-1',
        timestamp: '2026-03-15T12:10:02.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'I will inspect the runtime context window.' }]
        }
      }),
      JSON.stringify({
        type: 'message',
        id: 'user-2',
        parentId: 'assistant-1',
        timestamp: '2026-03-15T12:10:03.000Z',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'show the latest raw messages only' }]
        }
      })
    ].join('\n'),
    'utf8'
  );

  const payload = await buildInspectRuntimeWindowPayload(
    {
      sessionId: 'session-runtime-fallback',
      tokenBudget: 1000
    },
    {
      getRuntimeWindowSnapshot: () => undefined,
      getPersistedRuntimeWindowSnapshot: async () => undefined,
      resolveSessionFile: async () => sessionFile
    },
    {
      ...createPluginConfigFixture(),
      recentRawMessageCount: 2
    }
  );

  assert.equal(payload.source, 'transcript_fallback');
  assert.equal(payload.counts.inbound, 3);
  assert.equal(payload.compressedCount, 0);
  assert.equal(payload.recentRawTurnCount, 2);
  assert.equal(payload.counts.preferred, 3);
  assert.equal(payload.inboundSummary[0]?.role, 'user');
  assert.equal(payload.window.latestPointers.latestUserMessageId, 'user-2');
  assert.equal(payload.promptAssembly.includesSystemPromptAddition, false);
  assert.match(String(payload.preferredSummary[0]?.preview), /inspect the runtime context window/i);
});

function createTurnMessages(turn: number, userText: string, assistantText: string) {
  return [
    {
      id: `user-${turn}`,
      role: 'user',
      content: [{ type: 'text', text: userText }]
    },
    {
      id: `assistant-${turn}`,
      role: 'assistant',
      content: [{ type: 'text', text: assistantText }]
    }
  ];
}

function assertCompressionLayersDoNotOverlap(state: {
  baseline?: { derivedFrom: readonly string[] };
  incremental?: { derivedFrom: readonly string[] };
  rawTail: { turns: Array<{ messageIds: readonly string[] }> };
}) {
  const baselineIds = new Set(state.baseline?.derivedFrom ?? []);
  const incrementalIds = new Set(state.incremental?.derivedFrom ?? []);
  const rawTailIds = new Set(state.rawTail.turns.flatMap((turn) => [...turn.messageIds]));

  for (const value of baselineIds) {
    assert.equal(incrementalIds.has(value), false);
    assert.equal(rawTailIds.has(value), false);
  }

  for (const value of incrementalIds) {
    assert.equal(rawTailIds.has(value), false);
  }
}

function createBundleFixture(): RuntimeContextBundle {
  return {
    id: 'bundle-format-1',
    sessionId: 'session-format-1',
    query: 'why is the current step missing',
    goal: {
      nodeId: 'goal-1',
      type: 'Goal',
      label: 'goal:keep diagnostics visible',
      scope: 'session',
      kind: 'fact',
      strength: 'hard',
      reason: 'current goal match (raw:transcript_message)',
      estimatedTokens: 12
    },
    activeRules: [],
    activeConstraints: [],
    recentDecisions: [],
    recentStateChanges: [],
    relevantEvidence: [],
    candidateSkills: [],
    openRisks: [
      {
        nodeId: 'risk-1',
        type: 'Risk',
        label: 'risk:build blocked by sqlite timeout',
        scope: 'session',
        kind: 'inference',
        strength: 'soft',
        reason: 'open risk (raw:tool_output_raw)',
        estimatedTokens: 14
      }
    ],
    tokenBudget: {
      total: 120,
      used: 48,
      reserved: 72
    },
    diagnostics: {
      fixed: {
        selected: [
          {
            nodeId: 'goal-1',
            type: 'Goal',
            label: 'goal:keep diagnostics visible',
            estimatedTokens: 12,
            reason: 'selected as fixed goal context'
          }
        ],
        skipped: [
          {
            nodeId: 'step-1',
            type: 'Step',
            label: 'workflow:produce a long current process explanation',
            estimatedTokens: 60,
            reason: 'skipped fixed current process because total budget was exhausted'
          }
        ]
      },
      categoryBudgets: {
        activeRules: 12,
        activeConstraints: 14,
        openRisks: 12,
        recentDecisions: 10,
        recentStateChanges: 10,
        relevantEvidence: 18,
        candidateSkills: 8
      },
      categories: [
        {
          category: 'activeRules',
          allocatedBudget: 12,
          inputCount: 0,
          selectedCount: 0,
          skippedCount: 0,
          selectedTokens: 0,
          refillSelectedCount: 0,
          selected: [],
          skipped: []
        },
        {
          category: 'activeConstraints',
          allocatedBudget: 14,
          inputCount: 0,
          selectedCount: 0,
          skippedCount: 0,
          selectedTokens: 0,
          refillSelectedCount: 0,
          selected: [],
          skipped: []
        },
        {
          category: 'openRisks',
          allocatedBudget: 12,
          inputCount: 1,
          selectedCount: 1,
          skippedCount: 0,
          selectedTokens: 14,
          refillSelectedCount: 0,
          selected: [
            {
              nodeId: 'risk-1',
              type: 'Risk',
              label: 'risk:build blocked by sqlite timeout',
              estimatedTokens: 14,
              reason: 'selected within category budget'
            }
          ],
          skipped: []
        },
        {
          category: 'recentDecisions',
          allocatedBudget: 10,
          inputCount: 0,
          selectedCount: 0,
          skippedCount: 0,
          selectedTokens: 0,
          refillSelectedCount: 0,
          selected: [],
          skipped: []
        },
        {
          category: 'recentStateChanges',
          allocatedBudget: 10,
          inputCount: 0,
          selectedCount: 0,
          skippedCount: 0,
          selectedTokens: 0,
          refillSelectedCount: 0,
          selected: [],
          skipped: []
        },
        {
          category: 'relevantEvidence',
          allocatedBudget: 18,
          inputCount: 4,
          selectedCount: 1,
          skippedCount: 3,
          selectedTokens: 16,
          refillSelectedCount: 0,
          selected: [
            {
              nodeId: 'evidence-1',
              type: 'Evidence',
              label: 'evidence:first compact note',
              estimatedTokens: 16,
              reason: 'selected within category budget'
            }
          ],
          skipped: [
            {
              nodeId: 'evidence-2',
              type: 'Evidence',
              label: 'evidence:second note',
              estimatedTokens: 16,
              reason: 'skipped because total budget was exhausted'
            }
          ]
        },
        {
          category: 'candidateSkills',
          allocatedBudget: 8,
          inputCount: 0,
          selectedCount: 0,
          skippedCount: 0,
          selectedTokens: 0,
          refillSelectedCount: 0,
          selected: [],
          skipped: []
        }
      ]
    },
    createdAt: '2026-03-13T12:00:00.000Z'
  };
}

function createPluginConfigFixture() {
  return {
    defaultTokenBudget: 12000,
    compileBudgetRatio: 0.3,
    enableGatewayMethods: true,
    recentRawMessageCount: 8
  };
}

type GatewayRespond = (ok: boolean, data?: unknown, error?: unknown) => void;

async function invokeGatewayHandler(
  handler: (options: { params: Record<string, unknown>; respond: GatewayRespond }) => Promise<void>,
  params: Record<string, unknown>
): Promise<{ ok: boolean; data?: unknown; error?: unknown }> {
  let response: { ok: boolean; data?: unknown; error?: unknown } | undefined;

  await handler({
    params,
    respond: (ok, data, error) => {
      response = { ok, data, error };
    }
  });

  assert.ok(response);
  return response;
}

function createLoggerFixture() {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined
  };
}

function createControlPlaneFacadeFixture() {
  return new ControlPlaneFacade(
    new GovernanceService(),
    new ObservabilityService(),
    new ImportService(),
    buildDefaultImporterRegistry()
  );
}



