# 阶段 5 第二轮实现 TODO

本清单用于管理阶段 5 第二轮的深化工作，重点是在阶段 5 第一轮“可用实现”的基础上，继续把多跳 recall、长期记忆、人工校正和 observability 做深，并把第二轮结果收成稳定基线。

相关文档：
- 阶段 5 状态：[stage-5-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-status.zh-CN.md)
- 阶段 5 第二轮状态：[stage-5-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-second-pass-status.zh-CN.md)
- 阶段 5 第二轮总结：[stage-5-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-second-pass-report.zh-CN.md)
- 阶段 5 第一轮总结：[stage-5-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-first-pass-report.zh-CN.md)
- 多跳 recall 与 path explain：[multi-hop-recall-and-path-explain-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/multi-hop-recall-and-path-explain-plan.zh-CN.md)
- 跨任务记忆复用：[cross-task-memory-reuse-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/cross-task-memory-reuse-plan.zh-CN.md)
- 知识晋升合同：[knowledge-promotion-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/knowledge-promotion-contract.zh-CN.md)
- 观测、人工与 LLM 边界：[observability-human-in-the-loop-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/observability-human-in-the-loop-plan.zh-CN.md)
- TODO 模板：[todo-template.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/todo-template.zh-CN.md)

当前判断：
`阶段 5 第二轮 TODO 1-6 已全部完成；下一步更适合启动阶段 6 的规划，而不是继续在阶段 5 TODO 上追加零散条目。`

## 待办

- [ ] 当前无剩余待办；后续请转到阶段 6 规划文档。

## 进行中

- [ ] 当前无进行中任务；阶段 5 第二轮已收口完成。

## 已完成

- [x] TODO 6: 完成阶段 5 第二轮验收与总结 ~3d #文档 #评估 @Codex 2026-03-26
  - [x] 输出阶段 5 第二轮状态文档
  - [x] 输出阶段 5 第二轮总结文档
  - [x] 收敛已实现 / 半实现 / 未实现边界
  - [x] 明确后续阶段 6 的规划方向

- [x] TODO 5: 拉 observability 到阶段级报告与趋势视图 ~4d #平台 #评估 @Codex 2026-03-24
  - [x] 输出跨轮次 observability trend snapshot
  - [x] 固定 path cost / scope intrusion / promotion quality 指标
  - [x] 把 evaluation harness 汇总接成统一阶段报告
  - [x] 为后续 dashboard 预留稳定 JSON 契约

- [x] TODO 4: 接人工校正到主链与回滚入口 ~4d #平台 #治理 @Codex 2026-03-22
  - [x] 为 concept alias / promotion decision 增加持久化入口
  - [x] 接 explain / gateway debug 的 correction trace
  - [x] 定义 correction rollback 的最小读写流程
  - [x] 补 correction provenance 与误修正回归

- [x] TODO 3: 做深 pattern miner 与 retire / decay / downgrade ~6d #后端 #学习 @Codex 2026-03-20
  - [x] 区分短期 pattern、稳定 procedure、负向 pattern 的晋升门槛
  - [x] 把 `CriticalStep`、`ConstraintPattern` 等二级模式纳入治理
  - [x] 引入 retire / decay / downgrade 的真实执行逻辑
  - [x] 补知识晋升质量与退场质量评估

- [x] TODO 2: 落 `workspace -> global` 长期记忆治理第一轮 ~5d #后端 #记忆 @Codex 2026-03-18
  - [x] 把 `workspace -> global` promotion 主链接进 persistence
  - [x] 让 compiler 支持受控 global fallback 与越权抑制
  - [x] 补 global reuse usefulness / intrusion 评估 fixture
  - [x] 补 explain 对 global reuse 的 scope 与 provenance 解释

- [x] TODO 1: 做深多跳 recall 的 path budget / path pruning / ranking ~5d #后端 #编译 @Codex 2026-03-16
  - [x] 把 `2 hop` 扩展成受控的路径预算模型
  - [x] 增加 path pruning 与 path ranking，而不只按固定白名单扩展
  - [x] explain 输出完整 path 选择与裁剪理由
  - [x] evaluation harness 增加多跳深度与噪音控制阈值

- [x] 新起阶段 5 第二轮实现 TODO 并对齐第一轮基线 #文档 @Codex 2026-03-14
  - [x] 根据阶段 5 状态、路线图和第一轮总结整理第二轮主线
  - [x] 明确下一步优先做 path budget/path pruning
  - [x] 将入口挂到状态页、路线图、索引和 README

