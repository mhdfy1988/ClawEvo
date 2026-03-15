# 借鉴 summarize 的上下文处理实现

配套阅读：
- [stage-4-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-second-pass-todo.zh-CN.md)
- [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)
- [experience-learning-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/experience-learning-plan.zh-CN.md)
- [hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/hook-to-graph-pipeline.zh-CN.md)

## 1. 文档目标

这份文档专门回答一个问题：

`steipete/summarize 这样的“内容提取 + 总结 CLI”项目，有哪些工程做法值得 OpenClaw 的上下文处理主链借鉴？`

一句话结论：

`我们不借 summarize 的最终产品形态，而借它的输入分流、提取清洗、契约化 prompt、缓存与 fallback 这些工程化做法。`

## 2. summarize 在做什么

结合源码，`summarize` 的文章总结主链更接近下面这条：

```text
Input Routing
-> Content Extraction
-> Preprocess / Markdown Conversion / Transcript Resolution
-> Prompt Assembly
-> Model Attempts / Fallback
-> Streaming / Cache / Metrics
```

它的目标是：

- 从 URL / 文件 / PDF / 图片 / 音视频中拿到可用正文
- 把正文转成适合 LLM 的 prompt
- 输出一份流式摘要或 JSON 诊断结果

它并不负责：

- 把自然语言拆成语义原子
- 把上下文沉淀成知识图谱
- 把图谱编译成运行时 `bundle`

所以它和 OpenClaw 的上下文治理主链不是同一类系统。

## 3. 最值得借鉴的部分

## 3.1 输入分流，而不是所有内容走同一条链

`summarize` 会区分：

- URL
- 本地文件
- PDF
- 图片
- 音频 / 视频
- YouTube / 播客 / X

对我们的借鉴：

- 不要把 `conversation / tool_result / transcript / document / experience trace` 全都丢给同一套 parser
- 要先做 `input routing`

建议映射：

```text
conversation -> utterance parser
tool_result -> tool result normalizer
document -> document extractor / markdownify
transcript -> transcript normalizer
experience trace -> attempt / episode builder
```

## 3.2 先提取清洗，再做总结或抽取

`summarize` 不是把脏 HTML 直接喂给模型，而是先做：

- HTML fetch
- Readability
- article segment extraction
- Firecrawl fallback
- transcript resolution
- markitdown 预处理

对我们的借鉴：

- 先做 `Context Normalize`
- 再做 `Utterance Parse / Semantic Extraction`
- 再做 `Graph Materialization`
- 最后才做 `Runtime Bundle Compile`

也就是说：

`不要一开始就做自由摘要，要先把原始上下文清洗成稳定输入。`

## 3.3 内容足够短时，不强行总结

`summarize` 有一个很实用的判断：

- 如果内容本来就短
- 且已经满足目标长度
- 就可以直接返回抽取结果，不强行要求模型再生成摘要

对我们的借鉴：

- 最近几轮对话不用强制压缩
- 短工具输出不一定要二次摘要
- 对“已经足够短且清楚”的上下文，保留 raw 往往比二次改写更稳

建议落点：

- `recent raw tail preserve`
- `short-content no-compaction`
- `no-forced-summary for direct evidence`

## 3.4 Prompt 契约化，而不是随手拼 prompt

`summarize` 的 prompt 不是“内容 + 请总结一下”，而是带很重的契约：

- 输出长度
- 输出语言
- Markdown 规则
- 时间戳规则
- sponsor 过滤规则
- slides / sharer quotes 规则

对我们的借鉴：

- `Summary Contract`
- `Semantic Extraction Contract`
- `Bundle Contract`

后续我们应该把“上下文总结”从自由文本变成结构化契约，例如：

```ts
{
  goal,
  intent,
  activeRules,
  activeConstraints,
  currentProcess,
  openRisks,
  recentDecisions,
  recentStateChanges,
  relevantEvidence,
  candidateSkills
}
```

## 3.5 缓存维度设计得很细

`summarize` 会综合：

- `contentHash`
- `promptHash`
- `lengthKey`
- `languageKey`
- `model`

去决定缓存命中。

对我们的借鉴：

- parser 结果不能只按原文缓存
- 需要把 schema 版本、语言、normalization 模式也纳入 key

建议后续缓存维度：

```text
rawContentHash
+ parserVersion
+ extractionSchemaVersion
+ language
+ normalizationMode
+ conceptAliasVersion
```

这会直接影响：

- `Utterance Parser`
- `SemanticSpan Extractor`
- `Concept Normalizer`
- `Bundle Compiler`

## 3.6 fallback 是一等公民

`summarize` 的很多地方都不是“失败就失败”，而是显式设计了回退路径：

- HTML fetch 失败 -> Firecrawl
- stream 失败 -> non-stream
- 某 provider 不支持 -> fallback provider
- 媒体不支持直读 -> transcript route

对我们的借鉴：

- clause split 不稳定时，降级成 sentence-level parse
- concept normalize 失败时，保留原词并标记 unresolved
- semantic extraction 失败时，至少保留 `Evidence + coarse node`
- relation 生产不足时，不阻塞主链，先走 `supported_by`

一句话：

`上下文处理要允许降级，不要把主链做成“全有或全无”。`

## 4. 不建议照搬的部分

## 4.1 不要把系统中心放在“生成一篇摘要”

`summarize` 的终点是文章摘要。

而我们的终点是：

```text
Raw Context
-> Graph + Provenance
-> RuntimeContextBundle
-> Prompt Assembly
-> Checkpoint / Delta / Skill
```

所以不能把我们的系统中心变成：

- 只做一段 summary
- 只优化 prompt 文本
- 只让模型输出更漂亮

## 4.2 不要让 LLM 成为唯一抽取器

`summarize` 的主任务允许更强依赖模型，因为它是“从内容到摘要”。

而我们这条主链需要：

- 可追溯
- 可重复
- 可回归
- 可解释

所以不适合一开始就做：

- `message -> LLM -> JSON extraction -> overwrite graph`

更稳的路线是：

- 本地规则版 parser / normalizer 先打底
- LLM extractor 只做复杂句增强

## 4.3 不要把提取结果直接当长期知识

`summarize` 的提取结果主要服务当前这次总结。

但我们这里：

- 需要图谱
- 需要 memory
- 需要 experience learning

所以：

- 抽取结果先做 `Evidence / SemanticSpan`
- 再决定是否进 `Attempt / Episode / Pattern / Skill`

不能把“提取出来的文本结构”直接等同于“长期知识”。

## 5. 映射到我们项目时，应该怎么借

## 5.1 借“输入分流”，对应我们的模块边界

建议在现有主链前面补一个更明确的入口分流层：

```text
Input Router
-> conversation
-> tool_result
-> transcript
-> document
-> experience_trace
```

后续模块建议：

- `utterance-parser.ts`
- `tool-result-normalizer.ts`
- `document-extractor.ts`
- `transcript-normalizer.ts`
- `experience-builder.ts`

## 5.2 借“提取清洗”，对应我们的上下文处理底座

建议把阶段 4 第二轮的主线写成：

```text
RawContextRecord
-> normalize
-> sentence / clause split
-> SemanticSpan[]
-> concept normalize
-> node / edge materialization
-> RuntimeContextBundle
```

这正对应：

- `TODO 2: Utterance Parser / Clause Splitter`
- `TODO 3: SemanticSpan / Evidence Anchor`
- `TODO 4: Concept Normalizer`
- `TODO 6: 一条消息产多个语义节点`
- `TODO 7: compiler 消费新语义层`

## 5.3 借“契约化 prompt”，对应我们的 summary / bundle contract

后续建议补三个显式 contract：

- `Summary Contract`
  - 给人看 / 给 checkpoint 看
- `Semantic Extraction Contract`
  - 给 parser / extractor 用
- `Bundle Contract`
  - 给 compiler / assemble 用

这样我们的“总结”就不会继续漂成自由风格文本。

## 5.4 借“缓存 + fallback”，对应我们的 parser / extractor 主链

建议后续每层都支持：

- `cache key`
- `fallback path`
- `reason trace`

例如：

- clause split -> sentence split fallback
- concept normalize -> unresolved alias fallback
- semantic extraction -> coarse node fallback
- relation production -> supported_by fallback

并且 explain 里要能说清楚：

- 用了哪条 fallback
- 为什么用了
- 哪些精细能力这轮没生效

## 6. 对阶段 4 第二轮的直接影响

如果吸收 summarize 的经验，阶段 4 第二轮的优先级建议继续保持为：

1. `契约收敛`
2. `输入分流`
3. `Utterance Parser`
4. `SemanticSpan / Evidence Anchor`
5. `Concept Normalizer`
6. `多节点入图`
7. `compiler 消费新语义层`
8. `evaluation harness 扩展`

这里最重要的一条变化是：

`我们做的不是“总结器升级”，而是“上下文处理流水线工程化”。`

## 7. 与试错学习主线的关系

这份借鉴并不只影响文章总结，也会影响后面的经验学习。

原因是：

- `Attempt / Episode` 也需要先有稳定的原始过程提取
- `FailureSignal / ProcedureCandidate` 也需要先有 clause / span 级语义原子
- 经验晋升依赖抽取质量，而不是依赖一段自由摘要

所以对 [experience-learning-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/experience-learning-plan.zh-CN.md) 的直接支撑是：

- 先把执行过程提取干净
- 再谈失败经验和成功路径沉淀

## 8. 推荐落地顺序

1. 明确 `Summary Contract / Semantic Extraction Contract / Bundle Contract`
2. 建立 `input routing`
3. 落 `Utterance Parser / Clause Splitter`
4. 落 `SemanticSpan / Evidence Anchor`
5. 落 `Concept Normalizer`
6. 让 ingest 支持一条消息产多个语义节点
7. 让 compiler 稳定消费这些节点
8. 把 evaluation harness 扩展到中文 / 英文 / 中英混合 / 试错过程

## 9. 一句话总结

`对 OpenClaw 来说，summarize 最值得借鉴的不是“怎么写一篇摘要”，而是“怎么把输入分流、提取清洗、契约、缓存和 fallback 做成一条稳定流水线”；这正好能补我们当前上下文处理主链最薄的一段。`

