# lossless-claw 上下文处理借鉴清单

这份文档专门回答一个问题：`lossless-claw` 在上下文处理、压缩、召回和调试链路上，哪些值得我们直接借，哪些适合后面再借，哪些不适合照搬到当前项目。

相关参考：
- `lossless-claw` 仓库：<https://github.com/Martian-Engineering/lossless-claw>
- `lossless-claw` README：<https://github.com/Martian-Engineering/lossless-claw/blob/main/README.md>
- `lossless-claw` 架构文档：<https://github.com/Martian-Engineering/lossless-claw/blob/main/docs/architecture.md>
- `lossless-claw` agent tools：<https://github.com/Martian-Engineering/lossless-claw/blob/main/docs/agent-tools.md>
- `lossless-claw` TUI：<https://github.com/Martian-Engineering/lossless-claw/blob/main/tui/README.md>
- `lossless-claw` 深度感知 prompt 规格：<https://github.com/Martian-Engineering/lossless-claw/blob/main/specs/depth-aware-prompts-and-rewrite.md>
- 我们的平台总方案：[agent-workbench-platform-rebuild-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/agent-workbench-platform-rebuild-plan.zh-CN.md)
- 我们的平台 TODO：[agent-workbench-platform-rebuild-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/agent-workbench-platform-rebuild-todo.zh-CN.md)

## 1. 总结判断

一句话判断：

`lossless-claw 最值得借的不是“把上下文主链改成摘要 DAG”，而是“结构化持久化、受控压缩、受控扩展、可检查可修复的调试链路”。`

这份判断这次已经用两层材料复核过：

1. 官方 README / docs / specs
2. 本地 clone 后的关键源码

本轮重点复核的源码文件包括：

- `src/compaction.ts`
- `src/assembler.ts`
- `src/engine.ts`
- `src/transcript-repair.ts`
- `src/store/conversation-store.ts`
- `src/store/summary-store.ts`
- `src/tools/lcm-expand-query-tool.ts`
- `src/expansion-auth.ts`

如果只看当前我们最优先的目标：

- 先把上下文监控做出来
- 再把 compact-context 插件装进 OpenClaw 做真实调试

那么 `lossless-claw` 的参考价值主要集中在：

1. 结构化 message 持久化
2. 压缩触发与失败兜底
3. tool use / result 配对修复
4. 大文件 sidecar 与 exploration summary
5. “当前模型实际看到了什么”的 inspect / TUI 体验

而不在于：

- 直接复刻它的 summary DAG 主架构
- 直接把它的 retrieval tools 当成我们的主 recall 机制
- 直接把它的维护性操作全搬进第一版平台

## 2. 它主要解决什么问题

`lossless-claw` 的核心目标是：

- 不丢原始消息
- 对旧消息做多层摘要压缩
- 每轮组装“摘要 + recent raw messages”的上下文
- 在需要时允许 agent 再向下追溯细节

它的主干大致是：

```text
session / message
-> SQLite 持久化
-> 叶子摘要
-> 多层 condensed summary DAG
-> budget 内 assemble
-> grep / describe / expand_query 回查
```

这个思路和我们有重叠，但不完全同路。

它更像：

`摘要 DAG 驱动的 Lossless Context Management`

我们当前更接近：

`Runtime Plane + graph + provenance + runtime snapshot + prompt assembly 驱动的上下文治理主链`

所以对我们来说，最合理的姿势是：

`借机制，不换主骨架。`

## 3. 值得直接借的点

### 3.1 结构化 message_parts 持久化

`lossless-claw` 不只存 message 的扁平文本，还存 `message_parts`，保留：

- text
- tool call
- tool result
- reasoning
- file content

这样 assemble 时可以重建 richer content，而不是只能回放纯文本。

这点对我们非常有价值，因为我们也在强调：

- `raw / compressed / derived` 分层
- prompt assembly 和宿主最终 payload 分离
- tool result 与原文证据回查

对我们当前最适合的映射是：

- `message archive` 里保留更强的结构化块
- `Prompt Drilldown` 页能看到原始 block 形状，而不只是拼接后的字符串
- graph / provenance 能直接指回具体 message block

源码依据：

- `src/store/conversation-store.ts` 明确有 `createMessageParts(...) / getMessageParts(...)`
- `src/db/migration.ts` 明确建了 `message_parts` 表和索引
- `src/engine.ts` 明确把 `message_parts` 作为比纯文本 `messages.content` 更权威的结构化来源

### 3.2 tool_use / tool_result 配对修复

`lossless-claw` 在 assemble 前专门做 `sanitizeToolUseResultPairing(...)`，处理：

- orphan tool result
- duplicate tool result
- 配对顺序错乱

这很值得借。

因为在真实宿主环境里，工具消息顺序和配对经常会出现异常，而这类异常会直接污染：

- prompt build
- runtime snapshot
- explain / inspect
- 监控平台显示

对我们的直接动作建议：

1. 在 `PromptAssemblySnapshot` 或 assemble 收口前，增加一层轻量 sanitize
2. 把修复结果和 dropped / moved diagnostics 一起暴露到 explain / workbench

源码依据：

- `src/transcript-repair.ts` 的 `sanitizeToolUseResultPairing(...)` 不只是排序修复，还会：
  - 去重 duplicate `toolResult`
  - 删除 orphan `toolResult`
  - 为缺失结果补 synthetic missing result
  - 规范 reasoning block
- `src/assembler.ts` 在 `assemble()` 返回前对最终消息数组调用了这层 sanitize

### 3.3 压缩触发不只看阈值，还看“可压缩部分”

`lossless-claw` 的压缩触发不是只有总 context threshold。

它还看：

- `freshTailCount`
- tail 之外的 raw token 是否已经够大

这点很实用，因为它避免了两种坏情况：

1. 最近消息其实还很短，却因为总 token 接近阈值就过早压缩
2. 有一大段旧 raw 已经很肥，但因为总量还没完全爆掉就迟迟不压

对我们来说，可以借成：

- `contextOccupancyRatio`
- `evictableRawTokens`
- `rawOutsideTailRatio`

三者一起作为压缩判定和监控指标，而不是只看一个总 token 比例。

源码依据：

- `src/compaction.ts` 里 `evaluate(...)` 用 `contextThreshold * tokenBudget` 判总量阈值
- 同文件的 `evaluateLeafTrigger(...)` 单独统计 `rawTokensOutsideTail`
- `compactLeaf(...)` 只有在“总量超过阈值”或“tail 外 raw 已超 leafChunkTokens”时才触发

### 3.4 summarization 永远有兜底路径

`lossless-claw` 把摘要做成：

- normal
- aggressive
- deterministic fallback

这点很值得借。

原因很简单：

- 压缩主链不能因为 LLM 某次输出发散就卡住
- 即使摘要质量不理想，也要保证系统继续前进

对我们当前最实用的借法不是“照抄 fallback 文本”，而是：

1. 把压缩尝试级别和结果状态显式记录到 diagnostics
2. 在 workbench 里让用户能看见这次压缩是 `normal / aggressive / fallback`
3. 后续把 fallback rate 收进 observability

源码依据：

- `src/compaction.ts` 的 `summarizeWithEscalation(...)` 明确是 `normal -> aggressive -> fallback`
- `docs/architecture.md` 也把这条策略写成了正式架构说明

### 3.5 大文件 sidecar 与 exploration summary

`lossless-claw` 对超大文件块不会直接塞进主上下文，而是：

1. 把原文落到文件存储
2. 生成简短 exploration summary
3. 在上下文里只放 compact reference

这点对我们非常值得借，尤其是：

- tool 输出里的大日志
- 大型 config
- 大文件 diff
- artifact sidecar

对我们当前的映射非常直接：

- 在 `raw evidence` 层保留原件
- 在 `Context / Prompt` 页只显示 compact reference
- 在右侧 `DetailDrawer` 再允许回看全文

源码依据：

- `src/engine.ts` 的 `interceptLargeFiles(...)` 会在 ingest 前拦截过大 `<file>` block
- 同文件的 `storeLargeFileContent(...)` 把原文落到 `~/.openclaw/lcm-files/...`
- `formatFileReference(...)` 会把上下文中的大文件替换成 compact reference

### 3.6 session reconciliation 与 session pattern 治理

`lossless-claw` 做了两类很务实的治理：

1. bootstrap reconciliation
   - session 启动时以 JSONL transcript 为真源补齐遗漏消息
2. session patterns
   - `ignoreSessionPatterns`
   - `statelessSessionPatterns`

这两点都很适合我们借。

因为后面一旦做：

- subagent
- cron
- delegated runs
- 只读分析 session

就一定会遇到“哪些 session 可以写长期记忆、哪些只能读”的问题。

源码依据：

- `src/engine.ts` 里明确编译并匹配 `ignoreSessionPatterns / statelessSessionPatterns`
- `docs/configuration.md` 也明确把 sub-agent session 作为 stateless 的典型用途

### 3.7 “当前模型实际看到什么”的 inspect / TUI 体验

`lossless-claw` 的 `lcm-tui` 有个非常好的方向：

`直接让人看当前模型实际收到的 context ordered list`

这点和我们现在的 P0 目标高度一致。

对我们来说最值得借的是：

- 不是先做复杂图谱
- 而是先让 Workbench 明确回答“这一轮到底送了什么给模型”

这正好对应我们当前的：

- `Context Workbench`
- `Prompt / Message Drilldown`
- `currentAction + timeline`

源码依据：

- `tui/README.md` 明确把 “see exactly what the model sees in context” 作为主特性
- `src/assembler.ts` 的 assemble 结果本身就是按模型真正接收的顺序生成

### 3.8 动态 system prompt 指导

`lossless-claw` 不只是返回 assemble 后的 messages。

它还会根据当前上下文里 summary 的深度和压缩程度，动态生成一段 `systemPromptAddition`，指导模型：

- 先用 `lcm_grep`
- 再用 `lcm_describe`
- 再用 `lcm_expand_query`
- 深压缩场景下不要凭 summary 猜具体细节

这点很值得借。

因为它把：

- “上下文已经压缩过了”
- “现在应该怎样 recall”

从隐含事实变成了显式运行时提示。

对我们的映射可以是：

- `PromptAssemblySnapshot.systemPromptAddition`
- `Context Workbench` 上显式显示当前 recall guidance
- 深压缩场景下动态追加“不要从 summary 猜精确信息”的提醒

源码依据：

- `src/assembler.ts` 里的 `buildSystemPromptAddition(...)`
- 同文件会根据 `summarySignals` 的 `kind / depth / descendantCount` 动态生成 guidance

### 3.9 fail-safe assemble 与 per-session 串行化

这也是一个非常值得借的工程点。

`lossless-claw` 的思路不是“只要进入 LCM，就必须完全依赖 LCM 结果”，而是：

- DB 覆盖不完整时回退 live messages
- assemble 结果异常为空时回退 live messages
- 变更型操作按 session 串行，避免 ingest / compact 互相打架

这对真实宿主环境非常重要。

因为插件态上下文处理最怕两类问题：

1. 因为存储或 bootstrap 不完整，把本来 live 有的上下文丢掉
2. `afterTurn / compact / ingest` 并发时出现竞态，导致上下文表错乱

对我们的映射可以是：

- `assemble()` 保留 live fallback
- `runtime snapshot` 增加 coverage / fallback diagnostics
- mutating operation 走 per-session queue

源码依据：

- `src/engine.ts` 在 assemble 时如果 `contextItems` 不完整或 assemble 为空，会直接 fallback 到 live `params.messages`
- 同文件的 `withSessionQueue(...)` / `resolveSessionQueueKey(...)` 明确做了 per-session 串行化

## 4. 适合后面再借的点

### 4.1 grep -> describe -> expand_query 的召回分层

`lossless-claw` 的工具链分成：

1. `lcm_grep`
2. `lcm_describe`
3. `lcm_expand_query`

这个分层很值得借，但更适合放在 P1 以后。

原因是：

- 它属于“运行时 recall drilldown”
- 不是 P0 上下文监控最先要打通的主闭环

对我们后续的映射可以是：

- `search runtime graph / message archive`
- `describe node / summary / evidence`
- `expand branch / answer focused question`

### 4.2 delegated expansion 的权限边界

`lossless-claw` 给 `expand_query` 配了：

- scoped conversation grant
- token cap
- TTL
- revoke
- recursion guard

这对我们将来做：

- sub-agent recall
- delegated retrieval
- graph branch expansion

非常值得借。

但它不属于 P0。

第一版平台更应该先把：

- 当前上下文
- 当前 prompt
- 当前 graph / timeline

看清楚，再上这种更深的 delegated expansion。

源码依据：

- `src/tools/lcm-expand-query-tool.ts` 会给子代理下发明确的 retrieval strategy、tokenCap 和禁止递归规则
- `src/expansion-auth.ts` 负责 grant、TTL、revocation、token budget consumption

### 4.3 深度感知 prompt 与时间范围摘要

`lossless-claw` 已经意识到“一套摘要 prompt 压到底”质量会越来越差，所以它补了：

- depth-aware prompt
- timestamp injection
- summary time range

这很值得借，但更适合放在我们后面真的要做“多层摘要演化治理”时接入。

如果我们借，建议借的是：

- summary 节点显式带 `earliestAt / latestAt`
- 不同压缩层用不同 prompt
- summary UI 上显示时间范围和压缩层级

源码依据：

- `src/store/summary-store.ts` 已把 `earliestAt / latestAt / descendantCount` 作为正式字段写入
- `src/assembler.ts` 会把这些字段编码进 `<summary ...>` XML 属性
- `src/summarize.ts` 已按 `d1 / d2 / d3+` 使用不同 prompt

### 4.4 被压掉内容的显式提示

`lossless-claw` 会在 summary presentation 里显式告诉 agent：

- 哪些细节被压掉了
- 可以往哪里 expand

这点特别适合借到我们的 explain / inspect / graph detail 中。

因为它能把：

- `included`
- `omitted`
- `summary_only`

从“状态码”变成真正可理解的解释层。

## 5. 不建议照搬的点

### 5.1 不把 summary DAG 变成我们的主真相层

这是最重要的一条。

`lossless-claw` 的核心真相层更接近：

- raw messages
- summary DAG
- context_items

而我们当前已经明确：

- `assemble.final`
- `runtime snapshot`
- `transcript / raw evidence`
- `graph + provenance`

才是主真相链。

所以不建议为了借鉴它，反过来把我们当前主线改成“先做摘要 DAG，再让其他东西围着摘要转”。

### 5.2 不把 retrieval tools 直接当成主 recall 机制

`lcm_grep / describe / expand_query` 很好，但它们更像：

- 用户态 / agent 态 recall 工具

而不是：

- runtime compiler 的唯一 explain 源

对我们来说，真正的一等解释源仍应优先来自：

- runtime diagnostics
- graph / provenance
- prompt assembly snapshot

工具层更适合做 drilldown 和补查，而不是主合同本身。

源码依据：

- `src/tools/lcm-grep-tool.ts`
- `src/tools/lcm-describe-tool.ts`
- `src/tools/lcm-expand-query-tool.ts`

这三者都明显是 agent-facing tool，而不是 runtime compiler 自身的 explain contract。

### 5.3 不在 P0 就引入大量写操作维护工具

`lossless-claw` 的 TUI 很强，能做：

- rewrite
- subtree rewrite
- dissolve
- repair
- transplant
- backfill

这些都很酷，但不适合我们第一版平台就跟上。

原因是：

- 当前最优先是“看清楚”
- 不是“先把维护台做完”

所以第一版平台仍建议：

- `read-only` 优先
- repair / rewrite 后面再补

### 5.4 不把“lossless”当作产品承诺口径

`lossless-claw` 的“lossless”本质上是：

- 原文仍然保留，可回查

而不是：

- 摘要本身没有信息损失

这点要特别注意。

对我们来说，更稳的口径仍然应该是：

- `raw / compressed / derived` 分层
- 压缩是有损的
- 原文与证据可追溯

## 6. 映射到我们当前主线

### 6.1 P0 现在就适合做什么

最适合立刻借进我们当前 P0 的有：

1. 结构化 message archive
2. tool use / result pairing sanitize
3. 大文件 sidecar + exploration summary
4. session ignore / stateless pattern
5. “当前模型实际看到什么”的 Context / Prompt inspect
6. 压缩级别与 fallback diagnostics

这几项都直接服务于：

- 上下文监控
- OpenClaw 联调
- 压缩效果验证

建议优先级再收紧成下面这四条：

1. `PromptAssemblySnapshot` 增加 sanitize diagnostics
2. `Context Workbench` 增加 “模型实际看到什么” 的 ordered list
3. `raw evidence / artifact sidecar` 增加大块原文折叠与全文回看
4. `Observability` 增加 `rawOutsideTailRatio / fallbackRate`

### 6.2 P1 再推进什么

P1 最适合接：

1. runtime graph / archive 搜索
2. describe / expand drilldown
3. summary time range
4. depth-aware prompt
5. omitted / summary_only 的可解释 presentation

### 6.3 P2 再考虑什么

P2 再看：

1. delegated expansion grant / token cap / recursion guard
2. TUI 或 workbench 级 repair / rewrite
3. 更完整的 branch rewrite / subtree maintenance

## 7. 对当前 TODO 的影响

如果把这份分析映射到我们现在的 TODO，最直接相关的是：

1. [agent-workbench-platform-rebuild-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/agent-workbench-platform-rebuild-todo.zh-CN.md) 里的 `TODO 1`
   - `PromptAssemblySnapshot`
   - `ContextWorkbenchReadModel`
2. [agent-workbench-platform-rebuild-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/agent-workbench-platform-rebuild-todo.zh-CN.md) 里的 `TODO 2`
   - runtime event / diagnostics / sanitize / sidecar
3. [agent-workbench-platform-rebuild-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/agent-workbench-platform-rebuild-todo.zh-CN.md) 里的 `TODO 6`
   - `Context / Prompt` 页必须能回答“模型到底看到了什么”
4. [agent-workbench-platform-rebuild-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/agent-workbench-platform-rebuild-todo.zh-CN.md) 里的 `TODO 7`
   - graph / timeline / provenance drilldown
5. [agent-workbench-platform-rebuild-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/agent-workbench-platform-rebuild-todo.zh-CN.md) 里的 `TODO 8`
   - OpenClaw 真机场景验证压缩是否真的生效

## 8. 一句话结论

`lossless-claw` 最值得我们借的是“结构化持久化 + 受控压缩 + 受控扩展 + inspect / repair 思维”，而不是把当前项目重写成一个 summary DAG 系统。对于现阶段，优先借 message archive、pairing sanitize、sidecar、压缩 diagnostics 和“当前模型实际看到什么”的工作台视图，收益最高。`

## 9. 源码查看说明

这次分析顺手沉淀一个执行经验：

- GitHub 网页适合看 README、目录和小文件
- 大型源码文件和复杂跳转不要只依赖 GitHub 网页视图
- 真正做架构借鉴时，优先：
  1. 本地 clone
  2. `rg` 全局搜索
  3. `Get-Content -Encoding utf8` 读关键文件
  4. clone 不方便时再退到 `raw.githubusercontent.com`

原因是：

- GitHub 网页大文件视图容易截断
- 行号跳转不稳定
- 搜索结果有时会落在不完整的 HTML 渲染片段
- 只靠网页视图容易把“看起来像现状”的 spec 当成“已经落地的源码”
