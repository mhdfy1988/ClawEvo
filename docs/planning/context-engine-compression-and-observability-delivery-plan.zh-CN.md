# Context Engine 压缩与观测交付方案

相关文档：
- 压缩策略定稿：[context-engine-baseline-list-compaction-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-baseline-list-compaction-strategy.zh-CN.md)
- 当前 `assemble()` 主路线：[context-engine-assemble-compaction-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-assemble-compaction-strategy.zh-CN.md)
- Runtime Window contract：[runtime-context-window-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-context-window-contract.zh-CN.md)
- Prompt Assembly contract：[prompt-assembly-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/prompt-assembly-contract.zh-CN.md)
- Runtime Snapshot Persistence：[runtime-snapshot-persistence.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-snapshot-persistence.zh-CN.md)
- Agent Workbench 总方案：[agent-workbench-platform-rebuild-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/agent-workbench-platform-rebuild-plan.zh-CN.md)
- 对应 TODO：[context-engine-compression-and-observability-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-engine-compression-and-observability-todo.zh-CN.md)

## 1. 这份文档解决什么问题

这份文档把我们刚刚已经讨论定稿的内容收成一条可执行交付线，重点回答：

1. 当前上下文压缩主链已经定了什么
2. 为什么下一步要先做压缩实现和上下文监控，而不是继续扩别的能力
3. 具体先做哪些代码改动
4. 监控页面最小要看到什么
5. 插件装进 OpenClaw 前后如何验证

一句话：

`先把压缩主链做成“可运行、可解释、可观测、可兜底”，再进 OpenClaw 真机场景看效果。`

## 2. 一句话结论

接下来建议严格按下面这条主线推进：

1. 固定压缩 contract
2. 实现 `baseline list + rollup + rollback/evict`
3. 补 `rawTail + sidecar` 边界
4. 补 `compression diagnostics + live fallback + per-session 串行化`
5. 产出 `PromptAssemblySnapshot`
6. 落地 `Live / Context / Prompt` 三个 P0 页面
7. 安装到 OpenClaw 做真实会话验证

## 3. 当前基线

截至当前仓库状态，已经具备的相关能力有：

- `assemble()` 已经会区分：
  - `rawTail`
  - `incremental`
  - `baseline`
- `rawTail` 现在按最近 `2` 个 turn block 保留
- `incremental` 现在只保留 `1` 块
- `baseline.summaryText` 已有固定截断上限
- `systemPromptAddition` 已经是 provider-neutral 压缩注入位
- `artifact sidecar` 已经覆盖压缩后 `tool result` 的旁路落盘与回查
- runtime snapshot / inspect / explain / dashboard 已有基础出口

因此，这一轮不是从零设计，而是在现有运行骨架上完成：

- 压缩主结构升级
- 结构化压缩诊断
- 上下文观测收口

## 4. 已经定下来的方案

## 4.1 压缩主结构

当前正式收口后的结构是：

```text
system messages
+ rawTail (最近 2 个 turn block)
+ incremental (1 块滚动中间层)
+ baselines[] (从老到新的历史摘要列表)
```

其中：

- `system`
  - 不参与这三层持久化边界
- `rawTail`
  - 保最近 `2` 个 turn block 的原始结构和关键语义
- `incremental`
  - 只保留 `1` 块
  - 每轮 `assemble()` 滚动替换
- `baselines[]`
  - 用来承载更早历史
  - 数量有上限
  - 超限后对最老一半做 rollup

## 4.2 触发与阈值

当前已经定下来的第一版阈值：

- `full` 触发阈值：
  - `contextOccupancyRatio > 0.50`
- `baselines` 上限：
  - `maxBaselineCount = 4`
- rollup 结果上限：
  - `mergedBaselineTokenEstimate <= totalBudget * 0.20`

如果 rollup 后超过 `20%`：

1. 回退这次 rollup
2. 把最老 baseline 从 prompt-visible history 中移除
3. 本轮结束，不再继续重试 merge

这里的“移除”只影响 prompt 可见层，不影响：

- archive
- checkpoint
- graph
- transcript

## 4.3 `rawTail` 与 sidecar 边界

这条口径已经定了：

`保留最近 2 轮原文` 不等于 `最近 2 轮里所有长正文都要全文进 prompt`。

更准确地说：

- 普通 user / assistant 短文本
  - 继续按原文留在 `rawTail`
- 超长 `tool result / file / log`
  - 仍然属于最近 turn block
  - 但 prompt 里只保结构化压缩内容
  - 完整正文继续放 `artifact sidecar`

一句话：

`rawTail` 保最近结构，`sidecar` 保完整长文。

## 4.4 配套护栏

这轮同时收口两类配套护栏：

1. `compression diagnostics`
   - 解释为什么压、压了什么、替换了什么、是否 rollback / evict
2. `运行时兜底`
   - `assemble live fallback`
   - `per-session 串行化`

## 5. 目标与非目标

## 5.1 目标

这一轮的目标只有 4 个：

1. 让压缩主链真正能长期运行，不再被单 `baseline` 拖厚
2. 让上下文压缩行为能通过 explain / inspect / workbench 被直接看到
3. 让插件装进 OpenClaw 后能稳定观察“压缩前后效果”
4. 在不推翻当前架构的前提下，把增长治理做实

## 5.2 非目标

这轮明确不做：

- 完整 `summary DAG`
- 通用 `message_parts archive` 全量重构
- delegated expansion grant / token cap / recursion guard
- TUI repair / rewrite / transplant
- 大规模全局图谱治理台

## 6. 为什么选这条方案

原因有 5 条：

1. 当前三层主结构本身已经基本对，只是单 `baseline` 长期治理不够
2. 如果现在重造一套新的 ActiveContext 主抽象，会把现有主线搞重
3. 监控和 OpenClaw 联调的收益，远高于继续抽象化讨论
4. `sidecar + diagnostics + inspect` 能直接提升调试效率
5. 这条路线能复用现有：
   - `assemble.final -> runtime snapshot -> transcript`
   - `systemPromptAddition`
   - runtime snapshot / inspect / dashboard

## 7. 工作流分解

## 7.1 工作流 A：压缩 contract 与状态演进

目标：

- 把单 `baseline` 升级成 `baselines[]`
- 让 rollup / rollback / evict 有稳定 contract

关键输入：

- 当前 `SessionCompressionState`
- 当前 `rawTail`
- 当前 `incremental`
- token budget

关键输出：

- 新版 `SessionCompressionState`
- `CompressionDiagnostics`

状态变化：

第 1 轮：
- 只有 `rawTail`

第 3 轮：
- 出现 `incremental`

超过 `50%`：
- `incremental` 封存成 `B1`
- `baselines = [B1]`

长期运行后：
- `[B1, B2, B3, B4, B5]`
- rollup 成 `[B12, B3, B4, B5]`

超限回退时：
- `[B1, B2, B3, B4, B5]`
- merge `[B1, B2]` oversized
- rollback
- evict `B1`
- 得到 `[B2, B3, B4, B5]`

## 7.2 工作流 B：`rawTail + sidecar` 边界治理

目标：

- 防止超长正文污染 prompt 可见层
- 但保住最近 turn block 的结构和 provenance

关键输入：

- 最近两轮消息
- `tool_result_persist` 压缩结果
- artifact metadata

关键输出：

- prompt-visible `rawTail`
- artifact sidecar 引用
- explain / inspect 可回查入口

状态变化：

第 1 轮：
- 最近两轮都是短文本
- 原文直接保留

第 2 轮：
- 最近两轮里出现 20KB 日志
- turn 仍然留在 `rawTail`
- message content 变成压缩后的结构化 tool result
- sidecar 保留完整日志

## 7.3 工作流 C：Compression Diagnostics 与兜底

目标：

- 每次压缩都能解释清楚
- 异常时不把坏上下文送模

关键输入：

- `contextOccupancyRatio`
- 当前 `rawTail / incremental / baselines`
- rollup 结果
- assemble 输出

关键输出：

- `trigger`
- `occupancyRatioBefore / After`
- `sealedIncrementalId`
- `appendedBaselineId`
- `mergedBaselineIds`
- `mergedBaselineResultId`
- `rollback`
- `evictedBaselineId`
- `baselineCount`
- `rawTailTokenEstimate`
- `incrementalTokenEstimate`
- `baselineTokenEstimate`
- `sidecarReferenceCount`
- `fallbackLevel`

状态变化：

第 1 轮：
- 不触发 full
- diagnostics 最小输出当前 `mode`

第 2 轮：
- 触发 full
- diagnostics 明确写出 `incremental -> baseline`

第 N 轮：
- rollup oversized
- diagnostics 写出 rollback / evict，以及这轮没有继续 retry merge
- assemble 异常时直接退回 live fallback

## 7.4 工作流 D：上下文监控 P0

目标：

- 让我们能直接看到“模型到底看到了什么”
- 让压缩效果可以在真实场景里观察

关键输入：

- runtime snapshot
- `PromptAssemblySnapshot`
- `systemPromptAddition`
- compression diagnostics
- toolCallResultPairs

关键输出：

- `Live` 页
- `Context` 页
- `Prompt` 页

最小页面职责：

- `Live`
  - 当前 agent
  - 当前动作
  - 最近 step
- `Context`
  - `inbound / preferred / final`
  - `raw / compressed / derived`
  - `rawTail / incremental / baselines[]`
- `Prompt`
  - `messages`
  - `systemPromptAddition`
  - 最终 payload preview
  - 哪些内容只在 sidecar，不在 prompt

## 8. 关键技术落点

## 8.1 `packages/contracts`

需要新增或调整：

- `SessionCompressionState.baselines`
- `SessionCompressionBaselineState.generation`
- `SessionCompressionBaselineState.sourceBaselineIds`
- `CompressionDiagnostics`
- `PromptAssemblySnapshot`

## 8.2 `packages/openclaw-adapter`

需要调整：

- `shouldTriggerFullCompaction(...)`
- `buildNextBaselineState(...)`
- `buildIncrementalState(...)`
- `formatCompressionStateForPrompt(...)`
- explain / inspect 相关 payload

需要新增：

- `appendBaselineBlock(...)`
- `rollupBaselineBlocks(...)`
- `tryMergeOldestBaselineHalf(...)`
- `evictOldestBaselineFromPromptHistory(...)`
- `buildCompressionDiagnostics(...)`
- `buildPromptAssemblySnapshot(...)`

## 8.3 `packages/compact-context-core`

需要补：

- 上下文监控 read-model
- diagnostics / metric 汇总
- P0 workbench 查询面

## 8.4 `packages/control-plane-shell`

需要补：

- `Live / Context / Prompt` 三页
- `DetailDrawer`
- diagnostics / sidecar / payload drilldown

## 9. 第一版实施顺序

建议严格按这个顺序：

1. contract
2. adapter 压缩逻辑
3. sidecar 边界与 explain
4. diagnostics
5. live fallback + per-session 串行化
6. 测试
7. `PromptAssemblySnapshot`
8. `Live / Context / Prompt`
9. OpenClaw 联调

原因是：

- 如果先做 UI，很快会退化成临时拼 payload
- 如果 contract 没定死，explain / inspect / dashboard 很容易漂
- 如果先装 OpenClaw 反复试，没有 diagnostics 很难知道哪一步出问题

## 10. 验收标准

## 10.1 压缩主链

至少满足：

- `rawTail` 固定最近 `2` 个 turn block
- `incremental` 固定最多 `1` 块
- `baseline` 已升级成 `baselines[]`
- `contextOccupancyRatio > 0.50` 时会触发 full
- `baselines[]` 超限后会 rollup
- rollup 超过 `20%` 会 rollback + evict

## 10.2 诊断与 explain

至少满足：

- explain / inspect 能返回 compression diagnostics
- 能看到这轮为什么触发压缩
- 能看到这轮封存/合并/回退/淘汰了什么
- 能看出 sidecar 引用和 prompt-visible 内容的区别

## 10.3 上下文监控

至少满足：

- 能直接看到 `messages + systemPromptAddition`
- 能看到 `rawTail / incremental / baselines[]`
- 能看到当前 `context occupancy`
- 能看到压缩前后 final message count 变化

## 10.4 OpenClaw 联调

至少验证 3 类场景：

1. 短会话
   - `compressionMode = none`
2. 中等长度会话
   - 出现 `incremental`
3. 长会话
   - 触发 full
   - baseline append / rollup / rollback 行为符合预期

## 11. 后续增强

这轮做完后，再考虑：

- `ignore / stateless session patterns`
- 更细的 pairing sanitize
- 更成熟的 `PromptAssemblySnapshot`
- runtime subgraph / timeline drilldown 深化
- 后续图谱与全局 observability 扩展

## 12. 一句话总结

`接下来不重做整套上下文系统，而是沿现有三层压缩主线，把单 baseline 升级成 baseline 列表，并补上 rollup、rollback、sidecar 边界、compression diagnostics、运行时兜底和上下文监控工作台。先把这条链路做稳，再装进 OpenClaw 看真实效果。`
