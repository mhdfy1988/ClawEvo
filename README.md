# OpenClaw Compact Context

> 开发状态：**开发中 / Work in Progress**
>
> 当前阶段判断：`阶段 4 与阶段 5 主线已经完成；上下文处理攻坚与其他专项攻坚已经收口；阶段 6 第一轮与第二轮已经完成，下一步进入阶段 7-9 的平台化深化路线。`

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
- 阶段 6 第二轮已完成
- 阶段 7、8、9 TODO 已规划

阶段 6 两轮新增了：
- Runtime Context Window / Prompt Assembly / Runtime Snapshot 三项 contract
- `governance / observability / import` 三个最小 control-plane service
- `control-plane-facade`
- 平台化人工治理闭环
- dashboard 级 observability contract 与 snapshot history
- 多来源 import job 第一轮与第二轮治理能力
- 目录分层第一轮入口与 root export 收紧

## 已具备能力
- 作为 OpenClaw 原生插件接入，而不是独立 stdio 包装层
- 从 `transcript / hook / tool result` 导入上下文并写入 SQLite 图谱
- 显式区分 `raw / compressed / derived`
- 在 `tool_result_persist` 阶段压缩超长 tool result 并落 sidecar artifact
- 编译 `RuntimeContextBundle`，按预算和治理规则选择上下文
- 通过 `explain / inspect_bundle / query_nodes / inspect_runtime_window` 排查上下文选择
- 通过 checkpoint / delta / skill candidate 沉淀历史
- 通过 evaluation harness 跑阶段级回归
- 通过 gateway 访问运行时、治理、observability 和 import 第二轮能力

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
- `docs/planning/`
  - 总体路线图：[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)
  - 目录重构第一轮：[directory-refactor-first-pass.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/directory-refactor-first-pass.zh-CN.md)
- `docs/stages/`
  - 阶段 6 TODO：[stage-6-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-todo.zh-CN.md)
  - 阶段 6 第二轮 TODO：[stage-6-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-todo.zh-CN.md)
  - 阶段 6 平台化方案：[stage-6-platformization-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-platformization-plan.zh-CN.md)
  - 阶段 6 第一轮状态：[stage-6-first-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-first-pass-status.zh-CN.md)
  - 阶段 6 第一轮总结：[stage-6-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-first-pass-report.zh-CN.md)
  - 阶段 6 第二轮状态：[stage-6-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-status.zh-CN.md)
  - 阶段 6 第二轮总结：[stage-6-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-report.zh-CN.md)
  - 阶段 6 能力边界：[stage-6-capability-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-capability-boundary.zh-CN.md)
  - 阶段 7 TODO：[stage-7-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-todo.zh-CN.md)
  - 阶段 7 状态：[stage-7-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-status.zh-CN.md)
  - 阶段 7 总结：[stage-7-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-report.zh-CN.md)
  - 阶段 8 TODO：[stage-8-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-todo.zh-CN.md)
  - 阶段 9 TODO：[stage-9-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-9-todo.zh-CN.md)
- `docs/context-processing/`
  - Runtime 上下文策略：[openclaw-runtime-context-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/openclaw-runtime-context-strategy.zh-CN.md)
  - Runtime Window contract：[runtime-context-window-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-context-window-contract.zh-CN.md)
  - Prompt Assembly contract：[prompt-assembly-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/prompt-assembly-contract.zh-CN.md)
  - Runtime Snapshot Persistence：[runtime-snapshot-persistence.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-snapshot-persistence.zh-CN.md)
- `docs/control-plane/`
  - Control Plane contracts：[control-plane-service-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-service-contracts.zh-CN.md)
  - API Matrix：[control-plane-api-matrix.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-api-matrix.zh-CN.md)
  - Control Plane 当前入口：[README.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/README.md)
  - Governance Runbook：[governance-workflow-runbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/governance-workflow-runbook.zh-CN.md)
  - Control Plane Release Checklist：[control-plane-release-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/control-plane-release-checklist.zh-CN.md)
  - Control Plane Production Runbook：[control-plane-production-runbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/control-plane-production-runbook.zh-CN.md)
  - Dashboard observability contracts：[dashboard-observability-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/dashboard-observability-contracts.zh-CN.md)
  - 指标字典：[observability-metrics-dictionary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/observability-metrics-dictionary.zh-CN.md)
  - Import Source Spec：[import-source-spec.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/import-source-spec.zh-CN.md)
  - 历史归档入口：[README.md](/d:/C_Project/openclaw_compact_context/docs/archive/control-plane/README.md)
- `docs/references/`
  - 外部参考整理：[openclaw-external-context-references.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/references/openclaw-external-context-references.zh-CN.md)
- `docs/planning/`
  - 文档迁移说明：[docs-migration-map.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/docs-migration-map.zh-CN.md)
  - 文档贡献规范：[docs-contribution-guide.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/docs-contribution-guide.zh-CN.md)
  - 术语表：[glossary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/glossary.zh-CN.md)

## OpenClaw 插件入口
- 插件说明：[openclaw-native-plugin.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/openclaw-native-plugin.zh-CN.md)
- 插件清单：[openclaw.plugin.json](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/openclaw.plugin.json)
- 默认插件装配：[index.ts](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/src/index.ts)

## 说明
- README 只负责快速建立项目认知，不替代详细设计文档。
- 如果后面阶段状态再发生变化，优先同步：
  - [stage-6-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-todo.zh-CN.md)
  - [stage-6-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-todo.zh-CN.md)
  - [stage-6-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-status.zh-CN.md)
  - [stage-6-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-report.zh-CN.md)
  - [stage-7-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-todo.zh-CN.md)
  - [stage-7-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-status.zh-CN.md)
  - [stage-7-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-report.zh-CN.md)
  - [stage-8-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-todo.zh-CN.md)
  - [stage-8-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-status.zh-CN.md)
  - [stage-8-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-report.zh-CN.md)
  - [stage-9-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-9-todo.zh-CN.md)
  - [documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)

## 发布打包

真实生产打包现在只认两个最终交付物：

- 插件包
- 平台包

常用命令：

```bash
# 一次生成两个正式交付包
npm run pack:release

# 单独打插件包
npm run pack:release:plugin

# 单独打平台包
npm run pack:release:control-plane
```

当前真实产物目录约定：
- `artifacts/releases/compact-context/`
- `artifacts/releases/control-plane/`

这两个 app 包当前已经是自包含交付物：

- release 时会把内部 workspace 依赖一起打进包里
- 安装时不再要求额外从 npm registry 拉取 `@openclaw-compact-context/*` 内部包

安装示例：

```powershell
npm.cmd install -g artifacts/releases/compact-context/openclaw-compact-context-compact-context-0.1.0.tgz
openclaw-context-cli summarize --text "测试一句话能不能被压缩。"
```

共享 packages 继续通过 `npm run pack:workspace` 做 dry-run 审计，但不再作为“真实生产交付包”单独落 `.tgz` 目录。
