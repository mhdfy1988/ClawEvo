# OpenClaw Context Engine 插件 API 契约

## 1. 目标

该契约定义 OpenClaw 如何调用 Context Engine 插件。

核心边界如下：

- OpenClaw 调插件能力接口
- 插件自己管理知识图谱 schema
- 插件自己管理 SQLite 表与迁移
- OpenClaw 不直接操作插件表

## 2. 调用原则

OpenClaw 应调用高层能力，而不是数据库细节。

推荐调用的方法有：

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

## 3. 典型调用链

```text
OpenClaw
-> compile_context
-> create_checkpoint
-> crystallize_skills
-> explain / query_nodes / query_edges
```

## 4. 方法说明

### 4.1 `ingest_context`

用途：
- 吸收会话、规则、流程、工具输出等上下文
- 写入 Evidence 和语义节点

输入：
- `sessionId`
- `records[]`

输出：
- 写入的节点和边
- 可能的告警

### 4.2 `compile_context`

用途：
- 为当前任务编译最小运行时上下文
- 控制 token 预算

输入：
- `sessionId`
- `query`
- `tokenBudget`

输出：
- `RuntimeContextBundle`

### 4.3 `create_checkpoint`

用途：
- 保存当前会话压缩快照
- 自动生成 delta

输入：
- `sessionId`
- `bundle`

输出：
- `checkpoint`
- `delta`

### 4.4 `crystallize_skills`

用途：
- 从当前 bundle 中挖掘 skill candidate
- 自动持久化 skill candidate

输入：
- `sessionId`
- `bundle`

输出：
- `candidates`

### 4.5 `explain`

用途：
- 解释某条知识为何存在、从何而来

输入：
- `nodeId`

输出：
- 节点摘要
- 来源
- 关联节点

## 5. 存储边界

插件内部维护三类持久化对象：

- 图谱对象
  - `nodes`
  - `edges`
  - `sources`

- 会话压缩对象
  - `checkpoints`
  - `deltas`

- 能力沉淀对象
  - `skill_candidates`

OpenClaw 不需要知道这些表的细节，只需要调用插件方法。

## 6. 当前代码入口

核心代码位置：

- 插件请求/响应类型定义：
  [api.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/plugin/api.ts)

- 插件适配层：
  [context-engine-plugin.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/plugin/context-engine-plugin.ts)

- 引擎入口：
  [context-engine.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/engine/context-engine.ts)

- SQLite 存储实现：
  [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/infrastructure/sqlite-graph-store.ts)

## 7. 推荐宿主接法

如果 OpenClaw 侧需要一个统一入口，推荐做法是：

1. 宿主构造插件请求包
2. 调用 `ContextEnginePlugin.handle(request)`
3. 根据 `method` 获取结构化结果
4. 宿主只处理业务结果，不直接碰底层 SQLite

## 8. 结论

该契约确保宿主和插件之间保持稳定边界：

- 宿主负责任务编排和插件调用
- 插件负责上下文治理、图谱沉淀、压缩和 Skill 发现

这样后续无论底层存储是内存、插件自管 SQLite，还是接 OpenClaw 提供的 SQLite 适配器，上层调用方式都不必大改。


