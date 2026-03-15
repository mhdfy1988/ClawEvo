# 阶段 4 状态

## 当前结论
当前最准确的判断是：

`阶段 4 第一轮与第二轮主线都已完成；阶段 5 预研也已完成第一轮收敛。`

这意味着：
- 阶段 4 已不再停留在准备或起步状态
- 第一轮的 `relation recall / memory lifecycle / scope promotion / evaluation harness / Topic & Concept hint` 已全部进入主链
- 第二轮的 `utterance parsing / semantic spans / concept normalization / experience learning / compiler summary contract` 也已进入主链
- 当前更适合把剩余远期项转入阶段 5 正式实现规划，而不是继续把阶段 4 拉长

## 第一轮已完成的范围

### 1. Relation 治理与高价值 recall 扩边
- 已收敛 relation production contract
- 已明确 `recall_eligible / explain_only / governance_only`
- compiler 已稳定消费：
  - `supported_by`
  - `requires`
  - `next_step`
  - `overrides`
- diagnostics / explain 已能说明 relation contribution

对应代码：
- [relation-contract.ts](/d:/C_Project/openclaw_compact_context/src/governance/relation-contract.ts)
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/runtime/ingest-pipeline.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/runtime/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/runtime/audit-explainer.ts)

### 2. Relation retrieval 成本控制
- 已增加批量 adjacency 读取
- 已补 relation retrieval diagnostics
- 已让 compile / explain 共享最小成本视图
- SQLite 已补充 relation 相关索引

对应代码：
- [graph-store.ts](/d:/C_Project/openclaw_compact_context/src/infrastructure/graph-store.ts)
- [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/src/infrastructure/sqlite-graph-store.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/runtime/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/runtime/audit-explainer.ts)

### 3. 长期记忆生命周期第一轮
- 已补最小 `promotion / merge / retire / decay`
- `SkillCandidate` 已能 merge
- 被替换 lineage 会进入 retire / stale
- explain 已能看见 merged / retired lifecycle

对应代码：
- [memory-lifecycle.ts](/d:/C_Project/openclaw_compact_context/src/governance/memory-lifecycle.ts)
- [skill-crystallizer.ts](/d:/C_Project/openclaw_compact_context/src/runtime/skill-crystallizer.ts)
- [context-engine.ts](/d:/C_Project/openclaw_compact_context/src/engine/context-engine.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/runtime/audit-explainer.ts)

### 4. Scope promotion policy
- 已显式治理 `session / workspace / global`
- compiler 已按 scope precedence 裁决
- explain 已能输出 higher-scope fallback reason

对应代码：
- [scope-policy.ts](/d:/C_Project/openclaw_compact_context/src/governance/scope-policy.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/runtime/context-compiler.ts)
- [trace-view.ts](/d:/C_Project/openclaw_compact_context/src/runtime/trace-view.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

### 5. Evaluation harness
- 已建立阶段 4 的评估基座
- 已覆盖 relation recall / memory quality / bundle quality / explain completeness / retrieval cost
- 已接入 `npm run test:evaluation`

对应文档：
- [stage-4-evaluation-harness.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-evaluation-harness.zh-CN.md)

### 6. Topic / Concept 最小接入
- 已有最小 `Topic / Concept` 节点模型
- 已进入 compiler diagnostics 的 `topicHints`
- 目前仍保留为“hint”，不会主导主 bundle
- explain 已能说明为什么只作为 hint 保留

对应代码：
- [core.ts](/d:/C_Project/openclaw_compact_context/src/types/core.ts)
- [governance.ts](/d:/C_Project/openclaw_compact_context/src/governance/governance.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/runtime/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/runtime/audit-explainer.ts)

## 第一轮出口条件判断

### 已满足
- 高价值 relation 已有稳定 whitelist
- relation retrieval 成本已有批量与诊断口径
- memory lifecycle 已有最小治理闭环
- scope promotion 已明确边界和 recall 优先级
- evaluation harness 已能跑通
- Topic / Concept 已最小接入但不反向污染主链

### 仍然保留的边界
- 多跳 relation recall 还没进入主链
- Topic / Concept 仍是 hint，不是主 bundle 主导层
- Skill merge / retire 仍是第一轮原型，不是长期记忆平台终态
- 阶段级指标仍以测试与报告为主，观测面板还没有产品化

## 验证结果
- `npm test` 通过
- 全量测试：`87` 项通过
- `npm run test:evaluation` 通过
- evaluation harness：`3` 项通过

## 第二轮补充状态

阶段 4 第二轮已经新增并收口：
- 上下文处理契约层
- `Utterance Parser / Clause Splitter`
- `SemanticSpan / EvidenceAnchor`
- bilingual `Concept Normalizer`
- 一条消息产多个语义节点
- `Attempt / Episode / FailureSignal / ProcedureCandidate`
- compiler summary / reason contract
- 上下文处理专项 evaluation harness

对应文档：
- [stage-4-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-second-pass-status.zh-CN.md)
- [stage-4-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-second-pass-report.zh-CN.md)
- [stage-4-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-second-pass-todo.zh-CN.md)

## 推荐下一步
更自然的下一步已经不是继续补阶段 4，而是直接进入阶段 5 正式实现规划：

1. 新起“阶段 5 正式实现 TODO”
2. 在多跳 recall 与高 scope 记忆之间选一条先落主链
3. 保持第二轮 context-processing 主链稳定

对应入口：
- [stage-5-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-prework.zh-CN.md)
- [stage-5-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-status.zh-CN.md)
- [stage-5-pre-research-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-pre-research-report.zh-CN.md)
- [stage-5-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-todo.zh-CN.md)

## 一句话结论
`阶段 4 已经从“治理与增强入口”推进到“上下文理解主链可运行、可解释、可评估”的状态；阶段 5 预研也已完成，下一步更适合进入正式实现规划。`


