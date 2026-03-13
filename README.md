# OpenClaw Compact Context

> 开发状态：**开发中 / Work in Progress**
>
> 这个项目目前还在快速迭代中，`阶段 2` 主干已经基本打通，但整体仍未定版，不建议当作稳定成品能力来承诺。

## 项目简介

`OpenClaw Compact Context` 是一个面向 OpenClaw 的 context-engine 插件，目标是把“上下文压缩、知识沉淀、图谱化存储、运行时上下文编译、调试解释”串成一条闭环。

它关注的不是简单做一段摘要，而是把上下文治理拆成几步：

```text
hook / transcript / tool result
-> ingest
-> graph + provenance
-> runtime bundle compile
-> prompt assemble
-> checkpoint / delta / skill candidate
```

## 当前状态

- `阶段 2` 主干已基本打通，当前处在“后半段收尾与质量补齐”阶段
- `tool_result_persist`、provenance 主链、ingest 细粒度识别、compiler diagnostics 已接入
- `inspect_bundle`、`query_nodes + explain`、`queryMatch` 等调试链已可用
- 仍有一些收尾项还在继续推进，例如：
  - `tool_result_persist` 裁剪原因 explain
  - artifact sidecar 真正落盘与回查
  - 更深入的历史未保留原因解释

更详细的状态盘点见：

- [docs/stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
- [docs/context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)

## 已具备的能力

- OpenClaw 原生插件接入，不再以 `stdio` 作为主入口
- 从 transcript / hook / tool result 导入上下文并写入 SQLite 图谱
- 区分 `raw / compressed / derived` 的 provenance 主链
- 运行时编译 `RuntimeContextBundle`，按预算和类型做选择
- 为 bundle 选择提供 diagnostics 和 explain
- 提供 Gateway 调试入口，支持 `inspect_bundle`、`query_nodes`、`explain`
- 提供 smoke 和回归测试，覆盖核心调试链

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

这个项目当前是 **OpenClaw 原生 context-engine 插件**。

关键入口：

- 插件清单: [openclaw.plugin.json](/d:/C_Project/openclaw_compact_context/openclaw.plugin.json)
- 扩展入口: [package.json](/d:/C_Project/openclaw_compact_context/package.json)
- 插件实现: [src/openclaw/index.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/index.ts)

接入说明看这里：

- [docs/openclaw-native-plugin.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/openclaw-native-plugin.zh-CN.md)

## 文档导航

建议先从总览页开始：

- 文档总览索引: [docs/documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)

如果你想按主题直达：

- 全链路流程: [docs/hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hook-to-graph-pipeline.zh-CN.md)
- 当前阶段状态: [docs/stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
- 阶段路线图: [docs/context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
- provenance 设计: [docs/provenance-schema-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/provenance-schema-plan.zh-CN.md)
- 调试入口说明: [docs/gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/gateway-debug-usage.zh-CN.md)
- 故障排查手册: [docs/debug-playbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/debug-playbook.zh-CN.md)

## 说明

- 当前 README 以“快速建立项目认知”为目标，不替代详细设计文档
- 如果后续能力边界或阶段状态变化，应优先同步：
  - [docs/stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
  - [docs/documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)
