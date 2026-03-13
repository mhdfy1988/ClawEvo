import type {
  EdgeType,
  Freshness,
  GraphEdge,
  GraphNode,
  JsonObject,
  NodeType,
  ProvenanceOriginKind,
  ProvenanceRef,
  RuntimeContextSelectionSlot,
  RuntimeContextBundle,
  Scope,
  SessionCheckpoint,
  SessionDelta,
  SkillCandidate,
  SourceRef
} from './core.js';

export type RawContextSourceType =
  | 'conversation'
  | 'document'
  | 'rule'
  | 'workflow'
  | 'skill'
  | 'tool_output'
  | 'system';

export interface RawContextRecord {
  id?: string;
  sessionId?: string;
  scope: Scope;
  sourceType: RawContextSourceType;
  role?: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata?: JsonObject;
  sourceRef?: SourceRef;
  provenance?: ProvenanceRef;
  createdAt?: string;
}

export interface RawContextInput {
  sessionId: string;
  workspaceId?: string;
  records: RawContextRecord[];
}

export interface IngestResult {
  candidateNodes: GraphNode[];
  candidateEdges: GraphEdge[];
  persistedNodeIds: string[];
  persistedEdgeIds: string[];
  warnings: string[];
}

export interface GraphNodeFilter {
  types?: NodeType[];
  scopes?: Scope[];
  freshness?: Freshness[];
  originKinds?: ProvenanceOriginKind[];
  sessionId?: string;
  workspaceId?: string;
  text?: string;
  limit?: number;
}

export interface GraphEdgeFilter {
  types?: EdgeType[];
  scopes?: Scope[];
  nodeId?: string;
  sessionId?: string;
  workspaceId?: string;
  limit?: number;
}

export interface CompileContextRequest {
  sessionId: string;
  query: string;
  goalLabel?: string;
  intentLabel?: string;
  tokenBudget: number;
}

export interface CheckpointRequest {
  sessionId: string;
  bundle: RuntimeContextBundle;
  previousCheckpoint?: SessionCheckpoint;
}

export interface CheckpointResult {
  checkpoint: SessionCheckpoint;
  delta: SessionDelta;
}

export interface SkillMiningRequest {
  sessionId: string;
  bundle: RuntimeContextBundle;
  minEvidenceCount?: number;
}

export interface SkillCandidateResult {
  candidates: SkillCandidate[];
}

export interface ExplainRequest {
  nodeId: string;
  selectionContext?: {
    sessionId: string;
    query?: string;
    tokenBudget?: number;
  };
}

export interface ExplainToolResultCompression {
  compressed: true;
  toolName?: string;
  toolCallId?: string;
  status?: string;
  resultKind?: string;
  summary?: string;
  keySignals: string[];
  affectedPaths: string[];
  policyId: string;
  reason?: string;
  droppedSections: string[];
  lookup: {
    rawSourceId?: string;
    artifactPath?: string;
    sourcePath?: string;
    sourceUrl?: string;
    contentHash?: string;
    byteLength?: number;
  };
  metrics?: {
    byteLength?: number;
    lineCount?: number;
    itemCount?: number;
  };
  error?: {
    exitCode?: number;
    code?: string;
  };
}

export interface ExplainResult {
  node?: GraphNode;
  provenance?: ProvenanceRef;
  summary: string;
  sources: SourceRef[];
  toolResultCompression?: ExplainToolResultCompression;
  selection?: {
    included: boolean;
    slot?: RuntimeContextSelectionSlot;
    reason: string;
    query: string;
    tokenBudget: number;
    categoryBudget?: number;
  };
  relatedNodes: Array<{
    id: string;
    type: NodeType;
    label: string;
    provenance?: ProvenanceRef;
  }>;
}
