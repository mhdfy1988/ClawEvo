import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { CoreLogger } from '../types/logging.js';
import type {
  ControlPlaneFacadeContract,
  ControlPlaneRuntimeEngineContract,
  ControlPlaneRuntimeReadModelContract,
  ControlPlaneRequestContext,
  ControlPlaneRuntimeSnapshotRef,
  GovernanceAuthority,
  PlatformEventRecord
} from './contracts.js';
import { renderControlPlaneConsole } from './console.js';

export interface ControlPlaneHttpServerOptions {
  host?: string;
  port?: number;
}

export class ControlPlaneHttpServer {
  private server?: Server;

  constructor(
    private readonly runtime: ControlPlaneRuntimeReadModelContract,
    private readonly facade: ControlPlaneFacadeContract,
    private readonly logger: CoreLogger
  ) {}

  async start(options: ControlPlaneHttpServerOptions = {}): Promise<{ host: string; port: number }> {
    if (this.server) {
      const address = this.server.address();
      if (address && typeof address === 'object') {
        return {
          host: address.address,
          port: address.port
        };
      }
    }

    const host = options.host ?? '127.0.0.1';
    const port = options.port ?? 3210;
    this.server = createServer((request, response) => {
      void this.handleRequest(request, response);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(port, host, () => resolve());
    });

    const address = this.server.address();
    const resolvedHost = address && typeof address === 'object' ? address.address : host;
    const resolvedPort = address && typeof address === 'object' ? address.port : port;

    this.logger.info('[compact-context] control-plane server started', {
      host: resolvedHost,
      port: resolvedPort
    });

    return {
      host: resolvedHost,
      port: resolvedPort
    };
  }

  async close(): Promise<void> {
    if (!this.server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.server?.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    this.server = undefined;
  }

  private recordPlatformEvent(input: Parameters<ControlPlaneFacadeContract['recordPlatformEvent']>[0]): void {
    try {
      this.facade.recordPlatformEvent(input);
    } catch (error) {
      this.logger.warn('[compact-context] control-plane event emission failed', {
        err: error instanceof Error ? error.message : String(error),
        type: input.type
      });
    }
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const method = request.method ?? 'GET';
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');

      if (method === 'GET' && url.pathname === '/') {
        writeHtml(response, renderControlPlaneConsole());
        return;
      }

      if (!url.pathname.startsWith('/api/')) {
        writeJson(response, 404, { ok: false, error: 'not_found' });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/health') {
        writeJson(response, 200, {
          ok: true,
          apiBoundary: this.facade.apiBoundary,
          readonlySources: this.facade.readonlySources,
          importerCount: this.facade.listImporters().length,
          extensionCount: this.facade.listExtensions().length
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/runtime/snapshots') {
        const sessionId = url.searchParams.get('sessionId');
        if (sessionId) {
          const payload = await this.runtime.inspectRuntimeWindow({
            sessionId,
            ...(url.searchParams.get('tokenBudget') ? { tokenBudget: Number(url.searchParams.get('tokenBudget')) } : {})
          });
          writeJson(response, 200, { ok: true, payload });
          return;
        }

        const payloads = await this.runtime.listRuntimeWindows(readOptionalInt(url.searchParams.get('limit')) ?? 10);
        writeJson(response, 200, { ok: true, payloads });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/runtime/explain') {
        const body = await readJsonBody(request);
        const engine = await this.runtime.getEngine();
        const payload = await engine.explain({
          nodeId: typeof body.nodeId === 'string' ? body.nodeId : '',
          ...(body.selectionContext && typeof body.selectionContext === 'object'
            ? { selectionContext: body.selectionContext }
            : {})
        });
        writeJson(response, 200, { ok: true, payload });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/observability/dashboard') {
        const payload = await this.runtime.inspectObservabilityDashboard(
          {
            stage: url.searchParams.get('stage') ?? undefined,
            limit: readOptionalInt(url.searchParams.get('limit')) ?? undefined
          },
          this.facade
        );
        writeJson(response, 200, { ok: true, payload });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/observability/snapshots') {
        const body = await readJsonBody(request);
        const payload = await this.runtime.inspectObservabilityDashboard(
          {
            stage: body.stage,
            sessionIds: body.sessionIds,
            limit: body.limit
          },
          this.facade
        );
        const snapshot = this.facade.recordDashboardSnapshot({
          stage: payload.stage,
          sessionIds: payload.sessionIds,
          windowCount: payload.windowCount,
          dashboard: payload.dashboard,
          capturedAt: body.capturedAt
        });
        this.recordPlatformEvent({
          type: 'observability.snapshot_recorded',
          resourceId: snapshot.id,
          stage: snapshot.stage,
          payload: {
            sessionIds: snapshot.sessionIds,
            windowCount: snapshot.windowCount
          }
        });
        writeJson(response, 200, { ok: true, snapshot });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/observability/history') {
        const snapshots = this.facade.listDashboardSnapshots({
          stage: url.searchParams.get('stage') ?? undefined,
          limit: readOptionalInt(url.searchParams.get('limit')) ?? undefined
        });
        writeJson(response, 200, {
          ok: true,
          payload: this.facade.buildDashboardHistory({ snapshots })
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/observability/history/page') {
        writeJson(response, 200, {
          ok: true,
          payload: this.facade.listDashboardHistoryPage({
            stage: url.searchParams.get('stage') ?? undefined,
            offset: readOptionalInt(url.searchParams.get('offset')) ?? undefined,
            limit: readOptionalInt(url.searchParams.get('limit')) ?? undefined
          })
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/observability/thresholds') {
        writeJson(response, 200, {
          ok: true,
          record: this.facade.getObservabilityThresholds(url.searchParams.get('stage') ?? 'default')
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/observability/thresholds') {
        const body = await readJsonBody(request);
        writeJson(response, 200, {
          ok: true,
          record: this.facade.saveObservabilityThresholds({
            stage: body.stage ?? 'default',
            thresholds: body.thresholds ?? {},
            ...(body.savedAt ? { savedAt: body.savedAt } : {}),
            ...(body.savedBy ? { savedBy: body.savedBy } : {})
          })
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/observability/subscriptions') {
        writeJson(response, 200, {
          ok: true,
          subscriptions: this.facade.listAlertSubscriptions(url.searchParams.get('stage') ?? undefined)
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/observability/subscriptions') {
        const body = await readJsonBody(request);
        writeJson(response, 200, {
          ok: true,
          subscription: this.facade.createAlertSubscription({
            ...(body.stage ? { stage: body.stage } : {}),
            channel: body.channel,
            target: body.target,
            ...(body.minSeverity ? { minSeverity: body.minSeverity } : {}),
            ...(Array.isArray(body.metricKeys) ? { metricKeys: body.metricKeys } : {}),
            ...(body.createdAt ? { createdAt: body.createdAt } : {}),
            ...(body.createdBy ? { createdBy: body.createdBy } : {})
          })
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/observability/notifications') {
        writeJson(response, 200, {
          ok: true,
          notifications: this.facade.listAlertNotifications(readOptionalInt(url.searchParams.get('limit')) ?? undefined)
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/observability/compare') {
        const body = await readJsonBody(request);
        writeJson(response, 200, {
          ok: true,
          payload: this.facade.compareObservabilityReleases({
            baselineSnapshotId: body.baselineSnapshotId,
            candidateSnapshotId: body.candidateSnapshotId
          })
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/governance/proposals') {
        writeJson(response, 200, {
          ok: true,
          proposals: await this.facade.listProposals(readOptionalInt(url.searchParams.get('limit')) ?? undefined)
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/governance/templates') {
        writeJson(response, 200, {
          ok: true,
          templates: await this.facade.listGovernancePolicyTemplates()
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/governance/audit') {
        writeJson(response, 200, {
          ok: true,
          audit: await this.facade.listAuditRecords(readOptionalInt(url.searchParams.get('limit')) ?? undefined)
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/governance/global/review') {
        writeJson(response, 200, {
          ok: true,
          payload: await this.facade.buildGlobalGovernanceReview()
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/governance/global/recovery') {
        const body = await readJsonBody(request);
        writeJson(response, 200, {
          ok: true,
          payload: await this.facade.createPollutionRecoveryPlan({
            ...(Array.isArray(body.proposalIds) ? { proposalIds: body.proposalIds } : {}),
            ...(typeof body.limit === 'number' ? { limit: body.limit } : {})
          })
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/governance/lifecycle-policies') {
        writeJson(response, 200, {
          ok: true,
          policies: await this.facade.listKnowledgeLifecyclePolicies()
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/governance/lifecycle-policies') {
        const body = await readJsonBody(request);
        writeJson(response, 200, {
          ok: true,
          policy: await this.facade.saveKnowledgeLifecyclePolicy({
            scope: body.scope,
            label: body.label,
            decayDays: body.decayDays,
            retireDays: body.retireDays,
            refreshDays: body.refreshDays,
            ...(body.savedAt ? { savedAt: body.savedAt } : {}),
            ...(body.savedBy ? { savedBy: body.savedBy } : {})
          })
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/governance/proposals/bulk-rollback') {
        const body = await readJsonBody(request);
        const requestContext = readRequestContext(request, body.authority);
        const engine = await this.runtime.getEngine();
        const payload = await this.facade.bulkRollbackGovernanceProposals({
          proposalIds: Array.isArray(body.proposalIds) ? body.proposalIds : [],
          rolledBackBy: body.rolledBackBy ?? requestContext.actor,
          authority: requestContext.authority,
          ...(body.sessionId ? { runtimeSnapshot: await this.runtime.resolveRuntimeSnapshotRef(body.sessionId) } : {}),
          ...(body.rolledBackAt ? { rolledBackAt: body.rolledBackAt } : {}),
          ...(body.note ? { note: body.note } : {}),
          engine
        });
        this.recordPlatformEvent({
          type: 'governance.bulk_rolled_back',
          stage: 'stage-9',
          payload: {
            succeededIds: payload.succeededIds,
            requestedCount: payload.requestedCount
          }
        });
        writeJson(response, 200, { ok: true, payload });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/governance/preview') {
        const body = await readJsonBody(request);
        writeJson(response, 200, {
          ok: true,
          preview: await this.facade.previewGovernanceProposal({
            targetScope: body.targetScope,
            reason: body.reason ?? 'preview governance change',
            corrections: Array.isArray(body.corrections) ? body.corrections : []
          })
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/governance/conflicts') {
        const body = await readJsonBody(request);
        writeJson(response, 200, {
          ok: true,
          conflicts: await this.facade.detectGovernanceConflicts({
            targetScope: body.targetScope,
            corrections: Array.isArray(body.corrections) ? body.corrections : [],
            ...(typeof body.excludeProposalId === 'string' ? { excludeProposalId: body.excludeProposalId } : {})
          })
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/governance/proposals') {
        const body = await readJsonBody(request);
        const requestContext = readRequestContext(request, body.authority);
        const proposal = await this.facade.submitProposal({
          targetScope: body.targetScope,
          submittedBy: body.submittedBy ?? requestContext.actor,
          authority: requestContext.authority,
          reason: body.reason,
          corrections: body.corrections ?? [],
          ...(body.sessionId ? { contextSessionId: body.sessionId } : {}),
          ...(body.sessionId ? { runtimeSnapshot: await this.runtime.resolveRuntimeSnapshotRef(body.sessionId) } : {}),
          ...(body.submittedAt ? { submittedAt: body.submittedAt } : {})
        });
        this.recordPlatformEvent({
          type: 'governance.proposal_submitted',
          resourceId: proposal.id,
          sessionId: proposal.contextSessionId,
          payload: {
            targetScope: proposal.targetScope,
            submittedBy: proposal.submittedBy
          }
        });
        writeJson(response, 200, {
          ok: true,
          proposal
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/governance/proposals/batch') {
        const body = await readJsonBody(request);
        const requests = Array.isArray(body.requests) ? body.requests : [];
        const payload = await this.facade.submitProposalBatch({
          requests: await Promise.all(
            requests.map(async (item) => {
              const requestContext = readRequestContext(request, item.authority);
              return {
                targetScope: item.targetScope,
                submittedBy: item.submittedBy ?? requestContext.actor,
                authority: requestContext.authority,
                reason: item.reason,
                corrections: Array.isArray(item.corrections) ? item.corrections : [],
                ...(item.sessionId ? { contextSessionId: item.sessionId } : {}),
                ...(item.sessionId
                  ? { runtimeSnapshot: await this.runtime.resolveRuntimeSnapshotRef(item.sessionId) }
                  : {}),
                ...(item.submittedAt ? { submittedAt: item.submittedAt } : {})
              };
            })
          )
        });
        for (const proposal of payload.payloads) {
          this.recordPlatformEvent({
            type: 'governance.proposal_submitted',
            resourceId: proposal.id,
            sessionId: proposal.contextSessionId,
            payload: {
              targetScope: proposal.targetScope,
              submittedBy: proposal.submittedBy
            }
          });
        }
        writeJson(response, 200, {
          ok: true,
          payload
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/governance/proposals/batch/review') {
        const body = await readJsonBody(request);
        const requests = Array.isArray(body.requests) ? body.requests : [];
        const payload = await this.facade.reviewProposalBatch({
          requests: await Promise.all(
            requests.map(async (item) => {
              const requestContext = readRequestContext(request, item.authority);
              return {
                proposalId: item.proposalId,
                reviewedBy: item.reviewedBy ?? requestContext.actor,
                authority: requestContext.authority,
                decision: item.decision,
                ...(item.sessionId
                  ? { runtimeSnapshot: await this.runtime.resolveRuntimeSnapshotRef(item.sessionId) }
                  : {}),
                ...(item.reviewedAt ? { reviewedAt: item.reviewedAt } : {}),
                ...(item.note ? { note: item.note } : {})
              };
            })
          )
        });
        for (const proposal of payload.payloads) {
          this.recordPlatformEvent({
            type: 'governance.proposal_reviewed',
            resourceId: proposal.id,
            sessionId: proposal.contextSessionId,
            payload: {
              status: proposal.status,
              decision: proposal.review?.decision ?? null
            }
          });
        }
        writeJson(response, 200, {
          ok: true,
          payload
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/governance/proposals/batch/rollback') {
        const body = await readJsonBody(request);
        const engine = await this.runtime.getEngine();
        const requests = Array.isArray(body.requests) ? body.requests : [];
        const payload = await this.facade.rollbackProposalBatch({
          requests: await Promise.all(
            requests.map(async (item) => {
              const requestContext = readRequestContext(request, item.authority);
              return {
                proposalId: item.proposalId,
                rolledBackBy: item.rolledBackBy ?? requestContext.actor,
                authority: requestContext.authority,
                ...(item.sessionId
                  ? { runtimeSnapshot: await this.runtime.resolveRuntimeSnapshotRef(item.sessionId) }
                  : {}),
                ...(item.rolledBackAt ? { rolledBackAt: item.rolledBackAt } : {}),
                ...(item.note ? { note: item.note } : {})
              };
            })
          ),
          engine
        });
        this.recordPlatformEvent({
          type: 'governance.bulk_rolled_back',
          stage: 'stage-9',
          payload: {
            succeededIds: payload.succeededIds,
            requestedCount: payload.requestedCount
          }
        });
        writeJson(response, 200, {
          ok: true,
          payload
        });
        return;
      }

      const governanceMatch = matchGovernanceAction(url.pathname);
      if (method === 'POST' && governanceMatch) {
        const body = await readJsonBody(request);
        const requestContext = readRequestContext(request, body.authority);
        if (governanceMatch.action === 'review') {
          const proposal = await this.facade.reviewProposal({
            proposalId: governanceMatch.proposalId,
            reviewedBy: body.reviewedBy ?? requestContext.actor,
            authority: requestContext.authority,
            decision: body.decision,
            ...(body.sessionId ? { runtimeSnapshot: await this.runtime.resolveRuntimeSnapshotRef(body.sessionId) } : {}),
            ...(body.reviewedAt ? { reviewedAt: body.reviewedAt } : {}),
            ...(body.note ? { note: body.note } : {})
          });
          this.recordPlatformEvent({
            type: 'governance.proposal_reviewed',
            resourceId: proposal.id,
            sessionId: proposal.contextSessionId,
            payload: {
              status: proposal.status,
              decision: proposal.review?.decision ?? null
            }
          });
          writeJson(response, 200, {
            ok: true,
            proposal
          });
          return;
        }

        const engine = await this.runtime.getEngine();
        if (governanceMatch.action === 'apply') {
          const payload = await this.facade.applyProposal({
            proposalId: governanceMatch.proposalId,
            appliedBy: body.appliedBy ?? requestContext.actor,
            authority: requestContext.authority,
            ...(body.sessionId ? { runtimeSnapshot: await this.runtime.resolveRuntimeSnapshotRef(body.sessionId) } : {}),
            ...(body.appliedAt ? { appliedAt: body.appliedAt } : {}),
            engine
          });
          this.recordPlatformEvent({
            type: 'governance.proposal_applied',
            resourceId: payload.proposalId,
            sessionId: body.sessionId,
            payload: {
              appliedCount: payload.appliedCount
            }
          });
          writeJson(response, 200, {
            ok: true,
            payload
          });
          return;
        }

        const payload = await this.facade.rollbackProposal({
          proposalId: governanceMatch.proposalId,
          rolledBackBy: body.rolledBackBy ?? requestContext.actor,
          authority: requestContext.authority,
          ...(body.sessionId ? { runtimeSnapshot: await this.runtime.resolveRuntimeSnapshotRef(body.sessionId) } : {}),
          ...(body.rolledBackAt ? { rolledBackAt: body.rolledBackAt } : {}),
          ...(body.note ? { note: body.note } : {}),
          engine
        });
        this.recordPlatformEvent({
          type: 'governance.proposal_rolled_back',
          resourceId: payload.proposalId,
          sessionId: body.sessionId,
          payload: {
            rolledBackCount: payload.rolledBackCount
          }
        });
        writeJson(response, 200, {
          ok: true,
          payload
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/import/catalog') {
        writeJson(response, 200, { ok: true, catalog: this.facade.buildSourceCatalog() });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/import/jobs') {
        writeJson(response, 200, {
          ok: true,
          jobs: await this.facade.listImportJobs(readOptionalInt(url.searchParams.get('limit')) ?? undefined)
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/import/dead-letters') {
        writeJson(response, 200, {
          ok: true,
          deadLetters: await this.facade.listImportDeadLetters(readOptionalInt(url.searchParams.get('limit')) ?? undefined)
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/workbench/aliases') {
        const proposals = await this.facade.listProposals(readOptionalInt(url.searchParams.get('limit')) ?? 100);
        writeJson(response, 200, {
          ok: true,
          payload: buildAliasWorkbenchPayload(proposals)
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/workbench/knowledge-review') {
        const engine = await this.runtime.getEngine();
        writeJson(response, 200, {
          ok: true,
          payload: await buildKnowledgeReviewPayload(engine, {
            sessionId: url.searchParams.get('sessionId') ?? undefined,
            workspaceId: url.searchParams.get('workspaceId') ?? undefined,
            limit: readOptionalInt(url.searchParams.get('limit')) ?? 20
          })
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/workbench/import-review') {
        const jobs = await this.facade.listImportJobs(readOptionalInt(url.searchParams.get('limit')) ?? 20);
        writeJson(response, 200, {
          ok: true,
          payload: jobs.map((job) => ({
            jobId: job.id,
            sessionId: job.sessionId,
            sourceKind: job.sourceKind,
            status: job.status,
            attemptCount: job.attemptCount,
            ...(job.lastRunAt ? { lastRunAt: job.lastRunAt } : {}),
            ...(job.nextScheduledAt ? { nextScheduledAt: job.nextScheduledAt } : {}),
            ...(job.error ? { error: job.error } : {})
          }))
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/workbench/runtime-governance-trace') {
        const sessionId = url.searchParams.get('sessionId');

        if (!sessionId) {
          writeJson(response, 400, {
            ok: false,
            error: 'sessionId is required'
          });
          return;
        }

        writeJson(response, 200, {
          ok: true,
          payload: await buildRuntimeGovernanceTracePayload(sessionId, this.runtime, this.facade)
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/import/jobs') {
        const body = await readJsonBody(request);
        const runtimeSnapshot = body.sessionId
          ? await this.runtime.resolveRuntimeSnapshotRef(body.sessionId)
          : undefined;
        const job = await this.facade.createImportJob({
          sessionId: body.sessionId,
          ...(body.workspaceId ? { workspaceId: body.workspaceId } : {}),
          sourceKind: body.sourceKind,
          ...(body.source ? { source: body.source } : {}),
          ...(body.flow ? { flow: body.flow } : {}),
          ...(body.versionInfo ? { versionInfo: body.versionInfo } : {}),
          ...(body.incremental ? { incremental: body.incremental } : {}),
          ...(body.requestedBy ? { requestedBy: body.requestedBy } : {}),
          ...(body.createdAt ? { createdAt: body.createdAt } : {}),
          ...(runtimeSnapshot ? { runtimeSnapshot } : {}),
          input: body.input
        });
        this.recordPlatformEvent({
          type: 'import.job_created',
          resourceId: job.id,
          sessionId: job.sessionId,
          workspaceId: job.workspaceId,
          payload: {
            sourceKind: job.sourceKind
          }
        });
        writeJson(response, 200, {
          ok: true,
          job
        });
        return;
      }

      const importMatch = matchImportAction(url.pathname);
      if (importMatch && method === 'GET' && importMatch.action === 'get') {
        writeJson(response, 200, {
          ok: true,
          record: await this.facade.getImportJob(importMatch.jobId)
        });
        return;
      }

      if (importMatch && method === 'GET' && importMatch.action === 'history') {
        writeJson(response, 200, {
          ok: true,
          history: await this.facade.listImportJobHistory(
            importMatch.jobId,
            readOptionalInt(url.searchParams.get('limit')) ?? undefined
          )
        });
        return;
      }

      if (importMatch && method === 'POST') {
        const body = await readJsonBody(request);
        const engine = await this.runtime.getEngine();
        const record = await this.facade.getImportJob(importMatch.jobId);
        const runtimeSnapshot = record
          ? await this.runtime.resolveRuntimeSnapshotRef(record.job.sessionId)
          : undefined;

        switch (importMatch.action) {
          case 'run':
          case 'retry':
          case 'rerun': {
            try {
              const payload =
                importMatch.action === 'run'
                  ? await this.facade.runImportJob({
                      jobId: importMatch.jobId,
                      ...(body.completedAt ? { completedAt: body.completedAt } : {}),
                      ...(runtimeSnapshot ? { runtimeSnapshot } : {}),
                      engine
                    })
                  : importMatch.action === 'retry'
                    ? await this.facade.retryImportJob({
                        jobId: importMatch.jobId,
                        ...(body.completedAt ? { completedAt: body.completedAt } : {}),
                        ...(runtimeSnapshot ? { runtimeSnapshot } : {}),
                        engine
                      })
                    : await this.facade.rerunImportJob({
                        jobId: importMatch.jobId,
                        ...(body.completedAt ? { completedAt: body.completedAt } : {}),
                        ...(runtimeSnapshot ? { runtimeSnapshot } : {}),
                        engine
                      });
              this.recordPlatformEvent({
                type: 'import.job_completed',
                resourceId: payload.jobId,
                sessionId: record?.job.sessionId,
                workspaceId: record?.job.workspaceId,
                payload: {
                  attemptAction: payload.attemptAction,
                  status: payload.status,
                  persistedNodeCount: payload.persistedNodeCount
                }
              });
              writeJson(response, 200, {
                ok: true,
                payload
              });
              return;
            } catch (error) {
              this.recordPlatformEvent({
                type: 'import.job_failed',
                resourceId: importMatch.jobId,
                sessionId: record?.job.sessionId,
                workspaceId: record?.job.workspaceId,
                payload: {
                  action: importMatch.action,
                  message: error instanceof Error ? error.message : String(error)
                }
              });
              throw error;
            }
          }
          case 'schedule':
            writeJson(response, 200, {
              ok: true,
              payload: await this.facade.scheduleImportJob({
                jobId: importMatch.jobId,
                dueAt: body.dueAt,
                ...(body.createdAt ? { createdAt: body.createdAt } : {}),
                ...(body.createdBy ? { createdBy: body.createdBy } : {}),
                ...(body.note ? { note: body.note } : {})
              })
            });
            return;
        }
      }

      const batchMatch = matchImportBatchAction(url.pathname);
      if (batchMatch && method === 'POST') {
        const body = await readJsonBody(request);
        if (batchMatch === 'run') {
          const engine = await this.runtime.getEngine();
          writeJson(response, 200, {
            ok: true,
            payload: await this.facade.batchRunImportJobs({
              jobIds: body.jobIds ?? [],
              engine,
              ...(body.sessionId ? { runtimeSnapshot: await this.runtime.resolveRuntimeSnapshotRef(body.sessionId) } : {}),
              ...(body.completedAt ? { completedAt: body.completedAt } : {})
            })
          });
          return;
        }

        if (batchMatch === 'stop') {
          writeJson(response, 200, { ok: true, payload: await this.facade.stopImportJobs(body.jobIds ?? []) });
          return;
        }

        writeJson(response, 200, {
          ok: true,
          payload: await this.facade.resumeImportJobs({
            jobIds: body.jobIds ?? [],
            ...(body.dueAt ? { dueAt: body.dueAt } : {})
          })
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/extensions') {
        writeJson(response, 200, {
          ok: true,
          hostManifest: this.facade.getPlatformHostManifest(),
          extensions: this.facade.listExtensions()
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/extensions') {
        const body = await readJsonBody(request);
        const manifest = this.facade.registerExtension({
          id: body.id,
          label: body.label,
          description: body.description,
          kind: body.kind,
          source: body.source,
          version: body.version,
          apiVersion: body.apiVersion,
          providerNeutral: body.providerNeutral === true,
          capabilities: Array.isArray(body.capabilities) ? body.capabilities : [],
          ...(body.signature ? { signature: body.signature } : {}),
          ...(body.testContract ? { testContract: body.testContract } : {}),
          ...(body.status ? { status: body.status } : {})
        });
        this.recordPlatformEvent({
          type: 'extension.registered',
          resourceId: manifest.id,
          payload: {
            kind: manifest.kind,
            source: manifest.source,
            version: manifest.version
          }
        });
        writeJson(response, 200, { ok: true, manifest });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/extensions/negotiate') {
        const body = await readJsonBody(request);
        writeJson(response, 200, {
          ok: true,
          payload: this.facade.negotiateExtension({
            extensionId: body.extensionId,
            requestedApiVersion: body.requestedApiVersion,
            ...(Array.isArray(body.requiredCapabilities) ? { requiredCapabilities: body.requiredCapabilities } : {})
          })
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/autonomy/recommendations') {
        const stage = url.searchParams.get('stage') ?? undefined;
        const limit = readOptionalInt(url.searchParams.get('limit')) ?? 50;
        const snapshots = this.facade.listDashboardSnapshots({
          ...(stage ? { stage } : {}),
          limit
        });
        const payload = this.facade.buildAutonomyRecommendations({
          ...(stage ? { stage } : {}),
          snapshots,
          importJobs: await this.facade.listImportJobs(limit),
          proposals: await this.facade.listProposals(limit),
          ...(stage ? { thresholds: this.facade.getObservabilityThresholds(stage) } : {})
        });
        this.recordPlatformEvent({
          type: 'autonomy.recommendations_generated',
          ...(stage ? { stage } : {}),
          payload: {
            recommendationCount: payload.recommendationCount,
            basedOn: payload.basedOn
          }
        });
        writeJson(response, 200, { ok: true, payload });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/autonomy/simulate') {
        const body = await readJsonBody(request);
        writeJson(response, 200, {
          ok: true,
          payload: this.facade.simulateAutonomyRecommendations({
            recommendations: Array.isArray(body.recommendations) ? body.recommendations : []
          })
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/workspaces/aggregate') {
        const payload = await buildWorkspaceCatalogPayload(this.facade);
        writeJson(response, 200, {
          ok: true,
          payload: payload.aggregate
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/workspaces/policies') {
        writeJson(response, 200, {
          ok: true,
          payload: this.facade.listWorkspaceIsolationPolicies()
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/workspaces/policies') {
        const body = await readJsonBody(request);
        const policy = this.facade.saveWorkspaceIsolationPolicy({
          workspaceId: body.workspaceId,
          isolationMode: body.isolationMode,
          authorityMode: body.authorityMode,
          ...(typeof body.sharedGlobalRead === 'boolean' ? { sharedGlobalRead: body.sharedGlobalRead } : {}),
          ...(typeof body.sharedGlobalWrite === 'boolean' ? { sharedGlobalWrite: body.sharedGlobalWrite } : {}),
          ...(body.savedAt ? { savedAt: body.savedAt } : {}),
          ...(body.savedBy ? { savedBy: body.savedBy } : {})
        });
        this.recordPlatformEvent({
          type: 'workspace.policy_saved',
          resourceId: policy.workspaceId,
          workspaceId: policy.workspaceId,
          payload: {
            isolationMode: policy.isolationMode,
            authorityMode: policy.authorityMode,
            sharedGlobalWrite: policy.sharedGlobalWrite
          }
        });
        writeJson(response, 200, { ok: true, payload: policy });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/workspaces') {
        const payload = await buildWorkspaceCatalogPayload(this.facade);
        writeJson(response, 200, {
          ok: true,
          payload: payload.catalog
        });
        return;
      }

      const workspaceId = matchWorkspacePath(url.pathname);
      if (method === 'GET' && workspaceId) {
        const payload = await buildWorkspaceCatalogPayload(this.facade);
        writeJson(response, 200, {
          ok: true,
          payload: payload.catalog.find((entry) => entry.workspaceId === workspaceId)
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/platform/events') {
        writeJson(response, 200, {
          ok: true,
          payload: this.facade.listPlatformEvents({
            limit: readOptionalInt(url.searchParams.get('limit')) ?? 50,
            ...(url.searchParams.get('type') ? { type: url.searchParams.get('type') as PlatformEventRecord['type'] } : {}),
            ...(url.searchParams.get('workspaceId') ? { workspaceId: url.searchParams.get('workspaceId') ?? undefined } : {})
          })
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/platform/events/stream') {
        writeEventStream(response, this.facade.listPlatformEvents({
          limit: readOptionalInt(url.searchParams.get('limit')) ?? 20,
          ...(url.searchParams.get('type') ? { type: url.searchParams.get('type') as PlatformEventRecord['type'] } : {}),
          ...(url.searchParams.get('workspaceId') ? { workspaceId: url.searchParams.get('workspaceId') ?? undefined } : {})
        }));
        return;
      }

      if (method === 'GET' && url.pathname === '/api/platform/webhooks/subscriptions') {
        writeJson(response, 200, {
          ok: true,
          payload: this.facade.listWebhookSubscriptions()
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/platform/webhooks/subscriptions') {
        const body = await readJsonBody(request);
        writeJson(response, 200, {
          ok: true,
          payload: this.facade.createWebhookSubscription({
            target: body.target,
            eventTypes: Array.isArray(body.eventTypes) ? body.eventTypes : [],
            ...(body.createdAt ? { createdAt: body.createdAt } : {}),
            ...(body.createdBy ? { createdBy: body.createdBy } : {}),
            ...(body.secret ? { secret: body.secret } : {})
          })
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/platform/webhooks/deliveries') {
        writeJson(response, 200, {
          ok: true,
          payload: this.facade.listWebhookDeliveries(readOptionalInt(url.searchParams.get('limit')) ?? 50)
        });
        return;
      }

      writeJson(response, 404, { ok: false, error: 'not_found' });
    } catch (error) {
      this.logger.error('[compact-context] control-plane request failed', {
        err: error instanceof Error ? error.message : String(error)
      });
      writeJson(response, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

function buildAliasWorkbenchPayload(
  proposals: Awaited<ReturnType<ControlPlaneFacadeContract['listProposals']>>
): Array<{
  conceptId: string;
  aliases: string[];
  proposalIds: string[];
}> {
  const aliasMap = new Map<string, { aliases: Set<string>; proposalIds: Set<string> }>();

  for (const proposal of proposals) {
    for (const correction of proposal.corrections) {
      if (correction.targetKind !== 'concept_alias') {
        continue;
      }
      const alias = typeof correction.metadata?.alias === 'string' ? correction.metadata.alias : undefined;
      if (!alias) {
        continue;
      }

      const current = aliasMap.get(correction.targetId) ?? {
        aliases: new Set<string>(),
        proposalIds: new Set<string>()
      };
      current.aliases.add(alias);
      current.proposalIds.add(proposal.id);
      aliasMap.set(correction.targetId, current);
    }
  }

  return [...aliasMap.entries()].map(([conceptId, entry]) => ({
    conceptId,
    aliases: [...entry.aliases].sort(),
    proposalIds: [...entry.proposalIds].sort()
  }));
}

async function buildKnowledgeReviewPayload(
  engine: ControlPlaneRuntimeEngineContract,
  input: {
    sessionId?: string;
    workspaceId?: string;
    limit: number;
  }
): Promise<{
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    scope: string;
    freshness: string;
  }>;
  skillCandidates: Array<{
    id: string;
    label: string;
    evidenceCount?: number;
    lifecycleStage?: string;
  }>;
}> {
  const nodes = await engine.queryNodes({
    types: ['Pattern', 'FailurePattern', 'SuccessfulProcedure', 'Rule', 'Skill'],
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    limit: input.limit
  });
  const skillCandidates =
    input.sessionId ? await engine.listSkillCandidates(input.sessionId, Math.max(5, input.limit)) : [];

  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      scope: node.scope,
      freshness: node.freshness
    })),
    skillCandidates: skillCandidates.map((candidate) => ({
      id: candidate.id,
      label: candidate.name,
      evidenceCount: candidate.evidenceNodeIds.length,
      ...(candidate.lifecycle?.stage ? { lifecycleStage: candidate.lifecycle.stage } : {})
    }))
  };
}

async function buildRuntimeGovernanceTracePayload(
  sessionId: string,
  runtime: ControlPlaneRuntimeReadModelContract,
  facade: ControlPlaneFacadeContract
): Promise<{
  sessionId: string;
  runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
  proposals: Awaited<ReturnType<ControlPlaneFacadeContract['listProposals']>>;
  audit: Awaited<ReturnType<ControlPlaneFacadeContract['listAuditRecords']>>;
  imports: Array<{
    jobId: string;
    status: string;
    sourceKind: string;
    attemptCount: number;
  }>;
}> {
  const runtimeSnapshot = await runtime.resolveRuntimeSnapshotRef(sessionId);
  const proposals = (await facade.listProposals(100)).filter(
    (proposal) => proposal.contextSessionId === sessionId || proposal.runtimeSnapshot?.sessionId === sessionId
  );
  const proposalIds = new Set(proposals.map((proposal) => proposal.id));
  const audit = (await facade.listAuditRecords(200)).filter((record) => proposalIds.has(record.proposalId));
  const imports = (await facade.listImportJobs(100))
    .filter((job) => job.sessionId === sessionId)
    .map((job) => ({
      jobId: job.id,
      status: job.status,
      sourceKind: job.sourceKind,
      attemptCount: job.attemptCount
    }));

  return {
    sessionId,
    ...(runtimeSnapshot ? { runtimeSnapshot } : {}),
    proposals,
    audit,
    imports
  };
}

async function buildWorkspaceCatalogPayload(
  facade: ControlPlaneFacadeContract
): Promise<{
  catalog: ReturnType<ControlPlaneFacadeContract['buildWorkspaceCatalog']>;
  aggregate: ReturnType<ControlPlaneFacadeContract['buildWorkspaceAggregate']>;
}> {
  const jobs = await facade.listImportJobs(200);
  const proposals = await facade.listProposals(200);
  const snapshots = facade.listDashboardSnapshots({ limit: 200 });
  const catalog = facade.buildWorkspaceCatalog({
    jobs,
    proposals,
    snapshots
  });
  return {
    catalog,
    aggregate: facade.buildWorkspaceAggregate({ catalog })
  };
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, any>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, any>;
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload, null, 2));
}

function writeHtml(response: ServerResponse, html: string): void {
  response.statusCode = 200;
  response.setHeader('content-type', 'text/html; charset=utf-8');
  response.end(html);
}

function writeEventStream(response: ServerResponse, events: readonly PlatformEventRecord[]): void {
  response.statusCode = 200;
  response.setHeader('content-type', 'text/event-stream; charset=utf-8');
  response.setHeader('cache-control', 'no-cache, no-transform');
  response.setHeader('connection', 'keep-alive');

  for (const event of events) {
    response.write(`id: ${event.id}\n`);
    response.write(`event: ${event.type}\n`);
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  response.end();
}

function readOptionalInt(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readRequestContext(request: IncomingMessage, authorityOverride?: string): ControlPlaneRequestContext {
  const actorHeader = request.headers['x-control-plane-actor'];
  const authorityHeader = request.headers['x-control-plane-authority'];
  const actor = typeof actorHeader === 'string' && actorHeader.length > 0 ? actorHeader : 'control-plane';
  const authority = normalizeGovernanceAuthority(authorityOverride ?? authorityHeader);
  return {
    actor,
    authority
  };
}

function normalizeGovernanceAuthority(value: unknown): GovernanceAuthority {
  if (value === 'session_operator' || value === 'workspace_reviewer' || value === 'global_reviewer') {
    return value;
  }
  return 'workspace_reviewer';
}

function matchGovernanceAction(pathname: string): { proposalId: string; action: 'review' | 'apply' | 'rollback' } | undefined {
  const match = pathname.match(/^\/api\/governance\/proposals\/([^/]+)\/(review|apply|rollback)$/);
  if (!match) {
    return undefined;
  }
  const proposalId = match[1];
  const action = match[2];
  if (!proposalId || !action) {
    return undefined;
  }
  return {
    proposalId: decodeURIComponent(proposalId),
    action: action as 'review' | 'apply' | 'rollback'
  };
}

function matchImportAction(
  pathname: string
): { jobId: string; action: 'get' | 'history' | 'run' | 'retry' | 'rerun' | 'schedule' } | undefined {
  const getMatch = pathname.match(/^\/api\/import\/jobs\/([^/]+)$/);
  if (getMatch) {
    const jobId = getMatch[1];
    if (!jobId) {
      return undefined;
    }
    return { jobId: decodeURIComponent(jobId), action: 'get' };
  }
  const historyMatch = pathname.match(/^\/api\/import\/jobs\/([^/]+)\/history$/);
  if (historyMatch) {
    const jobId = historyMatch[1];
    if (!jobId) {
      return undefined;
    }
    return { jobId: decodeURIComponent(jobId), action: 'history' };
  }
  const actionMatch = pathname.match(/^\/api\/import\/jobs\/([^/]+)\/(run|retry|rerun|schedule)$/);
  if (!actionMatch) {
    return undefined;
  }
  const jobId = actionMatch[1];
  const action = actionMatch[2];
  if (!jobId || !action) {
    return undefined;
  }
  return {
    jobId: decodeURIComponent(jobId),
    action: action as 'run' | 'retry' | 'rerun' | 'schedule'
  };
}

function matchImportBatchAction(pathname: string): 'run' | 'stop' | 'resume' | undefined {
  const match = pathname.match(/^\/api\/import\/jobs\/batch\/(run|stop|resume)$/);
  return match?.[1] ? (match[1] as 'run' | 'stop' | 'resume') : undefined;
}

function matchWorkspacePath(pathname: string): string | undefined {
  const match = pathname.match(/^\/api\/workspaces\/([^/]+)$/);
  if (!match?.[1]) {
    return undefined;
  }
  const workspaceId = decodeURIComponent(match[1]);
  if (workspaceId === 'aggregate' || workspaceId === 'policies') {
    return undefined;
  }
  return workspaceId;
}
