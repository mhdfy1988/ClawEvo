# 文档索引

当前项目的文档已经从“按阶段堆叠”逐步收成两层：
- `当前有效入口`
- `历史归档入口`

如果你是第一次进入仓库，优先看“当前有效入口”；只有在需要追历史背景、迁移过程或旧阶段设计时，再进入 `docs/archive/`。

## 目录结构
- `docs/agents/`
  项目规则索引、协作约束、实现边界与长期踩坑记录。
- `docs/architecture/`
  系统分层、知识图谱、主链设计、hook 到图谱链路。
- `docs/context-processing/`
  上下文处理契约、代码流转、运行时上下文策略、snapshot / prompt assembly。
- `docs/control-plane/`
  当前有效的 control-plane contract、runbook、observability、import 规范。
- `docs/integrations/`
  OpenClaw 原生插件、CLI/Codex/OAuth、多模型接入文档。
- `docs/knowledge/`
  经验学习、知识晋升、跨任务记忆、多跳 recall 等知识治理。
- `docs/operations/`
  gateway 调试、release checklist、production runbook 等运维说明。
- `docs/planning/`
  当前路线图、结构收口、workspace/release/test 规划。
- `docs/references/`
  外部参考、讨论纪要、借鉴分析。
- `docs/stages/`
  阶段 6 到阶段 9 的 TODO、状态、总结与承接文档。
- `docs/archive/`
  已完成阶段、first-pass 说明、历史迁移报告与归档入口。

## 先看这几份
- 项目总览：[README.md](/d:/C_Project/openclaw_compact_context/README.md)
- 当前路线图：[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)
- 项目规则索引：[index.md](/d:/C_Project/openclaw_compact_context/docs/agents/index.md)
- OpenClaw 原生插件入口：[openclaw-native-plugin.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/openclaw-native-plugin.zh-CN.md)
- OpenClaw 接知识图谱说明：[openclaw-knowledge-graph-access.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/openclaw-knowledge-graph-access.zh-CN.md)
- Runtime 上下文策略：[openclaw-runtime-context-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/openclaw-runtime-context-strategy.zh-CN.md)
- Control Plane contracts：[control-plane-service-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-service-contracts.zh-CN.md)
- Gateway 调试入口：[gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/gateway-debug-usage.zh-CN.md)
- Compact Context 安装与验证：[compact-context-install-and-verify.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/compact-context-install-and-verify.zh-CN.md)
- Workspace / release 收口状态：[workspace-release-readiness.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-release-readiness.zh-CN.md)
- Codex 接入总览：[codex-access-modes.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/codex-access-modes.zh-CN.md)
- Codex OAuth 实现说明：[codex-oauth-login-implementation.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/codex-oauth-login-implementation.zh-CN.md)

## 按主题找文档

### 当前规划与阶段入口
- [docs/planning/README.md](/d:/C_Project/openclaw_compact_context/docs/planning/README.md)
- [stage-6-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-todo.zh-CN.md)
- [stage-7-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-todo.zh-CN.md)
- [stage-8-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-todo.zh-CN.md)
- [stage-9-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-9-todo.zh-CN.md)

### 架构与主链
- [context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-design-v2.zh-CN.md)
- [context-engine-assemble-compaction-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-assemble-compaction-strategy.zh-CN.md)
- [current-system-layering.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/current-system-layering.zh-CN.md)
- [layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/layered-knowledge-graph-architecture.zh-CN.md)
- [hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/hook-to-graph-pipeline.zh-CN.md)
- [plugin-api-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/plugin-api-contract.zh-CN.md)

### 上下文处理
- [openclaw-runtime-context-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/openclaw-runtime-context-strategy.zh-CN.md)
- [runtime-context-window-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-context-window-contract.zh-CN.md)
- [prompt-assembly-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/prompt-assembly-contract.zh-CN.md)
- [runtime-snapshot-persistence.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-snapshot-persistence.zh-CN.md)
- [context-processing-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/context-processing-contracts.zh-CN.md)
- [context-processing-code-flow.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/context-processing-code-flow.zh-CN.md)

### Control Plane 与运维
- [docs/control-plane/README.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/README.md)
- [control-plane-service-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-service-contracts.zh-CN.md)
- [control-plane-api-matrix.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-api-matrix.zh-CN.md)
- [governance-workflow-runbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/governance-workflow-runbook.zh-CN.md)
- [dashboard-observability-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/dashboard-observability-contracts.zh-CN.md)
- [import-source-spec.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/import-source-spec.zh-CN.md)
- [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/gateway-debug-usage.zh-CN.md)
- [compact-context-install-and-verify.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/compact-context-install-and-verify.zh-CN.md)
- [control-plane-release-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/control-plane-release-checklist.zh-CN.md)
- [control-plane-production-runbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/control-plane-production-runbook.zh-CN.md)

### 集成与多模型
- [docs/integrations/README.md](/d:/C_Project/openclaw_compact_context/docs/integrations/README.md)
- [openclaw-native-plugin.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/openclaw-native-plugin.zh-CN.md)
- [openclaw-knowledge-graph-access.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/openclaw-knowledge-graph-access.zh-CN.md)
- [stdio-integration.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/stdio-integration.zh-CN.md)
- [codex-access-modes.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/codex-access-modes.zh-CN.md)
- [codex-oauth-login-implementation.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/codex-oauth-login-implementation.zh-CN.md)

### 规则、知识与参考
- [docs/agents/index.md](/d:/C_Project/openclaw_compact_context/docs/agents/index.md)
- [experience-learning-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/experience-learning-plan.zh-CN.md)
- [knowledge-promotion-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/knowledge-promotion-contract.zh-CN.md)
- [openclaw-external-context-references.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/references/openclaw-external-context-references.zh-CN.md)

## 历史归档入口
- 历史归档总入口：[docs/archive/README.md](/d:/C_Project/openclaw_compact_context/docs/archive/README.md)
- Planning 历史归档：[docs/archive/planning/README.md](/d:/C_Project/openclaw_compact_context/docs/archive/planning/README.md)
- Control Plane 历史归档：[docs/archive/control-plane/README.md](/d:/C_Project/openclaw_compact_context/docs/archive/control-plane/README.md)

## 代码入口
- 上下文处理总入口：[context-processing-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/context-processing-pipeline.ts)
- Control Plane facade：[control-plane-facade.ts](/d:/C_Project/openclaw_compact_context/packages/compact-context-core/src/control-plane-facade.ts)
- OpenClaw adapter：[context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/context-engine-adapter.ts)
- 插件装配入口：[index.ts](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/src/index.ts)
