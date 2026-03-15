# 阶段 5 预研 TODO

本清单用于管理阶段 5 预研工作，重点是把长期方向收敛成清晰的设计边界、进入条件和实现顺序。

相关文档：
- 当前状态：[stage-4-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-status.zh-CN.md)
- 阶段 4 第二轮状态：[stage-4-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-second-pass-status.zh-CN.md)
- 总体路线图：[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)
- 阶段 5 预研说明：[stage-5-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-prework.zh-CN.md)
- 阶段 5 状态：[stage-5-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-status.zh-CN.md)
- 阶段 5 预研总结：[stage-5-pre-research-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-pre-research-report.zh-CN.md)
- 多跳 recall 与 path explain：[multi-hop-recall-and-path-explain-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/multi-hop-recall-and-path-explain-plan.zh-CN.md)
- 跨任务记忆复用：[cross-task-memory-reuse-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/cross-task-memory-reuse-plan.zh-CN.md)
- 知识晋升合同：[knowledge-promotion-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/knowledge-promotion-contract.zh-CN.md)
- Topic / Concept / Skill 融合：[topic-concept-skill-fusion-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/topic-concept-skill-fusion-plan.zh-CN.md)
- 观测、人工与 LLM 边界：[observability-human-in-the-loop-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/observability-human-in-the-loop-plan.zh-CN.md)
- 试错学习与经验晋升：[experience-learning-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/experience-learning-plan.zh-CN.md)
- TODO 模板：[todo-template.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/todo-template.zh-CN.md)

当前判断：
`阶段 5 预研 TODO 1-6 已完成，阶段 5 第一轮正式实现也已完成；本页只保留预研历史，后续请看正式实现总结与下一轮规划。`

后续入口：
- [stage-5-implementation-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-implementation-todo.zh-CN.md)
- [stage-5-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-first-pass-report.zh-CN.md)

## 待办

- [ ] 当前无剩余待办；后续请新起“阶段 5 正式实现 TODO”。

## 进行中

- [ ] 当前无进行中任务；后续请新起“阶段 5 正式实现 TODO”。

## 已完成

- [x] TODO 6: 输出阶段 5 预研总结与进入条件 ~2d #文档 #评估 @Codex 2026-03-14
  - [x] 输出阶段 5 预研总结文档
  - [x] 明确阶段 5 正式实现的进入条件
  - [x] 明确不进入实现阶段的延后项
  - [x] 产出文档：
    - [stage-5-pre-research-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-pre-research-report.zh-CN.md)
    - [stage-5-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-status.zh-CN.md)

- [x] TODO 5: 收敛观测、人工校正与可选 LLM extractor 边界 ~4d #架构 #平台 @Codex 2026-03-14
  - [x] 明确长期 dashboard 和阶段级报告的最小范围
  - [x] 明确人工校正入口与可回滚策略
  - [x] 明确可选 LLM extractor 的增强边界与禁区
  - [x] 产出文档：
    - [observability-human-in-the-loop-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/observability-human-in-the-loop-plan.zh-CN.md)

- [x] TODO 4: 收敛 Topic / Concept / Skill 长期融合边界 ~3d #架构 #图谱 @Codex 2026-03-14
  - [x] 明确 Topic / Concept 从 hint 到 admission 的条件
  - [x] 明确 Topic / Concept 与 Skill 的关系建模策略
  - [x] 明确何时保留为概念层、何时晋升为长期技能
  - [x] 产出文档：
    - [topic-concept-skill-fusion-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/topic-concept-skill-fusion-plan.zh-CN.md)

- [x] TODO 3: 收敛知识晋升合同 ~4d #架构 #学习 @Codex 2026-03-14
  - [x] 收敛 `Attempt -> Episode -> Pattern -> Skill / Rule / Process`
  - [x] 收敛 `FailurePattern / SuccessfulProcedure / CriticalStep` 的长期治理状态
  - [x] 明确晋升阈值、反例保留和回退策略
  - [x] 产出文档：
    - [knowledge-promotion-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/knowledge-promotion-contract.zh-CN.md)

- [x] TODO 2: 收敛跨任务记忆复用与高 scope 治理 ~4d #架构 #记忆 @Codex 2026-03-14
  - [x] 明确 `session -> workspace -> global` promotion 门槛
  - [x] 明确跨任务复用的 recall tier 与隔离规则
  - [x] 明确高 scope 记忆的清理、退役与冲突裁决
  - [x] 产出文档：
    - [cross-task-memory-reuse-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/cross-task-memory-reuse-plan.zh-CN.md)

- [x] TODO 1: 收敛多跳 relation recall 与 path explain 边界 ~4d #架构 #编译 @Codex 2026-03-14
  - [x] 明确允许进入多跳路径的 relation type
  - [x] 明确 path explain 的最小输出合同
  - [x] 明确多跳召回的预算、成本和降级策略
  - [x] 明确哪些路径只允许 explain，不允许进入 bundle
  - [x] 产出文档：
    - [multi-hop-recall-and-path-explain-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/multi-hop-recall-and-path-explain-plan.zh-CN.md)

- [x] 启动阶段 5 预研 TODO 并对齐阶段 4 第二轮出口 #文档 @Codex 2026-03-14
  - [x] 输出阶段 5 预研说明
  - [x] 将阶段 5 入口挂到路线图、索引与阶段 4 第二轮 TODO

