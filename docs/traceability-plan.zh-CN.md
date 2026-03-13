# OpenClaw Traceability 方案
配套阅读：
- 总体设计：[context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-engine-design-v2.zh-CN.md)
- 多层图谱方案：[layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/layered-knowledge-graph-architecture.zh-CN.md)
- Provenance 方案：[provenance-schema-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/provenance-schema-plan.zh-CN.md)
- Schema 治理方案：[schema-governance-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/schema-governance-plan.zh-CN.md)
- 冲突消解方案：[conflict-resolution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/conflict-resolution-plan.zh-CN.md)

## 1. 文档目标

这份文档回答阶段 3 的第三条治理主线：

`系统如何把一条上下文从原始输入，一路追到语义节点、bundle、prompt、checkpoint 和 skill。`

它的目标不是做日志堆积，而是建立一条可读、可调试、可解释的统一追查链。

## 2. 为什么现在需要 Traceability

当前系统已经有不少解释能力：
- provenance
- selection explain
- bundle diagnostics
- artifact lookup
- `inspect_bundle`
- `query_nodes + explain`

但这些能力还存在一个问题：

`能解释局部，不能总览整链。`

现在我们可以分别回答：
- 这条节点来自哪
- 为什么它进了 bundle
- 为什么某条 query 命中了它

但还不够稳定地回答：
- 一条原始输入最后是怎么变成 prompt 内容的
- 为什么某段历史只进 checkpoint 没进 prompt
- 为什么某条知识被压缩成 summary
- 为什么某条节点后来变成了 skill candidate

所以阶段 3 需要把这些局部 explain 收敛成统一 Trace 视图。

## 3. Traceability 要解决什么

建议把 Traceability 的目标拆成 4 类追查：

1. `Source Trace`
   - 从哪条原始输入来的

2. `Transformation Trace`
   - 经过了哪些中间步骤

3. `Selection Trace`
   - 为什么进或没进 bundle / prompt

4. `Persistence Trace`
   - 后续沉淀到了 checkpoint / delta / skill 的哪里

## 4. 设计原则

### 原则 1：Trace 只解释，不改写事实

trace 是观察视图，不是新的事实源。

### 原则 2：优先串联现有能力，而不是另起一套系统

阶段 3 先收拢：
- provenance
- selection diagnostics
- audit explain
- artifact lookup

而不是另造一个重型 tracing 基础设施。

### 原则 3：追查链必须和 compiler 对齐

如果 trace 看不出：
- 为什么被选中
- 为什么被跳过
- 为什么被压缩

那它对当前系统价值就不够。

### 原则 4：调试入口优先统一，而不是继续分散

后续应尽量让：
- `explain`
- `query_nodes + explain`
- `inspect_bundle`

都能读到同一套 trace 视图。

## 5. 推荐的最小追查链

建议把当前系统的统一 trace 主链定义成：

```text
raw input
-> RawContextRecord
-> Evidence
-> Semantic Node
-> ContextSelection
-> RuntimeContextBundle
-> prompt injection / summary
-> checkpoint / delta / skill candidate
```

这条链覆盖了：
- 输入
- 入图
- 编译
- 输出
- 沉淀

## 6. Trace 视图应该包含什么

建议统一成下面这类结构：

```ts
interface TraceView {
  source: {
    rawSourceId?: string;
    sourceStage?: string;
    producer?: string;
    sourcePath?: string;
  };
  transformation: {
    recordId?: string;
    evidenceNodeId?: string;
    semanticNodeId?: string;
    derivedFromNodeIds?: string[];
    createdByHook?: string;
  };
  selection: {
    included?: boolean;
    slot?: string;
    reason?: string;
    tokenBudget?: number;
    query?: string;
  };
  output: {
    promptReady?: boolean;
    preferredForm?: 'raw' | 'summary' | 'citation_only' | 'derived';
    assembledIntoPrompt?: boolean;
    summarizedIntoCompactView?: boolean;
  };
  persistence: {
    checkpointId?: string;
    deltaId?: string;
    skillCandidateId?: string;
  };
}
```

## 7. Trace 的四段设计

## 7.1 Source Trace

这一段负责回答：
- 原始内容来自 transcript 还是 live snapshot
- 来自 message / compaction / tool_result_persist / checkpoint
- 原始正文在哪

建议最少依赖：
- `sourceRef`
- `provenance.rawSourceId`
- `provenance.sourceStage`
- artifact path

当前实现基础：
- provenance 已有
- tool result artifact 已有

## 7.2 Transformation Trace

这一段负责回答：
- 原始记录怎么变成 Evidence
- Evidence 怎么变成语义节点
- 它是直接入图还是由压缩/派生过程产生

建议最少记录：
- `RawContextRecord.id`
- `Evidence.id`
- `Semantic Node.id`
- `derivedFromNodeIds`
- `createdByHook`

## 7.3 Selection Trace

这是当前最值钱的一段，因为它直接对应运行时误解排查。

它要回答：
- 这条节点是否被当前 query 命中
- 是否进入 bundle
- 进入了哪个 slot
- 被选中的原因是什么
- 如果没进，是预算问题、冲突问题、prompt readiness 问题，还是 relevance 不够

当前实现基础：
- `ContextSelection.reason`
- bundle diagnostics
- queryMatch

当前缺口：
- 这些信息还没有统一成一个 trace view

## 7.4 Persistence Trace

这一段负责回答：
- 这条知识有没有被沉淀进 checkpoint
- 是不是变成了 delta
- 有没有进一步变成 skill candidate

建议至少能看到：
- checkpoint id
- delta id
- skill candidate id
- 对应 derived link

## 8. 与当前调试入口的关系

## 8.1 explain

未来应成为最细粒度的节点级 trace 入口。

建议补强方向：
- 输出统一 `trace` 字段
- 合并 provenance / conflict / governance / selection

## 8.2 query_nodes + explain

未来应成为“先查到候选，再看 trace”的批量排查入口。

建议补强方向：
- 每条 explanation 都返回最小 trace
- 支持快速看命中词项和 selection 结果

## 8.3 inspect_bundle

未来应成为“这轮为什么这么编译”的总览入口。

建议补强方向：
- 附带 selected node sample trace
- 能看出 fixed slot / reserved slot 的选入链

## 9. 典型排查场景

## 9.1 为什么一条 raw 规则没进 prompt

trace 应该能看到：
- `sourceStage = transcript_message`
- 已形成 `Rule` 节点
- 当前 query 下 `selection.included = false`
- reason 可能是：
  - 被更高优先级规则覆盖
  - conflict suppress
  - budget 不足
  - promptReadiness 不允许

## 9.2 为什么一条 tool result 只看到 summary

trace 应该能看到：
- 原始 tool result 来自哪个 hook
- artifact path 在哪
- `preferredForm = summary`
- `requiresCompression = true`
- prompt 中只注入了 summary

## 9.3 为什么一段历史没出现在 bundle

trace 应该能看到：
- 它是否已经进入 checkpoint
- 是否因为 recency/tail 策略没进本轮 prompt
- 是否只保留了 derived summary

## 10. 推荐的统一输出视图

建议后续 explain 结果里补这样一块：

```ts
interface TraceExplainView {
  source: {
    sourceStage?: string;
    rawSourceId?: string;
    sourcePath?: string;
  };
  transformation: {
    evidenceNodeId?: string;
    semanticNodeId?: string;
    derivedFromNodeIds?: string[];
    createdByHook?: string;
  };
  selection: {
    included?: boolean;
    slot?: string;
    reason?: string;
    tokenBudget?: number;
  };
  persistence: {
    checkpointId?: string;
    deltaId?: string;
    skillCandidateId?: string;
  };
}
```

## 11. 代码接入点

## 11.1 Source / Transformation

- [transcript-loader.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/transcript-loader.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/ingest-pipeline.ts)

目标：
- 为 raw record、evidence、semantic node 建稳定映射

## 11.2 Selection

- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts)

目标：
- 把 selection 结果和 node id 的映射保留得更清楚

## 11.3 Explain / Debug

- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

目标：
- 用统一 trace view 输出而不是碎片 explain

## 11.4 Persistence

- [checkpoint-manager.ts](/d:/C_Project/openclaw_compact_context/src/core/checkpoint-manager.ts)
- [skill-crystallizer.ts](/d:/C_Project/openclaw_compact_context/src/core/skill-crystallizer.ts)
- [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/src/core/sqlite-graph-store.ts)

目标：
- 让 checkpoint / delta / skill 能回连到 source node

## 12. 推荐实施顺序

### P0

- 统一 trace 目标结构
- explain 输出最小 trace view
- 把 source / selection 两段串起来

### P1

- 接入 persistence trace
- `inspect_bundle` 输出 sample trace
- 增加“为什么没保留某段历史”的 trace 解释

### P2

- 更强的跨层 trace
- 更完整的 prompt injection trace
- 更细的多轮演化视图

## 13. 一句话结论

`阶段 3 的 Traceability，不是再做一套新日志系统，而是把 provenance、selection diagnostics、artifact lookup 和 checkpoint/skill 沉淀统一成一条从输入到 prompt 再到记忆沉淀的可追查链。`
