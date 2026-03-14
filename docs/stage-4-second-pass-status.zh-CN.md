# 阶段 4 第二轮状态

## 当前结论
当前最准确的判断是：

`阶段 4 第二轮主线与收口项已完成，阶段 5 预研也已完成第一轮收敛。`

这意味着：
- 上下文处理底座已经不再停留在设计层，而是进入代码主链
- `Utterance Parser / SemanticSpan / Evidence Anchor / Concept Normalizer / 多节点入图` 已经贯通
- compiler、explain、evaluation harness 已开始稳定消费这层新语义层
- `Attempt / Episode / FailureSignal / ProcedureCandidate` 已进入解释、沉淀与评估链

## 第二轮已完成的范围

### 1. 上下文处理契约与输入分流
- 已固定 `summary contract / semantic extraction contract / bundle contract`
- 已把 route 注解接到 `conversation / tool_result / transcript / document / experience_trace / system`
- `inspect_bundle` 现已返回结构化 `summaryContract / bundleContract`

对应代码：
- [context-processing-contracts.ts](/d:/C_Project/openclaw_compact_context/src/core/context-processing-contracts.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

### 2. 自然语言解析与证据锚点
- 已支持中英文 sentence split 与 mixed-language clause split
- 已引入 `SemanticSpan / EvidenceAnchor`
- explain / trace 已能回到原句、子句和字符偏移

对应代码：
- [utterance-parser.ts](/d:/C_Project/openclaw_compact_context/src/core/utterance-parser.ts)
- [semantic-spans.ts](/d:/C_Project/openclaw_compact_context/src/core/semantic-spans.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts)
- [trace-view.ts](/d:/C_Project/openclaw_compact_context/src/core/trace-view.ts)

### 3. 双语概念归一与多节点入图
- 已建立最小 bilingual alias map
- 已把 `context compression / knowledge graph / provenance / checkpoint` 归一到 canonical concept
- 一条消息现在可以稳定补充多个 `Goal / Constraint / Risk / Topic / Concept` 节点

对应代码：
- [concept-normalizer.ts](/d:/C_Project/openclaw_compact_context/src/core/concept-normalizer.ts)
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/ingest-pipeline.ts)

### 4. 试错学习第一轮
- 已有 `Attempt / Episode / FailureSignal / ProcedureCandidate`
- checkpoint / skill persistence 会把这些对象 materialize 回图
- compiler 已开始用 failure signal / procedure candidate 提升 risk 与 current process 的排序

对应代码：
- [experience-learning.ts](/d:/C_Project/openclaw_compact_context/src/core/experience-learning.ts)
- [context-engine.ts](/d:/C_Project/openclaw_compact_context/src/engine/context-engine.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts)

### 5. Compiler summary / reason contract
- bundle summary 已固定必备字段
- diagnostics 已补 `Summary contract / Bundle contract / Learning signals`
- selection reason 已能解释：
  - 为什么选中
  - 为什么没选中
  - 为什么是 topic hint
  - 为什么来自 learning signal

对应代码：
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

### 6. 上下文处理专项评估
- evaluation harness 已扩展到：
  - semantic node coverage
  - concept normalization coverage
  - clause split coverage
  - evidence anchor completeness
  - experience learning coverage
- 已补 representative fixture 和 bilingual fixture

对应代码：
- [evaluation-harness.ts](/d:/C_Project/openclaw_compact_context/src/evaluation/evaluation-harness.ts)
- [evaluation-harness-fixtures.ts](/d:/C_Project/openclaw_compact_context/src/tests/fixtures/evaluation-harness-fixtures.ts)
- [evaluation-harness.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/evaluation-harness.test.ts)

## 当前验证结果
- `npm test` 通过
- 全量测试：`87` 项通过
- `npm run test:evaluation` 通过
- evaluation harness：`3` 项通过

## 仍然保留的边界
- `Topic / Concept` 仍然是受控 hint，不主导主 bundle
- 多跳 relation recall 还没有进入主链
- `FailurePattern / SuccessfulProcedure` 还没有进入长期知识晋升主链
- workspace / global 跨任务记忆复用仍未进入主实现

## 推荐下一步
当前最自然的下一步是：

1. 保持阶段 4 第二轮结果稳定
2. 新起阶段 5 正式实现 TODO
3. 把多跳 relation recall、长期知识晋升、跨任务复用与人工校正入口按主实现顺序落地

对应入口：
- [stage-5-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-prework.zh-CN.md)
- [stage-5-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-status.zh-CN.md)
- [stage-5-pre-research-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-pre-research-report.zh-CN.md)
- [stage-5-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-todo.zh-CN.md)

## 一句话结论
`阶段 4 第二轮已经把“自然语言上下文 -> 语义原子 -> 图谱节点/边 -> compiler / explain / evaluation”补成了真正可运行、可验证的主链。`
