# 最小可落地实现清单：类、接口、表结构与 Hook 事件

## 1. 文档目标

这份文档把 `compact-context` 的 MVP 实现拆成可直接落地的工程清单。

目标不是再讲一次理念，而是回答下面这些工程问题：

1. 最小可跑版本到底要有哪些类和模块
2. 每个模块的输入输出是什么
3. SQLite 至少要建哪些表
4. OpenClaw hook 事件负载至少要长什么样
5. 开发顺序应该怎么排
6. 每一阶段怎么判断“已经可用”

本清单以当前仓库实现为基线，优先复用现有结构，而不是另起炉灶。

---

## 2. MVP 范围

MVP 只覆盖这条主链：

```text
OpenClaw 触发
-> 获取 transcript / messages
-> 标准化为 RawContextRecord
-> 入图为 Evidence + Semantic Node
-> SQLite 持久化
-> 编译 RuntimeContextBundle
-> assemble() 压缩 prompt
-> afterTurn / compact / after_compaction 生成 checkpoint / delta / skill candidate
```

MVP 暂不强依赖这些能力：

- 外部 LLM 抽取器
- 向量数据库
- 图可视化
- 复杂多跳图推理
- `tool_result_persist` 精细裁剪

---

## 3. 目录与模块清单

推荐继续沿用当前目录分层：

```text
src/
  openclaw/
    index.ts
    context-engine-adapter.ts
    hook-coordinator.ts
    transcript-loader.ts
    types.ts
  engine/
    context-engine.ts
  core/
    ingest-pipeline.ts
    graph-store.ts
    sqlite-graph-store.ts
    context-compiler.ts
    checkpoint-manager.ts
    skill-crystallizer.ts
    audit-explainer.ts
    context-persistence.ts
  plugin/
    api.ts
    context-engine-plugin.ts
  types/
    core.ts
    io.ts
schema/
  sqlite/
    001_init.sql
```

---

## 4. 最小类清单

## 4.1 OpenClaw 接入层

### `src/openclaw/index.ts`

职责：

- 注册插件
- 注册 `context-engine`
- 注册 typed hooks
- 注册调试 gateway 方法

最小验收：

- OpenClaw 能加载插件
- `compact-context` 能出现在 `contextEngine` slot 中

### `ContextEngineRuntimeManager`

文件：

- `src/openclaw/context-engine-adapter.ts`

职责：

- 延迟创建 `ContextEngine`
- 解析 SQLite 路径
- 管理 `stateDir/plugins/compact-context/...`
- 记录“最近由本插件触发过 compaction”的 TTL

最小方法：

```ts
class ContextEngineRuntimeManager {
  get(sessionFile?: string): Promise<ContextEngine>;
  close(): Promise<void>;
  markOwnCompaction(sessionId: string): void;
  wasRecentlyCompactedByPlugin(sessionId: string, withinMs?: number): boolean;
}
```

最小验收：

- 多次调用只打开一次底层引擎
- 插件 compaction 后能避免 `after_compaction` 重复执行

### `OpenClawContextEngineAdapter`

文件：

- `src/openclaw/context-engine-adapter.ts`

职责：

- 实现 OpenClaw `context-engine` 生命周期
- 把宿主消息映射为 `RawContextRecord`
- 在 `assemble()` 中执行压缩

最小方法：

```ts
interface OpenClawContextEngine {
  bootstrap?(params: { sessionId: string; sessionFile: string }): Promise<...>;
  ingest(params: { sessionId: string; message: AgentMessageLike; isHeartbeat?: boolean }): Promise<...>;
  ingestBatch?(params: { sessionId: string; messages: AgentMessageLike[]; isHeartbeat?: boolean }): Promise<...>;
  afterTurn?(params: {
    sessionId: string;
    sessionFile: string;
    messages: AgentMessageLike[];
    prePromptMessageCount: number;
    autoCompactionSummary?: string;
    isHeartbeat?: boolean;
    tokenBudget?: number;
    runtimeContext?: Record<string, unknown>;
  }): Promise<void>;
  assemble(params: { sessionId: string; messages: AgentMessageLike[]; tokenBudget?: number }): Promise<...>;
  compact(params: {
    sessionId: string;
    sessionFile: string;
    tokenBudget?: number;
    force?: boolean;
    currentTokenCount?: number;
    compactionTarget?: 'budget' | 'threshold';
    customInstructions?: string;
    runtimeContext?: Record<string, unknown>;
  }): Promise<...>;
  dispose?(): Promise<void>;
}
```

最小验收：

- `assemble()` 能返回压缩后的 `messages + systemPromptAddition`
- `afterTurn()` 能写 checkpoint 和 skill candidate
- `compact()` 能产出压缩结果

### `registerLifecycleHooks`

文件：

- `src/openclaw/hook-coordinator.ts`

职责：

- 注册 `before_compaction`
- 注册 `after_compaction`
- 在 hook 内做 transcript 同步和 checkpoint 刷新

最小方法：

```ts
function registerLifecycleHooks(
  api: OpenClawPluginApi,
  runtime: ContextEngineRuntimeManager,
  config: NormalizedPluginConfig,
  logger: OpenClawPluginLogger
): void;
```

最小验收：

- `before_compaction` 能 ingest 最新上下文
- `after_compaction` 能刷新 checkpoint / skill candidates

### `loadTranscriptContextInput`

文件：

- `src/openclaw/transcript-loader.ts`

职责：

- 读取 JSONL transcript
- 恢复当前有效 branch
- 转成 `RawContextInput`

最小方法：

```ts
function loadTranscriptContextInput(params: {
  sessionId: string;
  sessionFile: string;
}): Promise<RawContextInput>;
```

最小验收：

- 空 transcript 不报错
- 非法行能跳过
- 能正确恢复叶子分支

---

## 4.2 核心引擎层

### `ContextEngine`

文件：

- `packages/runtime-core/src/engine/context-engine.ts`

职责：

- 组装核心组件
- 作为所有高层操作的统一入口

最小方法：

```ts
class ContextEngine {
  static openSqlite(options: { dbPath: string; schemaPath?: string }): Promise<ContextEngine>;
  ingest(input: RawContextInput): Promise<IngestResult>;
  compileContext(request: CompileContextRequest): Promise<RuntimeContextBundle>;
  createCheckpoint(request: CheckpointRequest): Promise<CheckpointResult>;
  getLatestCheckpoint(sessionId: string): Promise<SessionCheckpoint | undefined>;
  listCheckpoints(sessionId: string, limit?: number): Promise<SessionCheckpoint[]>;
  crystallizeSkills(request: SkillMiningRequest): Promise<SkillCandidateResult>;
  listSkillCandidates(sessionId: string, limit?: number): Promise<SkillCandidate[]>;
  queryNodes(filter?: GraphNodeFilter): Promise<GraphNode[]>;
  queryEdges(filter?: GraphEdgeFilter): Promise<GraphEdge[]>;
  explain(request: ExplainRequest): Promise<ExplainResult>;
  close(): Promise<void>;
}
```

最小验收：

- 能用内存版和 SQLite 版两种存储跑通主链

---

## 4.3 Core 语义层

### `IngestPipeline`

文件：

- `src/runtime/ingest-pipeline.ts`

职责：

- 把 `RawContextRecord` 转成：
  - `Evidence` 节点
  - `Semantic Node`
  - `supported_by` 边

最小方法：

```ts
class IngestPipeline {
  ingest(input: RawContextInput): Promise<IngestResult>;
}
```

最小验收：

- 每条 record 至少生成一个 `Evidence`
- 可识别的 record 同时生成语义节点
- 节点和边都能持久化

### `ContextCompiler`

文件：

- `src/runtime/context-compiler.ts`

职责：

- 按类型和 query 从图谱挑选：
  - goal
  - intent
  - rules
  - constraints
  - process
  - decisions
  - states
  - evidence
  - skills
- 应用 token budget

最小方法：

```ts
class ContextCompiler {
  compile(request: CompileContextRequest): Promise<RuntimeContextBundle>;
}
```

最小验收：

- 在预算范围内输出 bundle
- 同一 query 下输出顺序稳定

### `CheckpointManager`

文件：

- `src/runtime/checkpoint-manager.ts`

职责：

- 从 bundle 生成 checkpoint
- 与上一个 checkpoint 做 diff，生成 delta

最小方法：

```ts
class CheckpointManager {
  createCheckpoint(request: CheckpointRequest): CheckpointResult;
}
```

最小验收：

- 首次创建能产出 checkpoint 和 delta
- 第二次创建能正确算新增项

### `SkillCrystallizer`

文件：

- `src/runtime/skill-crystallizer.ts`

职责：

- 从 bundle 识别稳定模式
- 生成最小 `SkillCandidate`

最小方法：

```ts
class SkillCrystallizer {
  crystallize(request: SkillMiningRequest): SkillCandidateResult;
}
```

最小验收：

- 有 `currentProcess + evidence` 时能产出候选
- 条件不满足时返回空数组

### `AuditExplainer`

文件：

- `src/runtime/audit-explainer.ts`

职责：

- 解释单个节点来自哪里、关联了什么

最小方法：

```ts
class AuditExplainer {
  explain(request: ExplainRequest): Promise<ExplainResult>;
}
```

最小验收：

- 输入 nodeId 能返回 node、sources、relatedNodes

---

## 4.4 存储层

### `GraphStore`

文件：

- `src/infrastructure/graph-store.ts`

职责：

- 节点边查询与写入抽象

最小方法：

```ts
interface GraphStore {
  upsertNodes(nodes: GraphNode[]): Promise<void>;
  upsertEdges(edges: GraphEdge[]): Promise<void>;
  getNode(id: string): Promise<GraphNode | undefined>;
  queryNodes(filter?: GraphNodeFilter): Promise<GraphNode[]>;
  queryEdges(filter?: GraphEdgeFilter): Promise<GraphEdge[]>;
  getEdgesForNode(nodeId: string): Promise<GraphEdge[]>;
  close(): Promise<void>;
}
```

### `ContextPersistenceStore`

文件：

- `src/infrastructure/context-persistence.ts`

职责：

- checkpoint / delta / skill candidate 持久化抽象

最小方法：

```ts
interface ContextPersistenceStore {
  saveCheckpoint(checkpoint: SessionCheckpoint): Promise<void>;
  saveDelta(delta: SessionDelta): Promise<void>;
  getLatestCheckpoint(sessionId: string): Promise<SessionCheckpoint | undefined>;
  listCheckpoints(sessionId: string, limit?: number): Promise<SessionCheckpoint[]>;
  saveSkillCandidates(sessionId: string, candidates: SkillCandidate[]): Promise<void>;
  listSkillCandidates(sessionId: string, limit?: number): Promise<SkillCandidate[]>;
  close(): Promise<void>;
}
```

### `SqliteGraphStore`

文件：

- `src/infrastructure/sqlite-graph-store.ts`

职责：

- 同时实现 `GraphStore` 与 `ContextPersistenceStore`
- 管理 schema 初始化
- 负责 sources / nodes / edges / checkpoints / deltas / skill_candidates

最小验收：

- 首次启动自动建表
- 可重复 upsert
- 查询能按 `sessionId/workspaceId/type/text` 过滤

---

## 4.5 插件 API 层

### `ContextEnginePlugin`

文件：

- `src/plugin/context-engine-plugin.ts`

职责：

- 给宿主暴露统一 RPC 风格的调试接口

最小方法：

```ts
class ContextEnginePlugin {
  handle(request: ContextPluginRequest): Promise<ContextPluginResponse>;
}
```

最小验收：

- 支持这些方法：
  - `health`
  - `ingest_context`
  - `compile_context`
  - `create_checkpoint`
  - `query_nodes`
  - `query_edges`
  - `get_latest_checkpoint`
  - `list_checkpoints`
  - `crystallize_skills`
  - `list_skill_candidates`
  - `explain`

---

## 5. 最小类型清单

以下类型是 MVP 的主干，不建议删减。

## 5.1 核心图谱类型

文件：

- `src/types/core.ts`

```ts
type Scope = 'global' | 'workspace' | 'session';
type KnowledgeKind = 'fact' | 'norm' | 'process' | 'state' | 'inference';
type KnowledgeStrength = 'hard' | 'soft' | 'heuristic';
type Freshness = 'active' | 'stale' | 'superseded';

type NodeType =
  | 'Rule'
  | 'Constraint'
  | 'Process'
  | 'Step'
  | 'Skill'
  | 'State'
  | 'Decision'
  | 'Outcome'
  | 'Evidence'
  | 'Goal'
  | 'Intent'
  | 'Tool'
  | 'Mode';

type EdgeType =
  | 'applies_when'
  | 'requires'
  | 'forbids'
  | 'permits'
  | 'overrides'
  | 'next_step'
  | 'uses_skill'
  | 'supported_by'
  | 'derived_from'
  | 'conflicts_with'
  | 'supersedes'
  | 'produces';
```

---

## 5.2 上下文输入类型

文件：

- `src/types/io.ts`

```ts
type RawContextSourceType =
  | 'conversation'
  | 'document'
  | 'rule'
  | 'workflow'
  | 'skill'
  | 'tool_output'
  | 'system';

interface RawContextRecord {
  id?: string;
  sessionId?: string;
  scope: Scope;
  sourceType: RawContextSourceType;
  role?: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata?: JsonObject;
  sourceRef?: SourceRef;
  createdAt?: string;
}

interface RawContextInput {
  sessionId: string;
  workspaceId?: string;
  records: RawContextRecord[];
}
```

最小约束：

- `content` 必须是可用文本
- `scope` 必须明确
- `sourceType` 必须明确
- `metadata` 允许扩展但不能替代主字段

---

## 5.3 编译与沉淀类型

```ts
interface RuntimeContextBundle {
  id: string;
  sessionId: string;
  query: string;
  goal?: ContextSelection;
  intent?: ContextSelection;
  activeRules: ContextSelection[];
  activeConstraints: ContextSelection[];
  currentProcess?: ContextSelection;
  recentDecisions: ContextSelection[];
  recentStateChanges: ContextSelection[];
  relevantEvidence: ContextSelection[];
  candidateSkills: ContextSelection[];
  openRisks: ContextSelection[];
  tokenBudget: {
    total: number;
    used: number;
    reserved: number;
  };
  createdAt: string;
}

interface SessionCheckpoint {
  id: string;
  sessionId: string;
  summary: {
    goal?: string;
    intent?: string;
    activeRuleIds: string[];
    activeConstraintIds: string[];
    currentProcessId?: string;
    recentDecisionIds: string[];
    recentStateIds: string[];
    openRiskIds: string[];
  };
  tokenEstimate: number;
  createdAt: string;
}

interface SkillCandidate {
  id: string;
  name: string;
  trigger: JsonObject;
  applicableWhen: string[];
  requiredRuleIds: string[];
  requiredConstraintIds: string[];
  workflowSteps: string[];
  expectedOutcome: JsonObject;
  failureSignals: string[];
  evidenceNodeIds: string[];
  scores: {
    frequency: number;
    stability: number;
    success: number;
    clarity: number;
  };
  createdAt: string;
}
```

---

## 6. Hook 事件与宿主负载清单

文件：

- `src/openclaw/types.ts`

## 6.1 AgentMessageLike

```ts
interface AgentMessageLike {
  role?: string;
  content?: unknown;
  id?: string;
  timestamp?: string;
  [key: string]: unknown;
}
```

最小约束：

- `content` 需要能被序列化为文本
- `role` 缺失时按 `user` 兜底

## 6.2 `before_compaction`

```ts
interface OpenClawHookBeforeCompactionEvent {
  messageCount: number;
  compactingCount?: number;
  tokenCount?: number;
  messages?: AgentMessageLike[];
  sessionFile?: string;
}
```

最小处理策略：

1. 优先从 `sessionFile` 读 transcript
2. 没有 `sessionFile` 时使用 `messages`
3. ingest 到 graph

最小验收：

- hook 触发后 graph 中能看到 compaction 前最后一批消息

## 6.3 `after_compaction`

```ts
interface OpenClawHookAfterCompactionEvent {
  messageCount: number;
  tokenCount?: number;
  compactedCount: number;
  sessionFile?: string;
}
```

最小处理策略：

1. 重读压缩后 transcript
2. compile bundle
3. create checkpoint
4. crystallize skills
5. 若本次 compaction 已由插件自己执行，则跳过重复处理

最小验收：

- compaction 后 latest checkpoint 能反映压缩后的稳定状态

## 6.4 Context Engine 生命周期负载

### `bootstrap`

```ts
{
  sessionId: string;
  sessionFile: string;
}
```

### `ingest`

```ts
{
  sessionId: string;
  message: AgentMessageLike;
  isHeartbeat?: boolean;
}
```

### `ingestBatch`

```ts
{
  sessionId: string;
  messages: AgentMessageLike[];
  isHeartbeat?: boolean;
}
```

### `afterTurn`

```ts
{
  sessionId: string;
  sessionFile: string;
  messages: AgentMessageLike[];
  prePromptMessageCount: number;
  autoCompactionSummary?: string;
  isHeartbeat?: boolean;
  tokenBudget?: number;
  runtimeContext?: Record<string, unknown>;
}
```

### `assemble`

```ts
{
  sessionId: string;
  messages: AgentMessageLike[];
  tokenBudget?: number;
}
```

### `compact`

```ts
{
  sessionId: string;
  sessionFile: string;
  tokenBudget?: number;
  force?: boolean;
  currentTokenCount?: number;
  compactionTarget?: 'budget' | 'threshold';
  customInstructions?: string;
  runtimeContext?: Record<string, unknown>;
}
```

---

## 7. Transcript 导入最小契约

文件：

- `src/openclaw/transcript-loader.ts`

MVP 需要支持的 transcript entry：

- `session`
- `message`
- `custom_message`
- `compaction`

最小映射规则：

| Transcript Entry | 转换结果 |
| --- | --- |
| `message(role=user)` | `conversation + Intent` |
| `message(role=assistant)` | `conversation + Decision` |
| `message(role=tool)` | `tool_output + State` |
| `message(role=system)` | `system + Rule` |
| `custom_message` | `system + inferNodeType(customType)` |
| `compaction` | `workflow + State` |

分支恢复最小算法：

1. 收集所有带 `id` 的 entry
2. 找出不被其他 entry 引用的 leaf
3. 选择顺序上最后一个 leaf
4. 通过 `parentId` 回溯到根
5. 只导入这条 branch

最小验收：

- 多分支 transcript 只导入当前有效 branch

---

## 8. SQLite 最小表结构

文件：

- `packages/runtime-core/schema/sqlite/001_init.sql`

## 8.1 `sources`

用途：

- 保存来源元信息

最小字段：

```sql
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_path TEXT,
  source_span TEXT,
  content_hash TEXT,
  extractor TEXT,
  created_at TEXT NOT NULL
);
```

## 8.2 `nodes`

用途：

- 保存图谱节点

最小字段：

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  scope TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  strength TEXT NOT NULL,
  confidence REAL NOT NULL,
  source_id TEXT,
  version TEXT,
  freshness TEXT NOT NULL DEFAULT 'active',
  valid_from TEXT,
  valid_to TEXT,
  updated_at TEXT NOT NULL
);
```

## 8.3 `edges`

用途：

- 保存节点关系

最小字段：

```sql
CREATE TABLE edges (
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
  updated_at TEXT NOT NULL
);
```

## 8.4 `checkpoints`

用途：

- 保存会话稳定快照

```sql
CREATE TABLE checkpoints (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  token_estimate INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
```

## 8.5 `deltas`

用途：

- 保存相对上一个 checkpoint 的增量

```sql
CREATE TABLE deltas (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  checkpoint_id TEXT,
  delta_json TEXT NOT NULL,
  token_estimate INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
```

## 8.6 `skill_candidates`

用途：

- 保存技能候选

```sql
CREATE TABLE skill_candidates (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  name TEXT NOT NULL,
  trigger_json TEXT NOT NULL,
  graph_pattern_json TEXT NOT NULL,
  candidate_json TEXT NOT NULL DEFAULT '{}',
  stability_score REAL NOT NULL,
  success_score REAL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## 8.7 `fts_chunks` 与 `fts_chunks_index`

用途：

- 为后续全文召回预留

MVP 不是强依赖，但表保留是值得的。

---

## 9. 最小数据流输入输出清单

## 9.1 `AgentMessageLike -> RawContextRecord`

最小规则：

- `content` 统一转字符串
- `role=user -> metadata.nodeType=Intent`
- `role=assistant -> metadata.nodeType=Decision`
- `role=tool -> metadata.nodeType=State`
- `role=system -> sourceType=system`

输出示例：

```json
{
  "id": "session-1:msg-1",
  "scope": "session",
  "sourceType": "conversation",
  "role": "user",
  "content": "请帮我梳理这个仓库的上下文压缩方案",
  "metadata": {
    "nodeType": "Intent"
  }
}
```

## 9.2 `RawContextRecord -> GraphNode / GraphEdge`

最小规则：

- 总是生成一个 `Evidence`
- 能识别类型时再生成一个 `Semantic Node`
- `Semantic Node -(supported_by)-> Evidence`

输出示例：

```json
{
  "candidateNodes": [
    { "type": "Evidence", "label": "conversation:请帮我梳理这个仓库的上下文压缩方案" },
    { "type": "Intent", "label": "conversation:请帮我梳理这个仓库的上下文压缩方案" }
  ],
  "candidateEdges": [
    { "type": "supported_by" }
  ]
}
```

## 9.3 `GraphStore -> RuntimeContextBundle`

最小规则：

- 按类型查询
- 按 query 和权重排序
- 按 budget 截断

输出示例：

```json
{
  "sessionId": "session-1",
  "query": "继续当前任务",
  "activeRules": [],
  "activeConstraints": [],
  "recentDecisions": [],
  "recentStateChanges": [],
  "relevantEvidence": [],
  "candidateSkills": [],
  "openRisks": [],
  "tokenBudget": {
    "total": 3600,
    "used": 420,
    "reserved": 3180
  }
}
```

## 9.4 `RuntimeContextBundle -> Checkpoint / SkillCandidate`

最小规则：

- checkpoint 保存稳定状态摘要
- skill 只在存在 `currentProcess + enough evidence` 时生成

---

## 10. `assemble()` 最小压缩策略

`assemble()` 必须承担真正的 token 减负职责。

最小算法：

1. ingest 当前 `messages`
2. compile `RuntimeContextBundle`
3. 统计非 system 消息数
4. 若未超过 `recentRawMessageCount`：
   - 走普通 budget trim
5. 若已超过阈值：
   - 保留最近 N 条 raw conversation message
   - 旧历史由 bundle 代表
   - 用 `systemPromptAddition` 注入结构化上下文
6. 若发生了历史压缩：
   - 比较 bundle 与 latest checkpoint
   - 有变化则更新 checkpoint
   - 顺手 crystallize skills

最小验收：

- prompt 中旧历史显著减少
- 最新 raw tail 仍保留
- checkpoint 会随压缩同步更新

---

## 11. 开发顺序清单

## 阶段 1：类型与表结构

完成项：

- `types/core.ts`
- `types/io.ts`
- `packages/runtime-core/schema/sqlite/001_init.sql`
- `GraphStore` / `ContextPersistenceStore` 抽象
- `SqliteGraphStore`

验收：

- 能建表
- 能 upsert / query
- 能保存 checkpoint / skill_candidates

## 阶段 2：摄取链

完成项：

- `transcript-loader.ts`
- `IngestPipeline`
- `bootstrap()`
- `ingest()` / `ingestBatch()`

验收：

- transcript 能导入
- 单条消息能入图
- graph 中可查到 Evidence 和语义节点

## 阶段 3：编译与压缩

完成项：

- `ContextCompiler`
- `assemble()`
- `resolveCompileBudget()`

验收：

- 能输出稳定 bundle
- 能根据 budget 压缩消息

## 阶段 4：沉淀链

完成项：

- `CheckpointManager`
- `SkillCrystallizer`
- `afterTurn()`
- `compact()`

验收：

- 会话结束后可看到 checkpoint / delta
- 有条件时可看到 skill candidate

## 阶段 5：Hook 协同

完成项：

- `registerLifecycleHooks()`
- `before_compaction`
- `after_compaction`

验收：

- 宿主 compaction 前后图谱状态同步
- 不会重复创建 compaction 后产物

## 阶段 6：调试与可解释

完成项：

- `ContextEnginePlugin`
- gateway debug methods
- `AuditExplainer`

验收：

- 可用 RPC 查询节点、边、checkpoint、skill、explain

---

## 12. 测试清单

MVP 最少应覆盖这些测试：

### 单元测试

- `transcript-loader` 能正确恢复 branch
- `IngestPipeline` 能生成 Evidence + Semantic Node
- `ContextCompiler` 能按 budget 裁剪
- `CheckpointManager` 能计算 delta
- `SkillCrystallizer` 在阈值不足时返回空

### 集成测试

- `bootstrap -> assemble -> afterTurn` 跑通
- `before_compaction -> after_compaction` 跑通
- SQLite 重启后能恢复 checkpoint 和 skill candidates

### 验收测试

- 长会话 prompt token 明显下降
- 关键 goal / intent / rule / constraint 没有在压缩后丢失

---

## 13. 外部 API 的最小使用策略

MVP 不需要外部 API 承担主链功能。

主链必须本地自己实现：

- hook 接入
- transcript 解析
- RawContextRecord 标准化
- GraphStore 持久化
- bundle 编译
- prompt 压缩
- checkpoint / delta / skill candidate

外部 API 只建议作为下一阶段增强：

- 复杂规则抽取
- 长工具输出压缩
- embedding / rerank
- skill 命名优化

---

## 14. 最终交付定义

当下面这些条件都满足时，可以认为 MVP 已经完成：

1. OpenClaw 能加载 `compact-context` 原生插件
2. `bootstrap()` 能从 transcript 恢复当前有效历史
3. `assemble()` 能把旧历史压缩成结构化上下文
4. `afterTurn()` 或 `compact()` 后能看到 checkpoint / delta
5. 满足条件时能看到 skill candidate
6. `before_compaction / after_compaction` 能与宿主生命周期保持同步
7. 能通过调试 RPC 查询和解释当前图谱状态

---

## 15. 一句话结论

最小可落地版本不需要很“聪明”，但一定要有完整闭环：

`能接事件、能拿上下文、能入图、能压缩、能沉淀、能解释。`

只要这六件事闭环跑通，后面无论加 LLM 抽取、FTS、向量检索还是 skill 升格，都会是在稳固主干上的增强，而不是返工。

