# OpenClaw 原生插件接入说明

相关文档入口：

- 文档总览索引: [documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)

## 1. 结论

这个项目现在已经按 OpenClaw 的原生插件协议接入，不再把 `stdio` 作为主入口。

真实形态是：

```text
OpenClaw
-> package.json openclaw.extensions
-> 加载 TypeScript 插件模块
-> 读取 openclaw.plugin.json
-> registerContextEngine(...)
-> plugins.slots.contextEngine = "compact-context"
```

也就是说，这个插件是一个 **同进程 context-engine 插件**，不是子进程 RPC 插件。

## 2. 本地源码里确认到的协议

从本机 OpenClaw 安装目录和示例插件可以确认：

- 插件根目录必须有 `openclaw.plugin.json`
- `package.json` 里必须有 `openclaw.extensions`
- 插件模块默认导出一个对象或函数
- 插件运行在 Gateway 同进程内
- Context Engine 通过 `registerContextEngine(id, factory)` 注册
- 启用时通过 `plugins.slots.contextEngine` 选择激活插件

## 3. 当前项目里的对应文件

- 清单: [openclaw.plugin.json](/d:/C_Project/openclaw_compact_context/openclaw.plugin.json)
- 扩展入口声明: [package.json](/d:/C_Project/openclaw_compact_context/package.json)
- 原生插件入口: [index.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/index.ts)
- OpenClaw context-engine 适配器: [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- 内部核心引擎: [context-engine.ts](/d:/C_Project/openclaw_compact_context/src/engine/context-engine.ts)

## 4. 启用方式

### 4.1 作为本地路径插件加载

把仓库路径加到 OpenClaw 配置里：

```json5
{
  plugins: {
    load: {
      paths: ["D:/C_Project/openclaw_compact_context"]
    },
    entries: {
      "compact-context": {
        enabled: true,
        config: {
          dbPath: "context-engine.sqlite",
          defaultTokenBudget: 12000,
          compileBudgetRatio: 0.3,
          enableGatewayMethods: true,
          recentRawMessageCount: 8
        }
      }
    },
    slots: {
      contextEngine: "compact-context"
    }
  }
}
```

### 4.2 关键配置项

- `dbPath`
  说明: SQLite 路径。相对路径优先解析到 OpenClaw `stateDir/plugins/compact-context/`；如果当前运行环境拿不到 `stateDir`，再按插件路径或当前工作目录解析。
- `defaultTokenBudget`
  说明: 宿主没有显式传 budget 时的默认值。
- `compileBudgetRatio`
  说明: 总 budget 中分配给“编译后上下文”的比例。
- `enableGatewayMethods`
  说明: 是否注册调试用 Gateway RPC。

## 5. 当前注册的能力

### 5.1 OpenClaw 原生 Context Engine

插件会注册：

- `compact-context`

引擎实现了这些生命周期方法：

- `bootstrap`
- `ingest`
- `ingestBatch`
- `afterTurn`
- `assemble`
- `compact`
- `dispose`

### 5.2 调试 Gateway 方法

为了方便排查和人工观察，插件还会注册一组 RPC：

- `compact-context.health`
- `compact-context.ingest_context`
- `compact-context.compile_context`
- `compact-context.create_checkpoint`
- `compact-context.query_nodes`
- `compact-context.query_edges`
- `compact-context.get_latest_checkpoint`
- `compact-context.list_checkpoints`
- `compact-context.crystallize_skills`
- `compact-context.list_skill_candidates`
- `compact-context.explain`
- `compact-context.inspect_bundle`
- `compact-context.apply_corrections`
- `compact-context.list_corrections`

[Gateway 调试入口示例](/d:/C_Project/openclaw_compact_context/docs/gateway-debug-usage.zh-CN.md)
[按问题场景排查的 Playbook](/d:/C_Project/openclaw_compact_context/docs/debug-playbook.zh-CN.md)
[故障注入与 Smoke Checklist](/d:/C_Project/openclaw_compact_context/docs/fault-injection-smoke-checklist.zh-CN.md)
[人工校正入口说明](/d:/C_Project/openclaw_compact_context/docs/manual-corrections-usage.zh-CN.md)
[阶段级观测矩阵](/d:/C_Project/openclaw_compact_context/docs/observability-matrix.zh-CN.md)

这些方法只是调试/运维入口，不是主协议。

其中 `compact-context.query_nodes` 当前已经不只是返回节点列表，还可以附带：

- `queryMatch`
  - 解释这条节点为什么会被文本查询召回
- `explain`
  - 解释这条节点为什么会或不会进入当前 bundle

## 6. 运行时行为

当前适配层做了这些事：

- 把 OpenClaw `AgentMessage[]` 映射成内部 `RawContextRecord[]`
- `bootstrap()` 会读取 OpenClaw JSONL transcript，识别 session header，并只导入当前叶子分支
- 用户消息默认沉淀为 `Intent`
- 助手消息默认沉淀为 `Decision`
- system 消息沉淀为 `Rule`
- tool 消息沉淀为 `State`
- `assemble()` 时会先摄取当前消息，再编译出最小上下文摘要，并裁剪原始消息尾部
- `afterTurn()` 时会做 checkpoint 和 skill candidate 结晶
- `compact()` 时会用当前图谱和 checkpoint 生成压缩结果

## 7. 当前实现边界

这一版已经是可跑的原生插件，但还有两点是刻意保守的：

- session history 的 `bootstrap` 是 best-effort 解析，不依赖 OpenClaw 私有 transcript 结构
- 当前仍使用 Node 自带 `node:sqlite`，所以本地会看到 experimental warning

如果后面 OpenClaw 明确暴露自己的 SQLite 适配层，可以把底层存储切过去，而不动上层 Context Engine 逻辑。

## 8. 旧 stdio 入口的定位

[stdio-integration.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stdio-integration.zh-CN.md) 现在只保留为通用调试入口。

主接入方式已经是：

`OpenClaw 原生插件 -> context-engine slot -> compact-context`
