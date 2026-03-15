# OpenClaw Compact Context

> 开发状态：**开发中 / Work in Progress**
>
> 当前阶段判断：`阶段 4 与阶段 5 主线已经完成；上下文处理攻坚与其他专项攻坚已经收口；阶段 6 第一轮已经完成。`

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
- 阶段 4 第一轮与第二轮主线已完成
- 阶段 5 第一轮与第二轮已完成
- 上下文处理攻坚已完成
- 其他专项攻坚已完成
- 阶段 6 第一轮已完成

阶段 6 第一轮新增了：
- Runtime Context Window / Prompt Assembly / Runtime Snapshot 三项 contract
- `governance / observability / import` 三个最小 control-plane service
- 平台化人工治理闭环
- dashboard 级 observability contract
- 多来源 import job 第一轮
- 目录分层第一轮入口

## 已具备能力
- 作为 OpenClaw 原生插件接入，而不是独立 stdio 包装层
- 从 `transcript / hook / tool result` 导入上下文并写入 SQLite 图谱
- 显式区分 `raw / compressed / derived`
- 在 `tool_result_persist` 阶段压缩超长 tool result 并落 sidecar artifact
- 编译 `RuntimeContextBundle`，按预算和治理规则选择上下文
- 通过 `explain / inspect_bundle / query_nodes / inspect_runtime_window` 排查上下文选择
- 通过 checkpoint / delta / skill candidate 沉淀历史
- 通过 evaluation harness 跑阶段级回归
- 通过 gateway 访问第一轮 control-plane 能力

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

### 阶段评估
```bash
npm run test:evaluation
```

## 文档导航
- 文档总览：[documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)
- 总体路线图：[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
- 阶段 6 TODO：[stage-6-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-6-todo.zh-CN.md)
- 阶段 6 平台化方案：[stage-6-platformization-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-6-platformization-plan.zh-CN.md)
- 阶段 6 第一轮状态：[stage-6-first-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-6-first-pass-status.zh-CN.md)
- 阶段 6 第一轮总结：[stage-6-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-6-first-pass-report.zh-CN.md)
- 阶段 6 能力边界：[stage-6-capability-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-6-capability-boundary.zh-CN.md)
- OpenClaw 运行时上下文策略：[openclaw-runtime-context-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/openclaw-runtime-context-strategy.zh-CN.md)
- 外部参考整理：[openclaw-external-context-references.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/openclaw-external-context-references.zh-CN.md)
- Control Plane contracts：[control-plane-service-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane-service-contracts.zh-CN.md)
- Dashboard observability contracts：[dashboard-observability-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/dashboard-observability-contracts.zh-CN.md)
- 多来源导入平台第一轮：[multi-source-import-platform-first-pass.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/multi-source-import-platform-first-pass.zh-CN.md)
- 目录重构第一轮：[directory-refactor-first-pass.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/directory-refactor-first-pass.zh-CN.md)

## OpenClaw 插件入口
- 插件说明：[openclaw-native-plugin.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/openclaw-native-plugin.zh-CN.md)
- 插件清单：[openclaw.plugin.json](/d:/C_Project/openclaw_compact_context/openclaw.plugin.json)
- 入口实现：[src/openclaw/index.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/index.ts)

## 说明
- README 只负责快速建立项目认知，不替代详细设计文档。
- 如果后面阶段状态再发生变化，优先同步：
  - [stage-6-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-6-todo.zh-CN.md)
  - [stage-6-first-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-6-first-pass-status.zh-CN.md)
  - [stage-6-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-6-first-pass-report.zh-CN.md)
  - [documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)
