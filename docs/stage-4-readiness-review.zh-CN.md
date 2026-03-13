# 阶段 4 准备度审查

## 1. 目标

这份文档用于回答两个问题：

1. 进入阶段 4 之前，还有哪些必须先补清楚
2. 阶段 4 以及之后，还应该额外规划哪些能力

它不是新的路线图，而是一份基于当前代码和现有文档的准备度审查。

---

## 2. 审查结论

当前主链已经具备进入阶段 4 前置准备的基础，但还不适合直接大规模扩边、扩记忆、扩 scope。

最需要先补清楚的不是“再做哪个功能”，而是 5 个工程底座：

1. `关系生产契约`
2. `关系检索与 explain 成本控制`
3. `记忆对象生命周期`
4. `scope 升级与写入边界`
5. `阶段 4 质量评估与指标`

一句话判断：

`阶段 4 不是不能开始，而是应该先把“扩边、扩记忆、扩作用域”三件事的治理底座写清楚，再正式进入实现。`

---

## 3. 进入阶段 4 前仍需补充的项

### 3.1 关系生产契约还不够明确

当前代码里，compiler 已开始消费关系，但稳定生产的边仍然比较少：

- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts)
  - 已消费一跳 `supported_by`
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/ingest-pipeline.ts)
  - 稳定生成的边主要还是：
    - `supported_by`
    - `conflicts_with`
    - `supersedes`
    - `overrides`

但类型层已经定义了更多边：

- [core.ts](/d:/C_Project/openclaw_compact_context/src/types/core.ts)
  - `requires`
  - `next_step`
  - `produces`
  - `uses_skill`

问题在于：

- 这些边已经有 schema，但还没有稳定生成规则
- 也没有明确哪些边允许进 recall 主链，哪些只适合 explain
- 阶段 4 如果直接扩 recall，会很容易出现“边定义很多，但边质量和边优先级不统一”的问题

建议在阶段 4 前先补：

- relation production contract
- recall-eligible edge whitelist
- 每类边的 provenance / confidence / priority 规则

### 3.2 关系检索和 explain 的成本控制还没成文

当前实现对单会话规模是可用的，但阶段 4 如果扩边和扩记忆，这部分成本会明显放大。

代码里已经能看到几类成本点：

- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts)
  - `compile()` 里会做大量 `queryNodes(...)`
  - relation-aware recall 里继续按 selection 调 `getEdgesForNode(...)`
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts)
  - explain 会查 node edges
  - persistence explain 会扫描 `listCheckpoints / listDeltas / listSkillCandidates`
- [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/src/core/sqlite-graph-store.ts)
  - `queryNodes()` 的 text 过滤仍然是 SQL 粗筛后再在 JS 里做 `matchesTextFilter`

当前这并不是 bug，但对阶段 4 来说，它意味着：

- recall 扩边前，最好先明确 batch retrieval / adjacency cache / index 方向
- explain 的 persistence lineage 需要长期方案，不能永远靠最近 N 条扫描
- SQLite 检索如果要承接更大规模记忆，应该开始规划索引和查询路径，而不只是功能正确

建议在阶段 4 前先补：

- relation retrieval cost model
- explain lineage lookup strategy
- SQLite / GraphStore 的索引与批量读取策略说明

### 3.3 记忆对象生命周期还没有正式定义

当前 `memory lineage` 已经打通，但“记忆如何长期存在”这件事还没有真正定下来。

代码状态：

- [skill-crystallizer.ts](/d:/C_Project/openclaw_compact_context/src/core/skill-crystallizer.ts)
  - 现在是基于 bundle 生成一次性 `SkillCandidate`
  - 已有 `sourceBundleId / sourceCheckpointId / sourceNodeIds`
  - 但没有 merge、upgrade、retire
- [checkpoint-manager.ts](/d:/C_Project/openclaw_compact_context/src/core/checkpoint-manager.ts)
  - 现在能生成 checkpoint / delta
  - 但还没有分层 checkpoint 和记忆淘汰策略

问题在于：

- 当前已经“能追踪”，但还不能“能管理”
- 没有生命周期契约，就无法安全放大长期记忆层

建议在阶段 4 前先补：

- `SkillCandidate -> Skill` 升格条件
- memory merge / dedupe / retire 规则
- checkpoint 的分层与保留策略

### 3.4 scope 升级与写入边界还不够清楚

当前代码和测试大部分还是围绕 `session` 在工作。

从代码上能看到：

- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts)
  - 绝大多数查询都带 `sessionId`
- [context-persistence.ts](/d:/C_Project/openclaw_compact_context/src/core/context-persistence.ts)
  - checkpoint / delta / skill candidate 都按 `sessionId` 组织
- [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/src/core/sqlite-graph-store.ts)
  - 查询路径也主要按 session 维度读

这说明：

- 阶段 4 如果要引入 workspace / global 级记忆，当前还缺明确的 promotion policy
- 还缺“谁能写到 workspace/global，什么条件才能升 scope”的治理边界

建议在阶段 4 前先补：

- session -> workspace -> global promotion policy
- higher-scope write gate
- higher-scope recall precedence

### 3.5 阶段 4 的评估指标还没显式化

当前测试链是不错的，但仍然偏“功能回归”，还不是“阶段评估”。

现状：

- [debug-smoke.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/debug-smoke.test.ts)
  - 已覆盖调试链 smoke
- [fault-injection-smoke-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/fault-injection-smoke-checklist.zh-CN.md)
  - 已有发布前 smoke / fault injection

但还缺：

- recall 扩边之后怎么衡量噪音是否上升
- 长期记忆接入后怎么衡量 bundle 质量是否下降
- scope 提升后怎么衡量 workspace/global recall 是否越权或越噪

建议在阶段 4 前先补：

- relation recall precision / noise 指标
- long-memory usefulness / intrusion 指标
- bundle quality / explain completeness / retrieval cost 指标

---

## 4. 阶段 4 应补充的项

基于上面的审查，阶段 4 建议在现有 prework 基础上再补 4 组内容。

### 4.1 Edge Governance

不只是 node 有治理层，进入 recall 主链的高价值 relation 也应该开始具备最小治理视图：

- edge confidence
- edge freshness
- edge recall eligibility
- edge priority

否则阶段 4 的 recall 扩边会越来越依赖写死分数。

### 4.2 Memory Governance

当前 memory lineage 已有，但阶段 4 应把它推进到 memory governance：

- promotion
- merge
- retire
- decay

否则 skill / checkpoint 只会越来越多，不会越来越好。

### 4.3 Scope Governance

阶段 4 如果要碰 workspace / global，建议显式建这套约束：

- promotion gate
- write authority
- recall precedence
- fallback policy

### 4.4 Evaluation Harness

阶段 4 开始前，建议把“阶段评估”单独拉成一层，而不只依赖现有 smoke：

- representative transcripts
- relation recall evaluation fixture
- long-memory intrusion fixture
- workspace/global promotion fixture

---

## 5. 阶段 4 之后仍建议补充的项

这些不一定要放在阶段 4 第一波，但建议提前留在路线图里。

### 5.1 Topic / Concept Layer 的显式数据模型

当前语义增强层还是概念上的。

后续建议补：

- `Topic`
- `Concept`
- `PatternTag`
- topic-aware recall

### 5.2 多跳关系召回与约束

当前 relation-aware recall 是一跳、保守、可解释的。

更往后可以再考虑：

- 二跳 recall
- relation path constraints
- path explanation

### 5.3 长期记忆的跨任务复用

后续建议补：

- workspace skill reuse
- global pattern reuse
- cross-session memory curation

### 5.4 阶段级观测面板

更往后建议把这些沉淀成统一观测面板或至少统一统计输出：

- bundle token quality
- recall edge contribution
- memory promotion / merge / retire
- explain completeness

---

## 6. 建议的文档落点

为了避免这些审查结论只停留在这一页，建议同步回下面几份主文档：

- [stage-4-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-prework.zh-CN.md)
- [stage-4-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-todo.zh-CN.md)
- [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
- [layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/layered-knowledge-graph-architecture.zh-CN.md)
- [documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)

---

## 7. 一句话结论

`阶段 4 前最该补的，不是新功能本身，而是“扩边、扩记忆、扩作用域”这三件事对应的工程契约和评估约束。`
