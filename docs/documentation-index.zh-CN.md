# 文档总览索引

## 1. 这份文档的用途

这是一份面向当前仓库的文档入口页，用来回答三件事：

1. 现在项目做到哪了
2. 某个问题应该先看哪份文档
3. 如果要继续实现，推荐按什么顺序阅读

当前项目状态可以先用一句话概括：

`阶段 2 主干已基本打通，当前进入收尾与质量补齐阶段。`

如果你只想先看当前状态，建议先读这两份：

- 阶段状态: [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
- 路线图: [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)

---

## 2. 按问题找文档

### 2.1 我想知道“现在做到哪了”

- 阶段状态总览: [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
- 路线图与阶段目标: [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
- 阶段 2 原始执行计划与当前收尾顺序: [stage-2-execution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-execution-plan.zh-CN.md)
- 交付视角的工作流拆解: [context-engine-delivery-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-engine-delivery-plan.zh-CN.md)

### 2.2 我想看“从 hook 到图谱再到 prompt”的全链路

- 总体流程: [hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hook-to-graph-pipeline.zh-CN.md)
- MVP 级落地清单: [mvp-implementation-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/mvp-implementation-checklist.zh-CN.md)
- 现有设计说明: [context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-engine-design-v2.zh-CN.md)
- 早期设计背景: [context-engine-design.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-engine-design.zh-CN.md)

### 2.3 我想看“上下文压缩、原文证据、图谱沉淀”的原则

- 原则基线: [context-handling-principles.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-handling-principles.zh-CN.md)
- prompt 压缩思路: [prompt-compression.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/prompt-compression.zh-CN.md)
- 讨论纪要: [discussion-notes-2026-03-13.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/discussion-notes-2026-03-13.zh-CN.md)

### 2.4 我想看 provenance、raw/compressed/derived 的设计

- provenance 方案: [provenance-schema-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/provenance-schema-plan.zh-CN.md)
- 流程里 provenance 的落点: [hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hook-to-graph-pipeline.zh-CN.md)
- 当前阶段完成度: [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)

### 2.5 我想看 tool result 治理

- tool result 策略: [tool-result-policy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/tool-result-policy.zh-CN.md)
- 阶段 2 执行计划中的对应迭代: [stage-2-execution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-execution-plan.zh-CN.md)
- 当前还剩哪些收尾项: [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)

### 2.6 我想调试“为什么这条上下文进了或没进 bundle”

- Gateway 调试入口: [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/gateway-debug-usage.zh-CN.md)
- 场景化排查手册: [debug-playbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/debug-playbook.zh-CN.md)
- Smoke 与故障注入检查表: [fault-injection-smoke-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/fault-injection-smoke-checklist.zh-CN.md)

### 2.7 我想确认 OpenClaw 插件接入方式

- 原生插件接入说明: [openclaw-native-plugin.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/openclaw-native-plugin.zh-CN.md)
- plugin API 合同: [plugin-api-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/plugin-api-contract.zh-CN.md)
- stdio 方案背景: [stdio-integration.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stdio-integration.zh-CN.md)
- hook 发现记录: [openclaw-hook-findings.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/openclaw-hook-findings.zh-CN.md)

---

## 3. 按阅读顺序看

### 3.1 新加入项目，想先建立全局认知

建议顺序：

1. [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
2. [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
3. [hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hook-to-graph-pipeline.zh-CN.md)
4. [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/gateway-debug-usage.zh-CN.md)

### 3.2 准备继续开发阶段 2 收尾项

建议顺序：

1. [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
2. [stage-2-execution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-execution-plan.zh-CN.md)
3. [tool-result-policy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/tool-result-policy.zh-CN.md)
4. [provenance-schema-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/provenance-schema-plan.zh-CN.md)
5. [fault-injection-smoke-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/fault-injection-smoke-checklist.zh-CN.md)

### 3.3 排查“为什么上下文理解不对”

建议顺序：

1. [debug-playbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/debug-playbook.zh-CN.md)
2. [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/gateway-debug-usage.zh-CN.md)
3. [context-handling-principles.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-handling-principles.zh-CN.md)
4. [fault-injection-smoke-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/fault-injection-smoke-checklist.zh-CN.md)

---

## 4. 当前最值得维护的主文档

如果后面还要继续校正文档，优先保证下面几份和代码状态同步：

- 当前状态: [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)
- 路线与阶段目标: [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
- 全链路流程: [hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hook-to-graph-pipeline.zh-CN.md)
- 交付/工作流拆解: [context-engine-delivery-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-engine-delivery-plan.zh-CN.md)
- 调试入口: [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/gateway-debug-usage.zh-CN.md)
- 回归与 smoke: [fault-injection-smoke-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/fault-injection-smoke-checklist.zh-CN.md)

---

## 5. 一句话总结

如果只记一个入口，就从这里开始：

[documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)
