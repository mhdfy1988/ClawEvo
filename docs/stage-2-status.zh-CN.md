# 阶段 2 进度盘点：已完成、剩余缺口、收尾建议

## 1. 文档目标

这份文档用于回答一个非常具体的问题：

`阶段 2 现在到底做到哪儿了，还剩哪些必须收尾的点？`

它不是新的路线图，也不是新的实现计划，而是对当前仓库状态的一次阶段性盘点。

建议配合下面两份文档一起看：

- 阶段 2 执行计划：
  [stage-2-execution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-execution-plan.zh-CN.md)
- 总体路线图：
  [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)

---

## 2. 当前判断

基于当前代码和文档状态，可以把阶段 2 的整体进度判断为：

`阶段 2 主干已基本打通，当前处在“后半段收尾与质量补齐”阶段。`

更直白一点说：

- 这已经不是“准备开始阶段 2”
- 也还没到“阶段 2 可以完全宣告完成”
- 当前更准确的状态是：
  `阶段 2 大部分核心目标已实现，剩下的是 explain 深化、artifact 落盘、结构化消费和结果验收。`

如果按完成度粗估：

- 迭代 2.1：已完成
- 迭代 2.2：已完成
- 迭代 2.3：已完成
- 迭代 2.4：大体完成，但还有几项收尾

---

## 3. 阶段 2 原目标回顾

根据执行计划，阶段 2 的总目标是：

`让上下文系统不只会压缩，而且能从源头减少垃圾上下文、能更准确识别结构、能更稳定地选出真正有用的上下文。`

拆成四轮迭代就是：

1. `2.1` 定义 `tool_result_persist` 治理规则
2. `2.2` 接入 `tool_result_persist`
3. `2.3` 提升 ingest 结构质量
4. `2.4` 提升 compiler 裁决质量

---

## 4. 当前完成度总览

## 4.1 结论表

- `2.1 tool result policy`：已完成
- `2.2 tool_result_persist 接入`：已完成
- `2.3 ingest 结构质量提升`：已完成
- `2.4 compiler / explain / debug 提升`：基本完成

## 4.2 这意味着什么

这意味着阶段 2 的“先减噪，再提取，再裁决”主顺序其实已经跑完了：

- 源头治理已经接进 hook
- 图谱结构质量已经明显好于阶段 1
- compiler 已经不再只是简单拼文本
- explain 和 Gateway 调试链已经形成可用闭环

剩下的工作，更多是“让阶段 2 的结果更完整、更可解释、更可验收”。

---

## 5. 已完成部分

## 5.1 `2.1` 已完成：tool result policy 已明确

已具备：

- `tool result` 的分类和压缩原则文档
- 必保留字段合同
- 标准压缩产物结构
- provenance / truncation / artifact 字段约定

对应文档与实现：

- [tool-result-policy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/tool-result-policy.zh-CN.md)
- [tool-result-policy.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/tool-result-policy.ts)

当前可认为已经达到执行计划里“先把边界定清楚”的要求。

## 5.2 `2.2` 已完成：`tool_result_persist` 已接入主链

已具备：

- `tool_result_persist` hook 已接入
- 超大 tool result 会在进入 transcript 前被压缩
- 压缩后结果会带 `compressed / tool_result_persist` provenance
- transcript loader / adapter / ingest 已能识别这类压缩结果

对应代码：

- [hook-coordinator.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/hook-coordinator.ts)
- [types.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/types.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- [transcript-loader.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/transcript-loader.ts)

这部分已经满足“从源头控制 transcript 膨胀”的主目标。

## 5.3 `2.3` 已完成：ingest 结构质量已明显提升

已具备：

- 不再只依赖粗粒度 role 映射
- 已识别并使用：
  - `Constraint`
  - `Process`
  - `Step`
  - `Risk`
  - `Mode`
  - `Outcome`
  - `Tool`
- `custom_message / compaction` 已有更细粒度映射
- stable semantic key、dedupe、version 更新已接入

对应代码：

- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/ingest-pipeline.ts)
- [transcript-loader.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/transcript-loader.ts)

这部分已经达到“结构质量明显高于阶段 1”的要求。

## 5.4 `2.4` 大体完成：compiler 裁决和 explain 已进入高质量阶段

已具备：

- 分类预算池
- `raw-first / compressed-fallback`
- bundle diagnostics
- explain 的 included / skipped 解释
- `inspect_bundle`
- `query_nodes + explain`
- `queryMatch`
- token-overlap 文本匹配与更稳的排序

对应代码：

- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- [text-search.ts](/d:/C_Project/openclaw_compact_context/src/core/text-search.ts)

这说明阶段 2 的裁决主链已经不再是“简单相关文本拼接”，而是真正开始像一个上下文裁决器。

## 5.5 测试与调试链已形成闭环

已具备：

- `tool_result_persist` 测试
- ingest / compiler 回归测试
- adapter / explain 回归测试
- debug smoke
- snapshot smoke
- 调试文档、playbook、smoke checklist

对应位置：

- [tool-result-policy.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/tool-result-policy.test.ts)
- [ingest-and-compiler.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/ingest-and-compiler.test.ts)
- [context-engine-adapter.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/context-engine-adapter.test.ts)
- [audit-explainer.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/audit-explainer.test.ts)
- [debug-smoke.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/debug-smoke.test.ts)

截至当前阶段，已跑通一组 `31` 项的测试回归。

---

## 6. 剩余缺口

下面这些是阶段 2 还没有完全收口的部分。

## 6.1 缺口 A：tool result 裁剪原因 explain 还不完整

当前状态：

- 已能解释 provenance
- 已能解释 selection
- 已知压缩结果携带 `truncation / policyId / droppedSections / artifact`

但还没做到：

- explain 直接回答“用了哪条 policy”
- explain 直接回答“为什么压了”
- explain 直接回答“压掉了哪些 section”
- explain 直接回答“原文去哪回查”

主要涉及：

- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts)
- [tool-result-policy.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/tool-result-policy.ts)

判断：

- `状态：基本完成但未收口`

## 6.2 缺口 B：artifact sidecar 结构有字段，但还没真正落盘闭环

当前状态：

- 压缩结构里已经有 `artifact.path / sourcePath / sourceUrl`
- explain 和 metadata 也能携带这些字段

但还没做到：

- 专门的 artifact store
- 超长正文外置落盘
- artifact 生命周期和清理策略
- “正文不在 transcript，但能稳定回查”的完整闭环

主要涉及：

- 可能新增 `tool-result-artifact-store.ts`
- [tool-result-policy.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/tool-result-policy.ts)

判断：

- `状态：未完成`

## 6.3 缺口 C：ingest 还没完全吃透 compressed tool result 的结构字段

当前状态：

- compressed tool result 已能被识别并入图
- provenance 已经正确透传

但还没做到：

- 更充分使用 `keySignals`
- 更充分使用 `affectedPaths`
- 更充分使用 `error`
- 更充分使用 `truncation`
- 让结构化字段直接驱动 `Risk / State / Tool / Evidence`，而不是更多依赖文本摘要

主要涉及：

- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/ingest-pipeline.ts)

判断：

- `状态：部分完成`

## 6.4 缺口 D：还不能完整解释“为什么某段历史没被保留”

当前状态：

- 已能解释“为什么某个 node 没被选中”
- 已能解释 fixed/category budget 下的 skipped

但还没做到：

- 为什么某段 raw history 被 recent-tail 裁掉
- 为什么某段内容只在 checkpoint 中保留
- 为什么某段旧消息只剩 bundle/summary，不再进 prompt
- 为什么某条历史没有形成 node

主要涉及：

- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts)

判断：

- `状态：部分完成`

## 6.5 缺口 E：阶段 2 的结果验收还缺统计与阶段总结

当前状态：

- 已有回归测试
- 已有 smoke
- 已有调试文档

但还没做到：

- transcript 膨胀下降量的统计
- 压缩率统计
- bundle 噪音变化的统计
- 规则 / 风险召回稳定性的阶段对比
- 一份正式的阶段 2 验收总结

判断：

- `状态：未完成`

---

## 7. 按优先级排列的剩余事项

如果按阶段 2 收尾的优先级来排，建议是：

## P0

- 补 tool result 裁剪原因 explain
- 补 artifact sidecar 的真正落盘闭环

## P1

- 让 ingest 更直接消费 compressed tool result 的结构化字段
- 补“历史未保留原因”的 explain

## P2

- 补阶段 2 的结果指标
- 补阶段 2 的正式验收总结

---

## 8. 阶段 2 出口条件对照

根据路线图，阶段 2 出口定义是：

- tool result 膨胀受控
- ingest 质量提升
- bundle 里无关信息明显减少
- provenance 与压缩策略能一起解释

当前对照结果如下：

- `tool result 膨胀受控`
  - 基本满足
- `ingest 质量提升`
  - 已满足
- `bundle 里无关信息明显减少`
  - 基本满足
- `provenance 与压缩策略能一起解释`
  - provenance 已满足
  - 压缩策略 explain 仍差最后一段

所以当前更准确的判断是：

`阶段 2 的出口条件已经满足了大半，但“压缩策略 explain + artifact 回查闭环”还没收口，因此不建议过早宣布阶段 2 完结。`

---

## 9. 建议的收尾顺序

为了避免阶段 2 一直拖着不收口，建议按下面顺序补齐：

1. 先做 tool result 裁剪原因 explain
2. 再做 artifact sidecar 落盘
3. 再增强 ingest 对 compressed tool result 结构字段的消费
4. 再补“历史未保留原因”的 explain
5. 最后补阶段 2 验收指标和阶段总结

这样做的原因是：

- 前两项直接决定阶段 2 是否真正“可解释”
- 第三项决定源头治理的结构收益是否被完全吃到
- 第四项决定调试链是否闭环
- 第五项决定阶段是否能正式结项

---

## 10. 一句话结论

如果只用一句话概括当前阶段 2 的状态，那就是：

`阶段 2 的主干已经完成，当前剩下的是 explain、artifact、结构化消费和验收收尾；它更像“收官阶段”，而不是“刚进入阶段 2”。`
