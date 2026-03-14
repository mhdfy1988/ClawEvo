# 文档索引
当前项目状态可以先用一句话概括：

`阶段 5 第一轮与第二轮已完成；上下文处理攻坚专项已收口，后续建议转入其他攻坚主线或新一轮深化。`

## 先看这几份
- 当前状态：[stage-5-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-status.zh-CN.md)
- 路线图：[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
- 总攻坚路线图：[hardening-master-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hardening-master-roadmap.zh-CN.md)
- 主链流程：[hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hook-to-graph-pipeline.zh-CN.md)
- OpenClaw 插件入口：[openclaw-native-plugin.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/openclaw-native-plugin.zh-CN.md)

## 按主题找文档

### 项目状态与阶段报告
- [stage-4-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-status.zh-CN.md)
- [stage-4-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-second-pass-status.zh-CN.md)
- [stage-5-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-status.zh-CN.md)
- [stage-5-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-second-pass-status.zh-CN.md)
- [stage-5-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-first-pass-report.zh-CN.md)
- [stage-5-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-second-pass-report.zh-CN.md)

### 主链设计与知识图谱
- [context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-engine-design-v2.zh-CN.md)
- [hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hook-to-graph-pipeline.zh-CN.md)
- [layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/layered-knowledge-graph-architecture.zh-CN.md)
- [schema-governance-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/schema-governance-plan.zh-CN.md)
- [conflict-resolution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/conflict-resolution-plan.zh-CN.md)
- [traceability-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/traceability-plan.zh-CN.md)

### 上下文处理与压缩
- [context-handling-principles.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-handling-principles.zh-CN.md)
- [context-processing-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing-contracts.zh-CN.md)
- [context-processing-code-flow.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing-code-flow.zh-CN.md)
- [context-processing-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing-hardening-todo.zh-CN.md)
- [summarize-reference-for-context-processing.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/summarize-reference-for-context-processing.zh-CN.md)

### 试错学习、知识晋升与长期记忆
- [experience-learning-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/experience-learning-plan.zh-CN.md)
- [knowledge-promotion-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge-promotion-contract.zh-CN.md)
- [cross-task-memory-reuse-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/cross-task-memory-reuse-plan.zh-CN.md)
- [multi-hop-recall-and-path-explain-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/multi-hop-recall-and-path-explain-plan.zh-CN.md)
- [topic-concept-skill-fusion-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/topic-concept-skill-fusion-plan.zh-CN.md)

### 调试、评估与观测
- [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/gateway-debug-usage.zh-CN.md)
- [debug-playbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/debug-playbook.zh-CN.md)
- [fault-injection-smoke-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/fault-injection-smoke-checklist.zh-CN.md)
- [stage-4-evaluation-harness.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-evaluation-harness.zh-CN.md)
- [observability-human-in-the-loop-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/observability-human-in-the-loop-plan.zh-CN.md)

### 攻坚专项
- [hardening-master-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hardening-master-roadmap.zh-CN.md)
- [context-processing-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing-hardening-todo.zh-CN.md)
- [other-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/other-hardening-todo.zh-CN.md)

## 代码入口
- 上下文处理总入口：[context-processing-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/context-processing-pipeline.ts)
- 噪音治理：[noise-policy.ts](/d:/C_Project/openclaw_compact_context/src/core/noise-policy.ts)
- 总结候选层：[summary-planner.ts](/d:/C_Project/openclaw_compact_context/src/core/summary-planner.ts)
- 语义分类：[semantic-classifier.ts](/d:/C_Project/openclaw_compact_context/src/core/semantic-classifier.ts)
- 节点物化：[semantic-node-materializer.ts](/d:/C_Project/openclaw_compact_context/src/core/semantic-node-materializer.ts)
- 上下文处理专项评估：[context-processing-harness.ts](/d:/C_Project/openclaw_compact_context/src/evaluation/context-processing-harness.ts)

## 推荐阅读顺序
1. [README.md](/d:/C_Project/openclaw_compact_context/README.md)
2. [stage-5-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-status.zh-CN.md)
3. [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
4. [hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hook-to-graph-pipeline.zh-CN.md)
5. [context-processing-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing-contracts.zh-CN.md)
6. [context-processing-code-flow.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing-code-flow.zh-CN.md)
7. [context-processing-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing-hardening-todo.zh-CN.md)
