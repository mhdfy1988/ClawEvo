# Gateway 调试入口使用说明

## 1. 文档目标

这份文档用于固定当前 `compact-context` 在 Gateway 层暴露出来的调试入口，以及三条最常用的排查路径：

1. `compact-context.explain`
2. `compact-context.query_nodes` + explain 附加输出
3. `compact-context.inspect_bundle`

它回答的不是“插件内部怎么实现”，而是：

- 现在有哪些调试入口可用
- 每个入口适合排查什么问题
- `selectionContext` 是怎么补出来的
- 实际请求该怎么写
- 返回结果里最应该看哪些字段

---

## 2. 入口概览

### 2.1 `compact-context.explain`

适合：

- 已经知道某个 `nodeId`
- 想看这条节点的来源、关联节点、provenance
- 想知道它为什么会被选进当前 bundle，或者为什么没被选中

当前实现位置：

- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts)
- [io.ts](/d:/C_Project/openclaw_compact_context/src/types/io.ts)

### 2.2 `compact-context.query_nodes`

适合：

- 还不知道具体 `nodeId`
- 先按 `type / text / sessionId / originKinds` 查一批节点
- 再顺手附带 explain，快速看“哪些节点值得继续深挖”

当前支持：

- `filter.text`
- `queryMatch`
- `explain: true`
- `includeExplain: true`
- `explainLimit`

也就是说，`query_nodes` 已经不只是“查列表”，还可以变成：

- `查列表 + 看文本命中诊断`
- `查列表 + 给前几个节点做 explain`
- `查列表 + 同时拿 queryMatch 和 explain`

### 2.3 `compact-context.inspect_bundle`

适合：

- 想直接看“当前这轮 compile_context 到底选了什么”
- 想同时拿到：
  - bundle 原始结构
  - summary 视图
  - promptPreview 视图
  - explain sample

这是 Gateway 专用调试入口，不属于底层 plugin API 合同。

---

## 3. `selectionContext` 的补全规则

`explain` 和 `query_nodes + explain` 依赖 `selectionContext` 才能回答“为什么被选中/为什么没选中”。

当前补全顺序是：

1. 显式 `selectionContext`
2. 顶层简写参数
3. `query_nodes.filter` 里的回退字段

### 3.1 显式写法

```json
{
  "nodeId": "node-123",
  "selectionContext": {
    "sessionId": "session-a",
    "query": "why is the build blocked",
    "tokenBudget": 320
  }
}
```

### 3.2 顶层简写

对 `compact-context.explain`，下面这种写法会自动被包成 `selectionContext`：

```json
{
  "nodeId": "node-123",
  "sessionId": "session-a",
  "query": "why is the build blocked",
  "tokenBudget": 1000
}
```

这里的 `tokenBudget` 不是直接拿去 compile，而是会先经过 `resolveCompileBudget()` 转成 compile budget。

### 3.3 `query_nodes` 的回退

如果 `query_nodes` 没显式传 `selectionContext`，系统会尝试从下面这些字段推导：

- `sessionId`
- `query`
- `compileTokenBudget`
- `tokenBudget`
- `filter.sessionId`
- `filter.text`

也就是说，下面这种请求就足够让 explain 附带 selection diagnostics：

```json
{
  "filter": {
    "sessionId": "session-a",
    "types": ["Risk"],
    "text": "why is the build blocked"
  },
  "explain": true
}
```

---

## 4. 常用调用示例

### 4.1 解释单个节点

请求：

```json
{
  "nodeId": "risk-node-id",
  "sessionId": "session-a",
  "query": "why is the build blocked",
  "tokenBudget": 1000
}
```

调用方法：

`compact-context.explain`

重点看返回里的：

- `summary`
- `provenance`
- `selection.included`
- `selection.slot`
- `selection.reason`

### 4.2 查节点并顺手解释前几个结果

请求：

```json
{
  "filter": {
    "sessionId": "session-a",
    "types": ["Risk"],
    "text": "build blocked"
  },
  "explain": true,
  "explainLimit": 3
}
```

调用方法：

`compact-context.query_nodes`

返回中除了 `nodes`，还会多一个：

```json
{
  "queryMatch": {
    "enabled": true,
    "query": "build blocked",
    "queryTerms": ["build", "blocked"],
    "matchedNodeCount": 2,
    "diagnostics": []
  },
  "explain": {
    "enabled": true,
    "explainLimit": 3,
    "explainedCount": 2,
    "totalNodeCount": 2,
    "truncated": false,
    "selectionContext": {
      "sessionId": "session-a",
      "query": "build blocked"
    },
    "explanations": []
  }
}
```

如果你只想看“为什么这几个节点会被召回”，不想额外跑 explain，也可以只传：

```json
{
  "filter": {
    "sessionId": "session-a",
    "types": ["Risk", "Evidence"],
    "text": "build blocked sqlite timeout"
  }
}
```

这时返回里仍然会附带 `queryMatch`，只是不会有 `explain`。

### 4.3 一次性检查当前 bundle

请求：

```json
{
  "sessionId": "session-a",
  "query": "why is the build blocked",
  "tokenBudget": 1000,
  "explainLimit": 5
}
```

调用方法：

`compact-context.inspect_bundle`

返回里最值得先看：

- `summary`
- `promptPreview`
- `bundle.diagnostics`
- `explain.explanations`

### 4.4 只看 bundle，不要 explain sample

```json
{
  "sessionId": "session-a",
  "includeExplain": false
}
```

这适合只想快速确认 compile 结果，不想额外跑 explain 的场景。

---

## 5. 返回结果怎么看

### 5.1 `ExplainResult.selection`

关键字段：

- `included`
  - `true` 表示这条节点进了当前 runtime bundle
  - `false` 表示这条节点这轮没进 bundle
- `slot`
  - 例如 `openRisks`、`relevantEvidence`、`currentProcess`
- `reason`
  - 例如 `open risk (raw:tool_output_raw)`
  - 或 `skipped because total budget was exhausted`
- `categoryBudget`
  - 如果节点属于分类池，会附带该池的预算

### 5.2 `query_nodes.queryMatch`

重点字段：

- `query`
- `queryTerms`
- `matchedNodeCount`
- `diagnostics`

其中每条 `diagnostics` 最值得看：

- `bestField`
  - 主要命中在 `label` 还是 `payload`
- `matchedTerms`
  - 实际命中的词项
- `coverage`
  - 当前节点覆盖了多少查询词
- `labelMatch`
- `payloadMatch`

这个块回答的是：

- 为什么这条节点会被 `query_nodes` 召回
- 它和查询词到底匹配在什么地方
- 当前候选里哪些只是弱命中噪音

### 5.3 `query_nodes.explain`

重点字段：

- `explainedCount`
- `totalNodeCount`
- `truncated`
- `selectionContext`
- `explanations`

如果 `truncated=true`，说明这次只解释了前 `explainLimit` 个结果。

### 5.4 `inspect_bundle`

重点字段：

- `bundle`
  - 原始结构化结果
- `summary`
  - 详细版文本摘要，含 selection diagnostics
- `promptPreview`
  - prompt 友好版文本摘要，只保留轻量诊断
- `selectionContext`
  - 本次 inspect 实际采用的 compile 条件
- `explain`
  - 对 bundle 内已选节点做的 explain sample

---

## 6. 推荐排查流程

### 场景 A：不知道当前 bundle 为什么怪

1. 先调 `compact-context.inspect_bundle`
2. 看 `summary` 和 `bundle.diagnostics`
3. 如果发现某类节点没进来，再去看 `explain.explanations`

### 场景 B：不知道应该查哪个 node

1. 先调 `compact-context.query_nodes`
2. 先看 `queryMatch.diagnostics`
3. 再带上 `explain=true`
4. 从 `explanations` 里挑出最值得深挖的节点
5. 再单独调 `compact-context.explain`

### 场景 C：已经知道具体节点

1. 直接调 `compact-context.explain`
2. 带上 `sessionId + query + tokenBudget`
3. 看 `selection` 字段确认是“被选中”还是“被预算/排序跳过”

---

## 7. 当前边界

当前这套调试入口已经能解释：

- 节点来自哪里
- 节点是 `raw / compressed / derived` 中哪一类
- 节点为什么会被 `query_nodes` 召回
- 节点为什么被选进 bundle
- 节点为什么没被选进 bundle
- `query_nodes` 和 `inspect_bundle` 当前使用了什么 `selectionContext`

但还没有覆盖：

- 为什么某条边没有参与推理
- 为什么某条历史消息被压缩掉但没有形成 node
- checkpoint 级别的 explain 聚合

这些可以作为下一阶段的调试增强项。

---

## 8. 相关代码

- Gateway 适配层：
  [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- 节点 explain：
  [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts)
- 类型合同：
  [io.ts](/d:/C_Project/openclaw_compact_context/src/types/io.ts)
- 测试：
  [context-engine-adapter.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/context-engine-adapter.test.ts)
  [audit-explainer.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/audit-explainer.test.ts)
