import { ContextEngine } from '@openclaw-compact-context/runtime-core';
import type { RuntimeContextBundle } from '@openclaw-compact-context/contracts';
import type {
  ContextPluginRequest,
  ContextPluginResponse,
  CreateCheckpointPluginResponse,
  HealthResponse
} from './api.js';

export class ContextEnginePlugin {
  constructor(private readonly engine: ContextEngine) {}

  async handle(request: ContextPluginRequest): Promise<ContextPluginResponse> {
    switch (request.method) {
      case 'health':
        return this.handleHealth(request.requestId);
      case 'ingest_context':
        return {
          requestId: request.requestId,
          method: request.method,
          ok: true,
          data: await this.engine.ingest(request.payload)
        };
      case 'compile_context':
        return {
          requestId: request.requestId,
          method: request.method,
          ok: true,
          data: await this.engine.compileContext(request.payload)
        };
      case 'create_checkpoint':
        return this.handleCreateCheckpoint(request.requestId, request.payload.sessionId, request.payload.bundle);
      case 'query_nodes':
        return {
          requestId: request.requestId,
          method: request.method,
          ok: true,
          data: {
            nodes: await this.engine.queryNodes(request.payload.filter)
          }
        };
      case 'query_edges':
        return {
          requestId: request.requestId,
          method: request.method,
          ok: true,
          data: {
            edges: await this.engine.queryEdges(request.payload.filter)
          }
        };
      case 'get_latest_checkpoint':
        return {
          requestId: request.requestId,
          method: request.method,
          ok: true,
          data: {
            checkpoint: await this.engine.getLatestCheckpoint(request.payload.sessionId)
          }
        };
      case 'list_checkpoints':
        return {
          requestId: request.requestId,
          method: request.method,
          ok: true,
          data: {
            checkpoints: await this.engine.listCheckpoints(request.payload.sessionId, request.payload.limit)
          }
        };
      case 'crystallize_skills':
        return {
          requestId: request.requestId,
          method: request.method,
          ok: true,
          data: await this.engine.crystallizeSkills(request.payload)
        };
      case 'list_skill_candidates':
        return {
          requestId: request.requestId,
          method: request.method,
          ok: true,
          data: {
            candidates: await this.engine.listSkillCandidates(request.payload.sessionId, request.payload.limit)
          }
        };
      case 'explain':
        return {
          requestId: request.requestId,
          method: request.method,
          ok: true,
          data: await this.engine.explain(request.payload)
        };
      default:
        return assertNever(request);
    }
  }

  private async handleCreateCheckpoint(
    requestId: string,
    sessionId: string,
    bundle: RuntimeContextBundle
  ): Promise<CreateCheckpointPluginResponse> {
    return {
      requestId,
      method: 'create_checkpoint',
      ok: true,
      data: await this.engine.createCheckpoint({
        sessionId,
        bundle
      })
    };
  }

  private handleHealth(requestId: string): HealthResponse {
    return {
      requestId,
      method: 'health',
      ok: true,
      data: {
        ok: true,
        storage: {
          graph: inferStoreType(this.engine.graphStore.constructor.name),
          persistence: inferStoreType(this.engine.persistenceStore.constructor.name)
        }
      }
    };
  }
}

function inferStoreType(name: string): 'memory' | 'sqlite' {
  return /sqlite/i.test(name) ? 'sqlite' : 'memory';
}

function assertNever(value: never): never {
  throw new Error(`Unhandled plugin request: ${JSON.stringify(value)}`);
}
