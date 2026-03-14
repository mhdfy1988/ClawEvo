# 观测与专项评估矩阵
本说明用于补充“其他专项攻坚”里的第二轮观测口径，目标是把多跳 recall、知识晋升、高 scope 复用、多来源入图放进同一套评估视图，而不再只看单条测试是否通过。

相关代码：
- 评估基座：[evaluation-harness.ts](/d:/C_Project/openclaw_compact_context/src/evaluation/evaluation-harness.ts)
- 阶段级观测报告：[observability-report.ts](/d:/C_Project/openclaw_compact_context/src/evaluation/observability-report.ts)
- 代表性 fixture：[evaluation-harness-fixtures.ts](/d:/C_Project/openclaw_compact_context/src/tests/fixtures/evaluation-harness-fixtures.ts)

## 指标分组

### 1. Relation Recall
- `precision`
- `recall`
- `noise rate`
- `candidate/admitted/pruned path`
- `path prune rate`

### 2. Knowledge Promotion
- `knowledge class coverage`
- `knowledge pollution rate`
- promoted pattern 的 `workspace/global` 准入质量

### 3. High-Scope Reuse
- `reuse benefit`
- `reuse intrusion`
- 直接 higher-scope 命中
- `via learning:` 带来的受控复用

### 4. Multi-Source Ingest
- `Document / Repo / Module / File / API / Command` 覆盖率
- 结构化来源是否进入统一评估矩阵

### 5. Existing Core Quality
- bundle coverage
- explain completeness
- context-processing coverage
- memory usefulness / intrusion

## 当前实现
当前 `StageObservabilitySnapshot` 已经会聚合：
- relation precision / recall / noise
- bundle coverage / explain coverage
- concept coverage
- memory usefulness / intrusion
- promotion quality / pollution
- high-scope reuse benefit / intrusion
- multi-source coverage
- path candidate / admitted / prune

同时 `formatStageObservabilityReport()` 会输出可直接贴进阶段报告的摘要文本。

## 推荐使用方式
1. 用代表性 fixture 跑 `npm run test:evaluation`
2. 将多组 `EvaluationReport` 聚合成 `StageObservabilityReport`
3. 在阶段收口文档里记录：
   - 当前 snapshot
   - 与上一轮的 trend 对比
   - 噪音、污染、复用收益是否朝预期方向变化

## 一句话结论
`第二轮观测的目标不是增加更多数字，而是让 recall、知识晋升、高 scope 复用、多来源入图可以在同一张表里一起看。`
