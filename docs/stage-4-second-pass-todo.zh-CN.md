# 阶段 4 第二轮增强 TODO

本清单用于管理“先补上下文处理底座，再做受控增强与经验学习”的第二轮工作。

当前判断：
`阶段 4 第一轮已完成；第二轮的主线是把“自然语言上下文 -> 语义原子 -> 图谱节点/边 -> runtime bundle”补成稳定主链，并把试错过程逐步沉淀成可晋升的经验对象。`

相关文档：
- 当前状态：[stage-4-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-status.zh-CN.md)
- 总体路线图：[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
- 多层图谱架构：[layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/layered-knowledge-graph-architecture.zh-CN.md)
- 上下文处理契约：[context-processing-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing-contracts.zh-CN.md)
- 试错学习与经验晋升：[experience-learning-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/experience-learning-plan.zh-CN.md)
- 借鉴 summarize 的处理链：[summarize-reference-for-context-processing.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/summarize-reference-for-context-processing.zh-CN.md)
- 阶段 4 第一轮 TODO：[stage-4-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-todo.zh-CN.md)
- TODO 模板：[todo-template.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/todo-template.zh-CN.md)

## 待办

- [ ] TODO 2: 落 Utterance Parser / Clause Splitter ~4d #后端 #上下文 2026-03-18
  - [ ] 支持中文标点切句与英文 sentence split
  - [ ] 支持连接词级 clause split，覆盖中英混合表达
  - [ ] 输出稳定的 `clauseId / offset / normalizedText`
  - [ ] 为长句、并列句、转折句补 fixture

- [ ] TODO 3: 落 SemanticSpan 与 Evidence Anchor ~4d #后端 #图谱 2026-03-21
  - [ ] 定义 `SemanticSpan` 最小 schema
  - [ ] 让每个语义原子都能回到原句、子句或字符区间
  - [ ] 让 explain / trace 显示 span 和 evidence anchor
  - [ ] 为多节点共用同一条原文证据补回归

- [ ] TODO 4: 落 Concept Normalizer 与双语 alias 映射 ~4d #后端 #多语言 2026-03-24
  - [ ] 定义 canonical concept id 与 alias map
  - [ ] 收敛中文 / 英文 / 别名到统一 concept
  - [ ] 补最小领域词表，例如 context compression / knowledge graph / provenance / checkpoint
  - [ ] 为中英同义、缩写和术语变体补测试

- [ ] TODO 5: 落 Attempt / Episode / Failure Signal 第一轮 ~4d #后端 #学习 2026-03-28
  - [ ] 定义 `Attempt / Episode` 最小 schema
  - [ ] 表达一次任务中的多次尝试、成功路径和失败路径
  - [ ] 将“这个办法不行”沉淀成 `FailureSignal / NegativePattern` 候选，而不是直接删除
  - [ ] 抽取 `CriticalStep / ProcedureCandidate`，为后续技能晋升做输入

- [ ] TODO 6: 改 ingest 支持一条消息产多个语义节点 ~5d #后端 #架构 2026-04-01
  - [ ] 将 `RawContextRecord -> Evidence -> SemanticSpan[] -> GraphNode[] / GraphEdge[]` 接入主链
  - [ ] 明确 span 到 `Intent / Goal / Constraint / Risk / Process / Step / Topic / Concept` 的映射
  - [ ] 让 `Attempt / Episode / FailureSignal / ProcedureCandidate` 进入统一入图路径
  - [ ] 增加基于 concept 和 semantic group 的 dedupe / version / merge 规则
  - [ ] 保证 provenance、governance、conflict、traceability 不回退

- [ ] TODO 7: 让 compiler 消费新语义层并收紧总结契约 ~4d #后端 #编译 2026-04-05
  - [ ] 固定 bundle / summary 必备字段，不再依赖自由摘要
  - [ ] 让 `Goal / Constraint / Risk / Topic` 更稳定地来自抽取结果
  - [ ] 明确成功路径、失败信号、关键步骤在 bundle 中的优先级和降级策略
  - [ ] 补“为什么选中 / 为什么没选中 / 为什么被压缩”的 reason contract
  - [ ] 明确 Topic / Concept 在第二轮仍为受控 admission，不反向污染主链

- [ ] TODO 8: 扩 evaluation harness 到上下文处理专项 ~4d #测试 #评估 2026-04-08
  - [ ] 增加中文、英文、中英混合的解析 fixture
  - [ ] 增加 clause split、concept normalization、semantic node materialization 指标
  - [ ] 增加多次尝试、失败步骤、最终成功路径的经验抽取 fixture
  - [ ] 增加 bundle coverage / omission reason / evidence anchor completeness 指标
  - [ ] 将专项评估接入 `npm run test:evaluation`

- [ ] TODO 9: 完成阶段 4 第二轮验收与文档收口 ~3d #文档 #评估 2026-04-10
  - [ ] 输出阶段 4 第二轮状态与总结文档
  - [ ] 校正 README、路线图、索引和调试手册
  - [ ] 收敛“已实现 / 半实现 / 未实现”的能力边界
  - [ ] 将剩余远期项转入阶段 5 预研区

- [ ] TODO 10: 整理阶段 5 预研区 ~3d #架构 #文档 2026-04-12
  - [ ] 收敛多跳 relation recall 与 path explain 的进入条件
  - [ ] 收敛 workspace / global 跨任务记忆复用与长期治理策略
  - [ ] 收敛 `FailurePattern / SuccessfulProcedure / Skill / Topic / Concept` 的长期融合与晋升策略
  - [ ] 收敛 `Attempt -> Episode -> Pattern -> Skill / Rule / Process` 的知识晋升合同
  - [ ] 收敛观测面板、人工校正入口与可选 LLM extractor 边界

## 进行中

- [ ] TODO 2: 落 Utterance Parser / Clause Splitter ~4d #后端 #上下文 2026-03-18
  - [ ] 先完成 parser 模块边界、输入输出和 fallback 顺序
  - [ ] 再接最小中英文切句 / clause split

## 已完成

- [x] TODO 1: 收敛上下文处理专项的契约与接入顺序 ~3d #架构 #上下文 @Codex 2026-03-14
  - [x] 明确“总结契约 + 语义抽取 + 入图 + 编译”是第二轮主线
  - [x] 吸收 summarize 的 `input routing / extraction hygiene / cache / fallback` 工程化做法，但不改变 `graph + compiler` 主链
  - [x] 明确 parser / extractor / normalizer / node-builder 的最小模块边界
  - [x] 明确与现有 `Schema / Conflict / Trace / relation contract / memory lifecycle` 的接缝
  - [x] 明确阶段 4 第二轮与阶段 5 预研的边界
  - [x] 新增共享类型与 helper：
    - [context-processing.ts](/d:/C_Project/openclaw_compact_context/src/types/context-processing.ts)
    - [context-processing-contracts.ts](/d:/C_Project/openclaw_compact_context/src/core/context-processing-contracts.ts)
  - [x] 新增契约文档：
    - [context-processing-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing-contracts.zh-CN.md)
  - [x] 将 route 注解接入：
    - [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
    - [transcript-loader.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/transcript-loader.ts)
    - [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/ingest-pipeline.ts)

- [x] 整理阶段 4 第二轮增强 TODO 并按后续顺序排布 #文档 @Codex 2026-03-14
  - [x] 基于代码现状、项目基线和阶段文档收敛第二轮主线
  - [x] 将“上下文处理底座优先”固定为当前推荐路线
