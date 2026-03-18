# 阶段 4 Evaluation Harness

## 1. 目标

这份文档用于说明阶段 4 评估基座的演进结果�?
它最初来自阶�?4 第一�?`TODO 5`，第二轮又继续扩展到了上下文处理专项�?
它解决的不是“功能有没有跑通”，而是“阶�?4 这条主链有没有在关键维度上退化”：

- relation recall 有没有把噪音一起放�?- 长期记忆有没有变得有用，而不是侵入当�?bundle
- explain / trace 还能不能把选择与沉淀说清�?- retrieval 成本有没有随着扩边被悄悄放�?- clause split / semantic span / concept normalization 有没有退�?- experience learning 有没有真正进�?compiler / explain / evaluation

对应实现�?
- 评估 runner：[evaluation-harness.ts](/d:/C_Project/openclaw_compact_context/internal/evaluation/evaluation-harness.ts)
- 代表�?fixture：[evaluation-harness-fixtures.ts](/d:/C_Project/openclaw_compact_context/tests/fixtures/evaluation-harness-fixtures.ts)
- 回归测试：[evaluation-harness.test.ts](/d:/C_Project/openclaw_compact_context/tests/evaluation-harness.test.ts)

---

## 2. 当前覆盖的指�?
### 2.1 Relation Recall

- `precision`
  - 本轮 relation-backed `relevantEvidence` 中，有多少属于允许集�?- `recall`
  - 代表�?fixture 期望召回�?relation-backed evidence，有多少实际进入 bundle
- `noise`
  - 本轮 relation-backed evidence 中，有多少条不在允许集合

当前实现里，relation-backed evidence 通过 `selection.reason` 中的 `via ... from ...` 标记识别�?
### 2.2 Long-Memory Quality

- `usefulness`
  - 期望�?checkpoint / delta / skill candidate 保留的节点，有多少实�?surfaced
- `intrusion`
  - 明确不希望进入长期记忆面的探针节点，有多少被错误 surfaced

当前判断依据来自 `trace.persistence`�?
- `persistedInCheckpoint`
- `surfacedInDelta`
- `surfacedInSkillCandidate`

### 2.3 Bundle Quality

- `requiredCoverage`
  - 代表�?fixture 里必须进�?bundle 的节点，覆盖率是多少
- `forbiddenIntrusion`
  - 明确不该进入 bundle 的节点，有多少条被误选中

### 2.4 Explain Completeness

当前�?explain 完整度定义为�?
- �?`node`
- �?`governance`
- �?`trace`
- �?`retrieval`
- 有非�?`summary`
- `trace.source.sourceStage` 存在
- `trace.selection.evaluated` 为布尔�?- `trace.output.promptReady` 为布尔�?
这层不是在测文案质量，而是在测 explain 结构有没有退化�?
### 2.5 Retrieval Cost

当前第一轮统计这些成本口径：

- bundle relation retrieval �?`edgeLookupCount / nodeLookupCount`
- explain 触发�?`selectionCompile` relation lookup 总量
- explain 邻接读取 `adjacency` 总量
- persistence 读取总量 `persistenceReadCountTotal`

### 2.6 Context Processing

第二轮新增了上下文处理专项指标：

- `semanticNodeCoverage`
  - 期望从自然语言�?materialize 的语义节点，有多少实际进入图�?- `conceptNormalizationCoverage`
  - 期望被归一�?canonical concept 的中英术语，有多少实际命�?- `clauseSplitCoverage`
  - 期望能稳定切开的中英混�?clause，有多少实际�?parser 拆出
- `evidenceAnchorCompleteness`
  - explain / trace 中应具备 anchor 的节点，有多少具�?`sentence / clause / offset`
- `experienceLearningCoverage`
  - `Attempt / Episode / FailureSignal / ProcedureCandidate` 这类经验对象，有多少实际进入 explain / evaluation �?
---

## 3. Representative Fixture

当前代表�?fixture 复用了现�?debug smoke 主链，而不是另造一套平行数据：

- 基础构造：[debug-smoke-fixtures.ts](/d:/C_Project/openclaw_compact_context/tests/fixtures/debug-smoke-fixtures.ts)
- 评估封装：[evaluation-harness-fixtures.ts](/d:/C_Project/openclaw_compact_context/tests/fixtures/evaluation-harness-fixtures.ts)

它覆盖了这几类真实路径：

- Goal / Rule / Risk / Step �?bundle 选择
- `supported_by` 驱动�?relation-aware evidence recall
- checkpoint / delta / skill candidate �?memory surface
- explain / trace / retrieval / persistence 输出
- explicit document evidence 的“应被排除”探�?- bilingual context-processing 路径
- `Attempt / Episode / FailureSignal / ProcedureCandidate` 的经验对象回�?
一句话说，这套 fixture 现在既覆盖“阶�?4 第一轮的 relation / memory 主链”，也覆盖“阶�?4 第二轮的 context-processing 主链”�?
---

## 4. 当前阈�?
第一轮默认阈值偏保守，目标是先做回归守门；第二轮新增�?context-processing 阈值也沿用同样策略�?
- relation precision >= `1.00`
- relation recall >= `1.00`
- relation noise <= `0`
- memory usefulness >= `1.00`
- memory intrusion <= `0.00`
- bundle required coverage >= `1.00`
- bundle forbidden intrusion <= `0`
- explain completeness >= `1.00`
- semantic node coverage >= `1.00`
- concept normalization coverage >= `1.00`
- evidence anchor completeness >= `1.00`
- experience learning coverage >= `1.00`
- bundle relation lookup `edge <= 1`、`node <= 1`

explain 侧的总成本阈值按探针数量动态计算：

- `selectionCompile` edge/node lookup 总量 <= `probeCount`
- `adjacency` edge/node lookup 总量 <= `probeCount`
- `persistenceReadCountTotal <= probeCount * 3`

这样做的目的，是让阶�?4 后续每次�?relation / 扩记忆时，都必须显式承担阈值变化�?
---

## 5. 如何运行

### 5.1 单独跑评�?
```bash
npm run test:evaluation
```

### 5.2 跑全量测�?
```bash
npm test
```

---

## 6. 当前输出结构

评估 runner 会输出一�?`EvaluationReport`，核心包含：

- `bundle`
  - `id / checkpointId / deltaId / skillCandidateIds`
- `metrics.bundleQuality`
- `metrics.relationRecall`
- `metrics.memoryQuality`
- `metrics.explainCompleteness`
- `metrics.retrievalCost`
- `metrics.contextProcessing`
- `pass / failures`

同时也提供了 `formatEvaluationReport()`，方便在测试失败时直接打印可读摘要�?
---

## 7. 当前边界

这套 evaluation harness 现在已经覆盖到第二轮，但仍然不追求一次做成完整评估平台。它暂时不覆盖：

- SQLite 独立评估矩阵
- �?workspace / global scope 混合样本
- 多跳 relation recall 路径
- Topic / Concept 主导 admission 的独立评�?- merge / retire 之后的长期记忆质量回�?
这些更适合进入阶段 5 预研后继续增强�?
---

## 8. 一句话结论

`阶段 4 evaluation harness` 现在已经能把 relation recall、memory surface、bundle quality、explain completeness、retrieval cost �?context-processing metrics 拉到同一份回归报告里，足够作为阶�?4 第一轮与第二轮的共同评估守门器�?

