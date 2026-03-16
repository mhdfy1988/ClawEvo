# 上下文处理契约

配套阅读：
- [stage-4-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-second-pass-todo.zh-CN.md)
- [summarize-reference-for-context-processing.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/references/summarize-reference-for-context-processing.zh-CN.md)
- [experience-learning-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/experience-learning-plan.zh-CN.md)
- [hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/hook-to-graph-pipeline.zh-CN.md)

## 1. 文档目标

这份文档收敛阶段 4 第二轮 `TODO 1` 的最小共识：

`我们当前要补的是上下文处理契约层，而不是直接把 parser、normalizer、Attempt/Episode 全部一次性做完。`

契约层要先回答四个问题：

1. 输入先按什么路由分流
2. 结构化 summary 最低要产出什么
3. 后续 semantic extraction 要遵守什么约束
4. bundle / compiler 需要什么固定输入形状

## 2. 当前主链位置

项目现有主链仍然是：

```text
Raw Context
-> ingest
-> graph + provenance + governance
-> runtime bundle
-> prompt assemble
-> checkpoint / delta / skill candidate
```

阶段 4 第二轮补的是这一段：

```text
Raw Context
-> input routing
-> normalize
-> sentence / clause parse
-> semantic spans
-> graph materialization
-> runtime bundle
```

也就是说：

`TODO 1` 不负责实现 parser 本身，而是先把后续 parser / extractor / normalizer / node-builder 的接缝定义清楚。

## 3. 输入分流契约

当前约定的 `ContextInputRouteKind`：

- `conversation`
- `tool_result`
- `transcript`
- `document`
- `experience_trace`
- `system`

### 3.1 路由原则

- `conversation`
  - 普通 user / assistant 会话消息
- `tool_result`
  - 原始 tool output
  - `tool_result_persist` 产生的压缩 tool output
- `transcript`
  - transcript message / custom_message / compaction
- `document`
  - document / rule / workflow / skill 这类外部输入
- `experience_trace`
  - runtime bundle / checkpoint / delta / skill candidate 及后续 Attempt / Episode
- `system`
  - 宿主或插件显式注入的系统上下文

### 3.2 工程要求

- 路由必须在 `RawContextRecord` 进入 ingest 之前就能确定
- 路由结果应写入 metadata，后续 explain / trace 可见
- 路由失败时不允许阻塞主链，至少回退为 `conversation` 或 `system`

## 4. Summary Contract

我们后续不再把“总结”定义成一段自由文本，而定义成结构化 contract。

当前最低 summary 形状：

```ts
{
  goal?: ContextSummaryContractItem;
  intent?: ContextSummaryContractItem;
  currentProcess?: ContextSummaryContractItem;
  activeRules: ContextSummaryContractItem[];
  activeConstraints: ContextSummaryContractItem[];
  openRisks: ContextSummaryContractItem[];
  recentDecisions: ContextSummaryContractItem[];
  recentStateChanges: ContextSummaryContractItem[];
  relevantEvidence: ContextSummaryContractItem[];
  candidateSkills: ContextSummaryContractItem[];
  requiredSlots: RuntimeContextSelectionSlot[];
  tokenBudget: TokenBudgetUsage;
}
```

每个 `ContextSummaryContractItem` 至少包括：

- `nodeId`
- `type`
- `label`
- `reason`
- `preferredForm`
- `requiresEvidence`

### 4.1 这意味着什么

- prompt summary 不再是“想怎么写就怎么写”
- checkpoint 侧 summary 也有最小结构锚点
- 后续 evaluation 可以直接评估 `requiredSlots` 的覆盖率

## 5. Semantic Extraction Contract

后续 parser / extractor 不允许直接跳过 evidence 和治理链。

每条 route 都要遵守这些共享约束：

- `preserveRawEvidence = true`
- `evidenceAnchorRequired = true`
- `conceptNormalization = true`
- `multiNodeMaterialization = true`

每条 route 再补 route-specific 差异：

- `conversation`
  - 支持 clause split
  - 主要产出 `Intent / Goal / Constraint / Risk / Process / Step / Topic / Concept`
- `tool_result`
  - 以结构化 metadata 和压缩摘要为主
  - 主要产出 `State / Risk / Outcome / Tool`
- `transcript`
  - 保留 transcript provenance
  - 允许 message/custom/compaction 共用一套 extraction schema
- `document`
  - 主要产出 `Rule / Constraint / Process / Step / Skill / Topic / Concept`
- `experience_trace`
  - 为后续 `Attempt / Episode / Pattern` 做输入预留
- `system`
  - 主要产出 `Rule / Constraint / Mode / Process / Step`

### 5.1 fallback 原则

每条 extraction 路线都必须允许降级：

- `raw_record`
- `sentence_split`
- `coarse_node`
- `unresolved_concept`
- `supported_by_only`

也就是说：

`失败时要降级，不要阻塞主链。`

## 6. Bundle Contract

bundle 仍然是系统运行时的中心出口，所以需要固定结构。

当前 bundle contract 最低固定项：

- 固定 slots
  - `goal`
  - `intent`
  - `currentProcess`
- 固定 categories
  - `activeRules`
  - `activeConstraints`
  - `openRisks`
  - `recentDecisions`
  - `recentStateChanges`
  - `relevantEvidence`
  - `candidateSkills`

### 6.1 Bundle Contract Snapshot

为了让 debug / evaluation 更稳定，contract 层还会额外输出：

- 固定 slot 覆盖情况
- 各 category 数量
- `topicHintCount`
- 是否开启 relation retrieval

这个 snapshot 不是给模型看的，而是给：

- explain
- evaluation harness
- 后续阶段验收

## 7. 模块边界

按照当前契约，后续新增模块边界收敛为：

- `input router`
  - 判断 route kind
- `utterance parser`
  - sentence / clause split
- `semantic extractor`
  - clause -> semantic spans
- `concept normalizer`
  - alias -> canonical concept
- `semantic node builder`
  - spans -> nodes / edges

当前 TODO 1 只要求把这些模块边界写清楚，不要求现在全部落代码。

## 8. 与现有主链的接缝

这套契约层必须兼容现有：

- `Schema`
- `Conflict`
- `Trace`
- `relation contract`
- `memory lifecycle`

所以后续 semantic layer 落地时必须满足：

- 不丢 provenance
- 不绕过 governance
- 不回退冲突裁决
- 不破坏 explain / trace
- 不让 Topic / Concept 反向污染主 bundle

## 9. 阶段 4 第二轮与阶段 5 的边界

### 阶段 4 第二轮负责

- 输入分流
- Summary Contract
- Semantic Extraction Contract
- Bundle Contract
- parser / extractor / normalizer / node-builder 的模块边界
- 为 Attempt / Episode 打地基

### 阶段 5 预研负责

- 多跳 relation recall
- Attempt / Episode -> Pattern -> Skill / Rule / Process 的完整晋升合同
- Topic / Concept 从 hint 到更成熟 admission
- 更强的多语义、跨任务记忆、可选 LLM extractor

一句话：

`阶段 4 第二轮先把上下文处理底座做稳，阶段 5 再在这个底座上做更强的学习和知识晋升。`

## 10. 当前代码落点

当前最小实现已经收进：

- 类型：
  - [context-processing.ts](/d:/C_Project/openclaw_compact_context/packages/contracts/src/types/context-processing.ts)
- helper：
  - [context-processing-contracts.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/context-processing-contracts.ts)

目前已落地的能力：

- `resolveContextInputRoute()`
- `annotateContextInputRoute()`
- `getSemanticExtractionContract()`
- `buildContextSummaryContract()`
- `buildBundleContractSnapshot()`

并且已经接到：

- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/context-engine-adapter.ts)
- [transcript-loader.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/transcript-loader.ts)
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)

## 11. 一句话总结

`TODO 1 的交付不是“做完上下文理解”，而是先把上下文处理主链的输入分流、summary 结构、semantic extraction 约束和 bundle 结构固定下来，让后续 TODO 2-8 都能沿着同一套契约继续实现。`



