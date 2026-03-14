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
import { deriveExperienceLearning, materializeExperienceLearningGraph } from '../core/experience-learning.js';

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

    await this.persistExperienceLearningArtifacts(request.bundle);
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
    const existingCandidates =
      request.existingCandidates ?? (await this.persistenceStore.listSkillCandidates(request.sessionId, 50));
    const result = this.skillCrystallizer.crystallize({
      ...request,
      existingCandidates
    });
    await this.persistExperienceLearningArtifacts(request.bundle);
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

  private async persistExperienceLearningArtifacts(bundle: RuntimeContextBundle): Promise<void> {
    const experienceView = deriveExperienceLearning(bundle);
    const artifacts = materializeExperienceLearningGraph(bundle, experienceView);
    const promotedPatternIds = artifacts.nodes
      .filter((node) => isPromotedPatternType(node.type))
      .map((node) => node.id);
    const existingPromotedPatterns =
      promotedPatternIds.length > 0 ? await this.graphStore.getNodesByIds(promotedPatternIds) : [];
    const existingById = new Map(existingPromotedPatterns.map((node) => [node.id, node]));
    const nextNodes = artifacts.nodes.map((node) => {
      const existing = existingById.get(node.id);
      return existing && isPromotedPatternType(node.type) ? reinforcePromotedPatternNode(existing, node, bundle.id) : node;
    });

    if (nextNodes.length > 0) {
      await this.graphStore.upsertNodes(nextNodes);
    }

    if (artifacts.edges.length > 0) {
      await this.graphStore.upsertEdges(artifacts.edges);
    }
  }
}

function isPromotedPatternType(type: GraphNode['type']): boolean {
  return type === 'Pattern' || type === 'FailurePattern' || type === 'SuccessfulProcedure';
}

function reinforcePromotedPatternNode(existing: GraphNode, next: GraphNode, sourceBundleId: string): GraphNode {
  const lastSourceBundleId = readStringPayload(existing, 'lastSourceBundleId');
  if (lastSourceBundleId === sourceBundleId) {
    return {
      ...next,
      payload: {
        ...next.payload,
        observationCount: readObservationCount(existing),
        lastSourceBundleId: sourceBundleId,
        promotionState: readPromotionState(existing)
      },
      confidence: Math.max(existing.confidence, next.confidence),
      version: existing.version
    };
  }

  const existingCount = readObservationCount(existing);
  const nextCount = existingCount + 1;
  const payload = {
    ...next.payload,
    observationCount: nextCount,
    lastSourceBundleId: sourceBundleId,
    promotionState: nextCount >= 2 ? 'reinforced' : readPromotionState(next)
  };

  return {
    ...next,
    payload,
    confidence: Math.min(0.99, Math.max(existing.confidence, next.confidence) + 0.03),
    version: `v${nextCount}`,
    updatedAt: new Date().toISOString()
  };
}

function readObservationCount(node: GraphNode): number {
  const value = node.payload.observationCount;
  return typeof value === 'number' && Number.isFinite(value) ? value : 1;
}

function readPromotionState(node: GraphNode): string {
  const value = node.payload.promotionState;
  return typeof value === 'string' && value.length > 0 ? value : 'candidate';
}

function readStringPayload(node: GraphNode, key: string): string | undefined {
  const value = node.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
