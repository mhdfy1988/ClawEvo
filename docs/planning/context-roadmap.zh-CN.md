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

`阶段 4 第一轮与第二轮主线已完成，阶段 5 第一轮与第二轮已完成；阶段 6 第一轮与第二轮也已完成。下一步进入阶段 7-9 的平台化深化路线。`

已经完成的阶段：

- 阶段 1：稳定闭环
- 阶段 2：源头治理与结构提升
- 阶段 3：Schema / Conflict / Trace 治理收敛
- 阶段 4 第一轮：relation recall 扩边、memory lifecycle、scope promotion、evaluation harness、Topic / Concept hint
- 阶段 4 第二轮：context-processing contract、utterance parsing、semantic spans、concept normalization、experience learning、compiler summary contract
- 阶段 5 第一轮：多跳 recall、workspace reuse、知识晋升执行器、受控 topic admission、人工校正 helper、observability snapshot
- 阶段 5 第二轮：path budget / pruning / ranking、workspace -> global 治理、deeper pattern lifecycle、correction trace、observability trend
- 阶段 6 第一轮：runtime context contract、control-plane services、人工治理第一轮、dashboard observability 第一轮、import platform 第一轮、目录分层第一轮
- 阶段 6 第二轮：import history / retry / rerun / scheduler、dashboard snapshot history、control-plane facade、runtime snapshot 联动、root export 收紧、第二轮状态与基线更新

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
- [stage-4-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-status.zh-CN.md)
- [stage-4-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-first-pass-report.zh-CN.md)
- [stage-4-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-todo.zh-CN.md)

### 阶段 4 第二轮

目标：
- 把“自然语言上下文 -> 语义原子 -> 图谱节点/边 -> compiler / explain / evaluation”补成稳定主链
- 把 `Attempt / Episode / FailureSignal / ProcedureCandidate` 接进图谱、沉淀与评估
- 让 bundle / summary / inspect_bundle 有固定 contract

状态：已完成

对应文档：
- [stage-4-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-second-pass-status.zh-CN.md)
- [stage-4-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-second-pass-report.zh-CN.md)
- [stage-4-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-second-pass-todo.zh-CN.md)

### 阶段 5 第一轮

目标：
- 让多跳 `relation recall + path explain` 受控接进主链
- 让 `workspace` 级复用、知识晋升执行器、Topic / Concept admission 形成第一轮可用能力
- 补人工校正 helper、阶段级 observability 与阶段 5 evaluation fixture

状态：已完成

对应文档：
- [stage-5-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-status.zh-CN.md)
- [stage-5-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-first-pass-report.zh-CN.md)
- [stage-5-implementation-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-implementation-todo.zh-CN.md)

### 阶段 5 第二轮

目标：
- 做深多跳 recall 的 `path budget / path pruning / ranking`
- 把 `workspace -> global` 的长期记忆治理与 fallback 收紧到主链
- 让 pattern miner、retire / decay / downgrade、人工校正和 observability 趋势化真正可用

状态：已完成

对应文档：
- [stage-5-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-second-pass-status.zh-CN.md)
- [stage-5-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-second-pass-report.zh-CN.md)
- [stage-5-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-second-pass-todo.zh-CN.md)

### 阶段 6

目标：
- 明确 `Runtime Plane / Control Plane / UI Plane`
- 把人工治理、观测、多来源导入收成可运营平台底座
- 在不破坏插件主链的前提下做目录与服务边界重构
- 为未来 Web 控制台与更成熟的长期记忆治理预留稳定 contract

状态：第一轮与第二轮已完成

对应文档：
- [stage-6-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-todo.zh-CN.md)
- [stage-6-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-todo.zh-CN.md)
- [stage-6-first-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-first-pass-status.zh-CN.md)
- [stage-6-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-first-pass-report.zh-CN.md)
- [stage-6-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-status.zh-CN.md)
- [stage-6-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-report.zh-CN.md)
- [context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-design-v2.zh-CN.md)
- [layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/layered-knowledge-graph-architecture.zh-CN.md)

### 阶段 7

目标：
- 把 `control-plane` 从插件内能力推进到独立 API / process 形态
- 做最小 Web console
- 建立 importer registry 与 source catalog 第一轮
- 推进目录重构第二轮

状态：规划中

对应文档：
- [stage-7-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-todo.zh-CN.md)
- [stage-7-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-status.zh-CN.md)
- [stage-7-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-report.zh-CN.md)

### 阶段 8

目标：
- 把治理、导入、观测做成更接近生产级的平台
- 深化 source-specific importer
- 完成更成熟的控制台、告警、历史与 runbook
- 建立平台级回归与运维基线

状态：规划中

对应文档：
- [stage-8-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-todo.zh-CN.md)
- [stage-8-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-status.zh-CN.md)
- [stage-8-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-report.zh-CN.md)

### 阶段 9

目标：
- 推进开放插件 / importer 生态
- 做更高阶的自治优化与全局知识治理
- 支持多工作区 / 多租户和外部系统接入
- 把平台从“项目内控制面”推进成“开放知识平台”

状态：规划中

对应文档：
- [stage-9-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-9-todo.zh-CN.md)

## 当前边界

现在已经有的：

- 多跳 recall、path explain 与路径成本诊断
- `workspace -> global` 的受控高 scope 复用
- 更成熟的 pattern lifecycle 与知识晋升
- 人工校正的持久化、gateway、explain trace
- observability 的历史趋势与 dashboard snapshot
- import 的 history / retry / rerun / scheduler
- `control-plane-facade`

现在仍然没做成“平台化完成态”的：

- 独立 control-plane 进程级 API
- Web UI / console
- 更成熟的 `global` 写入治理与审批
- 真正的 source-specific importer 与 source catalog
- 更深的物理目录迁移与内部 API 收敛

## 推荐下一步

当前更合理的顺序是：

1. 以 [stage-6-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-status.zh-CN.md) 和 [stage-6-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-report.zh-CN.md) 作为新基线。
2. 把阶段 6 看作“控制面底座完成态”，而不是“还在起步”。
3. 阶段 7 优先关注独立 control-plane API / process、最小 Web console、importer registry 与目录迁移第二轮。
4. 阶段 8 重点推进生产级治理、导入平台化和运维化 observability。
5. 阶段 9 再推进开放生态、全局知识治理、多工作区能力和自治优化。

## 一句话总结

`项目已经从“把上下文治理做稳”推进到了“让控制面、导入治理、历史观测和运行时联动真正成型”；阶段 6 第一轮与第二轮都已完成，当前进入阶段 7、8、9 的平台化深化路线。`
