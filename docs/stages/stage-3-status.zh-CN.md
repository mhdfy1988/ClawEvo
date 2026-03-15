# 阶段 3 状态

## 1. 文档目标

这份文档用于回答三件事：

1. 阶段 3 当前到底做到哪了
2. `Schema / Conflict / Trace` 三条治理主线各自完成到什么程度
3. 哪些已经达到阶段 3 第一轮出口，哪些应进入下一轮增强

---

## 2. 当前结论

当前最准确的判断是：

`阶段 3 第二轮增强已完成，TODO 5（persistence trace）、TODO 6（relation-aware recall 第一轮）、TODO 7（记忆增强与沉淀追踪）和 TODO 8（第二轮验收与总结）均已收口；当前进入阶段 4 前置准备阶段。`

这意味着：

- 阶段 2 已经不是当前工作重心
- 阶段 3 也不再停留在“规划 / 准备阶段”
- 当前更适合做的是：
  - 启动阶段 4 前置事项整理
  - 新起阶段 4 TODO

---

## 3. 已完成范围

### 3.1 Schema

第一轮已完成：

- 统一 `NodeGovernance`
- 显式化 `knowledgeState / validity / promptReadiness / traceability`
- ingest 为主链节点写入默认 governance
- SQLite 与内存图存储都已持久化 governance
- compiler 已读取 governance 做排序与选择
- explain 已输出 governance 摘要

对应代码：

- [core.ts](/d:/C_Project/openclaw_compact_context/src/types/core.ts)
- [io.ts](/d:/C_Project/openclaw_compact_context/src/types/io.ts)
- [governance.ts](/d:/C_Project/openclaw_compact_context/src/governance/governance.ts)
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/runtime/ingest-pipeline.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/runtime/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/runtime/audit-explainer.ts)
- [001_init.sql](/d:/C_Project/openclaw_compact_context/schema/sqlite/001_init.sql)

状态判断：

`已完成阶段 3 第一轮主链`

### 3.2 Conflict

第一轮已完成：

- 定义最小冲突模型：`conflictStatus / resolutionState / conflictSetKey / overridePriority`
- ingest 已能生成：
  - `supersedes`
  - `conflicts_with`
  - `overrides`
- 冲突结果会回写节点 governance
- compiler 已跳过被冲突压制的节点
- explain 已能说明 suppression reason

对应代码：

- [governance.ts](/d:/C_Project/openclaw_compact_context/src/governance/governance.ts)
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/runtime/ingest-pipeline.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/runtime/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/runtime/audit-explainer.ts)

状态判断：

`已完成阶段 3 第一轮最小闭环`

### 3.3 Trace

第一轮已完成：

- 定义统一 `TraceView`
- explain 已输出统一 trace 结构
- `query_nodes + explain` 直接复用 explain 结果里的 trace
- `inspect_bundle` 的 explain sample 已复用统一 trace
- trace 已覆盖：
  - `source`
  - `transformation`
  - `selection`
  - `output`
  - `persistence`

对应代码：

- [core.ts](/d:/C_Project/openclaw_compact_context/src/types/core.ts)
- [io.ts](/d:/C_Project/openclaw_compact_context/src/types/io.ts)
- [trace-view.ts](/d:/C_Project/openclaw_compact_context/src/runtime/trace-view.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/runtime/audit-explainer.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

状态判断：

`已完成阶段 3 第一轮统一视图`

第二轮当前新增：

- explain 会显式返回 `checkpoint / delta / skill candidate` 的 persistence trace
- explain 会给出“节点被历史保留但未进入当前 runtime bundle”的 retention reason
- `query_nodes + explain` 与 `inspect_bundle` 会透出同一份 persistence trace
- 已补 history-retention 回归与 gateway 调试回归

状态判断：

`阶段 3 第二轮已完成 TODO 5，trace 进入深化阶段`

### 3.4 Relation-aware Recall

第二轮当前新增：

- compiler 第一轮已正式消费 `supported_by` 作为 recall 主边
- `relevantEvidence` 会对来自 `activeRules / activeConstraints / openRisks / currentProcess / recentDecisions / recentStateChanges` 的一跳 `supported_by` 证据做加权
- `ContextSelection.reason` 会显式标记 `via supported_by from ...`
- bundle diagnostics 与 explain 都能看到 relation contribution
- 已补 relation-aware compiler / explain 回归，并同步更新 debug smoke 快照

对应代码：

- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/runtime/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/runtime/audit-explainer.ts)
- [ingest-and-compiler.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/ingest-and-compiler.test.ts)
- [audit-explainer.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/audit-explainer.test.ts)

状态判断：

`已完成阶段 3 第二轮 relation-aware recall 第一轮`

### 3.5 Memory Enrichment And Retention Lineage

第二轮当前新增：

- `checkpoint / delta / skill candidate` 现在都带 `sourceBundleId`
- `skill candidate` 现在会显式回指 `sourceCheckpointId / sourceNodeIds`
- explain trace 的 `persistence` 视图会补齐：
  - `checkpointSourceBundleId`
  - `deltaSourceBundleId`
  - `skillCandidateSourceBundleId`
- `query_nodes + explain` 与 `inspect_bundle` 已能看到一致的 bundle lineage
- SQLite 已完成 checkpoint / delta / skill candidate 的 lineage round-trip
- 已补最小记忆增强 smoke 与 SQLite 回归

对应代码：

- [checkpoint-manager.ts](/d:/C_Project/openclaw_compact_context/src/runtime/checkpoint-manager.ts)
- [skill-crystallizer.ts](/d:/C_Project/openclaw_compact_context/src/runtime/skill-crystallizer.ts)
- [trace-view.ts](/d:/C_Project/openclaw_compact_context/src/runtime/trace-view.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/runtime/audit-explainer.ts)
- [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/src/infrastructure/sqlite-graph-store.ts)
- [hook-coordinator.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/hook-coordinator.ts)
- [audit-explainer.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/audit-explainer.test.ts)
- [context-engine-adapter.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/context-engine-adapter.test.ts)
- [debug-smoke.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/debug-smoke.test.ts)
- [ingest-and-compiler.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/ingest-and-compiler.test.ts)

状态判断：

`已完成阶段 3 第二轮记忆增强与沉淀追踪第一轮闭环`

---

## 4. 阶段 3 第一轮出口条件

建议把第一轮出口条件收敛成下面这三组。

### 4.1 Schema 出口

- 所有核心节点都能稳定带出统一 governance
- `raw / compressed / derived` 不再只是 explain 概念，而是统一字段
- compiler 与 explain 对 governance 的读取口径一致
- SQLite / InMemory 存储都能 round-trip governance

当前判断：

`已满足`

### 4.2 Conflict 出口

- 至少一批高价值节点类型具备冲突治理字段
- ingest 能生成最小冲突边与覆盖边
- compiler 不再把已被压制的节点继续送进 bundle
- explain 能说明“为什么被冲突压掉”

当前判断：

`已满足`

### 4.3 Trace 出口

- explain 返回统一 trace 结构
- `query_nodes + explain` 与 `inspect_bundle` 不再各自拼一套解释
- trace 至少能贯通 `source -> transformation -> selection -> output`
- 对压缩节点和冲突节点都能给出可读 trace

当前判断：

`已满足`

---

## 5. 验证结果

当前阶段 3 第二轮已完成部分的验证结论：

- `TypeScript` 编译通过
- 全量 `node:test` 回归通过
- 当前回归总数：`47`
- debug smoke 与 explain/query 回归继续保持通过

当前验证覆盖重点包括：

- governance 默认写入与持久化
- compiler governance-aware 选择
- conflict 生成与 suppression
- explain 冲突解释
- trace 在 explain / query_nodes / inspect_bundle 中的一致性
- persistence trace 与历史保留解释
- relation-aware recall 与 `supported_by` 关系贡献解释
- 记忆增强与 `bundle -> checkpoint / delta / skill candidate` lineage 追踪

---

## 6. 仍然存在的缺口

阶段 3 第二轮已经完成。当前主要剩余的是阶段 4 前置准备项：

- relation-aware recall 还没扩展到更多图边与更强的边优先级策略
- 记忆增强目前仍以最小 lineage 闭环为主，长期记忆评分、聚合与淘汰策略还没进入主链
- 主题层、长期记忆层还没有正式接入 compiler
- 阶段指标和自动化验收汇总还需要继续沉淀

这些更适合作为阶段 4 的前置准备。

---

## 7. 推荐下一步

当前更合理的顺序是：

1. 先根据 [stage-4-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-prework.zh-CN.md) 收敛阶段 4 范围
2. 再新起阶段 4 TODO
   - relation-aware recall 扩边
   - 长期记忆增强
   - 主题层与长期记忆层接入

对应执行清单见：
[stage-3-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-3-todo.zh-CN.md)

---

## 8. 一句话结论

`阶段 3 已经完成第二轮增强收口；下一步最合理的主线不是继续补零散功能，而是正式进入阶段 4 前置准备。`


