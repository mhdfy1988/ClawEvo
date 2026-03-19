PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_path TEXT,
  source_span TEXT,
  content_hash TEXT,
  extractor TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  scope TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  strength TEXT NOT NULL,
  confidence REAL NOT NULL,
  source_id TEXT,
  origin_kind TEXT NOT NULL DEFAULT 'raw',
  provenance_json TEXT NOT NULL DEFAULT '{}',
  governance_json TEXT NOT NULL DEFAULT '{}',
  version TEXT,
  freshness TEXT NOT NULL DEFAULT 'active',
  valid_from TEXT,
  valid_to TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES sources (id)
);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT NOT NULL,
  scope TEXT NOT NULL,
  strength TEXT NOT NULL,
  confidence REAL NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  source_id TEXT,
  version TEXT,
  valid_from TEXT,
  valid_to TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (from_id) REFERENCES nodes (id),
  FOREIGN KEY (to_id) REFERENCES nodes (id),
  FOREIGN KEY (source_id) REFERENCES sources (id)
);

CREATE INDEX IF NOT EXISTS idx_edges_from_id ON edges (from_id);
CREATE INDEX IF NOT EXISTS idx_edges_to_id ON edges (to_id);
CREATE INDEX IF NOT EXISTS idx_edges_type_scope_updated_at ON edges (type, scope, updated_at DESC);

CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  lifecycle_json TEXT NOT NULL DEFAULT '{}',
  provenance_json TEXT NOT NULL DEFAULT '{}',
  token_estimate INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compression_states (
  session_id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deltas (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  checkpoint_id TEXT,
  delta_json TEXT NOT NULL,
  provenance_json TEXT NOT NULL DEFAULT '{}',
  token_estimate INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (checkpoint_id) REFERENCES checkpoints (id)
);

CREATE TABLE IF NOT EXISTS skill_candidates (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  name TEXT NOT NULL,
  trigger_json TEXT NOT NULL,
  graph_pattern_json TEXT NOT NULL,
  candidate_json TEXT NOT NULL DEFAULT '{}',
  provenance_json TEXT NOT NULL DEFAULT '{}',
  stability_score REAL NOT NULL,
  success_score REAL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manual_corrections (
  id TEXT PRIMARY KEY,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL,
  author TEXT NOT NULL,
  reason TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fts_chunks (
  rowid INTEGER PRIMARY KEY,
  source_id TEXT,
  scope TEXT NOT NULL,
  chunk_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES sources (id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_chunks_index USING fts5(
  content,
  metadata_json,
  content = 'fts_chunks',
  content_rowid = 'rowid'
);

CREATE INDEX IF NOT EXISTS idx_nodes_type_scope ON nodes (type, scope);
CREATE INDEX IF NOT EXISTS idx_nodes_kind_freshness ON nodes (kind, freshness);
CREATE INDEX IF NOT EXISTS idx_nodes_origin_kind ON nodes (origin_kind);
CREATE INDEX IF NOT EXISTS idx_nodes_type_freshness_origin ON nodes (type, freshness, origin_kind);
CREATE INDEX IF NOT EXISTS idx_edges_from_type ON edges (from_id, type);
CREATE INDEX IF NOT EXISTS idx_edges_to_type ON edges (to_id, type);
CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON checkpoints (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_compression_states_updated_at ON compression_states (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_deltas_session ON deltas (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_skill_candidates_session ON skill_candidates (session_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_manual_corrections_target ON manual_corrections (target_kind, target_id, created_at DESC);
