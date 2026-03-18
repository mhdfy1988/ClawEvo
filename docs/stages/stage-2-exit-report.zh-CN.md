# 阶段 2 出口报告

## 1. 文档目标

这份文档用于记录阶段 2 的最小验收材料，回答三个问题：

1. 阶段 2 是否已经达到出口条件
2. 当前有哪些可量化结果
3. 哪些事项应转入阶段 3

配合阅读：
- 当前状态: [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-2-status.zh-CN.md)
- 阶段 TODO: [stage-2-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-2-todo.zh-CN.md)
- 阶段计划: [stage-2-execution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-2-execution-plan.zh-CN.md)

## 2. 出口结论

结论可以直接写成：

`阶段 2 已达到出口条件，当前代码已具备源头治理、结构化消费、artifact 回查和选择可解释闭环。`

## 3. 最小结果指标

## 3.1 压缩结果

基于 oversized failure tool result 样例：
- 原始序列化长度: `8602`
- 压缩后长度: `3029`
- 压缩比: `35.2%`

这说明 `tool_result_persist` 已经能够在 transcript 入口前显著降低超长工具输出体积。

## 3.2 artifact sidecar

当前已具备：
- content-addressed 落盘路径
- sidecar JSON envelope
- metadata / explain 回查路径
- `pruneStaleArtifacts()` 最小生命周期清理能力

默认落盘结构：

```text
<stateDir>/plugins/compact-context/artifacts/tool-results/<hash-prefix>/<content-hash>.json
```

## 3.3 结构化消费

compressed tool result 的这些字段已经被直接消费：
- `keySignals`
- `affectedPaths`
- `error`
- `truncation`
- `artifact path / content hash`

这些字段已经能直接影响：
- `Risk`
- `State`
- `Tool`
- `Evidence`
- sourceRef / semantic anchor / inference text

## 3.4 explain / debug

当前 explain 链已能回答：
- 这条节点来自 `raw / compressed / derived` 哪一类来源
- 为什么它被选中或跳过
- 如果它来自 tool result 压缩，用了哪条 policy
- 为什么被压缩
- 压掉了哪些 section
- 原始正文去哪回查

Gateway 侧已具备：
- `compact-context.explain`
- `compact-context.query_nodes`
- `compact-context.inspect_bundle`

## 3.5 验证结果

当前回归基线：
- `tsc --noEmit` 通过
- `tsc -p tsconfig.json` 通过
- 全量 `36` 项测试通过

测试覆盖链路包括：
- tool result policy
- artifact store
- hook coordinator
- transcript loader
- ingest / compiler
- gateway adapter
- audit explainer
- debug smoke

## 4. 出口条件对照

阶段 2 的出口条件对照如下：

- `tool result 膨胀受控`
  - 结果: 已满足
- `ingest 结构质量明显提升`
  - 结果: 已满足
- `bundle 相关性与解释性增强`
  - 结果: 已满足
- `provenance 与压缩策略形成统一解释`
  - 结果: 已满足
- `回查链不再依赖 transcript 保留完整正文`
  - 结果: 已满足

## 5. 阶段 2 的正式交付面

阶段 2 结束时，可以明确对外表述的能力是：

- 可以在 `tool_result_persist` 阶段压缩超长工具输出
- 可以把原始超长正文落到 sidecar artifact
- 可以把 compressed tool result 结构字段直接进入图谱
- 可以在 compiler 中优先选择更高价值上下文
- 可以在 explain / debug 中回答“为什么这样选、为什么这样压”

## 6. 转入阶段 3 的内容

这些内容不再作为阶段 2 阻塞项，而应转入阶段 3：
- 历史未保留原因 explain
- 更强的关系感知检索和排序
- 更完整的指标自动采集和趋势分析
- 更长期的记忆增强和技能沉淀策略

## 7. 一句话结论

`阶段 2 已完成，项目可以从“收尾”切换到“阶段 3 规划与增强实现”。`

