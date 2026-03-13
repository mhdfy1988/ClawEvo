# 阶段 4 状态

## 当前结论
当前最准确的判断是：

`阶段 4 第一轮已完成，TODO 1-8 全部收口；项目适合进入“阶段 4 第二轮增强规划”或“阶段 5 预研整理”阶段。`

这意味着：
- 阶段 4 已不再停留在准备或起步状态
- `relation recall / memory lifecycle / scope promotion / evaluation harness / Topic & Concept hint` 已全部进入主链
- 当前更适合做下一轮增强方向收敛，而不是继续把第一轮 TODO 拖长

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
- [relation-contract.ts](/d:/C_Project/openclaw_compact_context/src/core/relation-contract.ts)
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/ingest-pipeline.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts)

### 2. Relation retrieval 成本控制
- 已增加批量 adjacency 读取
- 已补 relation retrieval diagnostics
- 已让 compile / explain 共享最小成本视图
- SQLite 已补充 relation 相关索引

对应代码：
- [graph-store.ts](/d:/C_Project/openclaw_compact_context/src/core/graph-store.ts)
- [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/src/core/sqlite-graph-store.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts)

### 3. 长期记忆生命周期第一轮
- 已补最小 `promotion / merge / retire / decay`
- `SkillCandidate` 已能 merge
- 被替换 lineage 会进入 retire / stale
- explain 已能看见 merged / retired lifecycle

对应代码：
- [memory-lifecycle.ts](/d:/C_Project/openclaw_compact_context/src/core/memory-lifecycle.ts)
- [skill-crystallizer.ts](/d:/C_Project/openclaw_compact_context/src/core/skill-crystallizer.ts)
- [context-engine.ts](/d:/C_Project/openclaw_compact_context/src/engine/context-engine.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts)

### 4. Scope promotion policy
- 已显式治理 `session / workspace / global`
- compiler 已按 scope precedence 裁决
- explain 已能输出 higher-scope fallback reason

对应代码：
- [scope-policy.ts](/d:/C_Project/openclaw_compact_context/src/core/scope-policy.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts)
- [trace-view.ts](/d:/C_Project/openclaw_compact_context/src/core/trace-view.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

### 5. Evaluation harness
- 已建立阶段 4 的评估基座
- 已覆盖 relation recall / memory quality / bundle quality / explain completeness / retrieval cost
- 已接入 `npm run test:evaluation`

对应文档：
- [stage-4-evaluation-harness.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-evaluation-harness.zh-CN.md)

### 6. Topic / Concept 最小接入
- 已有最小 `Topic / Concept` 节点模型
- 已进入 compiler diagnostics 的 `topicHints`
- 目前仍保留为“hint”，不会主导主 bundle
- explain 已能说明为什么只作为 hint 保留

对应代码：
- [core.ts](/d:/C_Project/openclaw_compact_context/src/types/core.ts)
- [governance.ts](/d:/C_Project/openclaw_compact_context/src/core/governance.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts)

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
- 全量测试：`64` 项通过
- `npm run test:evaluation` 通过
- evaluation harness：`2` 项通过

## 推荐下一步
更自然的下一步已经不是继续补阶段 4 第一轮，而是二选一：

1. 新起“阶段 4 第二轮增强 TODO”
2. 先做“阶段 5 预研 TODO”，专门收敛长期主题层、多跳 recall 和跨任务复用

## 一句话结论
`阶段 4 第一轮已经完成；当前更适合进入下一轮增强规划，而不是继续把第一轮 TODO 拖成长期 backlog。`
