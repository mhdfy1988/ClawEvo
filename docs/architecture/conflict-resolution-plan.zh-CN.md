# OpenClaw 冲突消解方案
配套阅读：
- 总体设计：[context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-design-v2.zh-CN.md)
- 多层图谱方案：[layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/layered-knowledge-graph-architecture.zh-CN.md)
- Provenance 方案：[provenance-schema-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/provenance-schema-plan.zh-CN.md)
- Hook 到图谱主链：[hook-to-graph-pipeline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/hook-to-graph-pipeline.zh-CN.md)

## 1. 文档目标

这份文档专门回答一个阶段 3 的核心问题：

`当图谱里同时存在多条相近、相反、过期、被覆盖或来源不一致的知识时，系统应该如何发现冲突、表达冲突、裁决冲突，并把结果反馈给 compiler 和 explain。`

它不是要一开始就做复杂图推理，而是先给当前系统补一个最小可落地的冲突治理闭环：

1. 节点和边有最小冲突模型
2. ingest 能发现高价值冲突
3. compiler 能做最小裁决
4. explain 能说清为什么保留这条、压掉那条

## 2. 为什么现在要做 Conflict

当前系统已经具备：
- provenance
- knowledge state 区分：`raw / compressed / derived`
- confidence / freshness / validFrom / validTo
- compiler 的预算池与 selection diagnostics

但还缺一条真正稳定的治理主线：

- 新规则和旧规则冲突时，谁优先
- raw 与 compressed 的结论不一致时，谁降权
- 两条约束表达相反意思时，能否同时进 prompt
- 某条状态已经被新状态覆盖时，是否还应该继续入 bundle

如果没有冲突消解，图谱会越来越像“把所有内容都收进来”，而不是“把当前最可信、最有效、最适合进入 prompt 的内容稳定选出来”。

## 3. 设计目标与非目标

### 3.1 设计目标

- 给高价值节点补最小冲突状态
- 给高价值关系补最小冲突边
- 让 compiler 在不复杂化查询链的前提下做基础裁决
- 让 explain 明确输出冲突原因和裁决结果
- 保持 `Evidence-first` 和 `raw-first`

### 3.2 非目标

- 不在阶段 3 一开始引入复杂本体推理
- 不要求所有节点类型都支持完整冲突语义
- 不要求一次性补齐多跳冲突传播
- 不要求把所有历史差异都建成显式冲突图

## 4. 冲突治理原则

### 原则 1：原文优先于摘要

当 `raw` 与 `compressed` 表达不一致时，默认 `raw` 优先。

### 原则 2：新鲜且未过期优先于陈旧内容

当两条节点表达同一语义组，且一条已经被更新、过期或 superseded，应优先保留更新后的节点。

### 原则 3：强约束优先于弱建议

当 `Rule / Constraint / Mode` 之间冲突时，默认按 `strength + scope + source priority` 裁决。

### 原则 4：冲突结果必须可追查

系统不能只“静默压掉”某条内容；至少应能通过 explain 看到：
- 冲突对象是谁
- 为什么被判断为冲突
- 为什么这条被降权或跳过

### 原则 5：先补最小闭环，再补复杂关系

阶段 3 先解决最值钱的几类冲突，而不是追求全图冲突完备性。

## 5. 阶段 3 的最小冲突范围

建议先覆盖这几类节点：

- `Rule`
- `Constraint`
- `Mode`
- `Decision`
- `State`
- `Process`
- `Step`
- `Risk`

建议先支持这几类冲突：

1. `同语义组覆盖`
   - 新节点覆盖旧节点
   - 典型边：`supersedes`

2. `显式语义对立`
   - 两条内容语义上相反或互斥
   - 典型边：`conflicts_with`

3. `高优先级规则覆盖低优先级规则`
   - 系统规则覆盖弱建议
   - 典型边：`overrides`

4. `知识状态冲突`
   - `raw` 与 `compressed/derived` 对同一语义组产生不同表达

## 6. 最小数据模型

### 6.1 节点侧

建议在现有治理结构里补下面这些字段：

```ts
interface ConflictGovernance {
  conflictStatus: 'none' | 'potential' | 'confirmed' | 'superseded';
  conflictSetKey?: string;
  resolutionState?: 'unresolved' | 'suppressed' | 'selected' | 'deferred';
  overridePriority?: number;
  supersededByNodeId?: string;
  conflictingNodeIds?: string[];
}
```

字段含义：
- `conflictStatus`
  - `none`：没有发现冲突
  - `potential`：存在语义接近但尚未确认
  - `confirmed`：已识别为冲突
  - `superseded`：已被其他节点覆盖
- `conflictSetKey`
  - 同一冲突组的稳定键，例如基于 `scope + semanticGroupKey + nodeType`
- `resolutionState`
  - 当前轮或当前版本的裁决结果
- `overridePriority`
  - 用于规则类对象最小排序
- `supersededByNodeId`
  - 标明谁覆盖了当前节点
- `conflictingNodeIds`
  - 便于 explain 快速定位冲突对手

### 6.2 边侧

当前系统已经预留了这些边类型：

- `conflicts_with`
- `supersedes`
- `overrides`

阶段 3 不需要扩更多新边，只要把这三类边真正用起来。

建议语义如下：

- `conflicts_with`
  - 双向语义
  - 表示两条节点不能在同一决策语境下被同时视为成立
- `supersedes`
  - 单向语义
  - 表示新节点替代旧节点
- `overrides`
  - 单向语义
  - 表示高优先级规则或约束覆盖低优先级项

## 7. 冲突发现策略

### 7.1 发现时机

最小实现建议放在 ingest 阶段：

```text
RawContextRecord
-> Evidence
-> Semantic Node
-> semanticGroupKey / scope / provenance 归一
-> 近邻查询
-> 生成 supersedes / conflicts_with / overrides
```

也就是说，冲突发现不是编译层临时猜，而是尽量在入图时形成显式结果。

### 7.2 发现输入

每个候选节点至少使用这些输入做判断：

- `nodeType`
- `scope`
- `semanticGroupKey`
- `provenance.originKind`
- `confidence`
- `freshness`
- `validFrom / validTo`
- 文本摘要或规范化正文

### 7.3 最小规则

#### 规则 A：同语义组新版本覆盖旧版本

触发条件：
- `nodeType` 一致
- `scope` 一致
- `semanticGroupKey` 一致
- 内容有实质差异，且新节点时间更新

动作：
- 新节点 -> 旧节点 建 `supersedes`
- 旧节点 `conflictStatus = superseded`
- 旧节点 `supersededByNodeId = 新节点`

#### 规则 B：同语义组表达相反

触发条件：
- `nodeType` 属于 `Rule / Constraint / Mode / Step / Decision / State`
- `semanticGroupKey` 接近或一致
- 文本表达落在相反模板上，例如“必须 / 不要”，“启用 / 禁用”，“继续 / 停止”

动作：
- 双向建 `conflicts_with`
- 双方 `conflictStatus = confirmed`
- `conflictSetKey` 相同

#### 规则 C：高优先级规则覆盖低优先级规则

触发条件：
- 两条节点都属于规则类
- 作用范围相同
- 存在 priority 或 strength 差异，且内容在目标对象上冲突

动作：
- 高优先级节点 -> 低优先级节点 建 `overrides`
- 低优先级节点 `resolutionState = suppressed`

#### 规则 D：derived 结论与 raw 证据冲突

触发条件：
- 两条节点同语义组
- 一条 `originKind = raw`
- 一条 `originKind = compressed` 或 `derived`
- 表达出现对立

动作：
- 先标 `potential` 或 `confirmed`
- compiler 默认降权 `compressed/derived`
- explain 明确说明：`raw conflict preferred`

## 8. Compiler 最小裁决顺序

建议当前 compiler 使用下面这套简化顺序：

1. 先过滤明显失效项
   - `validTo < now`
   - `freshness = stale` 且存在更新版本

2. 再过滤 `superseded`
   - 默认不进入 fixed slot
   - 只在 explain 或历史回查时保留

3. 再处理 `confirmed conflict`
   - 同一 `conflictSetKey` 只保留一个优先候选

4. 再应用优先级
   - `raw > compressed > derived`
   - 高 `confidence` 优先
   - 新鲜内容优先
   - `overridePriority` 高者优先

5. 最后再进入现有 budget 裁决

换句话说，冲突裁决发生在预算裁决之前，而不是之后。

## 9. 推荐裁决矩阵

| 冲突场景 | 默认保留 | 默认降权/跳过 |
| --- | --- | --- |
| `raw` vs `compressed` | `raw` | `compressed` |
| `raw` vs `derived` | `raw` | `derived` |
| 新版 vs 旧版 | 新版 | 旧版 |
| 高优先级 `Rule` vs 低优先级 `Constraint` | 高优先级规则 | 低优先级项 |
| 活跃 `State` vs 已 superseded `State` | 活跃状态 | 已覆盖状态 |
| 当前 `Step` vs 过期 `Step` | 当前步骤 | 过期步骤 |

## 10. Explain 与 Trace 输出要求

冲突消解真正有价值的前提，是输出必须可解释。

建议 explain 至少补这几类信息：

```ts
interface ConflictExplainView {
  conflictStatus: 'none' | 'potential' | 'confirmed' | 'superseded';
  resolutionState?: 'unresolved' | 'suppressed' | 'selected' | 'deferred';
  conflictSetKey?: string;
  conflictingNodeIds?: string[];
  supersededByNodeId?: string;
  resolutionReason?: string;
}
```

典型文案应能回答：
- “这条规则为什么没进 bundle”
- “因为它已被哪条更新规则 supersede”
- “为什么这条 compressed 节点没被选中”
- “因为同语义组里存在 raw 节点，且两者冲突”

## 11. 最小示例

### 11.1 规则覆盖

```text
Node A: Rule, "必须保留最近 3 轮原文"
Node B: Rule, "历史消息全部压缩"
```

如果两者 scope 相同，且 A 的 `overridePriority` 更高：
- `A overrides B`
- A 进入 `activeRules`
- B 被 suppress，并在 explain 中说明

### 11.2 状态更新

```text
Node A: State, "当前阻塞原因是 SQLite schema 不兼容"
Node B: State, "当前阻塞原因是测试 fixture 缺失"
```

如果两条属于同一 `semanticGroupKey = current_blocker`，且 B 更晚：
- `B supersedes A`
- A 标记 `superseded`
- compiler 只优先保留 B

### 11.3 原文与摘要冲突

```text
Node A: raw Evidence-backed Constraint, "不要把所有上下文一起压缩"
Node B: compressed summary, "可以先统一摘要全部历史"
```

如果同语义组对立：
- `A conflicts_with B`
- A 在 selection 时优先
- B 在 explain 中显示为 `suppressed by raw conflict`

## 12. 代码接入点

### 12.1 类型与 schema

- [core.ts](/d:/C_Project/openclaw_compact_context/src/types/core.ts)
- [001_init.sql](/d:/C_Project/openclaw_compact_context/packages/runtime-core/schema/sqlite/001_init.sql)
- [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/src/infrastructure/sqlite-graph-store.ts)

建议职责：
- 增加最小 conflict governance 类型
- 持久化 `conflictStatus / resolutionState / conflictSetKey`
- 为后续 explain 和 compiler 提供稳定读取入口

### 12.2 冲突发现

- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/runtime/ingest-pipeline.ts)

建议职责：
- 在语义节点建好后，按 `scope + nodeType + semanticGroupKey` 查询近邻
- 生成 `supersedes / conflicts_with / overrides`
- 更新旧节点的最小冲突字段

### 12.3 冲突裁决

- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/runtime/context-compiler.ts)

建议职责：
- 在现有打分之前先做 conflict-aware 过滤
- 对 `superseded` 和 `confirmed conflict` 做预裁决
- 把冲突结果写入 diagnostics 和 selection reason

### 12.4 冲突解释

- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/runtime/audit-explainer.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

建议职责：
- `explain` 输出 conflict view
- `inspect_bundle` 和 `query_nodes + explain` 能看到冲突裁决原因

## 13. 推荐演进顺序

### P0

- 定义最小 conflict governance schema
- 支持 `supersedes / conflicts_with / overrides`
- compiler 接入最小裁决顺序
- explain 输出最小 conflict view

### P1

- 为 `Rule / Constraint / Mode / State / Step` 补更多规则模板
- 把 conflict 结果写进 bundle diagnostics
- 支持“为什么某段历史只留摘要不留原文”的部分冲突解释

### P2

- 增强主题层和冲突传播
- 支持更丰富的跨层冲突
- 视需要增加专门索引和查询优化

## 14. 一句话结论

`阶段 3 的 Conflict 不需要先做复杂图推理；最值钱的是先把同语义组覆盖、显式语义对立、规则优先级覆盖、raw 与 compressed 冲突这四类场景做成可发现、可裁决、可解释的最小闭环。`


