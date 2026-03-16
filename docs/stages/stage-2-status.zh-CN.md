# 阶段 2 进度盘点：已完成、出口对照与后续边界

## 1. 文档目标

这份文档用来回答两个问题：

1. 阶段 2 现在是否已经可以正式收口
2. 哪些能力已经算阶段 2 交付，哪些工作应转入阶段 3

建议配合下面几份文档一起看：
- 阶段 2 执行计划: [stage-2-execution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-2-execution-plan.zh-CN.md)
- 阶段 2 出口报告: [stage-2-exit-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-2-exit-report.zh-CN.md)
- 阶段 2 收尾 TODO: [stage-2-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-2-todo.zh-CN.md)
- 总体路线图: [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)

## 2. 当前结论

基于当前代码、测试和文档状态，阶段 2 可以定义为：

`阶段 2 已完成收尾，出口条件已满足，项目进入阶段 3 准备阶段。`

更具体地说：
- `2.1` 已完成并稳定落地
- `2.2` 已完成并形成 artifact sidecar 闭环
- `2.3` 已完成并把 compressed tool result 的结构字段接入 ingest
- `2.4` 已完成，compiler / explain / gateway debug 链条已形成闭环
- 阶段 2 的剩余项已经不再是“必须收尾”，而是阶段 3 的增强方向

## 3. 阶段 2 原目标回看

阶段 2 的总目标是：

`让系统不只会压缩上下文，还能从源头治理上下文膨胀、结构化吸收 tool result，并稳定地解释“为什么保留、为什么压缩、为什么被选中”。`

对应的四轮迭代是：
1. `2.1` 明确 `tool_result_persist` 治理规则
2. `2.2` 接入 `tool_result_persist`，把超长输出挡在 transcript 入口外
3. `2.3` 提升 ingest 结构质量，让 compressed tool result 被结构化消费
4. `2.4` 提升 compiler / explain / gateway debug 的裁决与可解释性

## 4. 当前完成度总览

## 4.1 结论表

- `2.1 tool result policy`: 已完成
- `2.2 tool_result_persist 接入`: 已完成
- `2.3 ingest 结构质量提升`: 已完成
- `2.4 compiler / explain / debug 提升`: 已完成

## 4.2 这意味着什么

阶段 2 的主路径已经跑通：

`tool result / transcript -> provenance 标记 -> ingest 入图 -> runtime bundle compile -> explain / debug / artifact 回查`

当前系统已经不再只是“会压缩一段 prompt”，而是具备了更完整的治理能力：
- 源头减噪
- 结构化沉淀
- provenance 可追溯
- bundle 选择可解释
- 超长原文可回查

## 5. 已交付能力

## 5.1 `2.1` 已完成：tool result policy 已明确

已经具备：
- `tool result` 的分类和压缩原则
- 必保留字段合同
- 标准压缩产物结构
- provenance / truncation / artifact 约定

对应文档与实现：
- [tool-result-policy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/tool-result-policy.zh-CN.md)
- [tool-result-policy.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/tool-result-policy.ts)

## 5.2 `2.2` 已完成：artifact sidecar 已形成回查闭环

已经具备：
- `tool_result_persist` hook 接入主链
- 超长 tool result 在写入 transcript 前被压缩
- 原始正文可以落到 content-addressed artifact sidecar
- explain / metadata 会保留稳定回查路径
- 提供最小生命周期能力：`pruneStaleArtifacts()`

对应实现：
- [hook-coordinator.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/hook-coordinator.ts)
- [tool-result-artifact-store.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/tool-result-artifact-store.ts)
- [tool-result-artifact-store.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/tool-result-artifact-store.test.ts)

## 5.3 `2.3` 已完成：compressed tool result 已被结构化消费

已经具备：
- `keySignals / affectedPaths / error / truncation` 进入 ingest 推理文本
- evidence / semantic node 会保留结构化 `toolResult` 载荷
- sourceRef 会优先使用 artifact path / content hash
- 即使正文是中性摘要，也能依赖 metadata 推断 `Risk`

对应实现：
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
- [ingest-and-compiler.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/ingest-and-compiler.test.ts)

## 5.4 `2.4` 已完成：compiler / explain / gateway debug 已形成闭环

已经具备：
- 分类预算池
- `raw-first / compressed-fallback`
- bundle diagnostics
- included / skipped explain
- `inspect_bundle`
- `query_nodes + explain + queryMatch`
- token-overlap 匹配和更稳的排序
- tool result 裁剪原因 explain

对应实现：
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/gateway-debug-usage.zh-CN.md)

## 6. 最小验收结果

阶段 2 当前最小可对外复述的结果是：

- 压缩样例可验证:
  - oversized failure tool result 从 `8602` 字符压到 `3029`
  - 压缩比约 `35.2%`
- artifact sidecar 可验证:
  - 已有 content-addressed 落盘
  - 已有 prune helper
  - 已有 sidecar 单测
- explain 能力可验证:
  - provenance
  - selection
  - `policyId / reason / droppedSections`
  - `artifact / sourcePath / sourceUrl / rawSourceId`
- ingest 结构化消费可验证:
  - metadata 能直接推动 `Risk / Evidence / Tool / State`
- 回归基线可验证:
  - `tsc --noEmit` 通过
  - `tsc -p tsconfig.json` 通过
  - 全量 `36` 项测试通过

详细说明见：
- [stage-2-exit-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-2-exit-report.zh-CN.md)

## 7. 阶段 2 出口对照

根据路线图，阶段 2 的出口主要看四件事：

1. `tool result` 膨胀是否受控
2. ingest 质量是否明显提升
3. bundle 噪音是否明显下降
4. provenance 与压缩策略是否能一起解释

当前对照结果：
- `tool result 膨胀受控`: 已满足
- `ingest 质量提升`: 已满足
- `bundle 噪音下降`: 已满足
- `provenance + 压缩可解释`: 已满足

结论：

`阶段 2 的出口条件已经满足，可以正式收口。`

## 8. 哪些工作转入阶段 3

下面这些不再作为阶段 2 阻塞项，而应转入阶段 3：
- 更完整的“为什么某段历史没有保留”解释
- 更强的关系感知检索与排序
- 更系统的阶段指标自动采集
- 更细粒度的长期记忆策略和图谱增强

## 9. 下一步建议

下一步不建议继续在阶段 2 文档里追加收尾项，而是：

1. 保留阶段 2 文档作为稳定基线
2. 新建阶段 3 TODO / 执行计划
3. 把“历史保留解释、检索增强、指标自动化”转成阶段 3 工作包

## 10. 一句话结论

`阶段 2 已经完成从“会压缩”到“会治理、会解释、可回查”的升级，可以进入阶段 3。`



