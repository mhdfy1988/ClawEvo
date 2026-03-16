# 阶段 4 第二轮增强 TODO

本清单用于管理“先补上下文处理底座，再做受控增强与经验学习”的第二轮工作。

当前判断：
`阶段 4 第二轮的主线任务与收口项已全部完成；后续工作已转入阶段 5 预研整理。`

相关文档：
- 当前状态：[stage-4-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-status.zh-CN.md)
- 总体路线图：[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)
- 多层图谱架构：[layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/layered-knowledge-graph-architecture.zh-CN.md)
- 上下文处理契约：[context-processing-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/context-processing-contracts.zh-CN.md)
- 试错学习与经验晋升：[experience-learning-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/experience-learning-plan.zh-CN.md)
- 借鉴 summarize 的处理链：[summarize-reference-for-context-processing.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/references/summarize-reference-for-context-processing.zh-CN.md)
- 阶段 5 预研说明：[stage-5-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-prework.zh-CN.md)
- 阶段 5 预研 TODO：[stage-5-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-todo.zh-CN.md)
- 阶段 4 第一轮 TODO：[stage-4-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-todo.zh-CN.md)
- TODO 模板：[todo-template.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/todo-template.zh-CN.md)

## 待办

- [ ] 当前无剩余待办；后续请转到 [stage-5-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-todo.zh-CN.md)。

## 进行中

- [ ] 当前无进行中任务；后续请转到 [stage-5-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-todo.zh-CN.md)。

## 已完成

- [x] TODO 10: 整理阶段 5 预研区 ~3d #架构 #文档 @Codex 2026-03-14
  - [x] 收敛多跳 relation recall 与 path explain 的进入条件
  - [x] 收敛 workspace / global 跨任务记忆复用与长期治理策略
  - [x] 收敛 `FailurePattern / SuccessfulProcedure / Skill / Topic / Concept` 的长期融合与晋升策略
  - [x] 收敛 `Attempt -> Episode -> Pattern -> Skill / Rule / Process` 的知识晋升合同
  - [x] 收敛观测面板、人工校正入口与可选 LLM extractor 边界
  - [x] 新起阶段 5 预研说明与 TODO 入口

- [x] TODO 9: 完成阶段 4 第二轮验收与文档收口 ~3d #文档 #评估 @Codex 2026-03-14
  - [x] 输出阶段 4 第二轮状态与总结文档
  - [x] 校正 README、路线图、索引和评估文档
  - [x] 收敛“已实现 / 半实现 / 未实现”的能力边界
  - [x] 将剩余远期项转入阶段 5 预研区

- [x] TODO 8: 扩 evaluation harness 到上下文处理专项 ~4d #测试 #评估 @Codex 2026-03-14
  - [x] 增加中文、英文、中英混合的解析 fixture
  - [x] 增加 clause split、concept normalization、semantic node materialization 指标
  - [x] 增加多次尝试、失败步骤、最终成功路径的经验抽取 fixture
  - [x] 增加 bundle coverage / omission reason / evidence anchor completeness 指标
  - [x] 将专项评估接入 `npm run test:evaluation`

- [x] TODO 7: 让 compiler 消费新语义层并收紧总结契约 ~4d #后端 #编译 @Codex 2026-03-14
  - [x] 固定 bundle / summary 必备字段，不再依赖自由摘要
  - [x] 让 `Goal / Constraint / Risk / Topic` 更稳定地来自抽取结果
  - [x] 明确成功路径、失败信号、关键步骤在 bundle 中的优先级和降级策略
  - [x] 补“为什么选中 / 为什么没选中 / 为什么被压缩”的 reason contract
  - [x] 明确 Topic / Concept 在第二轮仍为受控 admission，不反向污染主链

- [x] TODO 6: 改 ingest 支持一条消息产多个语义节点 ~5d #后端 #架构 @Codex 2026-03-14
  - [x] 将 `RawContextRecord -> Evidence -> SemanticSpan[] -> GraphNode[] / GraphEdge[]` 接入主链
  - [x] 明确 span 到 `Intent / Goal / Constraint / Risk / Process / Step / Topic / Concept` 的映射
  - [x] 让 `Attempt / Episode / FailureSignal / ProcedureCandidate` 进入统一入图路径
  - [x] 增加基于 concept 和 semantic group 的 dedupe / version / merge 规则
  - [x] 保证 provenance、governance、conflict、traceability 不回退
  - [x] 新增/扩展模块：
    - [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
    - [experience-learning.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/experience-learning.ts)
    - [context-engine.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/engine/context-engine.ts)
  - [x] 新增测试：
    - [ingest-and-compiler.test.ts](/d:/C_Project/openclaw_compact_context/tests/ingest-and-compiler.test.ts)
    - [debug-smoke-snapshots.ts](/d:/C_Project/openclaw_compact_context/tests/fixtures/debug-smoke-snapshots.ts)

- [x] TODO 5: 落 Attempt / Episode / Failure Signal 第一轮 ~4d #后端 #学习 @Codex 2026-03-14
  - [x] 定义 `Attempt / Episode / FailureSignal / ProcedureCandidate` 最小 schema
  - [x] 表达一次任务中的多次尝试、成功路径和失败路径的第一轮状态机
  - [x] 将“这个办法不行”沉淀成 `FailureSignal`，并为后续 `NegativePattern` 预留承接点
  - [x] 抽取 `CriticalStep / ProcedureCandidate`，并接进 explain / trace / debug smoke
  - [x] 新增模块：
    - [experience-learning.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/experience-learning.ts)
  - [x] 接入 explain / trace：
    - [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
    - [trace-view.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/trace-view.ts)
  - [x] 新增测试：
    - [experience-learning.test.ts](/d:/C_Project/openclaw_compact_context/tests/experience-learning.test.ts)
    - [audit-explainer.test.ts](/d:/C_Project/openclaw_compact_context/tests/audit-explainer.test.ts)
    - [debug-smoke-snapshots.ts](/d:/C_Project/openclaw_compact_context/tests/fixtures/debug-smoke-snapshots.ts)

- [x] TODO 4: 落 Concept Normalizer 与双语 alias 映射 ~4d #后端 #多语言 @Codex 2026-03-14
  - [x] 定义 canonical concept id 与 alias map
  - [x] 收敛中文 / 英文 / 别名到统一 concept
  - [x] 补最小领域词表，例如 context compression / knowledge graph / provenance / checkpoint
  - [x] 为中英同义、缩写和术语变体补测试
  - [x] 新增模块：
    - [concept-normalizer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/concept-normalizer.ts)
  - [x] 接入 SemanticSpan：
    - [semantic-spans.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/semantic-spans.ts)
  - [x] 扩 explain / trace：
    - [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
    - [trace-view.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/trace-view.ts)
  - [x] 新增测试：
    - [concept-normalizer.test.ts](/d:/C_Project/openclaw_compact_context/tests/concept-normalizer.test.ts)
    - [semantic-spans.test.ts](/d:/C_Project/openclaw_compact_context/tests/semantic-spans.test.ts)
    - [audit-explainer.test.ts](/d:/C_Project/openclaw_compact_context/tests/audit-explainer.test.ts)

- [x] TODO 3: 落 SemanticSpan 与 Evidence Anchor ~4d #后端 #图谱 @Codex 2026-03-14
  - [x] 定义 `SemanticSpan` 最小 schema 与 `EvidenceAnchor` 锚点合同
  - [x] 让每个语义原子都能回到原句、子句或字符区间
  - [x] 让 explain / trace 显示 span 和 evidence anchor
  - [x] 为多节点共用同一条原文证据补回归
  - [x] 新增模块：
    - [semantic-spans.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/semantic-spans.ts)
  - [x] 接入 explain / trace：
    - [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
    - [trace-view.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/trace-view.ts)
  - [x] 新增测试：
    - [semantic-spans.test.ts](/d:/C_Project/openclaw_compact_context/tests/semantic-spans.test.ts)
    - [audit-explainer.test.ts](/d:/C_Project/openclaw_compact_context/tests/audit-explainer.test.ts)

- [x] TODO 2: 落 Utterance Parser / Clause Splitter ~4d #后端 #上下文 @Codex 2026-03-14
  - [x] 支持中文标点切句与英文 sentence split
  - [x] 支持连接词级 clause split，覆盖中英混合表达
  - [x] 输出稳定的 `clauseId / offset / normalizedText`
  - [x] 为长句、并列句、转折句补 parser fixture
  - [x] 新增模块：
    - [utterance-parser.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/utterance-parser.ts)
  - [x] 新增类型：
    - [context-processing.ts](/d:/C_Project/openclaw_compact_context/src/types/context-processing.ts)
  - [x] 新增测试：
    - [utterance-parser.test.ts](/d:/C_Project/openclaw_compact_context/tests/utterance-parser.test.ts)
  - [x] 保持与 route contract 对齐：
    - `conversation / transcript / experience_trace` 支持 clause split
    - `tool_result / document / system` 默认先走 sentence-level fallback

- [x] TODO 1: 收敛上下文处理专项的契约与接入顺序 ~3d #架构 #上下文 @Codex 2026-03-14
  - [x] 明确“总结契约 + 语义抽取 + 入图 + 编译”是第二轮主线
  - [x] 吸收 summarize 的 `input routing / extraction hygiene / cache / fallback` 工程化做法，但不改变 `graph + compiler` 主链
  - [x] 明确 parser / extractor / normalizer / node-builder 的最小模块边界
  - [x] 明确与现有 `Schema / Conflict / Trace / relation contract / memory lifecycle` 的接缝
  - [x] 明确阶段 4 第二轮与阶段 5 预研的边界
  - [x] 新增共享类型与 helper：
    - [context-processing.ts](/d:/C_Project/openclaw_compact_context/src/types/context-processing.ts)
    - [context-processing-contracts.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/context-processing-contracts.ts)
  - [x] 新增契约文档：
    - [context-processing-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/context-processing-contracts.zh-CN.md)
  - [x] 将 route 注解接入：
    - [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
    - [transcript-loader.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/transcript-loader.ts)
    - [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)

- [x] 整理阶段 4 第二轮增强 TODO 并按后续顺序排布 #文档 @Codex 2026-03-14
  - [x] 基于代码现状、项目基线和阶段文档收敛第二轮主线
  - [x] 将“上下文处理底座优先”固定为当前推荐路线




