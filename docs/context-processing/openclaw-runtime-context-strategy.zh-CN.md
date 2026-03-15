# OpenClaw 运行时上下文策略

这份文档用于收敛我们刚才关于“OpenClaw 上下文怎么获取、怎么处理、怎么放回去”的讨论结论。

相关文档：

- [context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-design-v2.zh-CN.md)
- [stage-6-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-todo.zh-CN.md)
- [openclaw-external-context-references.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/references/openclaw-external-context-references.zh-CN.md)
- [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/gateway-debug-usage.zh-CN.md)
- [runtime-context-window-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-context-window-contract.zh-CN.md)
- [prompt-assembly-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/prompt-assembly-contract.zh-CN.md)
- [runtime-snapshot-persistence.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-snapshot-persistence.zh-CN.md)

## 1. 一句话结论

`以 assemble() 看到的当前运行时窗口为真相源；以 hook 作为源头治理和生命周期协同层；以 provider-neutral 的运行时结果作为插件产物；最终 provider payload 仍由 OpenClaw 或宿主 adapter 组装。`

## 2. 我们现在确认到的事实

### 2.1 OpenClaw 原始上下文不是“纯文本数组”

从 session 文件和宿主行为看，真实上下文里会有：

- `user`
- `assistant`
- `toolResult`
- `thinking`
- `toolCall`
- 以及 session / model / thinking level 等外围事件

也就是说，原始上下文更像是：

`按顺序排列的消息窗口 + 一些系统层来源`

而不是一段简单 transcript 文本。

### 2.2 最终送模前的真相不在 transcript

`transcript` 只能告诉我们会话里发生过什么；
但真正送模前到底保留了哪些 raw message、压缩了多少历史、最终用了什么结构化摘要，只有 `assemble()` 最清楚。

所以：

- `transcript` 是恢复源 / 回放源
- `assemble()` 才是运行时真相源

### 2.3 hook 有价值，但不是主压缩点

我们当前已经确认：

- `tool_result_persist`
  - 适合源头治理
- `before_compaction / after_compaction`
  - 适合生命周期同步
- `before_prompt_build`
  - 适合将来做辅助注入

但真正负责减少当前轮 token、决定这轮上下文最终长什么样的，仍然是：

- `assemble()`

## 3. 为什么主链不用纯 hook 方案

### 3.1 只靠 hook，看不到最终窗口真相

如果只靠 hook，我们通常只能看到某个阶段的输入或事件切片，看不到：

- 最终保留了哪些 raw messages
- 最终压缩了多少历史
- 最终生成了什么 `systemPromptAddition`
- 最终 token 预算怎么分配

这些都要到 `assemble()` 才会收敛。

### 3.2 hook 更适合做增量治理

hook 最适合做的是：

- 源头压缩
- 事件同步
- recall 预计算
- 后台维护

而不是替代完整的运行时上下文编译器。

## 4. 为什么不直接采用 memory-lancedb-pro 的方案

`memory-lancedb-pro` 值得借鉴，但不适合直接当我们的主方案。

原因是：

1. 它更像 `memory augmentation plugin`
   - 主体是 `retrieve -> prependContext`
2. 它的回注方式主要是 prompt 前追加文本
   - 适合小规模记忆增强
   - 不适合表达完整 runtime window
3. 它没有把“上下文处理结果”和“最终 provider payload”严格分层
4. 它更偏 hook 驱动，而不是以 `assemble()` 为送模真相源

我们仍然要借它的：

- recall / inject 的 hook 纪律
- 已注入块的去重过滤
- 噪音治理

但不直接照搬它的总体边界。

## 5. 为什么 graph-memory 更接近我们

`graph-memory` 的方案更接近我们想要的主线：

1. `before_agent_start`
   - 做 recall 准备
2. `assemble()`
   - 真正裁剪消息窗口
   - 生成 `systemPromptAddition`
3. `afterTurn()`
   - 入库、异步提取图谱
4. `session_end`
   - finalize / maintenance

这说明它已经明确采用了：

- `assemble()` 做最终压缩与回注
- hook 做 recall、提取、维护的辅助协同

这比纯 `prependContext` 思路更接近我们当前阶段 6 的方向。

### 5.1 参考优先级

结合目前的讨论，我对三个外部参考的使用优先级是：

1. `graph-memory`
   - 作为上下文处理主链的首要参考
   - 重点借它的：
     - `before_agent_start` 做 recall 准备
     - `assemble()` 做最终窗口裁剪与回注
     - `systemPromptAddition` 作为回注位置
     - tool call / tool result 配对修复

2. `memory-lancedb-pro`
   - 作为局部机制参考
   - 重点借它的：
     - hook 时机意识
     - recall / noise filter 纪律
     - 已注入内容去重
     - 轻量回注经验

3. `openclaw-control-center`
   - 作为控制面与只读观察参考
   - 重点借它的：
     - live/session 数据获取策略
     - readonly 归一化
     - control plane / dashboard / console 组织方式

一句话收敛：

`上下文处理主链优先借 graph-memory，局部注入与噪音治理借 memory-lancedb-pro，控制面和可视化借 openclaw-control-center。`

## 6. 我们的具体方案

### 6.1 获取上下文：三层来源

#### 主来源：`assemble()`

位置：

- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

输入：

- `sessionId`
- `messages`
- `tokenBudget`

这里拿到的是宿主当前真正准备送模的消息窗口，因此它是：

`运行时上下文真相源`

#### 辅助来源：hook

位置：

- [hook-coordinator.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/hook-coordinator.ts)

我们当前会继续使用：

- `tool_result_persist`
- `before_compaction`
- `after_compaction`

用途：

- `tool_result_persist`
  - 提前压缩超长工具输出
- `before_compaction`
  - 在宿主压缩前同步最新状态
- `after_compaction`
  - 在宿主压缩后刷新 checkpoint / skill

#### 恢复来源：transcript / session file

位置：

- [transcript-loader.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/transcript-loader.ts)

用途：

- bootstrap
- 调试 fallback
- 冷启动回放

它不是实时真相源，只是恢复路径。

### 6.2 处理流程：六步

1. `assemble()` 拿宿主当前窗口
2. 标准化为 `RawContextInput / RawContextRecord`
3. `ingest()` 入图
4. `planPromptMessages()` 计算 raw tail 保留方案
5. `compileContext()` 生成结构化 bundle
6. `formatBundle()` 生成 `systemPromptAddition`

这时会得到两类运行时结果：

- 裁剪后的 `messages`
- 压缩后的 `systemPromptAddition`

### 6.3 放回去：三层落点

#### 第一层：放回宿主送模链

放在 `assemble()` 返回值里：

```ts
{
  messages,
  estimatedTokens,
  systemPromptAddition
}
```

也就是：

- `messages`
  - 放裁剪后的 raw 窗口
- `systemPromptAddition`
  - 放结构化压缩上下文

#### 第二层：放到 runtime snapshot

用途：

- `inspect_runtime_window`
- watch
- dashboard
- debug

这份快照应优先记录：

- `inboundMessages`
- `preferredMessages`
- `finalMessages`
- `latestPointers`
- `toolCallResultPairs`
- `query`
- `compressedCount`
- `systemPromptAddition`
- `estimatedTokens`

当前第一轮实现里，这些信息已经通过：

- `Runtime Context Window Contract`
- `Prompt Assembly Contract`
- `persisted_snapshot` 回退层

收敛进 `inspect_runtime_window` 调试输出。

#### 第三层：放到知识系统

通过：

- graph
- checkpoint
- delta
- skill candidate

把这轮上下文沉淀到长期知识层。

### 6.4 明确不放到哪里

我们不把结构化上下文再写成一条普通 transcript 消息。

原因：

- 会污染原始会话历史
- 会造成重复学习
- 会把“宿主原文”和“插件生成结果”混在一起

## 7. 阶段 6 最应该先补的 3 个 contract

### 7.1 Runtime Context Window Contract

它要明确：

- 当前 `inbound / preferred / final` 三层窗口
- 最新 user / assistant / toolResult 指针
- `toolCall / toolResult` 配对关系
- 压缩计数和 raw tail 保留信息

### 7.2 Prompt Assembly Contract

它要明确：

- 哪些结果来自上下文处理
- 哪些由宿主最终组装
- 哪些字段只用于 debug / observability，不进入模型

### 7.3 Runtime Snapshot Persistence

它要明确：

- 在 `assemble()` 处落真正送模前快照
- 后续 `inspect / watch / dashboard` 优先读快照
- 不再把 transcript 当作唯一观察来源

## 8. 最终边界

最终边界收敛成：

```text
OpenClaw raw context / message window
-> compact-context processing
-> provider-neutral runtime context result
-> OpenClaw / host adapter assembles final provider payload
```

所以本项目不应该演化成：

- provider payload assembler
- 单纯 prompt prepend 插件

而应该继续演化成：

- 一个 provider-neutral 的运行时上下文处理层
- 一个可观测、可调试、可沉淀、可被 control plane 使用的上下文系统

