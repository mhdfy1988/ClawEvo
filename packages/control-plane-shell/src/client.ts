import type {
  AutonomyRecommendation,
  AutonomySimulationResult,
  PlatformEventRecord,
  PlatformExtensionManifest,
  WorkspaceAggregateView,
  WorkspaceCatalogEntry
} from '@openclaw-compact-context/contracts';

export interface ControlPlaneClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export class ControlPlaneClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ControlPlaneClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async health(): Promise<Record<string, unknown>> {
    return this.getJson('/api/health');
  }

  async listExtensions(): Promise<PlatformExtensionManifest[]> {
    const payload = await this.getJson<{ ok: boolean; extensions: PlatformExtensionManifest[] }>('/api/extensions');
    return payload.extensions;
  }

  async getAutonomyRecommendations(stage?: string): Promise<AutonomyRecommendation[]> {
    const suffix = stage ? `?stage=${encodeURIComponent(stage)}` : '';
    const payload = await this.getJson<{ ok: boolean; payload: { recommendations: AutonomyRecommendation[] } }>(
      `/api/autonomy/recommendations${suffix}`
    );
    return payload.payload.recommendations;
  }

  async simulateAutonomyRecommendations(recommendations: readonly AutonomyRecommendation[]): Promise<AutonomySimulationResult> {
    const payload = await this.postJson<{ ok: boolean; payload: AutonomySimulationResult }>('/api/autonomy/simulate', {
      recommendations
    });
    return payload.payload;
  }

  async listWorkspaces(): Promise<WorkspaceCatalogEntry[]> {
    const payload = await this.getJson<{ ok: boolean; payload: WorkspaceCatalogEntry[] }>('/api/workspaces');
    return payload.payload;
  }

  async getWorkspaceAggregate(): Promise<WorkspaceAggregateView> {
    const payload = await this.getJson<{ ok: boolean; payload: WorkspaceAggregateView }>('/api/workspaces/aggregate');
    return payload.payload;
  }

  async listPlatformEvents(limit = 20): Promise<PlatformEventRecord[]> {
    const payload = await this.getJson<{ ok: boolean; payload: PlatformEventRecord[] }>(
      `/api/platform/events?limit=${limit}`
    );
    return payload.payload;
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(new URL(path, this.options.baseUrl));
    return (await response.json()) as T;
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchImpl(new URL(path, this.options.baseUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    return (await response.json()) as T;
  }
}
