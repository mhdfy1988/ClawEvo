# OpenClaw 接入知识图谱说明

相关入口：
- 文档索引：[documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)
- OpenClaw 原生插件入口：[openclaw-native-plugin.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/openclaw-native-plugin.zh-CN.md)
- Gateway 调试入口：[gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/gateway-debug-usage.zh-CN.md)
- 安装与验证：[compact-context-install-and-verify.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/compact-context-install-and-verify.zh-CN.md)

## 1. 文档目标
这份文档只回答一件事：

`OpenClaw 以后如何接到我们的知识图谱，并在需要“查找上下文 / 查节点 / 查边”时真正走这条链路。`

这里刻意把两类能力分开讲：

1. 日常对话时，宿主自动从知识图谱召回上下文。
2. 宿主显式发起“查图谱”请求，例如搜索页、调试页、解释页。

如果不把这两层分开，后面很容易出现两个误解：

1. 以为“插件装上了”就等于宿主所有搜索入口都自动改走图谱。
2. 以为“能 `query_nodes`”就等于主对话链已经在自动使用图谱。

## 2. 当前结论
当前项目已经具备这两条接入能力，但接入位置不同：

1. 自动上下文召回：
   OpenClaw 需要把 `compact-context` 设为当前 `context-engine slot`。
2. 显式知识图谱查询：
   OpenClaw 需要调用插件暴露出来的 gateway methods，例如 `compact-context.query_nodes`。

也就是说，主链和搜索链不是一回事：

1. 主链靠 `registerContextEngine(...) -> assemble()`。
2. 搜索链靠 `registerGatewayMethod(...) -> query_nodes/query_edges/explain/...`。

## 3. 目标、输入输出与边界

### 3.1 目标
目标不是“让 OpenClaw 知道有个 SQLite 文件”，而是让宿主在两个位置都能稳定消费知识图谱：

1. 送模前上下文组装。
2. 显式搜索 / 调试 / 解释。

### 3.2 关键输入
当前最关键的输入有 3 类：

1. 宿主插件挂载配置
   - 决定插件能不能被 OpenClaw 加载
   - 决定当前 `contextEngine slot` 指向谁
2. 插件自己的 runtime 配置
   - 决定图谱数据库、runtime snapshot、tool result artifact 写到哪里
   - 决定是否开启 gateway methods
3. 实际会话消息流
   - 决定图谱里有没有数据可查

### 3.3 关键输出
接入完成后，宿主会在两个层面看到输出：

1. `assemble()` 输出的 `messages / systemPromptAddition / estimatedTokens`
   - 这是自动上下文召回的结果
2. `query_nodes / query_edges / explain / inspect_bundle / inspect_runtime_window`
   - 这是显式图谱查询与调试结果

### 3.4 边界与不变式
下面这几个边界要固定住：

1. 知识图谱的运行时策略和存储路径归插件自己的 runtime 配置管理，不和宿主 `openclaw.json` 混放。
2. 宿主配置只负责：
   - 加载插件
   - 选择 `contextEngine slot`
   - 在需要时调用 gateway 方法
3. `assemble()` 仍然是送模前上下文的真相源。
4. 不是所有宿主搜索能力都会自动改走图谱；只有接到 `query_nodes/query_edges/...` 的入口才会显式使用图谱搜索。

## 4. 宿主侧接入链路

### 4.1 插件注册
插件入口在 [index.ts](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/src/index.ts)。
这里会先加载插件目录自己的 runtime 配置，再交给 adapter 标准化。

真正向 OpenClaw 宿主注册能力的是 [index.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/index.ts)：

1. `api.registerContextEngine('compact-context', ...)`
2. `registerLifecycleHooks(...)`
3. `registerGatewayDebugMethods(...)`

这三块分别对应：

1. 自动上下文主链
2. 生命周期沉淀链
3. 显式查询 / 调试 / 控制面入口

### 4.2 宿主配置
宿主需要做的最小配置只有两件事：

1. 能加载到插件
2. 把 `plugins.slots.contextEngine` 指向 `compact-context`

本地路径加载示例：

```json5
{
  plugins: {
    load: {
      paths: ["D:/C_Project/openclaw_compact_context/apps/openclaw-plugin"]
    },
    slots: {
      contextEngine: "compact-context"
    }
  }
}
```

如果插件已经正式安装进宿主扩展目录，通常不需要再写 `plugins.load.paths`，但 `slots.contextEngine` 这层语义仍然要成立。

### 4.3 宿主不该再承接什么
宿主配置里不再承担这些内容：

1. `dbPath`
2. `runtimeSnapshotDir`
3. `toolResultArtifactDir`
4. 压缩阈值、baseline 数量、rollup 比例

这些都属于插件自己的运行时真源。

## 5. 插件侧配置

### 5.1 插件自己的 runtime 配置
当前正式文件是：

- [compact-context.runtime.config.json](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/compact-context.runtime.config.json)

模板是：

- [compact-context.runtime.config.example.json](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/compact-context.runtime.config.example.json)

当前字段口径：

```json
{
  "dbPath": ".openclaw/context-engine.sqlite",
  "runtimeSnapshotDir": ".openclaw/runtime-window-snapshots",
  "toolResultArtifactDir": ".openclaw/tool-result-artifacts",
  "defaultTokenBudget": 12000,
  "compileBudgetRatio": 0.3,
  "enableGatewayMethods": true,
  "rawTailTurnCount": 2,
  "fullCompactionThresholdRatio": 0.5,
  "maxBaselineCount": 4,
  "maxBaselineRollupRatio": 0.2
}
```

这些字段的职责分别是：

1. `dbPath`
   - 知识图谱 SQLite 主库位置
2. `runtimeSnapshotDir`
   - `assemble()` 产出的 runtime window snapshot 目录
3. `toolResultArtifactDir`
   - tool result sidecar / artifact 目录
4. `enableGatewayMethods`
   - 是否向宿主注册显式查询与调试入口
5. 其余预算与压缩字段
   - 决定图谱召回和压缩治理策略

### 5.2 LLM 配置是另一层
不要把图谱 runtime 配置和 LLM 配置混在一起。

LLM 配置仍然是：

- [compact-context.llm.config.json](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/compact-context.llm.config.json)

它只负责：

1. provider 顺序
2. 模型
3. auth
4. baseUrl / apiKey / credential file

它不负责：

1. 图谱数据库路径
2. runtime snapshot 路径
3. tool artifact 路径
4. 压缩策略

## 6. 自动上下文召回链路

### 6.1 为什么主链要走 context-engine slot
因为宿主真正送模前的上下文入口在 `context-engine`，而不在 CLI，也不在控制台。

当前 adapter 已经把 `compact-context` 注册成原生 context engine：

- 注册点：[index.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/index.ts)
- 主实现：[context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/context-engine-adapter.ts)

### 6.2 自动主链怎么走
核心生命周期是：

1. `bootstrap()`
   - 宿主会话初始化时，尝试从 transcript 恢复历史
2. `ingest()` / `ingestBatch()`
   - 新消息进入时写入知识图谱
3. `afterTurn()`
   - 每轮结束后沉淀 checkpoint / skill candidate / 派生结果
4. `assemble()`
   - 真正从图谱里 compile 当前 bundle，裁 raw tail，生成最终送模前上下文
5. `compact()`
   - 手动 / 兼容 / 调试入口，不是日常自动主链前提

### 6.3 第 1 轮到第 N 轮的状态变化

#### 第 1 轮：刚装好插件，还没有真实会话
输入：

1. 宿主已加载插件
2. `contextEngine slot` 已指向 `compact-context`
3. 图谱库可能还是空的

状态：

1. `query_nodes` 可能查不到内容
2. `assemble()` 仍可工作，但主要依赖 live messages 或 transcript fallback

#### 第 2 轮：开始真实会话
输入：

1. 用户消息进入宿主
2. 宿主调用 `ingest()` / `afterTurn()`

状态：

1. SQLite 图谱开始有节点
2. checkpoint / delta / skill candidate 开始沉淀

#### 第 3 轮：会话继续推进
输入：

1. 当前轮消息窗口
2. 当前 session 的既有图谱历史

状态：

1. `assemble()` 已经不是只看 live raw messages
2. 会通过 `compileContext(...)` 从图谱里召回结构化上下文
3. 会按 runtime 配置的压缩策略保留 raw tail、baseline、incremental

#### 第 N 轮：宿主需要显式搜索 / 调试
输入：

1. 搜索词、sessionId、workspaceId、节点筛选条件

状态：

1. 宿主可以走 `query_nodes/query_edges/explain`
2. 平台或调试页可以走 `inspect_bundle/inspect_runtime_window`

## 7. 显式知识图谱查询链路

### 7.1 这条链路什么时候需要
下面这几类能力，不应强行塞进 `assemble()`，而应该显式走 gateway：

1. 搜索页
2. 调试页
3. 节点解释页
4. “为什么这条历史被召回”诊断页
5. 控制面观测页

### 7.2 当前已暴露的方法
当前 gateway methods 由 [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/context-engine-adapter.ts) 在 `registerGatewayDebugMethods(...)` 里注册。

最相关的一组是：

1. `compact-context.query_nodes`
2. `compact-context.query_edges`
3. `compact-context.explain`
4. `compact-context.inspect_bundle`
5. `compact-context.inspect_runtime_window`

### 7.3 它们分别适合什么场景

#### `compact-context.query_nodes`
适合：

1. 先按文本、类型、session、workspace 查一批候选节点
2. 给搜索页或候选列表页提供结果

补充行为：

1. 如果带 `filter.text`，响应里会附带 `queryMatch`
2. 如果加 `explain` 或 `includeExplain`，会对前几条结果补 explain

#### `compact-context.query_edges`
适合：

1. 看节点之间的关系
2. 给图谱视图或关系页提供边数据

#### `compact-context.explain`
适合：

1. 已知某个 `nodeId`
2. 想知道它为什么会或不会进当前 bundle

#### `compact-context.inspect_bundle`
适合：

1. 想看当前 compile 到底选中了什么
2. 想把“搜索结果”和“实际送模结果”对上

#### `compact-context.inspect_runtime_window`
适合：

1. 想看宿主当前消息窗口到底长什么样
2. 区分 `inboundMessages / preferredMessages / finalMessages`
3. 判断当前数据源来自：
   - `live_runtime`
   - `persisted_snapshot`
   - `transcript_fallback`

### 7.4 宿主后续做搜索页时应该怎么接
如果以后 OpenClaw 要做单独“知识图谱搜索页”，推荐最小接法是：

1. 搜索输入框
   - 调 `compact-context.query_nodes`
2. 结果列表点击某个节点
   - 调 `compact-context.explain`
3. 结果页侧栏查看“当前会话为什么召回这些东西”
   - 调 `compact-context.inspect_bundle`
4. 需要关系图时
   - 调 `compact-context.query_edges`

也就是说：

1. 搜索页先查节点
2. 解释页再 explain
3. 是否进 prompt，再由 `inspect_bundle` 对照

## 8. 配置清单

### 8.1 OpenClaw 宿主需要配什么
宿主现在真正需要关心的只有：

1. 插件如何被加载
2. `plugins.slots.contextEngine = "compact-context"`

如果后续宿主要调用显式图谱查询，还需要：

1. 有能力调用 gateway method
2. 把查询参数透传给 `compact-context.*`

### 8.2 插件需要配什么
插件目录里至少要有：

1. `compact-context.runtime.config.json`
2. `compact-context.llm.config.json`

如果要用 Codex OAuth：

1. `compact-context.codex-oauth.json`

### 8.3 当前最容易混乱的点
下面这几个点最容易配乱：

1. 把 `dbPath` 误写回宿主 `openclaw.json`
2. 把 LLM 配置和 runtime 配置写进同一个文件
3. 宿主 slot 没切到 `compact-context`，却以为主链已经走图谱
4. 只验证了 `query_nodes`，却以为 `assemble()` 已经自动召回了图谱

## 9. 推荐接入顺序

### 9.1 第 1 版先做什么
第一版只做这三件事：

1. 安装插件并切 `contextEngine slot`
2. 跑真实会话，确认图谱开始写入
3. 通过 `inspect_bundle / inspect_runtime_window / query_nodes` 验证主链与搜索链都通

这样能先确认：

1. 主对话已经会用图谱
2. 显式搜索也已经有入口

### 9.2 第 2 版再做什么
第二版再补：

1. 宿主显式搜索 UI
2. 图谱解释页
3. 关系图视图
4. 与 control-plane 的只读联动

### 9.3 先不要做什么
这一步先不要做：

1. 试图把宿主所有搜索入口统一替换成图谱
2. 在宿主和插件两边各维护一份图谱路径与压缩策略
3. 把平台页当成数据生产者

## 10. 最小验证路径
后续真正接入时，建议按这个顺序 smoke：

1. `openclaw plugins info compact-context`
   - 确认插件已经装上
2. 宿主确认 `contextEngine slot` 已切到 `compact-context`
3. 跑一轮真实会话
4. 检查插件目录下：
   - `dbPath`
   - `runtimeSnapshotDir`
   - `toolResultArtifactDir`
   是否已经有数据
5. 用 `compact-context.inspect_runtime_window`
   - 看当前窗口来源是不是 `live_runtime` 或 `persisted_snapshot`
6. 用 `compact-context.inspect_bundle`
   - 看当前 bundle 是否已经包含图谱召回内容
7. 用 `compact-context.query_nodes`
   - 看显式搜索是否能查到节点

只有这 7 步都成立，才能说：

1. 宿主主链已经接入图谱
2. 宿主显式搜索也已经接入图谱

## 11. 当前代码入口

### 宿主接入壳层
- [index.ts](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/src/index.ts)

### OpenClaw adapter
- [index.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/index.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/context-engine-adapter.ts)
- [hook-coordinator.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/hook-coordinator.ts)
- [tool-result-artifact-store.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/tool-result-artifact-store.ts)

### 插件配置
- [compact-context.runtime.config.json](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/compact-context.runtime.config.json)
- [compact-context.llm.config.json](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/compact-context.llm.config.json)

## 12. 一句话总结
以后 OpenClaw 要“查我们的知识图谱”，应该固定成两条线：

1. 主对话靠 `context-engine slot -> assemble() -> compileContext()`
2. 搜索 / 调试 / 解释靠 `query_nodes / query_edges / explain / inspect_bundle`

不要把这两条线混成“插件装上以后宿主所有查找都自动改走图谱”。
