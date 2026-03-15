import type {
  ControlPlaneFacadeContract,
  ControlPlaneObservabilityDashboardPayload,
  ControlPlaneRuntimeReadModelContract,
  ControlPlaneRuntimeSnapshotRef,
  ControlPlaneRuntimeWindowInspectionPayload
} from '../control-plane/contracts.js';
import type { AgentMessageLike } from './types.js';
import {
  buildInspectObservabilityDashboardPayload,
  buildInspectRuntimeWindowPayload,
  type ContextEngineRuntimeManager,
  type NormalizedPluginConfig
} from './context-engine-adapter.js';

type RuntimeManagerBridge = Pick<
  ContextEngineRuntimeManager,
  | 'get'
  | 'getRuntimeWindowSnapshot'
  | 'getPersistedRuntimeWindowSnapshot'
  | 'resolveSessionFile'
  | 'listRuntimeWindowSnapshots'
>;

export class OpenClawControlPlaneRuntimeBridge
  implements ControlPlaneRuntimeReadModelContract<AgentMessageLike>
{
  constructor(
    private readonly runtime: RuntimeManagerBridge,
    private readonly config: NormalizedPluginConfig
  ) {}

  async getEngine() {
    return this.runtime.get();
  }

  async inspectRuntimeWindow(params: {
    sessionId: string;
    sessionFile?: string;
    tokenBudget?: number;
  }): Promise<ControlPlaneRuntimeWindowInspectionPayload<AgentMessageLike>> {
    return buildInspectRuntimeWindowPayload(params, this.runtime, this.config);
  }

  async listRuntimeWindows(limit?: number): Promise<Array<ControlPlaneRuntimeWindowInspectionPayload<AgentMessageLike>>> {
    const snapshots = await this.runtime.listRuntimeWindowSnapshots(limit);
    return Promise.all(
      snapshots.map((snapshot) =>
        this.inspectRuntimeWindow({
          sessionId: snapshot.sessionId
        })
      )
    );
  }

  async inspectObservabilityDashboard(
    params: {
      stage?: string;
      sessionIds?: string[];
      sessionId?: string;
      sessionFile?: string;
      tokenBudget?: number;
      thresholds?: Record<string, unknown>;
      historyLimit?: number;
      limit?: number;
    },
    facade: ControlPlaneFacadeContract
  ): Promise<ControlPlaneObservabilityDashboardPayload<AgentMessageLike>> {
    return buildInspectObservabilityDashboardPayload(params, this.runtime, facade, this.config);
  }

  async resolveRuntimeSnapshotRef(sessionId: string): Promise<ControlPlaneRuntimeSnapshotRef | undefined> {
    try {
      const payload = await this.inspectRuntimeWindow({ sessionId });
      return {
        sessionId,
        source: payload.source,
        ...(payload.capturedAt ? { capturedAt: payload.capturedAt } : {}),
        ...(payload.query ? { query: payload.query } : {})
      };
    } catch {
      return undefined;
    }
  }
}
