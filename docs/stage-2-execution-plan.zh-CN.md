# 阶段 2 执行计划：源头治理与结构质量提升

## 1. 文档目标

这份文档把 [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md) 里的“阶段 2”单独展开成一份可执行计划。

阶段 2 不再回答“方向是什么”，而是回答：

1. 这一阶段到底要解决什么问题
2. 这一阶段先做哪几件事
3. 每一轮迭代的目标、输入、输出和完成标准是什么
4. 阶段 2 完成后，系统会比现在强在哪里

---

说明：

- 这份文档保留的是阶段 2 的原始执行计划视角
- 阶段 2 当前已经完成收口；最新结论与验收结果请同时参考：
  - [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
  - [stage-2-exit-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-exit-report.zh-CN.md)

---

## 2. 阶段 2 的定位

根据当前代码状态，项目已经不再是“准备进入阶段 2”，当前更准确的描述是：

`阶段 2 已完成收口，本文档保留为阶段 2 的历史执行计划与验收对照`

阶段 2 的定位不是继续补骨架，而是：

`把已经跑通的上下文闭环，推进成一套更高质量的上下文治理系统。`

阶段 2 对应的关键词是：

- 源头治理
- 结构提升
- 裁决质量

更具体一点说，就是三件事：

1. 从源头控制 transcript 膨胀
2. 提升 ingest 的结构化质量
3. 提升 compiler 的上下文选择质量

---

## 3. 阶段 2 的总目标

建议把阶段 2 的总目标定义为：

`让上下文系统不只“能压缩”，而且能从源头减少垃圾上下文、能更准确地识别结构、能更稳定地选出真正有用的上下文。`

这意味着阶段 2 完成后，系统应该具备下面这些变化：

### 变化 1

大体量 tool result 不再无脑进入 transcript。

### 变化 2

图谱里不再只是粗粒度的 `Intent / Decision / State`，而是能更稳定识别：

- `Rule`
- `Constraint`
- `Process`
- `Step`
- `Risk`

### 变化 3

`RuntimeContextBundle` 的内容更像“当前生效知识的裁决结果”，而不是“抓一些相关文本”。

### 变化 4

系统开始能解释：

- 为什么某段 tool result 被裁剪
- 为什么某条历史没被保留
- 为什么这次 bundle 选择了 raw，或者降级用了 compressed

---

## 4. 阶段 2 的完成定义

当下面这些条件都满足时，可以认为阶段 2 完成：

1. `tool_result_persist` 已接入并在宿主侧生效
2. 大 tool result 在写 transcript 前已被控制
3. ingest 对规则、约束、流程、风险的识别质量明显优于当前版本
4. compiler 对规则、约束、状态、证据的优先级更清晰
5. explain 能说明裁剪和选择背后的原因

一句话说：

`阶段 2 完成的标志，是系统开始从“会压缩”升级成“会治理”。`

---

## 5. 阶段 2 的边界

为了避免阶段膨胀，阶段 2 需要明确边界。

## 5.1 阶段 2 要做的

- `tool_result_persist`
- tool result 裁剪策略
- provenance 贯穿裁剪链
- ingest 语义识别增强
- compiler 预算池与优先级增强
- 反向 explain 基础能力

## 5.2 阶段 2 不做的

- 多层 checkpoint 体系
- skill 候选跨轮统计升格
- graph 复杂关系推理平台化
- 向量检索 / embedding 大规模接入
- workspace/global 级别共享复用

这些属于阶段 3 或阶段 4 的工作。

---

## 6. 阶段 2 的依赖前提

阶段 2 建立在阶段 1 之上，因此默认依赖下面这些能力已经存在：

- provenance 主链已经接入
- raw / compressed / derived 已可区分
- `assemble()` 压缩链有效
- checkpoint / delta 能跟随压缩更新
- explain 基础可用

如果这些还不稳定，就不应强推阶段 2。

---

## 7. 阶段 2 的迭代拆分

建议把阶段 2 拆成四轮小迭代，而不是一次性并行推进。

## 迭代 2.1：定义源头治理规则

### 目标

先把 tool result 的治理策略定义清楚，而不是先上代码。

### 要解决的问题

当前最大风险不是“不会裁剪”，而是“裁错了以后无法排查”。

因此第一轮要解决的是：

- 哪些 tool result 可以裁
- 哪些字段绝不能丢
- 哪些内容只能摘要，不能截断
- 如何保留 provenance 与 explain 能力

### 本轮输出

- 一份 `tool result policy` 设计文档
- 当前文档产物： [tool-result-policy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/tool-result-policy.zh-CN.md)
- 一组分类规则：
  - 可安全截断
  - 需保留错误上下文
  - 需保留关键信号
  - 需保留来源和 hash
- 一组标准压缩产物结构

### 涉及模块

- `hook-coordinator`
- 新的 `tool-result-policy.ts`
- provenance 设计文档联动

### 完成标准

- 对至少 3 类常见 tool result 定出明确处理策略
- 可以写出 deterministic 的裁剪规则，而不是靠人工判断
- explain 层知道后续要解释哪些字段

### 风险

- 白名单过窄，减不下体积
- 白名单过宽，丢关键排障信息

---

## 迭代 2.2：接入 `tool_result_persist`

### 目标

把阶段 2.1 的策略真正接进宿主 hook。

### 要解决的问题

现在 transcript 膨胀是在“写进去之后再想办法压”，成本太高。

这轮要把治理前移到：

`tool result 写 transcript 之前`

### 本轮输出

- `tool_result_persist` hook handler
- tool result 压缩策略实现
- 被压缩结果的 provenance 标记
- transcript 中压缩后对象的最小结构

### 建议实现结构

```text
tool_result_persist
-> classify tool result
-> apply policy
-> keep key fields
-> add provenance
-> persist reduced message
```

### 涉及模块

- `src/openclaw/types.ts`
- `src/openclaw/hook-coordinator.ts`
- 新增 `src/openclaw/tool-result-policy.ts`
- 可能新增 `src/openclaw/tool-result-normalizer.ts`

### 完成标准

- 超大 tool result 不再完整进入 transcript
- 被保留内容足以支持后续图谱 ingest
- provenance 能说明这是 `compressed` 的 tool result
- 对同类输入，输出结果稳定一致

### 风险

- OpenClaw 实际 hook payload 与预期不一致
- 压缩后 transcript 影响后续 debug

---

## 迭代 2.3：提升 ingest 结构质量

### 目标

让 ingest 从“粗粒度角色映射”提升到“更细粒度语义识别”。

### 要解决的问题

当前系统虽然已经能入图，但结构层还偏粗：

- 用户消息大多是 `Intent`
- 助手消息大多是 `Decision`
- tool 输出大多是 `State`

这对阶段 1 足够，但对阶段 2 不够。

### 本轮输出

- 更细粒度的规则/约束/流程/风险识别逻辑
- `custom_message / compaction` 的更细映射
- ingest policy 拆分
- 更清晰的 dedupe / version 规则

### 推荐识别优先级

#### 第一批优先识别

- `Constraint`
- `Process`
- `Step`
- `Risk`

#### 第二批再增强

- `Outcome`
- `Mode`
- `Tool`

### 建议实现方式

第一版仍建议本地实现：

- 模式匹配
- 规则词表
- metadata 优先
- sourceType 特定 policy

不要在阶段 2 一开始就引入外部 LLM 作为主抽取器。

### 涉及模块

- `src/core/ingest-pipeline.ts`
- `src/openclaw/transcript-loader.ts`
- 可能新增 `src/core/ingest-policies/*.ts`

### 完成标准

- 对典型规则/约束文本的误分类率明显下降
- compaction / custom_message 的图谱表达更合理
- 同类语义对象不会大量重复入图

### 风险

- 规则式抽取覆盖不全
- 去重策略过强导致不同事实被合并

---

## 迭代 2.4：提升 compiler 裁决质量

### 目标

让 bundle 的选择更像“当前有效知识裁决”，而不是“相关内容拼接”。

### 要解决的问题

当前 compiler 已经开始使用 provenance，但还可以更进一步：

- 规则、约束、证据、状态的预算要更细
- raw / compressed 的回退策略要更明确
- selection explain 要更完整

### 本轮输出

- 分类型预算池
- 更明确的优先级策略
- raw-first / compressed-fallback 的更细控制
- explain 中加入“未选原因”的第一版能力

### 推荐优先级顺序

在有限 budget 下，建议优先顺序明确为：

1. 当前 goal / intent
2. active rules
3. active constraints
4. current process / step
5. open risks
6. recent decisions / states
7. supporting evidence
8. candidate skills

### 涉及模块

- `src/core/context-compiler.ts`
- `src/core/audit-explainer.ts`

### 完成标准

- bundle 中无关证据明显下降
- 规则与约束更稳定进入 bundle
- explain 能部分回答“为什么没选”

### 风险

- 策略过复杂后，调参成本升高
- budget 池切分过细导致 bundle 不稳定

---

## 8. 原建议执行顺序与当前收尾顺序

原始执行计划建议按下面的顺序推进，而不是并行开战：

1. 迭代 2.1：先定 tool result policy
2. 迭代 2.2：再接 `tool_result_persist`
3. 迭代 2.3：再提升 ingest 结构质量
4. 迭代 2.4：最后提升 compiler 裁决质量

为什么当时是这个顺序：

- 没有 2.1，就无法安全做 2.2
- 没有 2.2，后面 ingest 和 compiler 还要继续消化大量噪音
- 没有 2.3，2.4 再怎么优化排序，输入质量也还是不够

一句话说：

`阶段 2 的核心顺序是：先减噪，再提取，再裁决。`

当前状态下，更实用的收尾顺序是：

1. 先补 `tool_result_persist` 的裁剪原因 explain
2. 再补 artifact sidecar 的真实落盘与回查
3. 再提升 compressed tool result 结构字段的直接消费
4. 最后补阶段 2 指标、阶段总结与出口对照

当前这么排的原因：

- `2.1 / 2.2 / 2.3` 已完成主干
- `2.4` 的 bundle diagnostics、selection explain、debug 入口也已基本成型
- 剩下的主要是可解释性、可恢复性和阶段验收材料

---

## 9. 阶段 2 的验收方式

阶段 2 不应只用“代码写完了”来验收，而应按结果验收。

## 9.1 源头治理指标

- 平均 tool result transcript 体积下降
- 压缩后仍保留错误、来源和关键结果
- provenance 可解释

## 9.2 结构质量指标

- `Rule / Constraint / Process / Risk` 识别准确率提高
- 重复节点明显减少
- compaction / custom_message 表达更稳定

## 9.3 裁决质量指标

- bundle 中无关上下文减少
- 规则与约束召回更稳定
- raw 证据优先级更符合预期

## 9.4 explain 指标

- 能解释为什么某条内容是 `compressed`
- 能解释为什么某条历史没被保留
- 能解释为什么当前 bundle 选了这些条目

---

## 10. 阶段 2 完成后的系统状态

如果阶段 2 顺利完成，系统应该从：

```text
能压缩、能入图、能沉淀、能 explain 基础来源
```

变成：

```text
能从源头控制垃圾上下文
+ 能更准确识别结构化语义
+ 能更稳定选择真正有用的上下文
+ 能更完整解释选择和裁剪原因
```

这时系统就会从“稳定闭环”进入真正的“高质量治理阶段”。

---

## 11. 当前建议

如果按当前代码状态继续推进阶段 2，我建议优先做的不是重新打开 `2.1`，而是：

`先补阶段 2 的 P0 收尾：tool result 裁剪原因 explain + artifact sidecar。`

原因很简单：

- `2.1 / 2.2 / 2.3` 已经完成，`2.4` 主链也已经完成大半
- 当前阶段 2 的主要缺口，已经集中在“可解释”和“可回查”闭环
- 当前完整盘点见：
  [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)

---

## 12. 一句话总结

阶段 2 的目标不是“再加几个功能点”，而是把系统推进到：

`先从源头减少噪音，再提升结构化质量，最后让上下文选择真正变成裁决过程。`
