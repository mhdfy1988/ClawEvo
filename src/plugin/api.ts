import type { SessionCheckpoint, SkillCandidate } from '../types/core.js';
import type {
  CheckpointResult,
  CompileContextRequest,
  ExplainRequest,
  ExplainResult,
  GraphEdgeFilter,
  GraphNodeFilter,
  IngestResult,
  RawContextInput,
  SkillCandidateResult,
  SkillMiningRequest
} from '../types/io.js';

export type ContextPluginMethod =
  | 'health'
  | 'ingest_context'
  | 'compile_context'
  | 'create_checkpoint'
  | 'query_nodes'
  | 'query_edges'
  | 'get_latest_checkpoint'
  | 'list_checkpoints'
  | 'crystallize_skills'
  | 'list_skill_candidates'
  | 'explain';

export interface PluginRequestBase<TMethod extends ContextPluginMethod, TPayload> {
  requestId: string;
  method: TMethod;
  payload: TPayload;
}

export type HealthRequest = PluginRequestBase<'health', { includeStorage?: boolean }>;
export type IngestContextRequest = PluginRequestBase<'ingest_context', RawContextInput>;
export type CompileContextPluginRequest = PluginRequestBase<'compile_context', CompileContextRequest>;
export type CreateCheckpointPluginRequest = PluginRequestBase<
  'create_checkpoint',
  {
    sessionId: string;
    bundle: Awaited<ReturnTypeLike<'compile_context'>>;
  }
>;
export type QueryNodesPluginRequest = PluginRequestBase<'query_nodes', { filter?: GraphNodeFilter }>;
export type QueryEdgesPluginRequest = PluginRequestBase<'query_edges', { filter?: GraphEdgeFilter }>;
export type GetLatestCheckpointPluginRequest = PluginRequestBase<'get_latest_checkpoint', { sessionId: string }>;
export type ListCheckpointsPluginRequest = PluginRequestBase<
  'list_checkpoints',
  { sessionId: string; limit?: number }
>;
export type CrystallizeSkillsPluginRequest = PluginRequestBase<'crystallize_skills', SkillMiningRequest>;
export type ListSkillCandidatesPluginRequest = PluginRequestBase<
  'list_skill_candidates',
  { sessionId: string; limit?: number }
>;
export type ExplainPluginRequest = PluginRequestBase<'explain', ExplainRequest>;

export type ContextPluginRequest =
  | HealthRequest
  | IngestContextRequest
  | CompileContextPluginRequest
  | CreateCheckpointPluginRequest
  | QueryNodesPluginRequest
  | QueryEdgesPluginRequest
  | GetLatestCheckpointPluginRequest
  | ListCheckpointsPluginRequest
  | CrystallizeSkillsPluginRequest
  | ListSkillCandidatesPluginRequest
  | ExplainPluginRequest;

export interface PluginResponseBase<TMethod extends ContextPluginMethod, TData> {
  requestId: string;
  method: TMethod;
  ok: boolean;
  data: TData;
  error?: {
    code: string;
    message: string;
  };
}

export type HealthResponse = PluginResponseBase<
  'health',
  {
    ok: true;
    storage?: {
      graph: 'memory' | 'sqlite';
      persistence: 'memory' | 'sqlite';
    };
  }
>;

export type IngestContextResponse = PluginResponseBase<'ingest_context', IngestResult>;
export type CompileContextPluginResponse = PluginResponseBase<
  'compile_context',
  Awaited<ReturnTypeLike<'compile_context'>>
>;
export type CreateCheckpointPluginResponse = PluginResponseBase<'create_checkpoint', CheckpointResult>;
export type QueryNodesPluginResponse = PluginResponseBase<'query_nodes', { nodes: Awaited<ReturnTypeLike<'query_nodes'>> }>;
export type QueryEdgesPluginResponse = PluginResponseBase<'query_edges', { edges: Awaited<ReturnTypeLike<'query_edges'>> }>;
export type GetLatestCheckpointPluginResponse = PluginResponseBase<
  'get_latest_checkpoint',
  { checkpoint?: SessionCheckpoint }
>;
export type ListCheckpointsPluginResponse = PluginResponseBase<
  'list_checkpoints',
  { checkpoints: Awaited<ReturnTypeLike<'list_checkpoints'>> }
>;
export type CrystallizeSkillsPluginResponse = PluginResponseBase<'crystallize_skills', SkillCandidateResult>;
export type ListSkillCandidatesPluginResponse = PluginResponseBase<
  'list_skill_candidates',
  { candidates: SkillCandidate[] }
>;
export type ExplainPluginResponse = PluginResponseBase<'explain', ExplainResult>;

export type ContextPluginResponse =
  | HealthResponse
  | IngestContextResponse
  | CompileContextPluginResponse
  | CreateCheckpointPluginResponse
  | QueryNodesPluginResponse
  | QueryEdgesPluginResponse
  | GetLatestCheckpointPluginResponse
  | ListCheckpointsPluginResponse
  | CrystallizeSkillsPluginResponse
  | ListSkillCandidatesPluginResponse
  | ExplainPluginResponse;

type ReturnTypeLike<TMethod extends ContextPluginMethod> = TMethod extends 'compile_context'
  ? Promise<import('../types/core.js').RuntimeContextBundle>
  : TMethod extends 'query_nodes'
    ? Promise<import('../types/core.js').GraphNode[]>
    : TMethod extends 'query_edges'
      ? Promise<import('../types/core.js').GraphEdge[]>
      : TMethod extends 'list_checkpoints'
        ? Promise<SessionCheckpoint[]>
        : never;
