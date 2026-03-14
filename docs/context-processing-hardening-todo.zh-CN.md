# 上下文处理攻坚 TODO
本清单用于把“上下文处理”从现有主链能力，收敛成一个可独立运行、可独立测试、可独立评估的子系统。

相关文档：
- [代码流转图](/d:/C_Project/openclaw_compact_context/docs/context-processing-code-flow.zh-CN.md)
- [处理契约](/d:/C_Project/openclaw_compact_context/docs/context-processing-contracts.zh-CN.md)
- [summarize 借鉴](/d:/C_Project/openclaw_compact_context/docs/summarize-reference-for-context-processing.zh-CN.md)
- [试错学习方案](/d:/C_Project/openclaw_compact_context/docs/experience-learning-plan.zh-CN.md)
- [总攻坚路线图](/d:/C_Project/openclaw_compact_context/docs/hardening-master-roadmap.zh-CN.md)

## 待办
- [ ] 当前没有剩余待办；建议下一步转入 [other-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/other-hardening-todo.zh-CN.md) 或新的上下文处理深化议题。

## 进行中
- [ ] 当前没有进行中任务。

## 已完成
- [x] TODO 1: 落独立的 `ContextProcessingPipeline` 总入口 ~5d #后端 #架构 @Codex 2026-03-14
  - [x] 新增 [context-processing-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/context-processing-pipeline.ts)
  - [x] 固定 `record -> parse -> spans -> concepts -> classification -> summary candidates -> materialization plan` 总流程
  - [x] 让 OpenClaw adapter、ingest、explain 统一消费 pipeline 输出
  - [x] 给 pipeline 增加稳定 diagnostics、版本信息和缓存入口

- [x] TODO 2: 落噪音治理与无意义语句策略 ~4d #后端 #上下文 @Codex 2026-03-15
  - [x] 新增 [noise-policy.ts](/d:/C_Project/openclaw_compact_context/src/core/noise-policy.ts)
  - [x] 定义 `drop / evidence_only / hint_only / materialize`
  - [x] 支持 acknowledgement、重复子句、弱 topic-only 子句的降级
  - [x] `explain / trace` 可说明噪音处置结果

- [x] TODO 3: 落 `Summary Planner` 与结构化总结候选层 ~4d #后端 #总结 @Codex 2026-03-16
  - [x] 新增 [summary-planner.ts](/d:/C_Project/openclaw_compact_context/src/core/summary-planner.ts)
  - [x] 从 `SemanticSpan[] / node candidates` 先产出 `summary candidates`
  - [x] 固定 summary slot、preferred form 和 evidence-required 规则

- [x] TODO 4: 拆出 `Semantic Classifier` 与 `Node Materializer` ~5d #后端 #架构 @Codex 2026-03-18
  - [x] 新增 [semantic-classifier.ts](/d:/C_Project/openclaw_compact_context/src/core/semantic-classifier.ts)
  - [x] 新增 [semantic-node-materializer.ts](/d:/C_Project/openclaw_compact_context/src/core/semantic-node-materializer.ts)
  - [x] 固定 `SemanticSpan -> NodeCandidate -> GraphNode/GraphEdge` 三段接口
  - [x] 保持 provenance / governance / conflict / traceability 不回退

- [x] TODO 5: 落独立的 `Context Processing Harness` ~5d #测试 #评估 @Codex 2026-03-19
  - [x] 新增 [context-processing-harness.ts](/d:/C_Project/openclaw_compact_context/src/evaluation/context-processing-harness.ts)
  - [x] 支持单条输入检查 `parse / spans / concepts / node candidates / summary candidates`
  - [x] 增加 [context-processing-harness.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/context-processing-harness.test.ts)
  - [x] 提供 `npm run test:context-processing`

- [x] TODO 6: 落 `Attempt / Episode` 的 raw-first builder ~5d #后端 #学习 @Codex 2026-03-20
  - [x] 增强 [context-processing-experience.ts](/d:/C_Project/openclaw_compact_context/src/core/context-processing-experience.ts)
  - [x] 从 span/step 序列直接派生 failure / procedure / critical step hint
  - [x] 为 raw-first 经验提示补单测 [context-processing-experience.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/context-processing-experience.test.ts)

- [x] TODO 7: 落版本化与缓存策略 ~4d #后端 #性能 @Codex 2026-03-21
  - [x] 新增 [context-processing-versions.ts](/d:/C_Project/openclaw_compact_context/src/core/context-processing-versions.ts)
  - [x] 固定 parser / lexicon / classifier / planner / materializer version
  - [x] 为 pipeline 增加 cache key 与 cache hit diagnostics

- [x] TODO 8: 接人工校正到上下文处理主链 ~4d #后端 #治理 @Codex 2026-03-22
  - [x] 新增 [context-processing-corrections.ts](/d:/C_Project/openclaw_compact_context/src/core/context-processing-corrections.ts)
  - [x] 支持 concept alias、noise policy、semantic classification 校正
  - [x] `engine -> pipeline` 同步人工校正
  - [x] 校正痕迹可通过 `explain` 查看

- [x] TODO 9: 扩专项评估与阶段报告 ~3d #测试 #文档 @Codex 2026-03-23
  - [x] 将上下文处理指标接入 [evaluation-harness.ts](/d:/C_Project/openclaw_compact_context/src/evaluation/evaluation-harness.ts)
  - [x] 保持 [observability-report.ts](/d:/C_Project/openclaw_compact_context/src/evaluation/observability-report.ts) 对上下文指标可见
  - [x] 增加噪音策略、总结规划、pipeline、harness 的专项单测

- [x] TODO 10: 完成上下文处理攻坚验收与收口 ~2d #文档 #验收 @Codex 2026-03-24
  - [x] 校正索引、流程图和专项 TODO
  - [x] 补齐导出入口 [index.ts](/d:/C_Project/openclaw_compact_context/src/index.ts)
  - [x] 确认 `npm test` 与 `npm run test:evaluation` 通过

## 当前结论
上下文处理现在已经具备一条可独立运行的主链：

`RawContextRecord -> route annotation -> utterance parse -> semantic spans -> concept normalize -> noise policy -> node candidates -> summary candidates -> materialization plan -> graph ingest / explain / evaluation`

专项测试入口：
- `npm run test:context-processing`
- `npm test`
- `npm run test:evaluation`
