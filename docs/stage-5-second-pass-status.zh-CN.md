# 阶段 5 第二轮状态

## 当前结论

当前最准确的判断是：

`阶段 5 第二轮 TODO 1-6 已完成；这轮的重点已经从“让能力进入主链”推进到“让能力更稳定、更可治理、更可解释”。`

## 第二轮已完成的范围

### 1. 多跳 recall 做深

- compiler 开始稳定输出 `path budget / path pruning / ranking`
- 多跳 relation retrieval diagnostics 不再只报告命中，还会报告候选、准入、裁剪
- explain 可以看到完整的 path 选择与裁剪原因

### 2. `workspace -> global` 长期记忆治理

- `workspace` 级稳定模式可以在满足条件时晋升到 `global`
- compiler 会把 `global` 作为受控 fallback，而不是默认主来源
- explain 会保留 scope fallback 与 provenance trace

### 3. pattern miner 与知识晋升深化

- `Pattern / FailurePattern / SuccessfulProcedure` 的强化逻辑进一步收紧
- `retire / decay / downgrade` 已进入主链，而不再只是概念字段
- `Attempt / Episode / ProcedureCandidate` 的沉淀与晋升关系更加稳定

### 4. 人工校正进入主链

- concept alias / promotion decision 可以持久化
- gateway debug 已提供 `apply_corrections / list_corrections`
- explain 可以直接显示 correction trace 与 correction summary

### 5. observability 趋势化

- observability 不再只是一轮 snapshot
- 阶段级 trend 与 report 已能汇总 recall、memory、promotion、path cost
- evaluation harness 已覆盖阶段 5 第二轮相关信号

### 6. 第二轮验收收口

- TODO、状态页、总结文档和索引已经统一
- 第二轮结果已经可以作为阶段 6 的起点

## 当前验证结果

- `npm test`：`101` 项测试全绿
- `npm run test:evaluation`：`4` 项评估测试全绿

## 仍然保留的边界

- 多跳 recall 仍是受控多跳，不是通用图搜索引擎
- `global` 写入策略仍以规则门槛为主，不是成熟的人机协同审批系统
- 人工校正入口和 observability 仍偏工程接口，尚未进入完整产品化界面

## 推荐下一步

1. 以 [stage-5-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-second-pass-report.zh-CN.md) 作为第二轮总结基线。
2. 启动阶段 6 规划，优先考虑平台化、人工治理界面、更强长期记忆治理和更成熟的多跳路径策略。

## 一句话结论

`阶段 5 第二轮已经把“可用的阶段 5 主链”推进成了“可治理、可解释、可评估的阶段 5 主链”。`
