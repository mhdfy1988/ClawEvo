# OpenClaw Compact Context

> 开发状态：**开发中 / Work in Progress**
>
> 当前阶段判断：`阶段 4 第一轮已完成`，项目正在进入下一轮增强规划阶段。

## 项目简介
`OpenClaw Compact Context` 是一个面向 OpenClaw 的 `context-engine` 插件，目标是把下面这条链路做成稳定主链：

```text
hook / transcript / tool result
-> ingest
-> graph + provenance
-> runtime bundle compile
-> prompt assemble
-> checkpoint / delta / skill candidate
```

它关注的不是“做一段摘要”，而是把上下文治理拆成：
- 原文证据沉淀
- provenance 与治理字段
- 运行时 bundle 编译
- checkpoint / delta / skill candidate 沉淀
- explain / debug / evaluation

## 当前状态
- 阶段 2 已完成收口
- 阶段 3 的治理主线和第二轮增强已完成
- 阶段 4 第一轮已完成
- 当前已经具备：
  - relation production contract 与高价值 recall 扩边
  - relation retrieval 成本诊断
  - memory lifecycle 第一轮
  - scope promotion policy
  - Topic / Concept 最小 hint 接入
  - evaluation harness

更详细的状态说明看这里：
- [stage-4-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-status.zh-CN.md)
- [stage-4-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-first-pass-report.zh-CN.md)
- [stage-4-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-todo.zh-CN.md)

## 已具备能力
- 作为 OpenClaw 原生插件接入，而不是单独的 stdio 包装层
- 从 `transcript / hook / tool result` 导入上下文并写入 SQLite 图谱
- 显式区分 `raw / compressed / derived`
- 在 `tool_result_persist` 阶段压缩超长 tool result 并落 sidecar artifact
- 编译 `RuntimeContextBundle`，按预算和治理规则选择上下文
- 通过 `explain / inspect_bundle / query_nodes + explain / queryMatch` 排查上下文选择
- 通过 checkpoint / delta / skill candidate 沉淀历史
- 通过 evaluation harness 跑阶段级回归

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

### 全量测试
```bash
npm test
```

### 调试 smoke
```bash
npm run test:smoke:debug
```

### 阶段 4 评估
```bash
npm run test:evaluation
```

## 文档导航
- 文档总览：[documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)
- 总体路线图：[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
- 多层图谱架构：[layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/layered-knowledge-graph-architecture.zh-CN.md)
- 主链流程：[hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hook-to-graph-pipeline.zh-CN.md)
- 阶段 4 评估：[stage-4-evaluation-harness.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-evaluation-harness.zh-CN.md)

## OpenClaw 插件入口
- 插件说明：[openclaw-native-plugin.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/openclaw-native-plugin.zh-CN.md)
- 插件清单：[openclaw.plugin.json](/d:/C_Project/openclaw_compact_context/openclaw.plugin.json)
- 入口实现：[src/openclaw/index.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/index.ts)

## 说明
- 当前 README 只负责快速建立项目认知，不替代详细设计文档
- 如果后面阶段状态发生变化，优先同步：
  - [stage-4-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-status.zh-CN.md)
  - [stage-4-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-first-pass-report.zh-CN.md)
  - [stage-4-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-todo.zh-CN.md)
  - [documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)
