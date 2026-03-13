# OpenClaw Compact Context

> 开发状态：**开发中 / Work in Progress**
>
> 项目整体仍在快速迭代中，但 `阶段 2` 已完成收口；当前状态更适合描述为“阶段 3 准备中”，而不是“刚开始做上下文压缩”。

## 项目简介

`OpenClaw Compact Context` 是一个面向 OpenClaw 的 `context-engine` 插件，目标是把下面这条链路串成闭环：

```text
hook / transcript / tool result
-> ingest
-> graph + provenance
-> runtime bundle compile
-> prompt assemble
-> checkpoint / delta / skill candidate
```

它关注的不是“做一段摘要”，而是把上下文治理拆成源头减噪、结构化沉淀、图谱存储、运行时裁决和调试解释几层能力。

## 当前状态

- `阶段 2` 已完成收口，当前进入阶段 3 准备阶段
- `tool_result_persist`、provenance 主链、artifact sidecar、ingest 结构化消费已经接入
- compiler diagnostics、`inspect_bundle`、`query_nodes + explain`、`queryMatch` 调试链已经可用
- 项目仍未定版，暂不建议按稳定成品能力对外承诺

更详细的阶段状态见：
- [docs/stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
- [docs/stage-2-exit-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-exit-report.zh-CN.md)
- [docs/context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)

## 已具备的能力

- 作为 OpenClaw 原生插件接入，不再以 `stdio` 作为主入口
- 从 `transcript / hook / tool result` 导入上下文并写入 SQLite 图谱
- 显式区分 `raw / compressed / derived` 的 provenance 主链
- 在 `tool_result_persist` 阶段压缩超长工具输出并落 sidecar artifact
- 运行时编译 `RuntimeContextBundle`，按预算和类型选择上下文
- 为 bundle 选择提供 diagnostics、selection explain 和 query match 解释
- 提供 Gateway 调试入口，支持 `inspect_bundle`、`query_nodes`、`explain`
- 提供 smoke 和回归测试，覆盖核心调试链和 artifact 回查链

## 快速开始

### 安装依赖

```bash
npm install
```

### 类型检查

```bash
npm run check
```

### 构建

```bash
npm run build
```

### 运行测试

```bash
npm test
```

### 仅跑调试 smoke

```bash
npm run test:smoke:debug
```

## 作为 OpenClaw 插件使用

当前项目是 **OpenClaw 原生 context-engine 插件**。

关键入口：
- 插件清单: [openclaw.plugin.json](/d:/C_Project/openclaw_compact_context/openclaw.plugin.json)
- 包配置: [package.json](/d:/C_Project/openclaw_compact_context/package.json)
- 插件实现: [src/openclaw/index.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/index.ts)

接入说明看这里：
- [docs/openclaw-native-plugin.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/openclaw-native-plugin.zh-CN.md)

## 文档导航

建议先从总览页开始：
- 文档总览索引: [docs/documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)

如果想按主题直达：
- 当前阶段状态: [docs/stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
- 阶段 2 出口报告: [docs/stage-2-exit-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-exit-report.zh-CN.md)
- 阶段路线图: [docs/context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
- 全链路流程: [docs/hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hook-to-graph-pipeline.zh-CN.md)
- provenance 设计: [docs/provenance-schema-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/provenance-schema-plan.zh-CN.md)
- 调试入口说明: [docs/gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/gateway-debug-usage.zh-CN.md)
- 故障排查手册: [docs/debug-playbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/debug-playbook.zh-CN.md)

## 说明

- 当前 README 目标是快速建立项目认知，不替代详细设计文档
- 如果后续阶段状态或能力边界变化，优先同步：
  - [docs/stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
  - [docs/stage-2-exit-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-exit-report.zh-CN.md)
  - [docs/documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)
