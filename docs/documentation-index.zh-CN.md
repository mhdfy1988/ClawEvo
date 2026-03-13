# 文档总览索引

## 1. 这份文档的作用

这是当前仓库的文档入口页，用来回答三件事：

1. 现在项目做到哪了
2. 某个问题应该先看哪份文档
3. 如果要继续实现或调试，推荐按什么顺序阅读

当前项目状态可以先用一句话概括：

`阶段 2 已完成收口，当前进入阶段 3 准备阶段。`

如果只想先看当前状态，建议先读这三份：
- 当前状态: [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
- 阶段出口: [stage-2-exit-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-exit-report.zh-CN.md)
- 总体路线图: [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)

## 2. 按问题找文档

### 2.1 我想知道“现在做到哪了”

- 当前阶段状态: [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
- 阶段出口报告: [stage-2-exit-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-exit-report.zh-CN.md)
- 阶段 2 收尾 TODO: [stage-2-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-todo.zh-CN.md)
- TODO 模板: [todo-template.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/todo-template.zh-CN.md)
- 路线图与阶段目标: [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
- 阶段 2 执行计划: [stage-2-execution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-execution-plan.zh-CN.md)

### 2.2 我想看“从 hook 到图谱再到 prompt”的全链路

- 总体流程: [hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hook-to-graph-pipeline.zh-CN.md)
- MVP 落地清单: [mvp-implementation-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/mvp-implementation-checklist.zh-CN.md)
- 现有设计说明: [context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-engine-design-v2.zh-CN.md)
- 早期设计背景: [context-engine-design.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-engine-design.zh-CN.md)

### 2.3 我想看“上下文压缩、原文证据、图谱沉淀”的原则

- 原则基线: [context-handling-principles.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-handling-principles.zh-CN.md)
- prompt 压缩思路: [prompt-compression.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/prompt-compression.zh-CN.md)
- 讨论纪要: [discussion-notes-2026-03-13.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/discussion-notes-2026-03-13.zh-CN.md)

### 2.4 我想看 provenance、raw/compressed/derived 的设计

- provenance 方案: [provenance-schema-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/provenance-schema-plan.zh-CN.md)
- 流程里的 provenance 落点: [hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hook-to-graph-pipeline.zh-CN.md)
- 当前阶段完成度: [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)

### 2.4A 我想看多层知识图谱架构

- 多层图谱架构方案: [layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/layered-knowledge-graph-architecture.zh-CN.md)
- Schema 治理方案: [schema-governance-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/schema-governance-plan.zh-CN.md)
- 冲突消解方案: [conflict-resolution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/conflict-resolution-plan.zh-CN.md)
- Traceability 方案: [traceability-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/traceability-plan.zh-CN.md)
- 现版总体设计: [context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-engine-design-v2.zh-CN.md)
- Hook 到图谱主链: [hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hook-to-graph-pipeline.zh-CN.md)

### 2.5 我想看 tool result 治理

- tool result 策略: [tool-result-policy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/tool-result-policy.zh-CN.md)
- 阶段 2 出口结果: [stage-2-exit-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-exit-report.zh-CN.md)
- 阶段 2 执行计划: [stage-2-execution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-execution-plan.zh-CN.md)

### 2.6 我想调试“为什么这条上下文进了或没进 bundle”

- Gateway 调试入口: [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/gateway-debug-usage.zh-CN.md)
- 场景化排查手册: [debug-playbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/debug-playbook.zh-CN.md)
- Smoke 与故障注入检查表: [fault-injection-smoke-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/fault-injection-smoke-checklist.zh-CN.md)

### 2.7 我想确认 OpenClaw 插件接入方式

- 原生插件接入说明: [openclaw-native-plugin.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/openclaw-native-plugin.zh-CN.md)
- plugin API 合同: [plugin-api-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/plugin-api-contract.zh-CN.md)
- stdio 背景方案: [stdio-integration.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stdio-integration.zh-CN.md)
- hook 发现记录: [openclaw-hook-findings.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/openclaw-hook-findings.zh-CN.md)

## 3. 按阅读顺序看

### 3.1 新加入项目，先建立全局认知

建议顺序：
1. [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
2. [stage-2-exit-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-exit-report.zh-CN.md)
3. [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
4. [hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hook-to-graph-pipeline.zh-CN.md)
5. [layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/layered-knowledge-graph-architecture.zh-CN.md)

### 3.2 准备继续做阶段 3

建议顺序：
1. [stage-2-exit-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-exit-report.zh-CN.md)
2. [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
3. [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
4. [provenance-schema-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/provenance-schema-plan.zh-CN.md)
5. [fault-injection-smoke-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/fault-injection-smoke-checklist.zh-CN.md)
6. [layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/layered-knowledge-graph-architecture.zh-CN.md)

### 3.3 排查“为什么上下文理解不对”

建议顺序：
1. [debug-playbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/debug-playbook.zh-CN.md)
2. [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/gateway-debug-usage.zh-CN.md)
3. [context-handling-principles.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-handling-principles.zh-CN.md)
4. [fault-injection-smoke-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/fault-injection-smoke-checklist.zh-CN.md)

## 4. 当前最值得维护的主文档

后面如果继续校正文档，优先保证这几份和代码状态同步：
- 当前状态: [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
- 阶段出口: [stage-2-exit-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-exit-report.zh-CN.md)
- 路线图与阶段目标: [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
- 全链路流程: [hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hook-to-graph-pipeline.zh-CN.md)
- 交付/工作流拆解: [context-engine-delivery-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-engine-delivery-plan.zh-CN.md)
- 调试入口: [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/gateway-debug-usage.zh-CN.md)
- 回归与 smoke: [fault-injection-smoke-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/fault-injection-smoke-checklist.zh-CN.md)

## 5. 一句话总结

如果只记一个入口，就从这里开始：

[documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)
