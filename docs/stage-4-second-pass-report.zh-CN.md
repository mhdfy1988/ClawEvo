# 阶段 4 第二轮总结

## 本轮目标
阶段 4 第二轮的目标不是继续扩 relation，而是把上下文处理底座真正补齐：

```text
自然语言上下文
-> utterance parse
-> semantic spans
-> concept normalize
-> graph materialization
-> runtime bundle compile
-> explain / evaluation
```

同时把试错过程开始收敛成可晋升的经验对象：

```text
bundle
-> Attempt / Episode / FailureSignal / ProcedureCandidate
-> checkpoint / skill persistence
-> compiler / explain / evaluation
```

## 这轮真正完成了什么

### 1. 从“粗粒度消息”走到了“语义原子”
现在已经不再是“一条消息只产一个粗节点”：
- 有 `Utterance Parser`
- 有 `SemanticSpan`
- 有 `EvidenceAnchor`
- 有 bilingual `Concept Normalizer`
- ingest 已能基于 span 补充多个语义节点

### 2. compiler 开始稳定消费这层新语义
这一轮不是只把解析结果放进 explain，而是让 compiler 真正开始读它们：
- span-derived `Goal / Constraint / Risk / Topic` 更容易稳定进 bundle 或 topic hint
- `FailureSignal / ProcedureCandidate` 会为 `openRisks / currentProcess / prerequisites` 提供 learning boost
- summary / diagnostics 已有固定 contract，不再只靠自由文本

### 3. explain 和 debug 视图更像系统接口了
`inspect_bundle` 现在不只是返回：
- `bundle`
- `summary`
- `promptPreview`

还会返回：
- `summaryContract`
- `bundleContract`

这让“结构化上下文”和“可读文本摘要”终于同步起来。

### 4. evaluation harness 不再只测 relation / memory
第二轮已经把上下文处理专项的关键指标纳入守门：
- semantic node coverage
- concept normalization coverage
- clause split coverage
- evidence anchor completeness
- experience learning coverage

并且已经有 bilingual fixture 来覆盖中英混合场景。

## 本轮最值得保留的设计收敛
- `Evidence-first` 仍然没有退
- `Topic / Concept` 仍然被限制为受控 hint
- `Attempt / Episode` 已开始入图，但没有反向污染 prompt 主链
- context-processing contract 没有绕过现有 `Schema / Conflict / Trace`

## 现在已经有、但还不该夸大成“已完成”的
- `Attempt / Episode / FailureSignal / ProcedureCandidate`
  - 已有第一轮闭环
  - 但还不是长期知识晋升平台
- `Topic / Concept`
  - 已有最小模型与 diagnostics
  - 但还不是主 bundle admission 层
- `Concept Normalizer`
  - 已有最小词表
  - 但还不是完整领域词典

## 第二轮之后的合理边界
适合进入阶段 5 预研的内容：
- 多跳 relation recall 与 path explain
- `FailurePattern / SuccessfulProcedure` 的长期治理
- `Attempt -> Episode -> Pattern -> Skill / Rule / Process` 的知识晋升合同
- workspace / global 跨任务记忆复用
- 人工校正入口和更强的观测面板

## 验证结果
- `npm test`：`87` 项通过
- `npm run test:evaluation`：`3` 项通过

## 一句话结论
`阶段 4 第二轮最大的价值，不是再多做了几种节点，而是把“上下文理解”第一次真正接进了现有 graph + compiler + explain + evaluation 主链。`
