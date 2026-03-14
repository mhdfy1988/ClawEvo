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
import type { ManualCorrectionRecord } from '../types/context-processing.js';
import { resolvePromotionDecision } from '../core/manual-corrections.js';
import { setManualConceptAliasCorrections } from '../core/concept-normalizer.js';

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
    setManualConceptAliasCorrections([]);
  }

  static async openSqlite(options: SqliteContextEngineOptions): Promise<ContextEngine> {
    const { SqliteGraphStore } = await import('../core/sqlite-graph-store.js');
    const graphStore = await SqliteGraphStore.open(options);
    const engine = new ContextEngine({ graphStore, persistenceStore: graphStore });
    await engine.syncManualCorrectionsFromPersistence();
    return engine;
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

  async applyManualCorrections(corrections: ManualCorrectionRecord[]): Promise<void> {
    if (corrections.length === 0) {
      return;
    }

    await this.persistenceStore.saveManualCorrections(corrections);
    await this.syncManualCorrectionsFromPersistence();
  }

  async listManualCorrections(limit?: number): Promise<ManualCorrectionRecord[]> {
    return this.persistenceStore.listManualCorrections(limit);
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
    const manualCorrections = await this.persistenceStore.listManualCorrections(400);
    const promotedPatternIds = artifacts.nodes
      .filter((node) => isPromotedPatternType(node.type))
      .map((node) => node.id);
    const existingPromotedPatterns =
      promotedPatternIds.length > 0 ? await this.graphStore.getNodesByIds(promotedPatternIds) : [];
    const existingById = new Map(existingPromotedPatterns.map((node) => [node.id, node]));
    const nextNodes = artifacts.nodes.map((node) => {
      const existing = existingById.get(node.id);
      return existing && isPromotedPatternType(node.type)
        ? reinforcePromotedPatternNode(existing, node, bundle.id, manualCorrections)
        : applyPromotionDecision(node, manualCorrections);
    });
    const globalNodes = await this.buildGlobalPromotionNodes(nextNodes, bundle, manualCorrections);

    if (nextNodes.length > 0 || globalNodes.length > 0) {
      await this.graphStore.upsertNodes(nextNodes.concat(globalNodes));
    }

    if (artifacts.edges.length > 0) {
      await this.graphStore.upsertEdges(artifacts.edges);
    }
  }

  private async buildGlobalPromotionNodes(
    nodes: GraphNode[],
    bundle: RuntimeContextBundle,
    corrections: readonly ManualCorrectionRecord[]
  ): Promise<GraphNode[]> {
    const promotable = nodes.filter((node) => shouldPromoteNodeToGlobal(node, corrections));

    if (promotable.length === 0) {
      return [];
    }

    const globalIds = promotable.map((node) => buildGlobalPromotionNodeId(node.id));
    const existingGlobalNodes = await this.graphStore.getNodesByIds(globalIds);
    const existingById = new Map(existingGlobalNodes.map((node) => [node.id, node]));

    return promotable.map((node) => {
      const globalNode = cloneNodeToGlobalScope(node, bundle.id);
      const existing = existingById.get(globalNode.id);

      return existing
        ? reinforcePromotedPatternNode(existing, globalNode, bundle.id, corrections)
        : applyPromotionDecision(globalNode, corrections);
    });
  }

  private async syncManualCorrectionsFromPersistence(): Promise<void> {
    const corrections = await this.persistenceStore.listManualCorrections(400);
    setManualConceptAliasCorrections(corrections);
  }
}

function isPromotedPatternType(type: GraphNode['type']): boolean {
  return type === 'Pattern' || type === 'FailurePattern' || type === 'SuccessfulProcedure';
}

function reinforcePromotedPatternNode(
  existing: GraphNode,
  next: GraphNode,
  sourceBundleId: string,
  corrections: readonly ManualCorrectionRecord[]
): GraphNode {
  const lastSourceBundleId = readStringPayload(existing, 'lastSourceBundleId');
  const manualDecision = resolvePromotionDecision(existing.id, corrections) ?? resolvePromotionDecision(next.id, corrections);

  if (lastSourceBundleId === sourceBundleId) {
    return applyPromotionDecision({
      ...next,
      payload: {
        ...next.payload,
        observationCount: readObservationCount(existing),
        downgradeCount: readDowngradeCount(existing),
        ...(readDecayState(existing) ? { decayState: readDecayState(existing) } : {}),
        patternTags: readPatternTags(existing),
        lastSourceBundleId: sourceBundleId,
        promotionState: readPromotionState(existing)
      },
      confidence: Math.max(existing.confidence, next.confidence),
      version: existing.version
    }, corrections);
  }

  const existingCount = readObservationCount(existing);
  const nextCount = existingCount + 1;
  const existingDowngradeCount = readDowngradeCount(existing);
  const nextBaseState = resolvePatternPromotionState(existing, next, nextCount, existingDowngradeCount, manualDecision);
  const nextDowngradeCount =
    nextBaseState === 'downgraded'
      ? existingDowngradeCount + 1
      : nextBaseState === 'reinforced'
        ? 0
        : existingDowngradeCount;
  const payload = {
    ...next.payload,
    observationCount: nextCount,
    downgradeCount: nextDowngradeCount,
    decayState: resolvePatternDecayState(nextCount, nextBaseState, next.confidence, nextDowngradeCount),
    patternTags: mergePatternTags(existing, next),
    lastSourceBundleId: sourceBundleId,
    promotionState: nextBaseState
  };

  return applyPromotionDecision({
    ...next,
    payload,
    confidence: Math.min(0.99, Math.max(existing.confidence, next.confidence) + 0.03),
    version: `v${nextCount}`,
    updatedAt: new Date().toISOString()
  }, corrections);
}

function readObservationCount(node: GraphNode): number {
  const value = node.payload.observationCount;
  return typeof value === 'number' && Number.isFinite(value) ? value : 1;
}

function readDowngradeCount(node: GraphNode): number {
  const value = node.payload.downgradeCount;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readPromotionState(node: GraphNode): string {
  const value = node.payload.promotionState;
  return typeof value === 'string' && value.length > 0 ? value : 'candidate';
}

function readDecayState(node: GraphNode): string | undefined {
  const value = node.payload.decayState;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readPatternTags(node: GraphNode): string[] {
  const value = node.payload.patternTags;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

function readStringPayload(node: GraphNode, key: string): string | undefined {
  const value = node.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function resolvePatternPromotionState(
  existing: GraphNode,
  next: GraphNode,
  nextCount: number,
  downgradeCount: number,
  manualDecision: ReturnType<typeof resolvePromotionDecision>
): 'candidate' | 'reinforced' | 'retired' | 'downgraded' {
  if (manualDecision === 'retire') {
    return 'retired';
  }

  if (manualDecision === 'hold') {
    return nextCount >= 2 ? 'downgraded' : 'candidate';
  }

  if (manualDecision === 'promote') {
    return 'reinforced';
  }

  if (readPromotionState(existing) === 'retired') {
    return 'retired';
  }

  const patternType = readStringPayload(next, 'patternType');
  const looksMixed = patternType === 'mixed';
  const confidenceDrop = next.confidence < existing.confidence - 0.08;

  if ((looksMixed && nextCount >= 2) || confidenceDrop || downgradeCount >= 2) {
    return 'downgraded';
  }

  return nextCount >= 2 ? 'reinforced' : (readPromotionState(next) as 'candidate' | 'reinforced' | 'retired' | 'downgraded');
}

function resolvePatternDecayState(
  observationCount: number,
  promotionState: string,
  confidence: number,
  downgradeCount: number
): 'fresh' | 'cooling' | 'stale' {
  if (promotionState === 'retired') {
    return 'stale';
  }

  if (promotionState === 'downgraded' || downgradeCount >= 2) {
    return confidence >= 0.7 ? 'cooling' : 'stale';
  }

  if (observationCount >= 3 || confidence >= 0.85) {
    return 'fresh';
  }

  return observationCount >= 2 || confidence >= 0.7 ? 'cooling' : 'stale';
}

function mergePatternTags(existing: GraphNode, next: GraphNode): string[] {
  const tags = new Set<string>([
    ...readPatternTags(existing),
    ...readPatternTags(next),
    next.type.toLowerCase()
  ]);
  const patternType = readStringPayload(next, 'patternType');

  if (patternType) {
    tags.add(patternType);
  }

  return [...tags];
}

function shouldPromoteNodeToGlobal(node: GraphNode, corrections: readonly ManualCorrectionRecord[]): boolean {
  if (!isPromotedPatternType(node.type) || node.scope !== 'workspace') {
    return false;
  }

  const manualDecision = resolvePromotionDecision(node.id, corrections);

  if (manualDecision === 'retire' || manualDecision === 'hold') {
    return false;
  }

  if (readPromotionState(node) === 'retired' || readPromotionState(node) === 'downgraded') {
    return false;
  }

  if (manualDecision === 'promote') {
    return true;
  }

  return readObservationCount(node) >= 3 && node.confidence >= 0.78;
}

function buildGlobalPromotionNodeId(nodeId: string): string {
  return `global:${nodeId}`;
}

function cloneNodeToGlobalScope(node: GraphNode, sourceBundleId: string): GraphNode {
  return {
    ...node,
    id: buildGlobalPromotionNodeId(node.id),
    scope: 'global',
    payload: {
      ...node.payload,
      scopeOrigin: node.scope,
      sourceScopedNodeId: node.id,
      lastSourceBundleId: sourceBundleId
    },
    provenance: {
      ...(node.provenance ?? {
        originKind: 'derived',
        sourceStage: 'runtime_bundle',
        producer: 'compact-context'
      }),
      sourceBundleId,
      derivedFromNodeIds: dedupeStrings([...(node.provenance?.derivedFromNodeIds ?? []), node.id])
    },
    governance: undefined,
    version: node.version,
    updatedAt: new Date().toISOString()
  };
}

function applyPromotionDecision(node: GraphNode, corrections: readonly ManualCorrectionRecord[]): GraphNode {
  if (!isPromotedPatternType(node.type)) {
    return node;
  }

  const decision =
    resolvePromotionDecision(node.id, corrections) ??
    resolvePromotionDecision(readStringPayload(node, 'sourceScopedNodeId') ?? '', corrections);

  if (!decision) {
    return node;
  }

  if (decision === 'retire') {
    return {
      ...node,
      freshness: 'superseded',
      payload: {
        ...node.payload,
        promotionState: 'retired',
        decayState: 'stale'
      }
    };
  }

  if (decision === 'hold') {
    return {
      ...node,
      payload: {
        ...node.payload,
        promotionState: 'downgraded',
        decayState: 'cooling',
        downgradeCount: readDowngradeCount(node) + 1
      }
    };
  }

  return {
    ...node,
    payload: {
      ...node.payload,
      promotionState: 'reinforced',
      decayState: 'fresh'
    }
  };
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}
