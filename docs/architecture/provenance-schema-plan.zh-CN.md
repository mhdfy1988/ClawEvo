# Provenance 设计与 Schema 迁移方案

## 1. 文档目标

这份文档把 `provenance` 从讨论结论收敛成一套可落地的设计方案。

目标是解决四个工程问题：

1. 怎么在系统里明确区分 `raw / compressed / derived`
2. 这些标签应该放到哪些类型和表结构里
3. 各个入口应该如何打标签
4. 现有仓库如何分阶段迁移，而不是大改一轮

这份文档和下面两份配套使用：

- [context-handling-principles.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-handling-principles.zh-CN.md)
- [mvp-implementation-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/mvp-implementation-checklist.zh-CN.md)

---

## 2. 设计目标

`provenance` 的职责不是替代 `sourceRef`，而是补上当前系统里缺失的“处理链路溯源”。

要区分两个概念：

### `sourceRef`

回答的是：

- 这条内容来自哪个外部来源
- 来源路径、span、hash 是什么

### `provenance`

回答的是：

- 这条内容是原文、压缩产物，还是派生产物
- 它是在系统哪一个阶段产生的
- 它依赖了哪些上游对象

一句话说：

`sourceRef` 是来源定位  
`provenance` 是加工履历

---

## 3. 总体设计原则

### 原则 1

所有进入图谱或持久化层的上下文对象，都应该能回答：

- 我是不是原文
- 我是不是压缩结果
- 我是不是从别的对象推导出来的

### 原则 2

不能依赖“文本长得像摘要”来猜测 provenance，必须在第一跳就打标签。

### 原则 3

`raw` 应该默认拥有更高召回优先级和更高证据权重。

### 原则 4

`compressed` 和 `derived` 允许参与恢复和加速，但不应无条件升级为高可信事实。

### 原则 5

迁移时要优先保证兼容性，不要求第一版就把所有 provenance 字段拆成独立列。

---

## 4. 推荐的类型设计

## 4.1 基础枚举

建议在 [core.ts](/d:/C_Project/openclaw_compact_context/src/types/core.ts) 中新增：

```ts
export type ProvenanceOriginKind = 'raw' | 'compressed' | 'derived';

export type ProvenanceSourceStage =
  | 'transcript_message'
  | 'transcript_custom'
  | 'transcript_compaction'
  | 'hook_message_snapshot'
  | 'document_raw'
  | 'document_extract'
  | 'tool_output_raw'
  | 'tool_output_summary'
  | 'runtime_bundle'
  | 'checkpoint'
  | 'delta'
  | 'skill_candidate';
```

## 4.2 统一 provenance 结构

建议新增：

```ts
export interface ProvenanceRef {
  originKind: ProvenanceOriginKind;
  sourceStage: ProvenanceSourceStage;
  producer: string;
  rawSourceId?: string;
  rawContentHash?: string;
  transcriptEntryId?: string;
  transcriptParentId?: string;
  derivedFromNodeIds?: string[];
  derivedFromCheckpointId?: string;
  compressionRunId?: string;
  createdByHook?: string;
}
```

字段含义如下：

| 字段 | 作用 |
| --- | --- |
| `originKind` | 区分 `raw / compressed / derived` |
| `sourceStage` | 标明进入系统的阶段或载体 |
| `producer` | 谁生成了它，例如 `openclaw`、`compact-context`、`tool` |
| `rawSourceId` | 指向原始来源对象 id |
| `rawContentHash` | 指向原文内容 hash，便于校验 |
| `transcriptEntryId` | 若来自 transcript，保留 entry id |
| `transcriptParentId` | 保留 transcript 分支关系 |
| `derivedFromNodeIds` | 派生自哪些节点 |
| `derivedFromCheckpointId` | 若来自 checkpoint，记录来源 checkpoint |
| `compressionRunId` | 标记一次压缩批次 |
| `createdByHook` | 标记由哪个 hook 创建或同步 |

---

## 5. 建议修改的类型对象

## 5.1 `RawContextRecord`

文件：

- [io.ts](/d:/C_Project/openclaw_compact_context/src/types/io.ts)

建议新增顶层字段：

```ts
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
```

为什么建议放顶层，而不是只放在 `metadata`：

- `metadata` 太松散，不利于统一约束
- adapter、loader、ingest 都需要稳定读取它
- 后续需要明确进入 `GraphNode`

## 5.2 `GraphNode`

文件：

- [core.ts](/d:/C_Project/openclaw_compact_context/src/types/core.ts)

建议新增：

```ts
export interface GraphNode<TPayload extends JsonObject = JsonObject> {
  id: string;
  type: NodeType;
  scope: Scope;
  kind: KnowledgeKind;
  label: string;
  payload: TPayload;
  strength: KnowledgeStrength;
  confidence: number;
  sourceRef?: SourceRef;
  provenance?: ProvenanceRef;
  version: string;
  freshness: Freshness;
  validFrom: string;
  validTo?: string;
  updatedAt: string;
}
```

建议所有节点都带 `provenance`，即便有些是简单复制：

- `Evidence` 需要
- `Intent / Decision / State / Rule` 需要
- `Checkpoint` 不在 `nodes` 表中，但其 summary 派生的状态节点后续也需要

## 5.3 `GraphEdge`

可以选两种策略：

### 方案 A：第一版不加

优点：

- 侵入最小

缺点：

- 边的来源信息只能靠 `sourceRef`

### 方案 B：也加 `provenance`

优点：

- 对 `derived_from / supported_by` 这类边更完整

缺点：

- 迁移范围略大

推荐结论：

MVP 可先不给 `GraphEdge` 加 typed provenance，只在 `payload` 里带最小来源信息；第二阶段再提升为正式字段。

## 5.4 `SessionCheckpoint`

建议新增：

```ts
export interface SessionCheckpoint {
  id: string;
  sessionId: string;
  summary: CheckpointSummary;
  provenance?: ProvenanceRef;
  tokenEstimate: number;
  createdAt: string;
}
```

建议默认值：

```ts
{
  originKind: 'derived',
  sourceStage: 'checkpoint',
  producer: 'compact-context'
}
```

## 5.5 `SessionDelta`

建议新增：

```ts
export interface SessionDelta {
  id: string;
  sessionId: string;
  checkpointId?: string;
  provenance?: ProvenanceRef;
  ...
}
```

默认：

- `originKind = 'derived'`
- `sourceStage = 'delta'`

## 5.6 `SkillCandidate`

建议新增：

```ts
export interface SkillCandidate {
  id: string;
  name: string;
  ...
  provenance?: ProvenanceRef;
  createdAt: string;
}
```

默认：

- `originKind = 'derived'`
- `sourceStage = 'skill_candidate'`

---

## 6. 入口判定规则

这一部分最关键。判定规则必须固定，不应运行时靠猜。

## 6.1 Transcript Loader

文件：

- [transcript-loader.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/transcript-loader.ts)

推荐规则：

| Transcript Entry | originKind | sourceStage | producer |
| --- | --- | --- | --- |
| `message` | `raw` | `transcript_message` | `openclaw` |
| `custom_message` 原始规则/原始系统注入 | `raw` | `transcript_custom` | `openclaw` |
| `custom_message` 若明确是插件摘要 | `compressed` | `transcript_custom` | `compact-context` |
| `compaction` | `compressed` | `transcript_compaction` | `openclaw` 或 `compact-context` |

额外建议：

- 将 `entry.id` 写入 `provenance.transcriptEntryId`
- 将 `parentId` 写入 `provenance.transcriptParentId`
- 将 transcript 恢复出来的 message id 写入 `rawSourceId`

## 6.2 Adapter 中的实时消息映射

文件：

- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

对于 `ingest()` / `ingestBatch()` / `assemble()` / `afterTurn()` 里从内存消息映射出来的 record，推荐：

| 输入 | originKind | sourceStage |
| --- | --- | --- |
| 普通用户/助手消息 | `raw` | `hook_message_snapshot` |
| 工具原始结果 | `raw` | `tool_output_raw` |
| 自动 compaction summary | `compressed` | `runtime_bundle` 或 `transcript_compaction` |

注意：

- `systemPromptAddition` 不建议再次 ingest
- 如果未来一定要 ingest 某种 bundle 摘要，必须标为 `compressed`

## 6.3 Hook 协同

文件：

- [hook-coordinator.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/hook-coordinator.ts)

推荐：

- `before_compaction` 同步进来的消息：
  - 保持原始来源的 `originKind`
  - 额外写 `createdByHook = 'before_compaction'`
- `after_compaction` 刷新生成的 checkpoint：
  - `originKind = 'derived'`
  - `createdByHook = 'after_compaction'`

## 6.4 Checkpoint 和 Skill

文件：

- [checkpoint-manager.ts](/d:/C_Project/openclaw_compact_context/src/core/checkpoint-manager.ts)
- [skill-crystallizer.ts](/d:/C_Project/openclaw_compact_context/src/core/skill-crystallizer.ts)

推荐固定为：

| 对象 | originKind | sourceStage |
| --- | --- | --- |
| `checkpoint` | `derived` | `checkpoint` |
| `delta` | `derived` | `delta` |
| `skill_candidate` | `derived` | `skill_candidate` |

并补上：

- `derivedFromNodeIds`
- `derivedFromCheckpointId`

---

## 7. Ingest 过程中的传递规则

文件：

- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/ingest-pipeline.ts)

`provenance` 在 ingest 时不能丢。

推荐规则如下：

## 7.1 `Evidence` 节点

`Evidence` 节点应尽量继承原始 `RawContextRecord.provenance`。

示例：

```ts
provenance: {
  originKind: 'raw',
  sourceStage: 'transcript_message',
  producer: 'openclaw',
  rawSourceId: 'session-1:msg-1',
  rawContentHash: '...'
}
```

## 7.2 语义节点

语义节点也应继承 provenance，但需要强调“语义抽取是派生动作”。

推荐做法：

- `originKind` 保持和原始 record 一致
- 但把 `producer` 改为 `compact-context`
- 同时加 `derivedFromNodeIds = [evidenceNode.id]`

这表示：

- 语义节点仍然来自原文
- 但它是由系统从原文证据中抽取出来的

## 7.3 compaction 产生的 record

若 ingest 的本身就是 compaction summary：

- `originKind = 'compressed'`
- `sourceStage = 'transcript_compaction'`

这种节点不应和原始 `message` 拥有同等证据权重。

---

## 8. 查询与编译如何使用 provenance

文件：

- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts)

仅仅存 provenance 还不够，还要在编译器中真正使用。

## 8.1 默认优先级

建议 ContextCompiler 在 rank 时引入 provenance 权重：

| originKind | 说明 | 默认权重 |
| --- | --- | --- |
| `raw` | 原始证据 | 最高 |
| `compressed` | 压缩结果 | 中等 |
| `derived` | 派生对象 | 视类型而定 |

建议规则：

- `Evidence` 默认优先使用 `raw`
- `compressed` 的 `Evidence` 只在原始证据不足时补位
- `SkillCandidate` 和 `Checkpoint` 不进入普通证据池，只作为辅助上下文或恢复对象

## 8.2 风险控制

下面这些场景不应仅靠 `compressed` 支撑：

- 激活硬规则
- 判断禁止项
- 关键决策溯源
- 用户明确需求边界的确认

也就是说：

若某条高优先级知识只来自 `compressed`，应降低 confidence 或要求补 raw evidence。

## 8.3 explain 输出

`AuditExplainer` 建议新增输出：

- `originKind`
- `sourceStage`
- `derivedFromNodeIds`

这样 explain 时就能明确告诉调用方：

- 这是原文证据
- 这是压缩产物
- 这是派生总结

---

## 9. SQLite Schema 迁移建议

## 9.1 迁移目标

迁移要同时满足两件事：

1. 不打断现有数据读写
2. 让 query 和 explain 能直接看到 provenance

## 9.2 推荐的最小方案

建议优先给以下表加字段：

### `nodes`

新增：

```sql
ALTER TABLE nodes ADD COLUMN origin_kind TEXT NOT NULL DEFAULT 'raw';
ALTER TABLE nodes ADD COLUMN provenance_json TEXT NOT NULL DEFAULT '{}';
```

原因：

- `nodes` 是 ContextCompiler 主要查询对象
- `origin_kind` 单列更容易做筛选和排序
- `provenance_json` 用于保存完整链路信息

### `checkpoints`

新增：

```sql
ALTER TABLE checkpoints ADD COLUMN provenance_json TEXT NOT NULL DEFAULT '{}';
```

### `deltas`

新增：

```sql
ALTER TABLE deltas ADD COLUMN provenance_json TEXT NOT NULL DEFAULT '{}';
```

### `skill_candidates`

新增：

```sql
ALTER TABLE skill_candidates ADD COLUMN provenance_json TEXT NOT NULL DEFAULT '{}';
```

### `edges`

第一版可暂不新增正式列。

原因：

- 当前编译主要依赖节点
- 边先保留 `payload + sourceRef`

若后续 explain 对边的 provenance 有更强需求，再补：

```sql
ALTER TABLE edges ADD COLUMN provenance_json TEXT NOT NULL DEFAULT '{}';
```

## 9.3 索引建议

若 `nodes.origin_kind` 落为独立列，建议增加：

```sql
CREATE INDEX IF NOT EXISTS idx_nodes_origin_kind ON nodes (origin_kind);
CREATE INDEX IF NOT EXISTS idx_nodes_type_freshness_origin ON nodes (type, freshness, origin_kind);
```

---

## 10. 代码改动落点

## 10.1 类型层

文件：

- [core.ts](/d:/C_Project/openclaw_compact_context/src/types/core.ts)
- [io.ts](/d:/C_Project/openclaw_compact_context/src/types/io.ts)

改动：

- 增加 `ProvenanceOriginKind`
- 增加 `ProvenanceSourceStage`
- 增加 `ProvenanceRef`
- 在 `RawContextRecord`
- 在 `GraphNode`
- 在 `SessionCheckpoint`
- 在 `SessionDelta`
- 在 `SkillCandidate`

## 10.2 Loader / Adapter / Hook

文件：

- [transcript-loader.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/transcript-loader.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- [hook-coordinator.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/hook-coordinator.ts)

改动：

- 创建 record 时显式写入 `provenance`

## 10.3 Ingest

文件：

- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/ingest-pipeline.ts)

改动：

- `Evidence` 节点继承 record provenance
- 语义节点继承并追加 `derivedFromNodeIds`

## 10.4 Store

文件：

- [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/src/core/sqlite-graph-store.ts)

改动：

- upsert / map row 时读写 `origin_kind`
- upsert / map row 时读写 `provenance_json`
- 增加列存在性检测

## 10.5 Compiler / Explain

文件：

- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts)

改动：

- rank 时考虑 `originKind`
- explain 时返回 provenance 摘要

## 10.6 Persistence Objects

文件：

- [checkpoint-manager.ts](/d:/C_Project/openclaw_compact_context/src/core/checkpoint-manager.ts)
- [skill-crystallizer.ts](/d:/C_Project/openclaw_compact_context/src/core/skill-crystallizer.ts)

改动：

- 创建 checkpoint / delta / skill candidate 时生成 provenance

---

## 11. 分阶段迁移顺序

## 阶段 1：类型与数据写入

目标：

- 先让新对象开始带 provenance

完成项：

- 扩展 TS 类型
- loader / adapter / hook 开始打标签
- ingest 把 provenance 传到 nodes

验收：

- 新写入节点已包含 provenance

## 阶段 2：SQLite 兼容迁移

目标：

- 让持久化层能保存 provenance

完成项：

- 增加 `origin_kind`
- 增加 `provenance_json`
- 增加索引

验收：

- 重启后 provenance 不丢

## 阶段 3：查询与解释接入

目标：

- 让 provenance 真正参与编译和 explain

完成项：

- compiler 打分考虑 `originKind`
- explain 输出 provenance

验收：

- 同等条件下优先选 raw evidence

## 阶段 4：补历史数据

目标：

- 让旧数据也具备基本 provenance

建议策略：

- `transcript.message` 导入的旧 `Evidence` 回填为 `raw`
- `compaction` 导入的旧节点回填为 `compressed`
- 旧 checkpoint 和 skill 回填为 `derived`

验收：

- 旧 session 也能被 explain 正确解释

---

## 12. 测试建议

最少应覆盖下面这些测试。

## 12.1 单元测试

- `transcript-loader` 对 `message / custom_message / compaction` 正确打 provenance
- `ingest-pipeline` 能把 provenance 传到 `Evidence` 和语义节点
- `checkpoint-manager` 生成的对象带 `derived` provenance
- `skill-crystallizer` 生成的对象带 `derived` provenance

## 12.2 集成测试

- `bootstrap -> assemble -> afterTurn` 跑通后，图中节点 provenance 正确
- `before_compaction -> after_compaction` 产生的 checkpoint provenance 正确

## 12.3 查询测试

- `raw` 与 `compressed` 内容同时存在时，优先选择 `raw`
- `compressed` 节点不会单独把硬规则抬成最高优先级

---

## 13. 推荐结论

这套 provenance 方案推荐按下面的最小路径落地：

1. 先加 typed `ProvenanceRef`
2. 再让 `RawContextRecord` 和 `GraphNode` 带 provenance
3. SQLite 的 `nodes` 先加 `origin_kind + provenance_json`
4. `checkpoints / deltas / skill_candidates` 加 `provenance_json`
5. 最后再让 `ContextCompiler` 和 `AuditExplainer` 真正消费这些标签

这样做的好处是：

- 迁移范围可控
- 兼容当前代码结构
- 不需要立刻改造所有表和所有查询
- 但能先把“原文 / 压缩 / 派生”的关键分界线建立起来

---

## 14. 一句话总结

`provenance` 的目标不是多加几个元数据字段，而是把“这条知识到底是原文、压缩结果还是派生产物”变成系统级真相，让后续的压缩、图谱、checkpoint、skill 和 explain 都建立在同一套可追溯语义上。

