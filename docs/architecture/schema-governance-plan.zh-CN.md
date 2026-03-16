# OpenClaw Schema 治理方案
配套阅读：
- 总体设计：[context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-design-v2.zh-CN.md)
- 多层图谱方案：[layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/layered-knowledge-graph-architecture.zh-CN.md)
- Provenance 方案：[provenance-schema-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/provenance-schema-plan.zh-CN.md)
- 冲突消解方案：[conflict-resolution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/conflict-resolution-plan.zh-CN.md)

## 1. 文档目标

这份文档回答的是阶段 3 里 `Schema` 这条治理主线：

`什么是当前系统里一条“可治理、可编译、可解释”的知识对象最小契约。`

它的重点不是再定义一套脱离代码的新模型，而是把当前已经分散在：
- node 顶层字段
- payload
- provenance
- compiler selection
- explain 结果
- SQLite 存储

里的治理信息，收敛成统一的 schema 视图。

## 2. 为什么现在需要 Schema 治理

当前系统其实已经有很多核心字段：
- `type / scope / kind / strength`
- `confidence / freshness / validFrom / validTo`
- `provenance`
- `sourceRef`
- compiler diagnostics
- selection reason

但这些信息目前还存在 3 个问题：

1. `同一类治理信息分散`
   - 有些在 node 顶层
   - 有些在 payload
   - 有些只在 compiler 里临时计算

2. `Prompt Readiness 还没显式建模`
   - 系统知道怎么选
   - 但节点自身还不知道“能不能进 prompt、以什么形式进”

3. `Knowledge State / Validity / Trace 没完全收成统一契约`
   - 现在能读懂
   - 但还不够适合后续稳定演进和跨模块读取

所以阶段 3 的 `Schema` 目标不是“重构所有类型”，而是：

`把当前系统从“能工作”升级到“能统一、能演进、能被 compiler 和 explain 稳定消费”。`

## 3. Schema 治理要解决什么

建议把 `Schema` 理解成 4 个输出：

1. `Node Contract`
   - 每条知识最小长什么样

2. `Knowledge State`
   - 这条知识是 `raw / compressed / derived`

3. `Validity`
   - 这条知识当前是否可信、有效、已过期、已冲突、已被覆盖

4. `Prompt Readiness`
   - 这条知识能不能进入 prompt
   - 进入时以什么形式进入
   - 是否必须附证据
   - 是否需要先压缩

## 4. 设计原则

### 原则 1：Schema 不替代原文证据

schema 只是治理契约，不能替代 `Evidence-first`。

### 原则 2：Schema 服务于 compiler，而不是只服务于存储

设计时必须直接考虑：
- compiler 怎么读
- explain 怎么读
- query_nodes 怎么读

### 原则 3：优先统一读取视图，而不是一次性重构所有持久化结构

阶段 3 优先做“可稳定读取的治理视图”，不急着一步到位拆很多新表。

### 原则 4：兼容当前代码主链

必须能平滑接到：
- [core.ts](/d:/C_Project/openclaw_compact_context/packages/contracts/src/types/core.ts)
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
- [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/infrastructure/sqlite-graph-store.ts)

## 5. 当前系统已经有的 Schema 基础

## 5.1 顶层节点字段

当前节点已经有：
- `id`
- `type`
- `label`
- `scope`
- `kind`
- `strength`
- `confidence`
- `freshness`
- `validFrom / validTo`
- `version`
- `sourceRef`
- `provenance`

这说明我们并不是从 0 开始，而是已经具备了很强的主干。

## 5.2 运行时治理能力

当前运行时已经具备：
- `raw-first / compressed-fallback`
- budget class
- selection reason
- bundle diagnostics
- explain provenance

这说明 `Prompt Readiness` 只是“还没显式化”，不是“完全没有”。

## 5.3 当前缺口

真正缺的是：
- 明确的 `knowledgeState` 读取入口
- 明确的 `validity` 视图
- 明确的 `promptReadiness` 结构
- 更统一的 `governance` 组织方式

## 6. 推荐的最小治理结构

建议在现有 node 上收敛成一个统一治理视图：

```ts
interface NodeGovernance {
  provenance: ProvenanceRef;
  knowledgeState: 'raw' | 'compressed' | 'derived';
  validity: {
    confidence: number;
    freshness: 'active' | 'stale' | 'superseded';
    validFrom: string;
    validTo?: string;
    conflictStatus?: 'none' | 'potential' | 'confirmed' | 'superseded';
    resolutionState?: 'unresolved' | 'suppressed' | 'selected' | 'deferred';
  };
  promptReadiness: {
    eligible: boolean;
    preferredForm: 'raw' | 'summary' | 'citation_only' | 'derived';
    requiresEvidence: boolean;
    requiresCompression: boolean;
    selectionPriority: 'must' | 'high' | 'normal' | 'low';
    budgetClass: 'fixed' | 'reserved' | 'candidate';
  };
  traceability: {
    rawSourceId?: string;
    derivedFromNodeIds?: string[];
    derivedFromCheckpointId?: string;
  };
}
```

这个结构不要求一开始就作为独立表存在，但至少应该作为统一读取视图存在。

## 7. 四块核心治理输出

## 7.1 Provenance

这部分当前已经相对成熟，重点是不要让它继续散开。

最少应保留：
- `originKind`
- `sourceStage`
- `producer`
- `rawSourceId`
- `rawContentHash`
- `derivedFromNodeIds`
- `derivedFromCheckpointId`
- `createdByHook`

当前结论：
- `状态：已实现主干`

## 7.2 Knowledge State

这部分虽然已经通过 `originKind` 实际存在，但建议在治理视图里单独抽成显式概念：

- `raw`
- `compressed`
- `derived`

这样做的价值是：
- compiler 可以直接按知识状态裁决
- explain 可以更稳定输出
- 后续 conflict / trace 也更容易统一表达

当前结论：
- `状态：已有能力，但建议显式化为治理字段`

## 7.3 Validity

建议把下面这些收敛到统一 validity 视图：

- `confidence`
- `freshness`
- `validFrom`
- `validTo`
- `conflictStatus`
- `resolutionState`

也就是说，`Validity` 不只是“时间有效性”，还包括：
- 是否过期
- 是否已被覆盖
- 是否存在已确认冲突
- 当前是否被 suppress

当前结论：
- `状态：已有时间与置信度基础，冲突态还需补齐`

## 7.4 Prompt Readiness

这部分是阶段 3 最值钱的新补充。

建议把每条知识的可入 prompt 状态显式表达成：

- `eligible`
  - 默认能不能进入 prompt
- `preferredForm`
  - 更适合以 `raw / summary / citation_only / derived` 哪种形式进入
- `requiresEvidence`
  - 进入 prompt 时是否必须附带证据支持
- `requiresCompression`
  - 是否要先压缩后再进入
- `selectionPriority`
  - 在当前 bundle 中更像 `must / high / normal / low`
- `budgetClass`
  - 更适合落在哪类预算槽位里

当前结论：
- `状态：运行时有隐式逻辑，schema 尚未显式化`

## 8. 推荐的最小节点契约

建议阶段 3 先把“所有进入主链的节点”收敛到下面这套最小契约：

```ts
interface GovernedGraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  scope: ScopeRef;
  sourceRef?: SourceRef;
  payload: Record<string, unknown>;
  governance: NodeGovernance;
}
```

解释：
- `payload`
  - 放业务语义
- `governance`
  - 放横切治理信息

这样后面 `payload` 和 `governance` 的职责会更清楚，不容易继续混在一起。

## 9. 推荐的节点默认策略

阶段 3 不需要每种节点都精细配置，但建议先有默认值。

| 节点类型 | knowledgeState | promptReadiness 默认策略 |
| --- | --- | --- |
| `Evidence` | 按 provenance 推导 | `eligible=false`，除非作为引用或 evidence slot |
| `Rule` | 多为 `raw` 或 `derived` | `eligible=true`，`preferredForm=raw`，`requiresEvidence=true` |
| `Constraint` | 多为 `raw` | `eligible=true`，`preferredForm=raw`，`selectionPriority=must/high` |
| `Goal / Intent` | 多为 `raw` | `eligible=true`，`budgetClass=fixed` |
| `State / Risk / Step` | `raw` 或 `derived` | `eligible=true`，优先 `summary/raw` |
| `Tool` | `compressed` 常见 | `eligible=true`，更适合 `summary` |
| `SkillCandidate` | `derived` | `eligible=false` 或仅 candidate fallback |

## 10. Compiler 如何消费 Schema

Schema 真正有价值的地方，是 compiler 不再完全靠临时规则猜。

建议后续改成：

1. 先读 `governance.knowledgeState`
   - 决定 `raw-first` 还是 fallback

2. 再读 `governance.validity`
   - 过滤 stale / superseded / suppressed

3. 再读 `governance.promptReadiness`
   - 决定是否可入 prompt
   - 决定 preferred form
   - 决定 budget class

4. 最后才做 query score 与 token budget 裁决

这样 compiler 会更像“读取治理契约”，而不是“把治理规则散写在各处”。

## 11. Explain 如何消费 Schema

建议 explain 后续统一输出下面这几类治理摘要：

```ts
interface GovernanceExplainView {
  knowledgeState: 'raw' | 'compressed' | 'derived';
  validity: {
    confidence: number;
    freshness: string;
    conflictStatus?: string;
    resolutionState?: string;
  };
  promptReadiness: {
    eligible: boolean;
    preferredForm: string;
    requiresEvidence: boolean;
    requiresCompression: boolean;
    selectionPriority: string;
    budgetClass: string;
  };
}
```

典型用途：
- 为什么这条节点能进 prompt
- 为什么这条只能当 summary
- 为什么这条必须附带 evidence
- 为什么这条虽然相关但默认不 eligible

## 12. SQLite 演进建议

阶段 3 不建议一开始就大改 schema，但建议按下面节奏推进。

### 第一步：类型层统一

先在：
- [core.ts](/d:/C_Project/openclaw_compact_context/packages/contracts/src/types/core.ts)
- [io.ts](/d:/C_Project/openclaw_compact_context/packages/contracts/src/types/io.ts)

中统一 `governance` 读取结构。

### 第二步：存储层最小承载

初期可以先把治理信息落在：
- 现有顶层字段
- `payload.governance`
- 或单独的 `governance_json`

三者之一，但建议最终收敛到更明确的读取口径。

### 第三步：按价值再拆字段

只有在下面场景真的出现后，再考虑增加独立列或索引：
- 频繁按 `knowledgeState` 过滤
- 频繁按 `conflictStatus` 过滤
- 频繁按 `promptReadiness.eligible` 查找

## 13. 与现有代码的接入点

## 13.1 类型定义

- [core.ts](/d:/C_Project/openclaw_compact_context/packages/contracts/src/types/core.ts)
- [io.ts](/d:/C_Project/openclaw_compact_context/packages/contracts/src/types/io.ts)

目标：
- 给 node 加统一 `governance` 读取视图
- 避免以后新增治理字段继续散落

## 13.2 ingest 主链

- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)

目标：
- 在节点落图时写默认 governance
- 根据 provenance 和 node type 推导默认 prompt readiness

## 13.3 compiler

- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)

目标：
- 逐步改成优先读取 `governance`
- 把 budget class / preferred form / eligibility 从临时逻辑迁到 schema

## 13.4 explain

- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/context-engine-adapter.ts)

目标：
- 输出治理摘要
- 让 query/debug/inspect 都能稳定看到统一治理视图

## 13.5 存储层

- [001_init.sql](/d:/C_Project/openclaw_compact_context/packages/runtime-core/schema/sqlite/001_init.sql)
- [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/infrastructure/sqlite-graph-store.ts)

目标：
- 给后续 `governance` 持久化预留稳定演进路径

## 14. 推荐实施顺序

### P0

- 定义 `NodeGovernance`
- 显式化 `knowledgeState`
- 显式化 `promptReadiness`
- 统一 validity 读取视图

### P1

- compiler 开始消费 `governance`
- explain 开始输出治理摘要
- query/debug 入口支持展示 prompt readiness

### P2

- 视查询压力增加专门存储字段或索引
- 进一步按节点类型做更细治理策略

## 15. 一句话结论

`阶段 3 的 Schema 治理，不是为了再造一套复杂模型，而是把 provenance、knowledge state、validity 和 prompt readiness 收敛成统一契约，让 compiler、explain 和存储层都能稳定读取同一套治理视图。`



