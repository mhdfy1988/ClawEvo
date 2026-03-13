# 阶段 4 Evaluation Harness

## 1. 目标

这份文档用于说明阶段 4 `TODO 5` 落下来的评估基座。

它解决的不是“功能有没有跑通”，而是“阶段 4 这条主链有没有在关键维度上退化”：

- relation recall 有没有把噪音一起放大
- 长期记忆有没有变得有用，而不是侵入当前 bundle
- explain / trace 还能不能把选择与沉淀说清楚
- retrieval 成本有没有随着扩边被悄悄放大

对应实现：

- 评估 runner：[evaluation-harness.ts](/d:/C_Project/openclaw_compact_context/src/evaluation/evaluation-harness.ts)
- 代表性 fixture：[evaluation-harness-fixtures.ts](/d:/C_Project/openclaw_compact_context/src/tests/fixtures/evaluation-harness-fixtures.ts)
- 回归测试：[evaluation-harness.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/evaluation-harness.test.ts)

---

## 2. 当前覆盖的指标

### 2.1 Relation Recall

- `precision`
  - 本轮 relation-backed `relevantEvidence` 中，有多少属于允许集合
- `recall`
  - 代表性 fixture 期望召回的 relation-backed evidence，有多少实际进入 bundle
- `noise`
  - 本轮 relation-backed evidence 中，有多少条不在允许集合

当前实现里，relation-backed evidence 通过 `selection.reason` 中的 `via ... from ...` 标记识别。

### 2.2 Long-Memory Quality

- `usefulness`
  - 期望被 checkpoint / delta / skill candidate 保留的节点，有多少实际 surfaced
- `intrusion`
  - 明确不希望进入长期记忆面的探针节点，有多少被错误 surfaced

当前判断依据来自 `trace.persistence`：

- `persistedInCheckpoint`
- `surfacedInDelta`
- `surfacedInSkillCandidate`

### 2.3 Bundle Quality

- `requiredCoverage`
  - 代表性 fixture 里必须进入 bundle 的节点，覆盖率是多少
- `forbiddenIntrusion`
  - 明确不该进入 bundle 的节点，有多少条被误选中

### 2.4 Explain Completeness

当前把 explain 完整度定义为：

- 有 `node`
- 有 `governance`
- 有 `trace`
- 有 `retrieval`
- 有非空 `summary`
- `trace.source.sourceStage` 存在
- `trace.selection.evaluated` 为布尔值
- `trace.output.promptReady` 为布尔值

这层不是在测文案质量，而是在测 explain 结构有没有退化。

### 2.5 Retrieval Cost

当前第一轮统计这些成本口径：

- bundle relation retrieval 的 `edgeLookupCount / nodeLookupCount`
- explain 触发的 `selectionCompile` relation lookup 总量
- explain 邻接读取 `adjacency` 总量
- persistence 读取总量 `persistenceReadCountTotal`

---

## 3. Representative Fixture

当前代表性 fixture 复用了现有 debug smoke 主链，而不是另造一套平行数据：

- 基础构造：[debug-smoke-fixtures.ts](/d:/C_Project/openclaw_compact_context/src/tests/fixtures/debug-smoke-fixtures.ts)
- 评估封装：[evaluation-harness-fixtures.ts](/d:/C_Project/openclaw_compact_context/src/tests/fixtures/evaluation-harness-fixtures.ts)

它覆盖了这几类真实路径：

- Goal / Rule / Risk / Step 的 bundle 选择
- `supported_by` 驱动的 relation-aware evidence recall
- checkpoint / delta / skill candidate 的 memory surface
- explain / trace / retrieval / persistence 输出
- explicit document evidence 的“应被排除”探针

一句话说，这份 fixture 是“阶段 4 第一轮最小代表性主链样本”。

---

## 4. 当前阈值

第一轮默认阈值偏保守，目标是先做回归守门：

- relation precision >= `1.00`
- relation recall >= `1.00`
- relation noise <= `0`
- memory usefulness >= `1.00`
- memory intrusion <= `0.00`
- bundle required coverage >= `1.00`
- bundle forbidden intrusion <= `0`
- explain completeness >= `1.00`
- bundle relation lookup `edge <= 1`、`node <= 1`

explain 侧的总成本阈值按探针数量动态计算：

- `selectionCompile` edge/node lookup 总量 <= `probeCount`
- `adjacency` edge/node lookup 总量 <= `probeCount`
- `persistenceReadCountTotal <= probeCount * 3`

这样做的目的，是让阶段 4 后续每次扩 relation / 扩记忆时，都必须显式承担阈值变化。

---

## 5. 如何运行

### 5.1 单独跑评估

```bash
npm run test:evaluation
```

### 5.2 跑全量测试

```bash
npm test
```

---

## 6. 当前输出结构

评估 runner 会输出一份 `EvaluationReport`，核心包含：

- `bundle`
  - `id / checkpointId / deltaId / skillCandidateIds`
- `metrics.bundleQuality`
- `metrics.relationRecall`
- `metrics.memoryQuality`
- `metrics.explainCompleteness`
- `metrics.retrievalCost`
- `pass / failures`

同时也提供了 `formatEvaluationReport()`，方便在测试失败时直接打印可读摘要。

---

## 7. 第一轮边界

这套 evaluation harness 目前还是第一轮，不追求一次做成完整评估平台。它暂时不覆盖：

- SQLite 独立评估矩阵
- 多 workspace / global scope 混合样本
- 多跳 relation recall 路径
- Topic / Concept 层评估
- merge / retire 之后的长期记忆质量回归

这些更适合放到阶段 4 后半段继续增强。

---

## 8. 一句话结论

`阶段 4 evaluation harness` 现在已经能把 relation recall、memory surface、bundle quality、explain completeness 和 retrieval cost 拉到同一份回归报告里，足够作为阶段 4 第一轮的评估守门器。
