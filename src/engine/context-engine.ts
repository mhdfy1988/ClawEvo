import type { RuntimeContextBundle } from '../types/core.js';
import type {
  CheckpointRequest,
  CheckpointResult,
  CompileContextRequest,
  ExplainRequest,
  ExplainResult,
  IngestResult,
  RawContextInput,
  SkillCandidateResult,
  SkillMiningRequest
} from '../types/io.js';
import { AuditExplainer } from '../core/audit-explainer.js';
import { CheckpointManager } from '../core/checkpoint-manager.js';
import { InMemoryContextPersistenceStore, type ContextPersistenceStore } from '../core/context-persistence.js';
import { ContextCompiler } from '../core/context-compiler.js';
import { InMemoryGraphStore, type GraphStore } from '../core/graph-store.js';
import { IngestPipeline } from '../core/ingest-pipeline.js';
import { SkillCrystallizer } from '../core/skill-crystallizer.js';
import type { GraphEdge, GraphNode, SessionCheckpoint, SkillCandidate } from '../types/core.js';
import type { GraphEdgeFilter, GraphNodeFilter } from '../types/io.js';

export interface ContextEngineOptions {
  graphStore?: GraphStore;
  persistenceStore?: ContextPersistenceStore;
}

export interface SqliteContextEngineOptions {
  dbPath: string;
  schemaPath?: string;
}

export class ContextEngine {
  readonly graphStore: GraphStore;
  readonly persistenceStore: ContextPersistenceStore;
  readonly ingestPipeline: IngestPipeline;
  readonly contextCompiler: ContextCompiler;
  readonly checkpointManager: CheckpointManager;
  readonly skillCrystallizer: SkillCrystallizer;
  readonly auditExplainer: AuditExplainer;

  constructor(options: ContextEngineOptions = {}) {
    this.graphStore = options.graphStore ?? new InMemoryGraphStore();
    this.persistenceStore = options.persistenceStore ?? new InMemoryContextPersistenceStore();
    this.ingestPipeline = new IngestPipeline(this.graphStore);
    this.contextCompiler = new ContextCompiler(this.graphStore);
    this.checkpointManager = new CheckpointManager();
    this.skillCrystallizer = new SkillCrystallizer();
    this.auditExplainer = new AuditExplainer(this.graphStore, this.contextCompiler, this.persistenceStore);
  }

  static async openSqlite(options: SqliteContextEngineOptions): Promise<ContextEngine> {
    const { SqliteGraphStore } = await import('../core/sqlite-graph-store.js');
    const graphStore = await SqliteGraphStore.open(options);
    return new ContextEngine({ graphStore, persistenceStore: graphStore });
  }

  async ingest(input: RawContextInput): Promise<IngestResult> {
    return this.ingestPipeline.ingest(input);
  }

  async compileContext(request: CompileContextRequest): Promise<RuntimeContextBundle> {
    return this.contextCompiler.compile(request);
  }

  async createCheckpoint(request: CheckpointRequest): Promise<CheckpointResult> {
    const previousCheckpoint =
      request.previousCheckpoint ?? (await this.persistenceStore.getLatestCheckpoint(request.sessionId));
    const result = this.checkpointManager.createCheckpoint({
      ...request,
      previousCheckpoint
    });

    await this.persistenceStore.saveCheckpoint(result.checkpoint);
    await this.persistenceStore.saveDelta(result.delta);

    return result;
  }

  async getLatestCheckpoint(sessionId: string): Promise<SessionCheckpoint | undefined> {
    return this.persistenceStore.getLatestCheckpoint(sessionId);
  }

  async listCheckpoints(sessionId: string, limit?: number): Promise<SessionCheckpoint[]> {
    return this.persistenceStore.listCheckpoints(sessionId, limit);
  }

  async crystallizeSkills(request: SkillMiningRequest): Promise<SkillCandidateResult> {
    const result = this.skillCrystallizer.crystallize(request);
    await this.persistenceStore.saveSkillCandidates(request.sessionId, result.candidates);
    return result;
  }

  async listSkillCandidates(sessionId: string, limit?: number): Promise<SkillCandidate[]> {
    return this.persistenceStore.listSkillCandidates(sessionId, limit);
  }

  async queryNodes(filter?: GraphNodeFilter): Promise<GraphNode[]> {
    return this.graphStore.queryNodes(filter);
  }

  async queryEdges(filter?: GraphEdgeFilter): Promise<GraphEdge[]> {
    return this.graphStore.queryEdges(filter);
  }

  async explain(request: ExplainRequest): Promise<ExplainResult> {
    return this.auditExplainer.explain(request);
  }

  async close(): Promise<void> {
    await this.graphStore.close();
    if (!Object.is(this.persistenceStore as object, this.graphStore as object)) {
      await this.persistenceStore.close();
    }
  }
}
