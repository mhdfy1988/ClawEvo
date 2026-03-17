# OpenClaw 原生插件接入说明

相关入口：
- 文档索引：[documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)

## 1. 结论
当前项目已经按 OpenClaw 原生插件协议接入，不再把 `stdio` 作为主入口。

真实形态是：

```text
OpenClaw
-> apps/openclaw-plugin/package.json openclaw.extensions
-> 加载 TypeScript 插件模块
-> 读取 openclaw.plugin.json
-> registerContextEngine(...)
-> plugins.slots.contextEngine = "compact-context"
```

也就是说，这个插件是一个同进程 `context-engine` 插件，不是子进程 RPC 插件。

## 2. 关键文件
- 清单：[openclaw.plugin.json](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/openclaw.plugin.json)
- 扩展声明：[package.json](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/package.json)
- 插件装配入口：[index.ts](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/src/index.ts)
- OpenClaw adapter：[context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/context-engine-adapter.ts)
- 内部引擎：[context-engine.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/engine/context-engine.ts)

## 3. 启用方式
### 3.1 作为本地路径插件加载
把仓库路径加到 OpenClaw 配置里：

```json5
{
  plugins: {
    load: {
      paths: ["D:/C_Project/openclaw_compact_context/apps/openclaw-plugin"]
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

### 3.2 关键配置项
- `dbPath`
- `defaultTokenBudget`
- `compileBudgetRatio`
- `enableGatewayMethods`
- `recentRawMessageCount`

## 4. 当前注册能力
### 4.1 OpenClaw 原生 Context Engine
插件注册：
- `compact-context`

生命周期方法：
- `bootstrap`
- `ingest`
- `ingestBatch`
- `afterTurn`
- `assemble`
- `compact`
- `dispose`

### 4.2 Gateway 调试与控制面方法
当前会注册：
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
- `compact-context.inspect_runtime_window`
- `compact-context.inspect_observability_dashboard`
- `compact-context.apply_corrections`
- `compact-context.list_corrections`
- `compact-context.submit_correction_proposal`
- `compact-context.review_correction_proposal`
- `compact-context.apply_correction_proposal`
- `compact-context.rollback_correction_proposal`
- `compact-context.list_correction_proposals`
- `compact-context.list_correction_audit`
- `compact-context.create_import_job`
- `compact-context.run_import_job`
- `compact-context.get_import_job`
- `compact-context.list_import_jobs`

相关文档：
- [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/gateway-debug-usage.zh-CN.md)
- [manual-corrections-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/manual-corrections-usage.zh-CN.md)
- [dashboard-observability-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/dashboard-observability-contracts.zh-CN.md)
- [import-source-spec.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/import-source-spec.zh-CN.md)
- [历史导入平台说明](/d:/C_Project/openclaw_compact_context/docs/archive/control-plane/multi-source-import-platform-first-pass.zh-CN.md)

## 5. 运行时行为
当前 adapter 负责：
- 把 OpenClaw `AgentMessage[]` 映射成内部 `RawContextRecord[]`
- `bootstrap()` 时读取 OpenClaw JSONL transcript，做 best-effort 恢复
- `assemble()` 时抓当前消息窗口，编译最小结构化上下文，并裁剪原始消息尾部
- `afterTurn()` 时做 checkpoint 与 skill candidate 沉淀
- `compact()` 时基于图谱和 checkpoint 生成压缩结果

## 6. 当前边界
这版已经是可跑的原生插件，但仍有两点刻意保守：
- `bootstrap` 仍然是 best-effort transcript 解析，不依赖 OpenClaw 私有 transcript 结构
- 当前仍使用 Node 自带 `node:sqlite`，本地可能看到 experimental warning

## 7. stdio 的定位
[stdio-integration.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/stdio-integration.zh-CN.md) 现在只保留为通用调试入口。

主接入方式已经是：

`OpenClaw 原生插件 -> context-engine slot -> compact-context`

