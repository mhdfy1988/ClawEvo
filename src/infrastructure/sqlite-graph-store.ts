import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import type {
  CheckpointLifecycle,
  Freshness,
  GraphEdge,
  GraphNode,
  JsonObject,
  KnowledgeKind,
  KnowledgeStrength,
  NodeGovernance,
  NodeType,
  ProvenanceOriginKind,
  ProvenanceRef,
  SessionCheckpoint,
  SessionDelta,
  SkillCandidate,
  Scope,
  SourceRef
} from '../types/core.js';
import type { ManualCorrectionRecord } from '../types/context-processing.js';
import type { GraphEdgeFilter, GraphNodeFilter } from '../types/io.js';
import type { ContextPersistenceStore } from './context-persistence.js';
import type { GraphStore } from './graph-store.js';
import { normalizeNodeGovernance } from '../governance/governance.js';
import { normalizeEdgeGovernance } from '../governance/relation-contract.js';
import { matchesTextFilter } from './text-search.js';

const DEFAULT_SCHEMA_PATH = fileURLToPath(new URL('../../schema/sqlite/001_init.sql', import.meta.url));

export interface SqliteGraphStoreOptions {
  dbPath: string;
  schemaPath?: string;
}

interface NodeRow {
  id: string;
  type: NodeType;
  scope: Scope;
  kind: KnowledgeKind;
  label: string;
  payload_json: string;
  governance_json: string;
  strength: KnowledgeStrength;
  confidence: number;
  origin_kind: ProvenanceOriginKind;
  provenance_json: string;
  version: string;
  freshness: Freshness;
  valid_from: string;
  valid_to: string | null;
  updated_at: string;
  source_type: string | null;
  source_path: string | null;
  source_span: string | null;
  content_hash: string | null;
  extractor: string | null;
}

interface EdgeRow {
  id: string;
  from_id: string;
  to_id: string;
  type: GraphEdge['type'];
  scope: Scope;
  strength: KnowledgeStrength;
  confidence: number;
  payload_json: string;
  version: string;
  valid_from: string;
  valid_to: string | null;
  updated_at: string;
  source_type: string | null;
  source_path: string | null;
  source_span: string | null;
  content_hash: string | null;
  extractor: string | null;
}

interface CheckpointRow {
  id: string;
  session_id: string;
  summary_json: string;
  lifecycle_json: string;
  provenance_json: string;
  token_estimate: number;
  created_at: string;
}

interface DeltaRow {
  id: string;
  session_id: string;
  checkpoint_id: string | null;
  delta_json: string;
  provenance_json: string;
  token_estimate: number;
  created_at: string;
}

interface SkillCandidateRow {
  id: string;
  session_id: string | null;
  candidate_json: string;
  provenance_json: string;
  created_at: string;
}

interface ManualCorrectionRow {
  id: string;
  target_kind: ManualCorrectionRecord['targetKind'];
  target_id: string;
  action: ManualCorrectionRecord['action'];
  author: string;
  reason: string;
  metadata_json: string;
  created_at: string;
}

interface LegacyNodeBackfillRow {
  id: string;
  type: NodeType;
  label: string;
  payload_json: string;
  origin_kind: ProvenanceOriginKind;
  provenance_json: string;
  content_hash: string | null;
}

interface LegacyCheckpointBackfillRow {
  id: string;
  provenance_json: string;
}

interface LegacyDeltaBackfillRow {
  id: string;
  checkpoint_id: string | null;
  provenance_json: string;
}

interface LegacySkillBackfillRow {
  id: string;
  candidate_json: string;
  provenance_json: string;
}

export class SqliteGraphStore implements GraphStore, ContextPersistenceStore {
  static async open(options: SqliteGraphStoreOptions): Promise<SqliteGraphStore> {
    if (options.dbPath !== ':memory:') {
      await mkdir(dirname(options.dbPath), { recursive: true });
    }

    const schemaPath = options.schemaPath ?? DEFAULT_SCHEMA_PATH;
    const schemaSql = await readFile(schemaPath, 'utf8');
    const db = new DatabaseSync(options.dbPath);

    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(schemaSql);
    ensureColumn(db, 'nodes', 'origin_kind', "TEXT NOT NULL DEFAULT 'raw'");
    ensureColumn(db, 'nodes', 'provenance_json', "TEXT NOT NULL DEFAULT '{}'");
    ensureColumn(db, 'nodes', 'governance_json', "TEXT NOT NULL DEFAULT '{}'");
    ensureColumn(db, 'edges', 'payload_json', "TEXT NOT NULL DEFAULT '{}'");
    ensureColumn(db, 'checkpoints', 'lifecycle_json', "TEXT NOT NULL DEFAULT '{}'");
    ensureColumn(db, 'checkpoints', 'provenance_json', "TEXT NOT NULL DEFAULT '{}'");
    ensureColumn(db, 'deltas', 'provenance_json', "TEXT NOT NULL DEFAULT '{}'");
    ensureColumn(db, 'skill_candidates', 'session_id', 'TEXT');
    ensureColumn(db, 'skill_candidates', 'candidate_json', "TEXT NOT NULL DEFAULT '{}'");
    ensureColumn(db, 'skill_candidates', 'provenance_json', "TEXT NOT NULL DEFAULT '{}'");
    backfillLegacyProvenance(db);

    return new SqliteGraphStore(db);
  }

  private readonly db: DatabaseSync;

  private constructor(db: DatabaseSync) {
    this.db = db;
  }

  async upsertNodes(nodes: GraphNode[]): Promise<void> {
    if (nodes.length === 0) {
      return;
    }

    this.db.exec('BEGIN');

    try {
      for (const node of nodes) {
        const governance = normalizeNodeGovernance(node);
        const sourceId = this.upsertSource(node.sourceRef);

        this.db
          .prepare(
            `
              INSERT INTO nodes (
                id, type, scope, kind, label, payload_json, strength, confidence,
                source_id, origin_kind, provenance_json, governance_json, version, freshness, valid_from, valid_to, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                type = excluded.type,
                scope = excluded.scope,
                kind = excluded.kind,
                label = excluded.label,
                payload_json = excluded.payload_json,
                strength = excluded.strength,
                confidence = excluded.confidence,
                source_id = excluded.source_id,
                origin_kind = excluded.origin_kind,
                provenance_json = excluded.provenance_json,
                governance_json = excluded.governance_json,
                version = excluded.version,
                freshness = excluded.freshness,
                valid_from = excluded.valid_from,
                valid_to = excluded.valid_to,
                updated_at = excluded.updated_at
            `
          )
          .run(
            node.id,
            node.type,
            node.scope,
            node.kind,
            node.label,
            stringifyJson(node.payload),
            node.strength,
            node.confidence,
            sourceId ?? null,
            governance.knowledgeState,
            stringifyProvenance(governance.provenance ?? node.provenance),
            stringifyGovernance(governance),
            node.version,
            node.freshness,
            node.validFrom,
            node.validTo ?? null,
            node.updatedAt
          );
      }

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async upsertEdges(edges: GraphEdge[]): Promise<void> {
    if (edges.length === 0) {
      return;
    }

    this.db.exec('BEGIN');

    try {
      for (const edge of edges) {
        const sourceId = this.upsertSource(edge.sourceRef);

        this.db
          .prepare(
            `
              INSERT INTO edges (
                id, from_id, to_id, type, scope, strength, confidence, payload_json,
                source_id, version, valid_from, valid_to, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                from_id = excluded.from_id,
                to_id = excluded.to_id,
                type = excluded.type,
                scope = excluded.scope,
                strength = excluded.strength,
                confidence = excluded.confidence,
                payload_json = excluded.payload_json,
                source_id = excluded.source_id,
                version = excluded.version,
                valid_from = excluded.valid_from,
                valid_to = excluded.valid_to,
                updated_at = excluded.updated_at
            `
          )
          .run(
            edge.id,
            edge.fromId,
            edge.toId,
            edge.type,
            edge.scope,
            edge.strength,
            edge.confidence,
            stringifyJson(edge.payload ?? {}),
            sourceId ?? null,
            edge.version,
            edge.validFrom,
            edge.validTo ?? null,
            edge.updatedAt
          );
      }

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async getNode(id: string): Promise<GraphNode | undefined> {
    const row = this.db
      .prepare(
        `
          SELECT
            n.*,
            s.source_type,
            s.source_path,
            s.source_span,
            s.content_hash,
            s.extractor
          FROM nodes n
          LEFT JOIN sources s ON s.id = n.source_id
          WHERE n.id = ?
        `
      )
      .get(id) as NodeRow | undefined;

    return row ? mapNodeRow(row) : undefined;
  }

  async getNodesByIds(ids: string[]): Promise<GraphNode[]> {
    const chunks = chunkArray(dedupeIds(ids), 200);
    const rows: NodeRow[] = [];

    for (const chunk of chunks) {
      if (chunk.length === 0) {
        continue;
      }

      rows.push(
        ...((this.db
          .prepare(
            `
              SELECT
                n.*,
                s.source_type,
                s.source_path,
                s.source_span,
                s.content_hash,
                s.extractor
              FROM nodes n
              LEFT JOIN sources s ON s.id = n.source_id
              WHERE n.id IN (${repeatPlaceholders(chunk.length)})
            `
          )
          .all(...chunk) as unknown) as NodeRow[])
      );
    }

    const nodesById = new Map(rows.map((row) => [row.id, mapNodeRow(row)]));
    return ids.map((id) => nodesById.get(id)).filter((node): node is GraphNode => Boolean(node));
  }

  async queryNodes(filter: GraphNodeFilter = {}): Promise<GraphNode[]> {
    const { whereSql, params } = buildNodeWhere(filter);
    const applySqlLimit = typeof filter.limit === 'number' && !filter.text;
    const limitSql = applySqlLimit ? ' LIMIT ?' : '';
    const rows = this.db
      .prepare(
        `
          SELECT
            n.*,
            s.source_type,
            s.source_path,
            s.source_span,
            s.content_hash,
            s.extractor
          FROM nodes n
          LEFT JOIN sources s ON s.id = n.source_id
          ${whereSql}
          ORDER BY n.updated_at DESC, n.label ASC, n.id ASC${limitSql}
        `
      )
      .all(...(applySqlLimit ? [...params, filter.limit as number] : params)) as unknown as NodeRow[];

    const nodes = rows.map(mapNodeRow);
    const filtered = filter.text
      ? nodes.filter((node) => {
          const payload = JSON.stringify(node.payload);
          return matchesTextFilter(node.label, filter.text as string) || matchesTextFilter(payload, filter.text as string);
        })
      : nodes;

    return typeof filter.limit === 'number' ? filtered.slice(0, filter.limit) : filtered;
  }

  async queryEdges(filter: GraphEdgeFilter = {}): Promise<GraphEdge[]> {
    const { whereSql, params } = buildEdgeWhere(filter);
    const limitSql = typeof filter.limit === 'number' ? ' LIMIT ?' : '';
    const rows = this.db
      .prepare(
        `
          SELECT
            e.*,
            s.source_type,
            s.source_path,
            s.source_span,
            s.content_hash,
            s.extractor
          FROM edges e
          LEFT JOIN sources s ON s.id = e.source_id
          ${whereSql}
          ORDER BY e.updated_at DESC, e.id ASC${limitSql}
        `
      )
      .all(...(typeof filter.limit === 'number' ? [...params, filter.limit] : params)) as unknown as EdgeRow[];

    return rows.map(mapEdgeRow);
  }

  async getEdgesForNode(nodeId: string): Promise<GraphEdge[]> {
    return this.queryEdges({ nodeId });
  }

  async getEdgesForNodes(nodeIds: string[]): Promise<GraphEdge[]> {
    const chunks = chunkArray(dedupeIds(nodeIds), 100);
    const edgesById = new Map<string, GraphEdge>();

    for (const chunk of chunks) {
      if (chunk.length === 0) {
        continue;
      }

      const rows = this.db
        .prepare(
          `
            SELECT
              e.*,
              s.source_type,
              s.source_path,
              s.source_span,
              s.content_hash,
              s.extractor
            FROM edges e
            LEFT JOIN sources s ON s.id = e.source_id
            WHERE e.from_id IN (${repeatPlaceholders(chunk.length)})
               OR e.to_id IN (${repeatPlaceholders(chunk.length)})
          `
        )
        .all(...chunk, ...chunk) as unknown as EdgeRow[];

      for (const row of rows) {
        const edge = mapEdgeRow(row);
        edgesById.set(edge.id, edge);
      }
    }

    return [...edgesById.values()].sort((left, right) => compareGraphEdgeOrder(left, right));
  }

  async saveCheckpoint(checkpoint: SessionCheckpoint): Promise<void> {
    this.db
      .prepare(
        `
          INSERT INTO checkpoints (id, session_id, summary_json, lifecycle_json, provenance_json, token_estimate, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            session_id = excluded.session_id,
            summary_json = excluded.summary_json,
            lifecycle_json = excluded.lifecycle_json,
            provenance_json = excluded.provenance_json,
            token_estimate = excluded.token_estimate,
            created_at = excluded.created_at
        `
      )
      .run(
        checkpoint.id,
        checkpoint.sessionId,
        JSON.stringify(checkpoint.summary),
        stringifyCheckpointLifecycle(checkpoint.lifecycle),
        stringifyProvenance(checkpoint.provenance),
        checkpoint.tokenEstimate,
        checkpoint.createdAt
      );
  }

  async saveDelta(delta: SessionDelta): Promise<void> {
    this.db
      .prepare(
        `
          INSERT INTO deltas (id, session_id, checkpoint_id, delta_json, provenance_json, token_estimate, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            session_id = excluded.session_id,
            checkpoint_id = excluded.checkpoint_id,
            delta_json = excluded.delta_json,
            provenance_json = excluded.provenance_json,
            token_estimate = excluded.token_estimate,
            created_at = excluded.created_at
        `
      )
      .run(
        delta.id,
        delta.sessionId,
        delta.checkpointId ?? null,
        JSON.stringify({
          sourceBundleId: delta.sourceBundleId,
          addedRuleIds: delta.addedRuleIds,
          addedConstraintIds: delta.addedConstraintIds,
          addedDecisionIds: delta.addedDecisionIds,
          addedStateIds: delta.addedStateIds,
          addedRiskIds: delta.addedRiskIds
        }),
        stringifyProvenance(delta.provenance),
        delta.tokenEstimate,
        delta.createdAt
      );
  }

  async getLatestCheckpoint(sessionId: string): Promise<SessionCheckpoint | undefined> {
    const row = this.db
      .prepare(
        `
          SELECT id, session_id, summary_json, lifecycle_json, provenance_json, token_estimate, created_at
          FROM checkpoints
          WHERE session_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `
      )
      .get(sessionId) as CheckpointRow | undefined;

    return row ? mapCheckpointRow(row) : undefined;
  }

  async listCheckpoints(sessionId: string, limit = 20): Promise<SessionCheckpoint[]> {
    const rows = this.db
      .prepare(
        `
          SELECT id, session_id, summary_json, lifecycle_json, provenance_json, token_estimate, created_at
          FROM checkpoints
          WHERE session_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `
      )
      .all(sessionId, limit) as unknown as CheckpointRow[];

    return rows.map(mapCheckpointRow);
  }

  async listDeltas(sessionId: string, limit = 20): Promise<SessionDelta[]> {
    const rows = this.db
      .prepare(
        `
          SELECT id, session_id, checkpoint_id, delta_json, provenance_json, token_estimate, created_at
          FROM deltas
          WHERE session_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `
      )
      .all(sessionId, limit) as unknown as DeltaRow[];

    return rows.map(mapDeltaRow);
  }

  async saveSkillCandidates(sessionId: string, candidates: SkillCandidate[]): Promise<void> {
    if (candidates.length === 0) {
      return;
    }

    this.db.exec('BEGIN');

    try {
      for (const candidate of candidates) {
        const graphPattern = {
          applicableWhen: candidate.applicableWhen,
          requiredRuleIds: candidate.requiredRuleIds,
          requiredConstraintIds: candidate.requiredConstraintIds,
          workflowSteps: candidate.workflowSteps,
          evidenceNodeIds: candidate.evidenceNodeIds,
          failureSignals: candidate.failureSignals
        };

        this.db
          .prepare(
            `
              INSERT INTO skill_candidates (
                id, session_id, name, trigger_json, graph_pattern_json, candidate_json, provenance_json,
                stability_score, success_score, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                session_id = excluded.session_id,
                name = excluded.name,
                trigger_json = excluded.trigger_json,
                graph_pattern_json = excluded.graph_pattern_json,
                candidate_json = excluded.candidate_json,
                provenance_json = excluded.provenance_json,
                stability_score = excluded.stability_score,
                success_score = excluded.success_score,
                status = excluded.status,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at
            `
          )
          .run(
            candidate.id,
            sessionId,
            candidate.name,
            JSON.stringify(candidate.trigger),
            JSON.stringify(graphPattern),
            JSON.stringify(candidate),
            stringifyProvenance(candidate.provenance),
            candidate.scores.stability,
            candidate.scores.success,
            'candidate',
            candidate.createdAt,
            new Date().toISOString()
          );
      }

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async listSkillCandidates(sessionId: string, limit = 20): Promise<SkillCandidate[]> {
    const rows = this.db
      .prepare(
        `
          SELECT id, session_id, candidate_json, provenance_json, created_at
          FROM skill_candidates
          WHERE session_id = ?
          ORDER BY updated_at DESC
          LIMIT ?
        `
      )
      .all(sessionId, limit) as unknown as SkillCandidateRow[];

    return rows.map((row) => {
      const candidate = JSON.parse(row.candidate_json) as SkillCandidate;
      return {
        ...candidate,
        provenance: candidate.provenance ?? parseProvenance(row.provenance_json)
      };
    });
  }

  async saveManualCorrections(corrections: ManualCorrectionRecord[]): Promise<void> {
    if (corrections.length === 0) {
      return;
    }

    this.db.exec('BEGIN');

    try {
      for (const correction of corrections) {
        this.db
          .prepare(
            `
              INSERT INTO manual_corrections (
                id, target_kind, target_id, action, author, reason, metadata_json, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                target_kind = excluded.target_kind,
                target_id = excluded.target_id,
                action = excluded.action,
                author = excluded.author,
                reason = excluded.reason,
                metadata_json = excluded.metadata_json,
                created_at = excluded.created_at
            `
          )
          .run(
            correction.id,
            correction.targetKind,
            correction.targetId,
            correction.action,
            correction.author,
            correction.reason,
            JSON.stringify(correction.metadata ?? {}),
            correction.createdAt
          );
      }

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async listManualCorrections(limit = 200): Promise<ManualCorrectionRecord[]> {
    const rows = this.db
      .prepare(
        `
          SELECT id, target_kind, target_id, action, author, reason, metadata_json, created_at
          FROM manual_corrections
          ORDER BY created_at DESC
          LIMIT ?
        `
      )
      .all(limit) as unknown as ManualCorrectionRow[];

    return rows.map(mapManualCorrectionRow);
  }

  async close(): Promise<void> {
    this.db.close();
  }

  private upsertSource(sourceRef?: SourceRef): string | undefined {
    if (!sourceRef) {
      return undefined;
    }

    const sourceId = sourceIdFromRef(sourceRef);

    this.db
      .prepare(
        `
          INSERT INTO sources (
            id, source_type, source_path, source_span, content_hash, extractor, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            source_type = excluded.source_type,
            source_path = excluded.source_path,
            source_span = excluded.source_span,
            content_hash = excluded.content_hash,
            extractor = excluded.extractor
        `
      )
      .run(
        sourceId,
        sourceRef.sourceType,
        sourceRef.sourcePath ?? null,
        sourceRef.sourceSpan ?? null,
        sourceRef.contentHash ?? null,
        sourceRef.extractor ?? null,
        new Date().toISOString()
      );

    return sourceId;
  }
}

function buildNodeWhere(filter: GraphNodeFilter): { whereSql: string; params: Array<string | number> } {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (filter.types?.length) {
    clauses.push(`n.type IN (${repeatPlaceholders(filter.types.length)})`);
    params.push(...filter.types);
  }

  if (filter.scopes?.length) {
    clauses.push(`n.scope IN (${repeatPlaceholders(filter.scopes.length)})`);
    params.push(...filter.scopes);
  }

  if (filter.freshness?.length) {
    clauses.push(`n.freshness IN (${repeatPlaceholders(filter.freshness.length)})`);
    params.push(...filter.freshness);
  }

  if (filter.originKinds?.length) {
    clauses.push(`n.origin_kind IN (${repeatPlaceholders(filter.originKinds.length)})`);
    params.push(...filter.originKinds);
  }

  if (filter.sessionId) {
    clauses.push(`json_extract(n.payload_json, '$.sessionId') = ?`);
    params.push(filter.sessionId);
  }

  if (filter.workspaceId) {
    clauses.push(`json_extract(n.payload_json, '$.workspaceId') = ?`);
    params.push(filter.workspaceId);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

function buildEdgeWhere(filter: GraphEdgeFilter): { whereSql: string; params: Array<string | number> } {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (filter.types?.length) {
    clauses.push(`e.type IN (${repeatPlaceholders(filter.types.length)})`);
    params.push(...filter.types);
  }

  if (filter.scopes?.length) {
    clauses.push(`e.scope IN (${repeatPlaceholders(filter.scopes.length)})`);
    params.push(...filter.scopes);
  }

  if (filter.nodeId) {
    clauses.push('(e.from_id = ? OR e.to_id = ?)');
    params.push(filter.nodeId, filter.nodeId);
  }

  if (filter.sessionId) {
    clauses.push(`json_extract(e.payload_json, '$.sessionId') = ?`);
    params.push(filter.sessionId);
  }

  if (filter.workspaceId) {
    clauses.push(`json_extract(e.payload_json, '$.workspaceId') = ?`);
    params.push(filter.workspaceId);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

function repeatPlaceholders(count: number): string {
  return new Array(count).fill('?').join(', ');
}

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function chunkArray<TValue>(values: TValue[], size: number): TValue[][] {
  if (values.length === 0) {
    return [];
  }

  const chunks: TValue[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function mapNodeRow(row: NodeRow): GraphNode {
  const node: GraphNode = {
    id: row.id,
    type: row.type,
    scope: row.scope,
    kind: row.kind,
    label: row.label,
    payload: parseJsonObject(row.payload_json),
    strength: row.strength,
    confidence: row.confidence,
    sourceRef: mapSourceRef(row),
    provenance: parseProvenance(row.provenance_json, row.origin_kind),
    version: row.version,
    freshness: row.freshness,
    validFrom: row.valid_from,
    validTo: row.valid_to ?? undefined,
    updatedAt: row.updated_at
  };

  return {
    ...node,
    governance: normalizeNodeGovernance({
      ...node,
      governance: parseGovernance(row.governance_json)
    })
  };
}

function mapEdgeRow(row: EdgeRow): GraphEdge {
  const edge: GraphEdge = {
    id: row.id,
    fromId: row.from_id,
    toId: row.to_id,
    type: row.type,
    scope: row.scope,
    strength: row.strength,
    confidence: row.confidence,
    payload: parseJsonObject(row.payload_json),
    sourceRef: mapSourceRef(row),
    version: row.version,
    validFrom: row.valid_from,
    validTo: row.valid_to ?? undefined,
    updatedAt: row.updated_at
  };

  return {
    ...edge,
    governance: normalizeEdgeGovernance(edge)
  };
}

function mapCheckpointRow(row: CheckpointRow): SessionCheckpoint {
  const provenance = parseProvenance(row.provenance_json) ?? buildDerivedProvenance('checkpoint');

  return {
    id: row.id,
    sessionId: row.session_id,
    sourceBundleId: provenance.sourceBundleId,
    summary: JSON.parse(row.summary_json) as SessionCheckpoint['summary'],
    lifecycle: parseCheckpointLifecycle(row.lifecycle_json),
    provenance,
    tokenEstimate: row.token_estimate,
    createdAt: row.created_at
  };
}

function mapDeltaRow(row: DeltaRow): SessionDelta {
  const parsed = JSON.parse(row.delta_json) as Omit<SessionDelta, 'id' | 'sessionId' | 'checkpointId' | 'provenance' | 'tokenEstimate' | 'createdAt'>;
  const provenance = parseProvenance(row.provenance_json) ?? buildDerivedProvenance('delta');

  return {
    id: row.id,
    sessionId: row.session_id,
    ...(row.checkpoint_id ? { checkpointId: row.checkpoint_id } : {}),
    sourceBundleId: parsed.sourceBundleId ?? provenance.sourceBundleId,
    provenance,
    addedRuleIds: parsed.addedRuleIds ?? [],
    addedConstraintIds: parsed.addedConstraintIds ?? [],
    addedDecisionIds: parsed.addedDecisionIds ?? [],
    addedStateIds: parsed.addedStateIds ?? [],
    addedRiskIds: parsed.addedRiskIds ?? [],
    tokenEstimate: row.token_estimate,
    createdAt: row.created_at
  };
}

function mapSourceRef(row: {
  source_type: string | null;
  source_path: string | null;
  source_span: string | null;
  content_hash: string | null;
  extractor: string | null;
}): SourceRef | undefined {
  if (!row.source_type) {
    return undefined;
  }

  return {
    sourceType: row.source_type,
    sourcePath: row.source_path ?? undefined,
    sourceSpan: row.source_span ?? undefined,
    contentHash: row.content_hash ?? undefined,
    extractor: row.extractor ?? undefined
  };
}

function mapManualCorrectionRow(row: ManualCorrectionRow): ManualCorrectionRecord {
  return {
    id: row.id,
    targetKind: row.target_kind,
    targetId: row.target_id,
    action: row.action,
    author: row.author,
    reason: row.reason,
    createdAt: row.created_at,
    metadata: parseManualCorrectionMetadata(row.metadata_json)
  };
}

function compareGraphEdgeOrder(left: GraphEdge, right: GraphEdge): number {
  const updatedAtDelta = right.updatedAt.localeCompare(left.updatedAt);

  if (updatedAtDelta !== 0) {
    return updatedAtDelta;
  }

  return left.id.localeCompare(right.id);
}

function stringifyJson(value: JsonObject): string {
  return JSON.stringify(value);
}

function stringifyProvenance(value: ProvenanceRef | undefined): string {
  return JSON.stringify(value ?? {});
}

function stringifyGovernance(value: NodeGovernance | undefined): string {
  return JSON.stringify(value ?? {});
}

function stringifyCheckpointLifecycle(value: CheckpointLifecycle | undefined): string {
  return JSON.stringify(value ?? {});
}

function parseJsonObject(value: string): JsonObject {
  return JSON.parse(value) as JsonObject;
}

function parseProvenance(value: string, fallbackOriginKind?: ProvenanceOriginKind): ProvenanceRef | undefined {
  const parsed = JSON.parse(value) as Partial<ProvenanceRef>;

  if (parsed.originKind && parsed.sourceStage && parsed.producer) {
    return parsed as ProvenanceRef;
  }

  if (fallbackOriginKind) {
    return {
      originKind: fallbackOriginKind,
      sourceStage: 'legacy_unknown',
      producer: 'legacy-migration',
      ...(parsed.rawSourceId ? { rawSourceId: parsed.rawSourceId } : {}),
      ...(parsed.rawContentHash ? { rawContentHash: parsed.rawContentHash } : {}),
      ...(parsed.transcriptEntryId ? { transcriptEntryId: parsed.transcriptEntryId } : {}),
      ...(parsed.transcriptParentId ? { transcriptParentId: parsed.transcriptParentId } : {}),
      ...(parsed.derivedFromNodeIds ? { derivedFromNodeIds: parsed.derivedFromNodeIds } : {}),
      ...(parsed.derivedFromCheckpointId ? { derivedFromCheckpointId: parsed.derivedFromCheckpointId } : {}),
      ...(parsed.compressionRunId ? { compressionRunId: parsed.compressionRunId } : {}),
      ...(parsed.createdByHook ? { createdByHook: parsed.createdByHook } : {})
    };
  }

  return undefined;
}

function parseGovernance(value: string): NodeGovernance | undefined {
  if (!value || value === '{}' || value === 'null') {
    return undefined;
  }

  return JSON.parse(value) as NodeGovernance;
}

function parseCheckpointLifecycle(value: string): CheckpointLifecycle | undefined {
  if (!value || value === '{}' || value === 'null') {
    return undefined;
  }

  return JSON.parse(value) as CheckpointLifecycle;
}

function parseManualCorrectionMetadata(value: string): ManualCorrectionRecord['metadata'] {
  if (!value || value === '{}' || value === 'null') {
    return undefined;
  }

  const parsed = JSON.parse(value) as ManualCorrectionRecord['metadata'];
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
}

function buildDerivedProvenance(
  sourceStage: Extract<ProvenanceRef['sourceStage'], 'checkpoint' | 'delta' | 'skill_candidate'>,
  extras: Partial<ProvenanceRef> = {}
): ProvenanceRef {
  return {
    originKind: 'derived',
    sourceStage,
    producer: 'legacy-migration',
    ...extras
  };
}

function backfillLegacyProvenance(db: DatabaseSync): void {
  backfillLegacyNodeProvenance(db);
  backfillLegacyCheckpointProvenance(db);
  backfillLegacyDeltaProvenance(db);
  backfillLegacySkillProvenance(db);
}

function backfillLegacyNodeProvenance(db: DatabaseSync): void {
  const rows = db
    .prepare(
      `
        SELECT
          n.id,
          n.type,
          n.label,
          n.payload_json,
          n.origin_kind,
          n.provenance_json,
          s.content_hash
        FROM nodes n
        LEFT JOIN sources s ON s.id = n.source_id
        WHERE n.provenance_json = '{}' OR n.provenance_json = ''
      `
    )
    .all() as unknown as LegacyNodeBackfillRow[];

  if (rows.length === 0) {
    return;
  }

  const update = db.prepare(`UPDATE nodes SET origin_kind = ?, provenance_json = ? WHERE id = ?`);

  db.exec('BEGIN');

  try {
    for (const row of rows) {
      const payload = parseJsonObject(row.payload_json);
      const provenance = inferLegacyNodeProvenance(row, payload);
      update.run(provenance.originKind, stringifyProvenance(provenance), row.id);
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function backfillLegacyCheckpointProvenance(db: DatabaseSync): void {
  const rows = db
    .prepare(`SELECT id, provenance_json FROM checkpoints WHERE provenance_json = '{}' OR provenance_json = ''`)
    .all() as unknown as LegacyCheckpointBackfillRow[];

  if (rows.length === 0) {
    return;
  }

  const update = db.prepare(`UPDATE checkpoints SET provenance_json = ? WHERE id = ?`);

  db.exec('BEGIN');

  try {
    for (const row of rows) {
      update.run(stringifyProvenance(buildDerivedProvenance('checkpoint')), row.id);
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function backfillLegacyDeltaProvenance(db: DatabaseSync): void {
  const rows = db
    .prepare(
      `SELECT id, checkpoint_id, provenance_json FROM deltas WHERE provenance_json = '{}' OR provenance_json = ''`
    )
    .all() as unknown as LegacyDeltaBackfillRow[];

  if (rows.length === 0) {
    return;
  }

  const update = db.prepare(`UPDATE deltas SET provenance_json = ? WHERE id = ?`);

  db.exec('BEGIN');

  try {
    for (const row of rows) {
      update.run(
        stringifyProvenance(
          buildDerivedProvenance('delta', {
            ...(row.checkpoint_id ? { derivedFromCheckpointId: row.checkpoint_id } : {})
          })
        ),
        row.id
      );
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function backfillLegacySkillProvenance(db: DatabaseSync): void {
  const rows = db
    .prepare(
      `SELECT id, candidate_json, provenance_json FROM skill_candidates WHERE provenance_json = '{}' OR provenance_json = ''`
    )
    .all() as unknown as LegacySkillBackfillRow[];

  if (rows.length === 0) {
    return;
  }

  const update = db.prepare(`UPDATE skill_candidates SET provenance_json = ? WHERE id = ?`);

  db.exec('BEGIN');

  try {
    for (const row of rows) {
      const candidate = JSON.parse(row.candidate_json) as Partial<SkillCandidate>;
      update.run(
        stringifyProvenance(
          buildDerivedProvenance('skill_candidate', {
            ...(candidate.evidenceNodeIds ? { derivedFromNodeIds: candidate.evidenceNodeIds } : {})
          })
        ),
        row.id
      );
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function inferLegacyNodeProvenance(row: LegacyNodeBackfillRow, payload: JsonObject): ProvenanceRef {
  const metadata = readJsonObject(payload, 'metadata');
  const transcriptType = readJsonString(metadata, 'transcriptType');
  const sourceType = readJsonString(payload, 'sourceType') ?? inferSourceTypeFromLabel(row.label);
  const role = readJsonString(payload, 'role');
  const contentHash = row.content_hash ?? undefined;

  if (transcriptType === 'compaction') {
    return {
      originKind: 'compressed',
      sourceStage: 'transcript_compaction',
      producer: readJsonBoolean(metadata, 'fromHook') ? 'compact-context' : 'legacy-migration',
      rawSourceId: row.id,
      rawContentHash: contentHash,
      ...(readJsonString(metadata, 'entryId') ? { transcriptEntryId: readJsonString(metadata, 'entryId') } : {}),
      ...(readJsonString(metadata, 'parentId') ? { transcriptParentId: readJsonString(metadata, 'parentId') } : {}),
      compressionRunId: row.id
    };
  }

  if (transcriptType === 'message') {
    return {
      originKind: 'raw',
      sourceStage: 'transcript_message',
      producer: 'legacy-migration',
      rawSourceId: row.id,
      rawContentHash: contentHash,
      ...(readJsonString(metadata, 'entryId') ? { transcriptEntryId: readJsonString(metadata, 'entryId') } : {}),
      ...(readJsonString(metadata, 'parentId') ? { transcriptParentId: readJsonString(metadata, 'parentId') } : {})
    };
  }

  if (transcriptType === 'custom_message') {
    const compressed = /summary|compact|compression|checkpoint/i.test(
      [
        readJsonString(metadata, 'customType'),
        readJsonString(metadata, 'displayJson'),
        readJsonString(metadata, 'detailsJson')
      ]
        .filter(Boolean)
        .join(' ')
    );

    return {
      originKind: compressed ? 'compressed' : 'raw',
      sourceStage: 'transcript_custom',
      producer: compressed ? 'compact-context' : 'legacy-migration',
      rawSourceId: row.id,
      rawContentHash: contentHash,
      ...(readJsonString(metadata, 'entryId') ? { transcriptEntryId: readJsonString(metadata, 'entryId') } : {}),
      ...(readJsonString(metadata, 'parentId') ? { transcriptParentId: readJsonString(metadata, 'parentId') } : {})
    };
  }

  if (sourceType === 'tool_output' || role === 'tool') {
    return {
      originKind: 'raw',
      sourceStage: 'tool_output_raw',
      producer: 'legacy-migration',
      rawSourceId: row.id,
      rawContentHash: contentHash
    };
  }

  if (sourceType === 'workflow' && row.type !== 'Process' && row.type !== 'Step') {
    return {
      originKind: 'compressed',
      sourceStage: 'runtime_bundle',
      producer: 'legacy-migration',
      rawSourceId: row.id,
      rawContentHash: contentHash,
      compressionRunId: row.id
    };
  }

  if (sourceType === 'document' || sourceType === 'rule') {
    return {
      originKind: 'raw',
      sourceStage: 'document_raw',
      producer: 'legacy-migration',
      rawSourceId: row.id,
      rawContentHash: contentHash
    };
  }

  if (sourceType === 'skill' || (sourceType === 'workflow' && (row.type === 'Process' || row.type === 'Step'))) {
    return {
      originKind: 'raw',
      sourceStage: 'document_extract',
      producer: 'legacy-migration',
      rawSourceId: row.id,
      rawContentHash: contentHash
    };
  }

  return {
    originKind: row.origin_kind ?? 'raw',
    sourceStage: 'legacy_unknown',
    producer: 'legacy-migration',
    rawSourceId: row.id,
    rawContentHash: contentHash
  };
}

function readJsonObject(value: JsonObject, key: string): JsonObject | undefined {
  const next = value[key];
  return next && typeof next === 'object' && !Array.isArray(next) ? (next as JsonObject) : undefined;
}

function readJsonString(value: JsonObject | undefined, key: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const next = value[key];
  return typeof next === 'string' ? next : undefined;
}

function readJsonBoolean(value: JsonObject | undefined, key: string): boolean {
  if (!value) {
    return false;
  }

  return value[key] === true;
}

function inferSourceTypeFromLabel(label: string): string | undefined {
  const separatorIndex = label.indexOf(':');

  if (separatorIndex <= 0) {
    return undefined;
  }

  return label.slice(0, separatorIndex);
}

function sourceIdFromRef(sourceRef: SourceRef): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        sourceType: sourceRef.sourceType,
        sourcePath: sourceRef.sourcePath ?? null,
        sourceSpan: sourceRef.sourceSpan ?? null,
        contentHash: sourceRef.contentHash ?? null,
        extractor: sourceRef.extractor ?? null
      })
    )
    .digest('hex');
}

function ensureColumn(db: DatabaseSync, tableName: string, columnName: string, definition: string): void {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;

  if (rows.some((row) => row.name === columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}
