# 阶段 5 正式实现 TODO

本清单用于管理阶段 5 的正式实现工作，重点是把阶段 5 预研已经收敛好的长期方向，按风险和收益顺序接进主链。

相关文档：
- 阶段 5 状态：[stage-5-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-status.zh-CN.md)
- 阶段 5 预研说明：[stage-5-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-prework.zh-CN.md)
- 阶段 5 预研总结：[stage-5-pre-research-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-pre-research-report.zh-CN.md)
- 多跳 recall 与 path explain：[multi-hop-recall-and-path-explain-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/multi-hop-recall-and-path-explain-plan.zh-CN.md)
- 跨任务记忆复用：[cross-task-memory-reuse-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/cross-task-memory-reuse-plan.zh-CN.md)
- 知识晋升合同：[knowledge-promotion-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/knowledge-promotion-contract.zh-CN.md)
- Topic / Concept / Skill 融合：[topic-concept-skill-fusion-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/topic-concept-skill-fusion-plan.zh-CN.md)
- 观测、人工与 LLM 边界：[observability-human-in-the-loop-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/observability-human-in-the-loop-plan.zh-CN.md)
- TODO 模板：[todo-template.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/todo-template.zh-CN.md)

当前判断：
`阶段 5 第一轮正式实现 TODO 1-6 已完成；阶段 5 第二轮也已完成，当前请以 [stage-5-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-second-pass-status.zh-CN.md) 和 [stage-5-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-second-pass-report.zh-CN.md) 作为最新基线。`

## 待办

- [ ] 当前无剩余待办；后续请转到 [stage-5-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-second-pass-todo.zh-CN.md)。

## 进行中

- [ ] 当前无进行中任务；后续请转到 [stage-5-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-second-pass-todo.zh-CN.md)。

## 已完成

- [x] TODO 6: 阶段 5 第一轮验收与总结 ~3d #文档 #评估 @Codex 2026-03-14
  - [x] 输出阶段 5 第一轮状态文档
  - [x] 输出阶段 5 第一轮总结文档
  - [x] 收敛已实现 / 半实现 / 未实现边界
  - [x] 明确下一步应进入“阶段 5 第二轮实现 TODO”

- [x] TODO 5: 落人工校正与观测第一轮 ~5d #平台 #评估 @Codex 2026-03-14
  - [x] 定义 concept alias / promotion decision 的人工校正入口
  - [x] 定义 correction provenance / rollback 最小结构
  - [x] 输出阶段级 observability snapshot 所需最小 metrics contract
  - [x] 补长期观测 fixture 与 smoke/test

- [x] TODO 4: 落 Topic / Concept / Skill admission 第一轮 ~4d #后端 #图谱 @Codex 2026-03-14
  - [x] 保持 Topic / Concept 默认不污染主 bundle
  - [x] 只在高置信条件下开放受控 admission
  - [x] 明确 Skill 与 Topic / Concept 的最小关系消费链
  - [x] 补 topic admission intrusion 与 explain 回归

- [x] TODO 3: 落知识晋升执行器第一轮 ~6d #后端 #学习 @Codex 2026-03-14
  - [x] 增加 `Pattern / FailurePattern / SuccessfulProcedure` 最小对象
  - [x] 将 `Attempt / Episode` 结果晋升到 pattern 层
  - [x] 增加 promotion / downgrade / retire 第一轮状态
  - [x] 补 explain / evaluation 对知识晋升的覆盖

- [x] TODO 2: 落高 scope 记忆复用第一轮 ~5d #后端 #记忆 @Codex 2026-03-14
  - [x] 支持受控 `session -> workspace` promotion 主链
  - [x] 将 workspace recall tier 接入 compiler fallback
  - [x] 补高 scope intrusion / usefulness 回归
  - [x] 补 scope promotion explain 与 evaluation fixture

- [x] TODO 1: 落多跳 relation recall 与 path explain 第一轮 ~5d #后端 #编译 @Codex 2026-03-14
  - [x] 支持受控 `2 hop` relation 白名单扩展
  - [x] 增加 path explain 数据合同与 explain 输出
  - [x] 增加 path budget / path prune / cost diagnostics
  - [x] 保证多跳默认 explain-first，不直接放大主 bundle
  - [x] 补多跳 recall representative fixture 与 evaluation harness

- [x] 启动阶段 5 正式实现 TODO 并对齐预研结论 #文档 @Codex 2026-03-14
  - [x] 将阶段 5 正式实现主线按风险和收益排序
  - [x] 明确多跳 recall 为第一实现项
  - [x] 将入口挂到状态、路线图和索引

