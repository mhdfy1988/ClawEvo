# 上下文处理代码流转图
这份文档对应当前仓库里的“上下文处理”主链，重点说明：

`输入 -> 解析 -> 语义片段 -> 概念归一 -> 噪音治理 -> 总结候选 -> 物化计划 -> 入图 / explain / 评估`

## 总流程图

```mermaid
flowchart TD
    A[OpenClaw 消息 / transcript / 工具结果] --> B[构建原始上下文输入 buildRawContextInput]
    B --> C[标注输入路由 annotateContextInputRoute]
    C --> D[ContextProcessingPipeline.processContextRecord]
    D --> E[语句解析 parseContextRecordUtterance]
    D --> F[语义片段 buildSemanticSpansFromRecord]
    F --> G[概念归一 normalizeConcepts]
    D --> H[噪音治理 evaluateNoisePolicy]
    D --> I[节点候选 buildNodeCandidates]
    D --> J[总结候选 buildSummaryCandidates]
    D --> K[经验提示 buildContextProcessingExperienceHint]
    D --> L[物化计划 materializationPlan]
    L --> M[IngestPipeline.ingest]
    M --> N[物化节点 materializeSemanticNodeCandidate]
    N --> O[GraphStore.upsertNodes / upsertEdges]
    O --> P[ContextCompiler.compile]
    P --> Q[RuntimeContextBundle]
    Q --> R[AuditExplainer.explain]
    Q --> S[evaluation-harness]
    D --> T[context-processing-harness]
```

## 函数级时序图

```mermaid
sequenceDiagram
    participant Host as OpenClaw 宿主
    participant Adapter as context-engine-adapter.ts
    participant Contracts as context-processing-contracts.ts
    participant Pipeline as context-processing-pipeline.ts
    participant Parser as utterance-parser.ts
    participant Spans as semantic-spans.ts
    participant Concepts as concept-normalizer.ts
    participant Noise as noise-policy.ts
    participant Summary as summary-planner.ts
    participant Ingest as ingest-pipeline.ts
    participant Store as graph-store / sqlite-graph-store
    participant Compiler as context-compiler.ts
    participant Explain as audit-explainer.ts

    Host->>Adapter: ingest() / assemble() / explain()
    Adapter->>Contracts: annotateContextInputRoute(record)
    Adapter->>Pipeline: processContextRecord(record)
    Pipeline->>Parser: parseContextRecordUtterance(record)
    Pipeline->>Spans: buildSemanticSpansFromRecord(record)
    Spans->>Concepts: normalizeConcepts(clause.text)
    Pipeline->>Noise: evaluateNoisePolicy(route, spans)
    Pipeline->>Pipeline: buildNodeCandidates()
    Pipeline->>Summary: buildSummaryCandidates(nodeCandidates)
    Pipeline-->>Adapter: parseResult + semanticSpans + noiseDecisions + nodeCandidates + summaryCandidates + materializationPlan

    Adapter->>Ingest: ingest(rawContextInput)
    Ingest->>Ingest: buildEvidenceNode(record)
    Ingest->>Pipeline: processContextRecord(record)
    Ingest->>Ingest: materializeSemanticNodeCandidate()
    Ingest->>Store: upsertNodes() / upsertEdges()

    Host->>Compiler: compileContext()
    Compiler->>Store: queryNodes() / getEdgesForNodes()
    Compiler-->>Host: RuntimeContextBundle

    Host->>Explain: explain(nodeId)
    Explain->>Pipeline: processContextGraphNode(node, sourceNode)
    Explain-->>Host: semantic spans + evidence anchor + noise summary + trace
```

## 模块对照

| 阶段 | 主要文件 | 作用 |
|---|---|---|
| 输入标准化 | [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts) | 把宿主消息转成 `RawContextRecord` |
| route 契约 | [context-processing-contracts.ts](/d:/C_Project/openclaw_compact_context/src/core/context-processing-contracts.ts) | 解析输入来源并固定处理合同 |
| 上下文处理总入口 | [context-processing-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/context-processing-pipeline.ts) | 串起解析、归一、噪音治理、总结候选与物化计划 |
| 句子/子句解析 | [utterance-parser.ts](/d:/C_Project/openclaw_compact_context/src/core/utterance-parser.ts) | 中英文 sentence split 与 clause split |
| 语义片段 | [semantic-spans.ts](/d:/C_Project/openclaw_compact_context/src/core/semantic-spans.ts) | 生成 `SemanticSpan + EvidenceAnchor` |
| 概念归一 | [concept-normalizer.ts](/d:/C_Project/openclaw_compact_context/src/core/concept-normalizer.ts) | 中英别名归一到 canonical concept |
| 噪音治理 | [noise-policy.ts](/d:/C_Project/openclaw_compact_context/src/core/noise-policy.ts) | 计算 `drop / evidence_only / hint_only / materialize` |
| 总结候选 | [summary-planner.ts](/d:/C_Project/openclaw_compact_context/src/core/summary-planner.ts) | 产出 `summary candidates` |
| 语义分类 | [semantic-classifier.ts](/d:/C_Project/openclaw_compact_context/src/core/semantic-classifier.ts) | clause -> candidate node types |
| 节点物化 | [semantic-node-materializer.ts](/d:/C_Project/openclaw_compact_context/src/core/semantic-node-materializer.ts) | candidate -> GraphNode |
| 入图 | [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/ingest-pipeline.ts) | 先落 Evidence，再落补充语义节点和边 |
| 编译 | [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts) | 图谱 -> `RuntimeContextBundle` |
| explain | [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts) | 输出 spans、anchor、noise、trace、persistence |
| 专项测试 | [context-processing-harness.ts](/d:/C_Project/openclaw_compact_context/src/evaluation/context-processing-harness.ts) | 独立评估 parse / concept / noise / summary / experience |

## 当前处理逻辑

### 1. 保留原文，不直接重写
上下文处理不会先把用户消息改写成摘要，而是：
- 保留原文 Evidence
- 旁路生成 `parseResult`
- 再生成 `SemanticSpan / ConceptMatch / NodeCandidate`

### 2. 一条消息可以产多个语义原子
当前主链已经不是“message -> 一个主节点”，而是：

`message -> Evidence -> SemanticSpan[] -> 多个补充语义节点`

补充节点可能包括：
- `Goal`
- `Constraint`
- `Process`
- `Step`
- `Topic`
- `Concept`

### 3. 噪音和弱语句不会强行升格
通过 `noise-policy.ts`，弱语句会被分类为：
- `drop`
- `evidence_only`
- `hint_only`
- `materialize`

这使得上下文处理和图谱入图之间有了明确缓冲层。

### 4. 上下文处理已经可以独立测试
现在可以直接跑：

```powershell
npm run test:context-processing
```

它会覆盖：
- 契约
- parser
- concept normalize
- noise policy
- summary planner
- raw-first experience hint
- harness

## 一句话总结

`当前上下文处理已经是一条独立主链：先解析和归一，再决定哪些内容该降级、哪些该总结、哪些该物化入图，最后再接入 compiler、explain 和专项评估。`
