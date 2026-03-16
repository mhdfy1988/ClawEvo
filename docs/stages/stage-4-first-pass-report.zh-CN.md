# 阶段 4 第一轮总结

## 目标
阶段 4 第一轮的目标不是“做完整长期记忆平台”，而是把阶段 3 收敛出来的治理主链继续往前推一轮，重点验证 5 件事：

1. relation 可以从 `supported_by` 扩到更高价值边
2. relation retrieval 不会把 compile / explain 成本打散
3. 长期记忆开始有最小生命周期，而不是只堆对象
4. scope 升级边界有明确治理口径
5. 阶段 4 开始有自己的评估基座

## 这一轮实际完成了什么

### 1. Relation recall 从一条边扩到一组高价值边
这轮不再只消费 `supported_by`，而是把下面这批边纳入稳定 contract：
- `supported_by`
- `requires`
- `next_step`
- `overrides`

其中：
- `supported_by` 继续承担 evidence recall
- `requires` 开始为 `Rule / Constraint / Mode` 提供 recall boost
- `next_step` 开始参与 current process 的关系增强
- `overrides` 进入 relation-aware 的治理闭环

### 2. Relation retrieval 有了最小成本模型
这轮不是简单“多查边”，而是把 retrieval 方式也治理起来：
- 支持 batch adjacency
- 单源时允许 single-source fallback
- diagnostics 能输出 relation retrieval 策略、lookup 次数和 edge type

这让 relation recall 不再只是“能用”，而是“可解释、可回归、可继续扩”

### 3. Skill lifecycle 从 lineage 进到 merge / retire 原型
这轮把 skill candidate 从“带来源链路的派生产物”推进到了“有生命周期状态的记忆对象”：
- 支持重复 candidate merge
- 支持被替换 lineage retire
- 支持 decay state 进入 stale
- explain 能看到 merged / retired 的状态

这还不是长期记忆平台终态，但它已经不是“只会新增，不会治理”的状态了

### 4. Scope promotion policy 进入主链
这轮把 `session / workspace / global` 从隐式约定提升成显式治理：
- write authority 明确
- recall tier 明确
- recall precedence 明确
- explain 能说明 higher-scope fallback

### 5. Evaluation harness 建起来了
这轮开始有阶段级评估基座，已覆盖：
- relation recall precision / recall / noise
- memory usefulness / intrusion
- bundle quality
- explain completeness
- retrieval cost

## 代码侧最重要的交付
- relation contract：[relation-contract.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/relation-contract.ts)
- relation-aware compiler：[context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
- structured relation ingest：[ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
- lifecycle 合同：[memory-lifecycle.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/memory-lifecycle.ts)
- skill merge / retire 原型：[skill-crystallizer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/skill-crystallizer.ts)
- trace / explain 收口：[audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
- gateway 展示层：[context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- 评估基座：[evaluation-harness.ts](/d:/C_Project/openclaw_compact_context/internal/evaluation/evaluation-harness.ts)

## 验证结果
- `npm test` 通过
- 全量测试：`64` 项通过
- `npm run test:evaluation` 通过
- evaluation harness：`2` 项通过

新增覆盖重点包括：
- `requires / next_step` recall 回归
- `Topic / Concept` hint 保留回归
- skill merge / retire 与 SQLite round-trip
- explain 对 relation / lifecycle / topic hint 的输出

## 这一轮最大的收益
阶段 4 第一轮最大的收益，不是“又长了一层图谱”，而是：

- 关系扩边开始有 contract，而不是散点接入
- 长期记忆开始有 lifecycle，而不是只会沉淀
- Topic / Concept 开始接入，但仍被约束成 hint，不会反向污染主链
- 评估开始从 smoke 回归推进到阶段级 harness

也就是说，系统已经从：

`能治理、能编译、能追查`

继续推进到了：

`能扩边、能治理记忆、能评估增强是否真的有价值`

## 仍然不该高估的地方
阶段 4 第一轮完成后，系统仍然不应该被描述成：
- 完整的多跳图推理系统
- 完整的长期记忆平台
- 完整的主题层驱动 recall 系统

当前更准确的边界仍然是：
- Topic / Concept 只做 hint
- relation recall 仍以一跳高价值边为主
- skill merge / retire 还是第一轮原型

## 下一步建议
建议下一步把问题收敛到这 3 条之一：

1. 多跳 relation recall 的进入条件与 path explain
2. Skill / Topic / Concept 的长期 admission 策略
3. 阶段级观测与评估结果沉淀

## 一句话结论
`阶段 4 第一轮的价值，是把“关系扩边、长期记忆治理、阶段级评估”都真正接进了主链，但仍然把它们控制在可解释、可回归、可治理的范围内。`



