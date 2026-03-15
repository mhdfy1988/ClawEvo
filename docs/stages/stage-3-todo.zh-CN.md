# 阶段 3 第二轮增强 TODO

本清单用于跟踪阶段 3 第二轮增强工作，重点围绕 `persistence trace -> 历史保留解释 -> relation-aware recall -> 第二轮验收` 推进。

相关文档：
- 当前状态：[stage-3-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-3-status.zh-CN.md)
- 第一轮总结：[stage-3-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-3-first-pass-report.zh-CN.md)
- 第二轮总结：[stage-3-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-3-second-pass-report.zh-CN.md)
- 阶段 4 前置事项：[stage-4-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-prework.zh-CN.md)
- 路线图与阶段目标：[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)
- 多层知识图谱方案：[layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/layered-knowledge-graph-architecture.zh-CN.md)
- Schema 治理方案：[schema-governance-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/schema-governance-plan.zh-CN.md)
- Conflict 方案：[conflict-resolution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/conflict-resolution-plan.zh-CN.md)
- Traceability 方案：[traceability-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/traceability-plan.zh-CN.md)
- TODO 模板：[todo-template.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/todo-template.zh-CN.md)

## 待办

当前无额外待办，阶段 3 第二轮已完成。

## 进行中

当前无进行中任务，下一步应新起阶段 4 TODO。

## 已完成

- [x] 启动阶段 3 TODO 并对齐治理主线 #文档 2026-03-13
  - [x] 确认阶段 3 主线为 `Schema / Conflict / Trace`
  - [x] 后续 TODO 文档继续沿用统一模板

- [x] 输出阶段 3 治理方案文档 #文档 2026-03-13
  - [x] 补 `Schema` 治理方案
  - [x] 补 `Conflict` 冲突消解方案
  - [x] 补 `Traceability` 方案
  - [x] 更新多层知识图谱架构和文档索引入口

- [x] TODO 1: 落第一轮 Schema 治理主链 #后端 #架构 2026-03-13
  - [x] 在 `core.ts / io.ts` 定义统一 `NodeGovernance`
  - [x] 显式化 `knowledgeState / validity / promptReadiness`
  - [x] 让 ingest 为主链节点写入默认 governance
  - [x] 让 compiler 读取 `promptReadiness / validity`
  - [x] 让 explain 输出治理摘要
  - [x] 补 schema fixture 与回归测试

- [x] TODO 2: 落最小 Conflict 闭环 #后端 #架构 2026-03-19
  - [x] 在类型与存储层补 `conflictStatus / resolutionState / conflictSetKey`
  - [x] 在 ingest 主链生成 `supersedes / conflicts_with / overrides`
  - [x] 在 compiler 接入最小 `conflict-aware` 裁决顺序
  - [x] 在 explain 输出冲突视图与 suppression reason
  - [x] 补 conflict fixture、回归测试和调试快照

- [x] TODO 3: 落统一 Trace 视图 #后端 #调试 2026-03-22
  - [x] 定义 `TraceView / TraceExplainView`
  - [x] 串起 `source / transformation / selection / persistence`
  - [x] 让 `explain / inspect_bundle / query_nodes + explain` 复用统一 trace
  - [x] 补“为什么没进 bundle / 为什么只留 summary”的 trace 解释
  - [x] 补 trace smoke 与快照回归

- [x] TODO 4: 完成阶段 3 第一轮验收与回归 #测试 #文档 2026-03-24
  - [x] 更新阶段状态、路线图与文档索引
  - [x] 补治理主线 smoke checklist
  - [x] 整理 `Schema / Conflict / Trace` 的出口条件
  - [x] 输出阶段 3 第一轮总结文档

- [x] TODO 5: 深化 persistence trace 与历史保留解释 #后端 #调试 2026-03-28
  - [x] 让 `checkpoint / delta / skill candidate` 的 trace 在 explain 中可见
  - [x] 补“为什么没进 prompt / 为什么只进 checkpoint / 为什么只保留 summary”的 explain
  - [x] 让 `explain / query_nodes + explain / inspect_bundle` 都能看见一致的 persistence trace
  - [x] 补 history-retention fixture、trace smoke 与回归测试

- [x] TODO 6: 落 relation-aware recall 第一轮 #后端 #架构 2026-03-31
  - [x] 明确第一轮真正消费 `supported_by` 作为主 recall 边
  - [x] 让 compiler 支持一跳 `supported_by` 关系增强召回
  - [x] 让 diagnostics / explain 能说明 relation 对入选的贡献
  - [x] 补 relation-aware fixture、回归测试与 debug 快照更新

- [x] TODO 7: 落记忆增强与沉淀追踪 #后端 #记忆 2026-04-03
  - [x] 基于已落地的 persistence trace 继续深化记忆沉淀追踪
  - [x] 让 skill candidate 能回指来源 bundle / source node / checkpoint
  - [x] 让 checkpoint / delta / skill candidate 的 bundle lineage 能进入 explain trace
  - [x] 补阶段 3 第二轮的最小记忆增强 smoke 与 SQLite round-trip 回归
  - [x] 将剩余长期记忆增强项收敛到 TODO 8 和阶段 4 前置事项

- [x] TODO 8: 完成阶段 3 第二轮验收与总结 #测试 #文档 2026-04-05
  - [x] 更新阶段状态、路线图与文档索引
  - [x] 整理第二轮出口条件
  - [x] 输出阶段 3 第二轮总结文档
  - [x] 准备阶段 4 前置事项列表

