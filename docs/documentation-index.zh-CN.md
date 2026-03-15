# 文档索引

当前项目状态可以先用一句话概括：
`阶段 4 和阶段 5 主线已经收口；阶段 6 第一轮与第二轮都已完成，项目目前进入“Runtime Plane + Control Plane 基础完成、下一步转向阶段 7-9 平台化深化”的状态。`

## 目录结构
- `docs/architecture/`
  主链设计、知识图谱分层、schema/provenance/traceability、hook 到图谱链路。
- `docs/context-processing/`
  上下文处理契约、代码流转、运行时上下文策略、压缩与攻坚记录。
- `docs/control-plane/`
  Control Plane contract、observability、人工治理、导入平台相关文档。
- `docs/integrations/`
  OpenClaw 原生插件、hook 发现、stdio 集成等宿主接入文档。
- `docs/knowledge/`
  经验学习、知识晋升、跨任务记忆、多跳 recall 等知识治理文档。
- `docs/operations/`
  调试手册、gateway 调试、故障注入与运维侧说明。
- `docs/planning/`
  总路线图、交付计划、阶段外 TODO、重构路线和模板。
- `docs/references/`
  外部参考、讨论纪要、借鉴分析。
- `docs/stages/`
  阶段 2 到阶段 6 的 TODO、状态、报告和阶段计划。

## 先看这几份
- 当前路线图：[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)
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
- 阶段 8 状态：[stage-8-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-status.zh-CN.md)
- 阶段 8 总结：[stage-8-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-report.zh-CN.md)
- 阶段 9 TODO：[stage-9-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-9-todo.zh-CN.md)
- Runtime 上下文策略：[openclaw-runtime-context-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/openclaw-runtime-context-strategy.zh-CN.md)
- Control Plane contracts：[control-plane-service-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-service-contracts.zh-CN.md)
- Dashboard observability contracts：[dashboard-observability-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/dashboard-observability-contracts.zh-CN.md)
- OpenClaw 原生插件入口：[openclaw-native-plugin.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/openclaw-native-plugin.zh-CN.md)

## 按主题找文档

### 阶段与路线图
- [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)
- [hardening-master-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/hardening-master-roadmap.zh-CN.md)
- [stage-6-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-todo.zh-CN.md)
- [stage-6-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-todo.zh-CN.md)
- [stage-6-platformization-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-platformization-plan.zh-CN.md)
- [stage-6-first-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-first-pass-status.zh-CN.md)
- [stage-6-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-first-pass-report.zh-CN.md)
- [stage-6-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-status.zh-CN.md)
- [stage-6-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-report.zh-CN.md)
- [stage-6-capability-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-capability-boundary.zh-CN.md)
- [stage-7-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-todo.zh-CN.md)
- [stage-7-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-status.zh-CN.md)
- [stage-7-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-report.zh-CN.md)
- [stage-8-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-todo.zh-CN.md)
- [stage-8-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-status.zh-CN.md)
- [stage-8-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-report.zh-CN.md)
- [stage-9-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-9-todo.zh-CN.md)

### 架构与主链
- [context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-design-v2.zh-CN.md)
- [context-engine-design.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-design.zh-CN.md)
- [layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/layered-knowledge-graph-architecture.zh-CN.md)
- [hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/hook-to-graph-pipeline.zh-CN.md)
- [context-handling-principles.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-handling-principles.zh-CN.md)
- [plugin-api-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/plugin-api-contract.zh-CN.md)

### 上下文处理
- [openclaw-runtime-context-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/openclaw-runtime-context-strategy.zh-CN.md)
- [runtime-context-window-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-context-window-contract.zh-CN.md)
- [prompt-assembly-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/prompt-assembly-contract.zh-CN.md)
- [runtime-snapshot-persistence.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-snapshot-persistence.zh-CN.md)
- [context-processing-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/context-processing-contracts.zh-CN.md)
- [context-processing-code-flow.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/context-processing-code-flow.zh-CN.md)
- [context-processing-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/context-processing-hardening-todo.zh-CN.md)
- [summarize-reference-for-context-processing.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/references/summarize-reference-for-context-processing.zh-CN.md)

### 知识与记忆治理
- [experience-learning-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/experience-learning-plan.zh-CN.md)
- [knowledge-promotion-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/knowledge-promotion-contract.zh-CN.md)
- [cross-task-memory-reuse-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/cross-task-memory-reuse-plan.zh-CN.md)
- [multi-hop-recall-and-path-explain-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/multi-hop-recall-and-path-explain-plan.zh-CN.md)
- [topic-concept-skill-fusion-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/topic-concept-skill-fusion-plan.zh-CN.md)

### Control Plane 与运维
- [control-plane-service-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-service-contracts.zh-CN.md)
- [control-plane-api-matrix.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-api-matrix.zh-CN.md)
- [control-plane-server-first-pass.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-server-first-pass.zh-CN.md)
- [control-plane-second-pass.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-second-pass.zh-CN.md)
- [governance-workflow-runbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/governance-workflow-runbook.zh-CN.md)
- [dashboard-observability-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/dashboard-observability-contracts.zh-CN.md)
- [observability-metrics-dictionary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/observability-metrics-dictionary.zh-CN.md)
- [multi-source-import-platform-first-pass.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/multi-source-import-platform-first-pass.zh-CN.md)
- [import-source-spec.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/import-source-spec.zh-CN.md)
- [manual-corrections-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/manual-corrections-usage.zh-CN.md)
- [observability-matrix.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/observability-matrix.zh-CN.md)
- [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/gateway-debug-usage.zh-CN.md)
- [debug-playbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/debug-playbook.zh-CN.md)
- [control-plane-release-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/control-plane-release-checklist.zh-CN.md)
- [control-plane-production-runbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/control-plane-production-runbook.zh-CN.md)

### 集成与外部参考
- [openclaw-native-plugin.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/openclaw-native-plugin.zh-CN.md)
- [openclaw-hook-findings.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/openclaw-hook-findings.zh-CN.md)
- [stdio-integration.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/stdio-integration.zh-CN.md)
- [openclaw-external-context-references.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/references/openclaw-external-context-references.zh-CN.md)
- [discussion-notes-2026-03-13.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/references/discussion-notes-2026-03-13.zh-CN.md)

### 目录与文档治理
- [docs-migration-map.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/docs-migration-map.zh-CN.md)
- [docs-contribution-guide.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/docs-contribution-guide.zh-CN.md)
- [glossary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/glossary.zh-CN.md)

## 代码入口
- 上下文处理总入口：[context-processing-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/context-processing-pipeline.ts)
- Control Plane contracts：[contracts.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/contracts.ts)
- Control Plane facade：[control-plane-facade.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/control-plane-facade.ts)
- 导入服务：[import-service.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/import-service.ts)
- OpenClaw adapter：[context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

## 推荐阅读顺序
1. [README.md](/d:/C_Project/openclaw_compact_context/README.md)
2. [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)
3. [stage-6-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-todo.zh-CN.md)
4. [stage-6-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-todo.zh-CN.md)
5. [stage-6-platformization-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-platformization-plan.zh-CN.md)
6. [openclaw-runtime-context-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/openclaw-runtime-context-strategy.zh-CN.md)
7. [control-plane-service-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-service-contracts.zh-CN.md)
8. [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/gateway-debug-usage.zh-CN.md)
