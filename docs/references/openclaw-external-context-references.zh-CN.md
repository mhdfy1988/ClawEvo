# OpenClaw 外部上下文参考整理

这份文档用于收敛三个外部仓库的参考价值：

- `openclaw-control-center`
- `memory-lancedb-pro`
- `graph-memory`

重点回答 4 个问题：

1. 哪个仓库能看到 `OpenClaw` 上下文是怎么获取的
2. 哪个仓库能看到“处理后的上下文”如何重新放回去
3. 哪些实现值得直接借鉴
4. 哪些设计不适合直接照搬到本项目

相关链接：

- `openclaw-control-center`：<https://github.com/TianyiDataScience/openclaw-control-center>
- `memory-lancedb-pro`：<https://github.com/CortexReach/memory-lancedb-pro>
- `graph-memory`：<https://github.com/adoresever/graph-memory>
- 阶段 6 TODO：[stage-6-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-todo.zh-CN.md)
- 阶段 6 平台化方案：[stage-6-platformization-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-platformization-plan.zh-CN.md)
- `openclaw-control-center` 页面借鉴清单：[openclaw-control-center-ui-borrowing.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/references/openclaw-control-center-ui-borrowing.zh-CN.md)

## 1. 总结判断

一句话判断：

- `openclaw-control-center` 更像 `control plane / readonly console`
- `memory-lancedb-pro` 更像 `memory augmentation plugin`
- `graph-memory` 更像 `graph-backed context engine`

如果问题是：

- `OpenClaw` 上下文怎么获取：三个仓库都能提供参考
- 处理后怎么重新放回去：主要看 `memory-lancedb-pro` 与 `graph-memory`

但如果问题是：

- 怎样形成一个完整、provider-neutral 的运行时上下文包
- 怎样把上下文处理和最终 provider payload 组装解耦

那么这两个仓库都只能提供局部参考，不能直接当最终架构模板。

## 2. openclaw-control-center

### 2.1 它主要解决什么问题

这个仓库的主定位不是运行时上下文编译，而是：

- 获取 `OpenClaw` live/session/runtime 信息
- 把数据整理成只读控制台视图
- 承载控制面、会话浏览、任务浏览、审批、状态面板

代表文件：

- `docs/ARCHITECTURE.md`
- `src/clients/openclaw-live-client.ts`
- `src/runtime/session-conversations.ts`
- `src/adapters/openclaw-readonly.ts`

### 2.2 它怎么获取上下文

这部分是值得借鉴的。

它的策略大致是：

1. 官方优先
   - 优先调用 `openclaw` 官方 CLI / JSON 输出
2. 本地回退
   - 读 session 文件、cache、本地 runtime stores
3. 文本回退
   - 如果 JSON 不可用，再做文本 fallback

也就是说，它已经把：

- live gateway / CLI
- session history
- 本地缓存

统一成了一套较稳的只读获取链。

### 2.3 它有没有“重新放回去”

基本没有。

它有：

- 读取 live/session/runtime 状态
- 整理成 `read model`
- 写本地 runtime stores

但没有看到真正的：

- 运行时 prompt 重新组装
- provider payload 回注
- “处理后的上下文”再送回 LLM

所以它更像：

`获取与展示平台`

而不是：

`运行时上下文处理与回注平台`

### 2.4 值得借鉴的点

- `official-first + fallback` 的上下文读取策略
- 将 session history 归一化成 UI/read-model 的中间层
- 控制面与运行时主链分层
- “只读控制台”优先，不直接篡改 runtime 主链

### 2.5 不适合直接照搬的点

- 不能把它当成我们的 runtime context compiler
- 不能把“导入本地 runtime store”误当成“重新注入 LLM”
- 它更适合阶段 6 的 `Control Plane / Readonly Console` 参考，而不是上下文编译主链参考

### 2.6 页面层最值得借的方向

如果只看平台页面而不是上下文获取链，`openclaw-control-center` 更值得借的是：

- 清晰分区的信息架构
- 总览 + drilldown 的页面组织
- 全局可见性卡片
- 面向非技术用户的 plain-language 文案
- 轻量偏好和 quick filter

详细拆解见：

- [openclaw-control-center-ui-borrowing.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/references/openclaw-control-center-ui-borrowing.zh-CN.md)

## 3. memory-lancedb-pro

### 3.1 它主要解决什么问题

这个仓库更接近：

- 通过 hook 获取会话消息
- 从对话中提取记忆
- 检索相关记忆
- 在下一轮 prompt 前把相关记忆再注入

代表文件：

- `index.ts`
- `src/smart-extractor.ts`
- `src/adaptive-retrieval.ts`
- `src/noise-filter.ts`
- `docs/openclaw-integration-playbook.md`

### 3.2 它怎么获取上下文

这部分很有参考价值。

它主要通过这些 hook/事件点获取上下文：

- `before_agent_start`
  - 拿当前 prompt / ctx 做检索决策
- `agent_end`
  - 读取 `event.messages`，提取有价值的用户/助手内容
- `message_received`
  - 捕获单条消息进入系统
- `before_message_write`
  - 在写入前做待处理缓存或筛选
- `command:new`
  - 从 session 文件生成 summary / memory reflection

这说明它已经明确利用了：

- 当前 turn 入口
- turn 结束后的完整消息
- session 文件
- hook 生命周期

### 3.3 它怎么重新放回去

这里能看到明确实现。

它的主方式是：

- 在 `before_agent_start` 返回 `prependContext`
- 在 `before_prompt_build` 继续追加 `prependContext`

也就是：

`先检索相关记忆，再把记忆块插入到 prompt 前面`

这点非常重要，因为它证明了：

- `OpenClaw` 插件侧确实可以在送模前插入处理后的上下文
- hook 不是只能观察，也可以做 prompt augmentation

### 3.4 值得借鉴的点

- `before_agent_start / before_prompt_build` 的回注时机
- 在记忆抽取前先过滤已注入块，避免自我重复学习
- retrieval gating / noise filtering
- session summary 进入 memory store 的思路
- 用 hook 串起 capture -> retrieve -> inject 的最小闭环

### 3.5 不适合直接照搬的点

它的回注方式以 `prependContext` 为核心，这种方式适合：

- memory augmentation
- 规则提示
- 小规模上下文增强

但不适合直接当成我们项目的完整终态，因为我们现在追求的是：

- provider-neutral 的上下文处理结果
- runtime window / summary blocks / diagnostics 分离
- 宿主自己负责最终 provider payload 组装

所以不能把：

`prependContext`

直接等同于：

`完整运行时上下文模型`

## 4. graph-memory

### 4.1 它主要解决什么问题

这个仓库更像一个真正的 `OpenClaw context-engine`：

- `ingest()` 持续记录消息
- `afterTurn()` 异步提取图谱
- `before_agent_start` 预先做 recall
- `assemble()` 真正裁剪 raw window 并生成 `systemPromptAddition`
- `session_end` 做 finalize / maintenance

代表文件：

- `index.ts`
- `src/format/assemble.ts`
- `src/format/transcript-repair.ts`
- `src/recaller/recall.ts`
- `src/extractor/extract.ts`

### 4.2 它怎么获取上下文

它的获取链比 `memory-lancedb-pro` 更完整：

1. `ingest()`
   - 每条消息先同步写入 `gm_messages`
2. `afterTurn()`
   - 从 `messages.slice(prePromptMessageCount)` 里拿本轮新增消息
   - 异步触发提取
3. `before_agent_start`
   - 用当前 prompt 做 recall 查询
4. `session_end`
   - 用 session 级节点做 finalize 和维护

也就是说，它同时利用了：

- context-engine 生命周期
- hook 生命周期
- 本地消息存储

### 4.3 它怎么重新放回去

这部分最值得我们关注。

它不是只在 hook 上直接注入，而是：

1. `before_agent_start`
   - 先做 recall，结果放入内存状态
2. `assemble()`
   - 读取 active nodes + recalled nodes
   - 调 `assembleContext()`
   - 生成：
     - `xml`
     - `systemPrompt`
     - `systemPromptAddition`
   - 最终返回：
     - `messages`
     - `estimatedTokens`
     - `systemPromptAddition`

所以它真正“放回去”的位置是：

`assemble() 的 systemPromptAddition`

这点和我们当前讨论的方向是高度一致的。

### 4.4 值得借鉴的点

- 以 `assemble()` 作为最终送模前上下文的真相源
- `before_agent_start` 做 recall 预计算，而不是直接承担最终注入
- `systemPromptAddition` 作为结构化上下文的回注位置
- `fresh tail + graph context` 的双层压缩
- `toolCall / toolResult` 配对修复，避免裁剪后消息顺序冲突
- `afterTurn` 做异步提取，减少对主交互链的阻塞

### 4.5 不适合直接照搬的点

- 节点/边类型过于克制，只适合较窄的图谱模型
- 更依赖 LLM 抽取三元组，治理字段较少
- 直接把图谱 XML 当成主要注入格式，偏 prompt-oriented
- 没有我们当前这么强的 governance / trace / scope / runtime snapshot 契约

## 5. 对本项目最有价值的借鉴

### 5.1 从 openclaw-control-center 借什么

- `official-first` 的 live/session 获取链
- CLI / session / local store 的多级 fallback
- session history 的只读归一化层
- 运行时主链与控制面分层

这更适合阶段 6 的：

- `Control Plane`
- 只读上下文检查
- dashboard / console
- 多来源接入前的观测层

### 5.2 从 memory-lancedb-pro 借什么

- hook 驱动的 capture / retrieve / inject 流程
- `before_agent_start / before_prompt_build` 的注入契约
- 已注入上下文的去重过滤
- 噪音治理与提取前清洗
- session summary 进入 memory store 的路径

这更适合阶段 6 的：

- runtime snapshot / runtime window 观察
- prompt augmentation contract
- hook 与 runtime context 之间的衔接

### 5.3 从 graph-memory 借什么

- `assemble()` 做主压缩与主回注
- `before_agent_start` 做 recall 预热，而不替代最终组装
- `systemPromptAddition` 作为结构化上下文注入位
- `afterTurn` 异步抽取、`session_end` 后台维护的时机设计
- 裁剪后 `toolCall / toolResult` 配对修复

## 6. 我们不应该照搬的地方

### 5.1 不把 control-center 当 runtime engine

`openclaw-control-center` 更适合做：

- 获取
- 展示
- 管理

不适合直接变成：

- runtime context compiler
- prompt assembly engine

### 5.2 不把 prependContext 当完整上下文结构

`memory-lancedb-pro` 的 `prependContext` 是一个很好用的注入机制，但它仍然是：

- 注入文本块

而不是：

- 一个完整、可追踪、可调试的运行时上下文容器

### 5.3 不让我们负责 provider-specific payload

本项目当前更合理的边界是：

- 我们负责 `上下文处理`
- 我们产出 provider-neutral 的运行时上下文结果
- `OpenClaw` 或宿主 adapter 负责把它转成最终 `system/messages/tools`

也就是说，不能因为看到了外部仓库里有 prompt augmentation，就把我们自己变成 provider payload assembler。

## 7. 对阶段 6 的直接影响

基于这三个仓库，阶段 6 更适合明确补下面三件事：

1. `Runtime Context Window Contract`
   - 明确当前运行时窗口、最新消息、工具结果配对、压缩计数
2. `Prompt Assembly Contract`
   - 明确哪些内容是上下文处理结果，哪些内容留给宿主最终组装
3. `Runtime Snapshot Persistence`
   - 在 `assemble()` 处保存真正的送模前快照，不再只依赖 transcript 回放

如果继续沿这个方向走，最稳的边界应该是：

```text
OpenClaw raw context / message window
-> our context processing
-> provider-neutral runtime context result
-> OpenClaw adapter assembles final provider payload
```

## 8. 一句话结论

`openclaw-control-center` 适合借鉴“怎么拿、怎么看、怎么管”；`memory-lancedb-pro` 适合借鉴“怎么挂 hook、怎么抽记忆、怎么做轻量回注”；`graph-memory` 适合借鉴“怎么把 recall 和 assemble 串成真正的 context-engine 主链”；而我们自己的目标，仍然应该是做一个和 provider payload 解耦的运行时上下文处理层。

