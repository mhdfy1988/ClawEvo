# 多跳 Recall 与 Path Explain 方案

配套阅读：
- [stage-5-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-prework.zh-CN.md)
- [stage-5-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-todo.zh-CN.md)
- [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)
- [relation-contract.ts](/d:/C_Project/openclaw_compact_context/src/governance/relation-contract.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/runtime/context-compiler.ts)

## 1. 目标

这份文档用于收敛阶段 5 里“多跳 relation recall 与 path explain”的进入边界。

一句话结论：

`多跳 recall 不应该一上来进入主 bundle 主链，而应该先做受控白名单、多跳预算和强 explain，再逐步放量。`

## 2. 当前基线

当前已经稳定进入主链的是：

- 一跳 `supported_by`
- 一跳 `requires`
- 一跳 `next_step`
- 一跳 `overrides / supersedes / conflicts_with` 的治理消费

当前还没有正式进入主链的是：

- 两跳及以上路径召回
- 路径级 explain
- 路径预算和路径降级策略

## 3. 多跳 recall 的进入条件

### 3.1 允许进入多跳路径的 relation type

建议第一批只允许下面这些边参与多跳：

- `supported_by`
- `requires`
- `next_step`
- `overrides`
- `supersedes`

不建议第一批就纳入：

- 广义 `mentions`
- 低置信 topic/concept 弱连接
- 纯 explain 用的辅助边

### 3.2 允许的路径形态

建议第一批只允许下面几类模板：

- `Goal/Constraint -> supported_by -> Evidence`
- `Process -> next_step -> Step -> supported_by -> Evidence`
- `Rule -> requires -> Step -> supported_by -> Evidence`
- `Current selection -> overrides/supersedes -> suppressed node`

也就是说，第一批更适合：

- `1.5 跳`
- `2 跳`

不建议一开始就做无约束 BFS。

## 4. Path Explain 最小合同

每条路径 explain 至少要输出：

```ts
type RecallPathExplain = {
  pathId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeTypes: string[];
  hopCount: number;
  pathScore: number;
  pathKind: "evidence" | "procedure" | "governance";
  includedInBundle: boolean;
  inclusionReason: string;
}
```

最少要能回答：

- 这条节点为什么被召回
- 它是经过哪几条边被召回的
- 为什么这条路径允许进入 bundle
- 如果没进 bundle，是因为预算、冲突还是路径只允许 explain

## 5. 预算、成本与降级

### 5.1 路径预算

建议在现有 node budget 外，再单独引入：

- `maxRecallHop`
- `maxPathsPerSource`
- `maxExpandedTargets`
- `maxPathExplainItems`

### 5.2 成本诊断

建议 diagnostics 里补：

- `pathExpansionCount`
- `pathPrunedCount`
- `pathExplainCount`
- `pathBudgetExhausted`

### 5.3 降级规则

如果达到预算或成本上限：

- 优先退化成一跳 relation recall
- 路径保留在 explain
- 不继续进入主 bundle

## 6. 进入主 bundle 的约束

建议第一批只有下面两类路径结果能进入 bundle：

- 高置信 evidence path
- 高置信 procedure path

下面这些只建议先做 explain：

- governance path
- suppressed lineage path
- topic/concept 弱路径

## 7. 推荐推进顺序

1. 先做 path explain 数据合同
2. 再做 `2 hop` 的受控白名单
3. 再接 evaluation harness
4. 最后才考虑是否让多跳结果进入主 bundle

## 8. 一句话结论

`多跳 recall 的第一目标不是“更会找”，而是“更会解释、可控扩展、不会把 bundle 变吵”。`


