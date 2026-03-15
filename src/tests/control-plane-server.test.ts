import test from 'node:test';
import assert from 'node:assert/strict';

import { ControlPlaneFacade } from '../control-plane/control-plane-facade.js';
import { GovernanceService } from '../control-plane/governance-service.js';
import { ImportService } from '../control-plane/import-service.js';
import { buildDefaultImporterRegistry } from '../control-plane/importer-registry.js';
import { ObservabilityService } from '../control-plane/observability-service.js';
import { ControlPlaneHttpServer } from '../control-plane/server.js';
import type { AgentMessageLike } from '../openclaw/types.js';

test('control-plane http server exposes health, catalog, dashboard, and runtime snapshot routes', async (t) => {
  const liveMessages: AgentMessageLike[] = [
    {
      id: 'msg-user-1',
      role: 'user',
      timestamp: '2026-03-29T08:00:00.000Z',
      content: [{ type: 'text', text: 'show the current runtime window' }]
    },
    {
      id: 'msg-assistant-1',
      role: 'assistant',
      timestamp: '2026-03-29T08:00:05.000Z',
      content: [{ type: 'text', text: 'here is the latest runtime snapshot' }]
    }
  ];
  const runtime = {
    async get() {
      return {
        explain: async (request: { nodeId: string }) => ({
          nodeId: request.nodeId,
          summary: `explain:${request.nodeId}`
        }),
        ingest: async () => ({
          candidateNodes: [],
          candidateEdges: [],
          persistedNodeIds: [],
          persistedEdgeIds: [],
          warnings: []
        }),
        applyManualCorrections: async () => undefined
      } as any;
    },
    getRuntimeWindowSnapshot(sessionId: string) {
      if (sessionId !== 'session-live') {
        return undefined;
      }
      return {
        sessionId,
        capturedAt: '2026-03-29T08:00:10.000Z',
        query: 'show the current runtime window',
        totalBudget: 1200,
        recentRawMessageCount: 4,
        compressedCount: 1,
        preservedConversationCount: 2,
        inboundMessages: liveMessages,
        preferredMessages: liveMessages,
        finalMessages: liveMessages,
        systemPromptAddition: 'Goal: inspect the latest runtime context.',
        estimatedTokens: 240
      };
    },
    async getPersistedRuntimeWindowSnapshot() {
      return undefined;
    },
    async resolveSessionFile() {
      return undefined;
    },
    async listRuntimeWindowSnapshots() {
      return [this.getRuntimeWindowSnapshot('session-live')].filter(Boolean);
    }
  } as any;
  const facade = new ControlPlaneFacade(
    new GovernanceService(),
    new ObservabilityService(),
    new ImportService(),
    buildDefaultImporterRegistry()
  );
  const server = new ControlPlaneHttpServer(
    runtime,
    facade,
    {
      dbPath: undefined,
      defaultTokenBudget: 12000,
      compileBudgetRatio: 0.3,
      enableGatewayMethods: false,
      recentRawMessageCount: 8
    },
    {
      info() {},
      warn() {},
      error() {}
    }
  );

  const address = await server.start({ host: '127.0.0.1', port: 0 });
  t.after(async () => {
    await server.close();
  });

  const health = (await fetch(`http://${address.host}:${address.port}/api/health`).then((response) =>
    response.json()
  )) as Record<string, any>;
  const catalog = (await fetch(`http://${address.host}:${address.port}/api/import/catalog`).then((response) =>
    response.json()
  )) as Record<string, any>;
  const dashboard = (await fetch(`http://${address.host}:${address.port}/api/observability/dashboard`).then((response) =>
    response.json()
  )) as Record<string, any>;
  const thresholds = (await fetch(`http://${address.host}:${address.port}/api/observability/thresholds?stage=default`).then((response) =>
    response.json()
  )) as Record<string, any>;
  const snapshots = (await fetch(`http://${address.host}:${address.port}/api/runtime/snapshots`).then((response) =>
    response.json()
  )) as Record<string, any>;
  const templates = (await fetch(`http://${address.host}:${address.port}/api/governance/templates`).then((response) =>
    response.json()
  )) as Record<string, any>;
  const aliases = (await fetch(`http://${address.host}:${address.port}/api/workbench/aliases`).then((response) =>
    response.json()
  )) as Record<string, any>;

  assert.equal(health.ok, true);
  assert.equal(Array.isArray(health.apiBoundary), true);
  assert.equal(catalog.catalog.supportedSourceKinds.includes('document'), true);
  assert.equal(dashboard.payload.dashboard.metricCards.length > 0, true);
  assert.equal(thresholds.record, undefined);
  assert.equal(snapshots.payloads.length, 1);
  assert.equal(snapshots.payloads[0]?.window.sessionId, 'session-live');
  assert.equal(templates.templates.length >= 3, true);
  assert.equal(Array.isArray(aliases.payload), true);
});

test('control-plane http server supports governance batch actions and observability subscriptions', async (t) => {
  const runtime = {
    async get() {
      return {
        explain: async () => ({ ok: true }),
        ingest: async () => ({
          candidateNodes: [],
          candidateEdges: [],
          persistedNodeIds: [],
          persistedEdgeIds: [],
          warnings: []
        }),
        applyManualCorrections: async () => undefined,
        queryNodes: async () => [],
        listSkillCandidates: async () => []
      } as any;
    },
    getRuntimeWindowSnapshot() {
      return undefined;
    },
    async getPersistedRuntimeWindowSnapshot() {
      return undefined;
    },
    async resolveSessionFile() {
      return undefined;
    },
    async listRuntimeWindowSnapshots() {
      return [];
    }
  } as any;
  const facade = new ControlPlaneFacade(
    new GovernanceService(),
    new ObservabilityService(),
    new ImportService(),
    buildDefaultImporterRegistry()
  );
  const server = new ControlPlaneHttpServer(
    runtime,
    facade,
    {
      dbPath: undefined,
      defaultTokenBudget: 12000,
      compileBudgetRatio: 0.3,
      enableGatewayMethods: false,
      recentRawMessageCount: 8
    },
    {
      info() {},
      warn() {},
      error() {}
    }
  );

  const address = await server.start({ host: '127.0.0.1', port: 0 });
  t.after(async () => {
    await server.close();
  });

  const batchSubmit = (await fetch(`http://${address.host}:${address.port}/api/governance/proposals/batch`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          targetScope: 'workspace',
          reason: 'batch proposal',
          corrections: [
            {
              id: 'corr-1',
              targetKind: 'concept_alias',
              targetId: 'knowledge_graph',
              action: 'apply',
              reason: 'batch proposal',
              author: 'tester',
              createdAt: '2026-04-22T10:00:00.000Z',
              metadata: {
                alias: 'kg-console'
              }
            }
          ]
        }
      ]
    })
  }).then((response) => response.json())) as Record<string, any>;

  const subscription = (await fetch(`http://${address.host}:${address.port}/api/observability/subscriptions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      stage: 'stage-8',
      channel: 'console',
      target: 'ops'
    })
  }).then((response) => response.json())) as Record<string, any>;

  const historyPage = (await fetch(`http://${address.host}:${address.port}/api/observability/history/page?stage=stage-8&limit=10`).then((response) =>
    response.json()
  )) as Record<string, any>;

  assert.equal(batchSubmit.payload.succeededIds.length, 1);
  assert.equal(subscription.subscription.channel, 'console');
  assert.equal(historyPage.payload.limit, 10);
});

test('control-plane http server exposes stage-9 extension, autonomy, workspace, and platform routes', async (t) => {
  const runtime = {
    async get() {
      return {
        explain: async () => ({ ok: true }),
        ingest: async () => ({
          candidateNodes: [],
          candidateEdges: [],
          persistedNodeIds: [],
          persistedEdgeIds: [],
          warnings: []
        }),
        applyManualCorrections: async () => undefined,
        queryNodes: async () => [],
        listSkillCandidates: async () => []
      } as any;
    },
    getRuntimeWindowSnapshot() {
      return undefined;
    },
    async getPersistedRuntimeWindowSnapshot() {
      return undefined;
    },
    async resolveSessionFile() {
      return undefined;
    },
    async listRuntimeWindowSnapshots() {
      return [];
    }
  } as any;
  const facade = new ControlPlaneFacade(
    new GovernanceService(),
    new ObservabilityService(),
    new ImportService(),
    buildDefaultImporterRegistry()
  );
  const server = new ControlPlaneHttpServer(
    runtime,
    facade,
    {
      dbPath: undefined,
      defaultTokenBudget: 12000,
      compileBudgetRatio: 0.3,
      enableGatewayMethods: false,
      recentRawMessageCount: 8
    },
    {
      info() {},
      warn() {},
      error() {}
    }
  );

  const address = await server.start({ host: '127.0.0.1', port: 0 });
  t.after(async () => {
    await server.close();
  });

  const webhook = (await fetch(`http://${address.host}:${address.port}/api/platform/webhooks/subscriptions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      target: 'https://example.com/platform-webhook',
      eventTypes: ['extension.registered', 'autonomy.recommendations_generated', 'workspace.policy_saved']
    })
  }).then((response) => response.json())) as Record<string, any>;

  const extension = (await fetch(`http://${address.host}:${address.port}/api/extensions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      id: 'custom.extension.stage9',
      label: 'Stage 9 Extension',
      description: 'custom extension route coverage',
      kind: 'sdk',
      source: 'local',
      version: '1.0.0',
      apiVersion: 'control-plane-extension.v1',
      providerNeutral: true,
      capabilities: ['sdk_client']
    })
  }).then((response) => response.json())) as Record<string, any>;

  const extensions = (await fetch(`http://${address.host}:${address.port}/api/extensions`).then((response) =>
    response.json()
  )) as Record<string, any>;
  const negotiation = (await fetch(`http://${address.host}:${address.port}/api/extensions/negotiate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      extensionId: 'custom.extension.stage9',
      requestedApiVersion: 'control-plane-extension.v1',
      requiredCapabilities: ['sdk_client']
    })
  }).then((response) => response.json())) as Record<string, any>;

  const importJob = (await fetch(`http://${address.host}:${address.port}/api/import/jobs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: 'stage-9-session',
      workspaceId: 'workspace-alpha',
      sourceKind: 'document',
      input: {
        sessionId: 'stage-9-session',
        workspaceId: 'workspace-alpha',
        records: [
          {
            id: 'record-stage9-1',
            scope: 'workspace',
            sourceType: 'document',
            role: 'system',
            content: 'workspace alpha import'
          }
        ]
      }
    })
  }).then((response) => response.json())) as Record<string, any>;

  const workspacePolicy = (await fetch(`http://${address.host}:${address.port}/api/workspaces/policies`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      workspaceId: 'workspace-alpha',
      isolationMode: 'isolated',
      authorityMode: 'workspace_reviewer',
      sharedGlobalRead: true,
      sharedGlobalWrite: false
    })
  }).then((response) => response.json())) as Record<string, any>;

  const workspaces = (await fetch(`http://${address.host}:${address.port}/api/workspaces`).then((response) =>
    response.json()
  )) as Record<string, any>;
  const workspaceSummary = (await fetch(`http://${address.host}:${address.port}/api/workspaces/workspace-alpha`).then((response) =>
    response.json()
  )) as Record<string, any>;
  const workspaceAggregate = (await fetch(`http://${address.host}:${address.port}/api/workspaces/aggregate`).then((response) =>
    response.json()
  )) as Record<string, any>;

  const globalProposal = (await fetch(`http://${address.host}:${address.port}/api/governance/proposals`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-control-plane-authority': 'global_reviewer'
    },
    body: JSON.stringify({
      targetScope: 'global',
      reason: 'global governance review coverage',
      corrections: []
    })
  }).then((response) => response.json())) as Record<string, any>;

  const globalReview = (await fetch(`http://${address.host}:${address.port}/api/governance/global/review`).then((response) =>
    response.json()
  )) as Record<string, any>;
  const lifecyclePolicy = (await fetch(`http://${address.host}:${address.port}/api/governance/lifecycle-policies`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      scope: 'global',
      label: 'global policy',
      decayDays: 30,
      retireDays: 90,
      refreshDays: 14
    })
  }).then((response) => response.json())) as Record<string, any>;
  const recovery = (await fetch(`http://${address.host}:${address.port}/api/governance/global/recovery`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      proposalIds: [globalProposal.proposal.id]
    })
  }).then((response) => response.json())) as Record<string, any>;

  const recommendations = (await fetch(`http://${address.host}:${address.port}/api/autonomy/recommendations?stage=stage-9`).then((response) =>
    response.json()
  )) as Record<string, any>;
  const simulation = (await fetch(`http://${address.host}:${address.port}/api/autonomy/simulate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      recommendations: recommendations.payload.recommendations
    })
  }).then((response) => response.json())) as Record<string, any>;

  const platformEvents = (await fetch(`http://${address.host}:${address.port}/api/platform/events`).then((response) =>
    response.json()
  )) as Record<string, any>;
  const eventStreamResponse = await fetch(`http://${address.host}:${address.port}/api/platform/events/stream?limit=5`);
  const eventStream = await eventStreamResponse.text();
  const deliveries = (await fetch(`http://${address.host}:${address.port}/api/platform/webhooks/deliveries`).then((response) =>
    response.json()
  )) as Record<string, any>;

  assert.equal(webhook.payload.target, 'https://example.com/platform-webhook');
  assert.equal(extension.manifest.id, 'custom.extension.stage9');
  assert.equal(extensions.extensions.some((item: { id: string }) => item.id === 'custom.extension.stage9'), true);
  assert.equal(negotiation.payload.compatible, true);
  assert.equal(importJob.job.workspaceId, 'workspace-alpha');
  assert.equal(workspacePolicy.payload.workspaceId, 'workspace-alpha');
  assert.equal(workspaces.payload.some((item: { workspaceId: string }) => item.workspaceId === 'workspace-alpha'), true);
  assert.equal(workspaceSummary.payload.workspaceId, 'workspace-alpha');
  assert.equal(workspaceAggregate.payload.workspaceCount >= 1, true);
  assert.equal(globalReview.payload.pendingGlobalProposalIds.includes(globalProposal.proposal.id), true);
  assert.equal(lifecyclePolicy.policy.scope, 'global');
  assert.equal(recovery.payload.rollbackProposalIds.includes(globalProposal.proposal.id), true);
  assert.equal(Array.isArray(recommendations.payload.recommendations), true);
  assert.equal(['low', 'medium', 'high'].includes(simulation.payload.riskLevel), true);
  assert.equal(platformEvents.payload.length > 0, true);
  assert.equal(eventStream.includes('event:'), true);
  assert.equal(deliveries.payload.length > 0, true);
});
