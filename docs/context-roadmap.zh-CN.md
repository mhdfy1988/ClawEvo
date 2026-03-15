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

`阶段 4 第一轮与第二轮主线已完成，阶段 5 第一轮与第二轮也已完成；上下文处理攻坚与其他专项攻坚均已完成收口。`

已经完成的阶段：

- 阶段 1：稳定闭环
- 阶段 2：源头治理与结构提升
- 阶段 3：Schema / Conflict / Trace 治理收敛
- 阶段 4 第一轮：relation recall 扩边、memory lifecycle、scope promotion、evaluation harness、Topic / Concept hint
- 阶段 4 第二轮：context-processing contract、utterance parsing、semantic spans、concept normalization、experience learning、compiler summary contract
- 阶段 5 第一轮：多跳 recall、workspace reuse、知识晋升执行器、受控 topic admission、人工校正 helper、observability snapshot
- 阶段 5 第二轮：path budget / pruning / ranking、workspace -> global 治理、deeper pattern lifecycle、correction trace、observability trend

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
- 让 compiler 更像裁决器，而不是自由摘要器

状态：已完成

### 阶段 3

目标：
- 把 `Schema / Conflict / Trace` 做成统一治理主线
- 让 relation-aware recall 第一轮进入主链
- 打通 persistence trace 与 memory lineage

状态：已完成

### 阶段 4 第一轮

目标：
- 稳定 relation whitelist
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
- 让 bundle / summary / inspect_bundle 有固定 contract

状态：已完成

对应文档：
- [stage-4-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-second-pass-status.zh-CN.md)
- [stage-4-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-second-pass-report.zh-CN.md)
- [stage-4-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-second-pass-todo.zh-CN.md)

### 阶段 5 第一轮

目标：
- 让多跳 `relation recall + path explain` 受控接进主链
- 让 `workspace` 级复用、知识晋升执行器、Topic / Concept admission 形成第一轮可用能力
- 补人工校正 helper、阶段级 observability 与阶段 5 evaluation fixture

状态：已完成

对应文档：
- [stage-5-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-status.zh-CN.md)
- [stage-5-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-first-pass-report.zh-CN.md)
- [stage-5-implementation-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-implementation-todo.zh-CN.md)

### 阶段 5 第二轮

目标：
- 做深多跳 recall 的 `path budget / path pruning / ranking`
- 把 `workspace -> global` 的长期记忆治理与 fallback 收紧到主链
- 让 pattern miner、retire / decay / downgrade、人工校正和 observability 趋势化真正可用

状态：已完成

对应文档：
- [stage-5-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-second-pass-status.zh-CN.md)
- [stage-5-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-second-pass-report.zh-CN.md)
- [stage-5-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-second-pass-todo.zh-CN.md)

### 阶段 6

目标：
- 明确 `Runtime Plane / Control Plane / UI Plane`
- 把人工治理、观测、多来源导入收成可运营平台底座
- 在不破坏插件主链的前提下做目录与服务边界重构
- 为未来 Web 控制台与更成熟的长期记忆治理预留稳定 contract

状态：规划中

对应文档：
- [stage-6-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-6-todo.zh-CN.md)
- [context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-engine-design-v2.zh-CN.md)
- [layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/layered-knowledge-graph-architecture.zh-CN.md)

## 当前边界

现在已经有的：

- 多跳 recall、path explain 与路径成本诊断
- `workspace -> global` 的受控高 scope 复用
- 更成熟的 pattern lifecycle 与知识晋升
- 人工校正的持久化、gateway、explain trace
- observability 的趋势化汇总

现在仍然没做成“平台化完成态”的：

- 更自由、更深层的路径搜索与学习型 recall
- 更成熟的 `global` 写入治理与审批
- 产品化的人机协同校正界面
- dashboard 级 observability 展示

## 推荐下一步

当前更合理的顺序是：

1. 以 [stage-5-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-second-pass-status.zh-CN.md) 和 [stage-5-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-second-pass-report.zh-CN.md) 作为新基线。
2. 以 [context-processing-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing-hardening-todo.zh-CN.md) 和 [other-hardening-capability-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/other-hardening-capability-boundary.zh-CN.md) 作为攻坚收口基线。
3. 以 [stage-6-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-6-todo.zh-CN.md) 作为下一阶段执行入口。
4. 阶段 6 优先关注平台化、产品化观测、人机协同治理和更成熟的长期记忆治理。
5. 阶段 6 的第一落点应前移到运行时上下文 contract：
   - `Runtime Context Window Contract`
   - `Prompt Assembly Contract`
   - `Runtime Snapshot Persistence`
6. 在这三类 contract 清晰之前，不建议直接扩 control plane 的产品形态。

## 一句话总结

`项目已经从“把上下文治理做稳”推进到了“让上下文理解、知识晋升、多跳 recall 和人工治理进入主链并可评估”；阶段 5 第二轮与两条 hardening 主线都已收口，下一步该进入阶段 6 规划。`

## 阶段 6 补充口径

阶段 6 除了平台化与分层，还要把一个新的边界说清楚：

`本项目负责上下文处理与 provider-neutral 的运行时上下文结果；OpenClaw 或宿主 adapter 负责最终 provider payload 组装。`

因此阶段 6 最值得优先落的，不只是 control plane，还包括：

1. `Runtime Context Window Contract`
2. `Prompt Assembly Contract`
3. `Runtime Snapshot Persistence`

这三件事会把“上下文怎么获取、怎么观察、怎么在送模前被实际使用”从隐式行为收敛成明确 contract。

配套讨论整理见：

- [openclaw-runtime-context-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/openclaw-runtime-context-strategy.zh-CN.md)
- [openclaw-external-context-references.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/openclaw-external-context-references.zh-CN.md)
