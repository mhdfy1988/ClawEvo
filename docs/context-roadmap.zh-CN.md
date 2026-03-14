# Context Engine 路线图

## 北极星目标
这个项目的长期目标不是“做一个更聪明的摘要器”，而是：

`把 OpenClaw 的上下文治理做成一条可追溯、可压缩、可编译、可沉淀、可评估的主链。`

主链形态保持不变：

```text
hook / transcript / tool result
-> ingest
-> graph + provenance
-> runtime bundle compile
-> prompt assemble
-> checkpoint / delta / skill candidate
```

## 当前状态
当前最准确的判断是：

`阶段 4 第一轮与第二轮主线已完成，阶段 5 第一轮正式实现已完成。`

已经完成的阶段：
- 阶段 1：稳定闭环
- 阶段 2：源头治理与结构提升
- 阶段 3：治理收敛、relation-aware recall 第一轮、trace / memory lineage
- 阶段 4 第一轮：relation recall 扩边、memory lifecycle 原型、scope promotion、evaluation harness、Topic / Concept hint
- 阶段 4 第二轮：context-processing contract、utterance parsing、semantic spans、concept normalization、experience learning、compiler summary contract

## 分阶段目标

### 阶段 1
目标：
- 建立从 ingest 到 compile 到 checkpoint 的最小闭环
- 显式区分 `raw / compressed / derived`
- 让 explain 不再是黑盒

状态：已完成

### 阶段 2
目标：
- 用 `tool_result_persist` 从源头控制 transcript 膨胀
- 提升 ingest 结构化质量
- 让 compiler 更像裁决器而不是摘要器

状态：已完成

### 阶段 3
目标：
- 把 `Schema / Conflict / Trace` 做成统一治理主线
- 让 relation-aware recall 第一轮进入主链
- 打通 persistence trace 和 memory lineage

状态：已完成

### 阶段 4 第一轮
目标：
- 扩 relation whitelist
- 建立 relation retrieval 成本模型
- 建立 memory lifecycle 第一轮
- 明确 scope promotion 边界
- 建立 evaluation harness
- 接入最小 Topic / Concept hint

状态：已完成

对应文档：
- [stage-4-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-status.zh-CN.md)
- [stage-4-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-first-pass-report.zh-CN.md)
- [stage-4-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-todo.zh-CN.md)

### 阶段 4 第二轮
目标：
- 把“自然语言上下文 -> 语义原子 -> 图谱节点/边 -> compiler / explain / evaluation”补成稳定主链
- 把 `Attempt / Episode / FailureSignal / ProcedureCandidate` 接进图谱、沉淀与评估
- 让 bundle / summary / inspect_bundle 具备固定 contract，而不是依赖自由摘要

状态：已完成

对应文档：
- [stage-4-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-second-pass-status.zh-CN.md)
- [stage-4-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-second-pass-report.zh-CN.md)
- [stage-4-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-second-pass-todo.zh-CN.md)

### 阶段 5 第一轮
目标：
- 把多跳 `relation recall + path explain` 受控接进主链
- 把 `workspace` 级复用、知识晋升执行器、Topic / Concept admission 做成第一轮可用能力
- 补人工校正 helper、阶段级 observability 与阶段 5 evaluation fixture

状态：已完成

对应文档：
- [stage-5-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-status.zh-CN.md)
- [stage-5-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-first-pass-report.zh-CN.md)
- [stage-5-implementation-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-implementation-todo.zh-CN.md)

## 阶段 4 之后更适合做什么

### 方向 1：阶段 5 预研
更适合先做文档和设计：
- 跨任务记忆复用
- workspace / global 级长期记忆治理
- Skill / Topic / Concept 的长期融合策略
- 试错学习的知识晋升合同：`Attempt -> Episode -> Pattern -> Skill / Rule / Process`
- 失败经验与成功流程的长期治理：`FailurePattern / SuccessfulProcedure / CriticalStep`
- 观测面板与阶段级报告

当前状态：已完成第一轮预研收敛。

对应文档：
- [stage-5-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-prework.zh-CN.md)
- [stage-5-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-status.zh-CN.md)
- [stage-5-pre-research-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-pre-research-report.zh-CN.md)
- [stage-5-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-todo.zh-CN.md)

### 方向 2：阶段 5 第二轮
更适合继续深入的方向：
- 更深一层的多跳路径预算、path pruning 与 path explain
- `workspace -> global` 的长期记忆治理
- 更成熟的 pattern miner、retire / decay / downgrade 策略
- 人工校正入口与 dashboard 产品化

## 当前出口判断
阶段 4 第一轮与第二轮的出口已经满足：
- relation 扩边已进入主链
- relation retrieval 有成本视图
- memory lifecycle 有最小治理闭环
- scope promotion 有明确边界
- evaluation harness 可跑
- Topic / Concept 已接入但仍被限制成 hint
- context-processing contract 已接入主链
- semantic spans / evidence anchors 已可解释
- bilingual concept normalization 已可回归
- experience learning 已进入 compiler / explain / evaluation

## 推荐下一步
当前最合理的顺序是：

1. 以阶段 5 第一轮实现结果为基线
2. 新起“阶段 5 第二轮实现 TODO”
3. 优先在多跳 recall 深化、长期记忆治理、人工校正入口之间排顺序

当前更推荐：
1. 以 [stage-4-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-second-pass-status.zh-CN.md) 和 [stage-4-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-second-pass-report.zh-CN.md) 为第二轮基线
2. 以 [stage-4-evaluation-harness.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-evaluation-harness.zh-CN.md) 作为阶段 4 两轮共同的评估守门器
3. 以 [stage-5-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-status.zh-CN.md) 和 [stage-5-pre-research-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-pre-research-report.zh-CN.md) 作为阶段 5 预研基线
4. 以 [stage-5-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-first-pass-report.zh-CN.md) 作为阶段 5 第一轮实现基线
5. 后续新起“阶段 5 第二轮实现 TODO”

## 一句话总结
`项目已经从“把上下文治理做稳”推进到了“让上下文理解、知识晋升和多跳 recall 进入主链并可评估”；阶段 5 第一轮已完成，下一步适合进入第二轮深化。`
