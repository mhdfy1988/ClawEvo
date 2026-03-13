# 调试 Playbook

## 1. 文档目标

这份文档不是 API 参考，而是“遇到问题时怎么排查”的操作手册。

它默认你已经有下面这些 Gateway 调试入口可用：

- `compact-context.explain`
- `compact-context.query_nodes`
- `compact-context.inspect_bundle`

如果你还不熟悉这些入口的参数格式，先看：
[gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/gateway-debug-usage.zh-CN.md)

如果你正在做发布前回归或想系统性验证退化点，再看：
[fault-injection-smoke-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/fault-injection-smoke-checklist.zh-CN.md)

---

## 2. 总体原则

调试顺序建议固定成下面这样：

1. 先看 `inspect_bundle`
2. 再看 `query_nodes`
3. 最后看单点 `explain`

原因很简单：

- `inspect_bundle` 先告诉你“系统这轮到底选了什么”
- `query_nodes` 再告诉你“图里还有什么候选”
- `explain` 最后解决“为什么是这条 / 为什么不是那条”

一句话记忆：

`先看 bundle，再看候选，最后解释单点。`

---

## 3. 场景 A：感觉当前 prompt 丢了重要约束

典型症状：

- 模型突然不再遵守之前明确过的规则
- 某条 constraint / rule 明明说过，但回答里没体现
- 最近一轮好像“忘了”禁止项

### 先调什么

先调 `compact-context.inspect_bundle`

示例：

```json
{
  "sessionId": "session-a",
  "query": "what constraints should still apply",
  "tokenBudget": 1000,
  "explainLimit": 5
}
```

### 先看哪里

- `bundle.activeRules`
- `bundle.activeConstraints`
- `bundle.diagnostics.categories`
- `summary`

### 怎么判断

如果问题约束已经在 `activeRules` 或 `activeConstraints` 里：

- 说明 compile 已经选到了
- 问题更可能在宿主 prompt 拼装、模型执行、或回答阶段

如果约束不在 bundle 里：

- 看 `bundle.diagnostics.categories`
- 重点看 `activeRules` / `activeConstraints` 对应分类里的：
  - `selectedCount`
  - `skippedCount`
  - `skipped.reason`

### 下一步

如果你已经知道那条规则对应的 node：

- 再调 `compact-context.explain`

如果你还不知道 node：

- 调 `compact-context.query_nodes`

---

## 4. 场景 B：bundle 里为什么没有某个步骤或当前流程位置

典型症状：

- `Current step` 没出现
- 模型像是失去了“做到哪一步了”的感觉
- 明明前面在执行某个流程，但这轮 bundle 没带出来

### 先调什么

直接调 `compact-context.inspect_bundle`

示例：

```json
{
  "sessionId": "session-a",
  "query": "why is the current step missing",
  "tokenBudget": 400
}
```

### 先看哪里

- `bundle.currentProcess`
- `bundle.diagnostics.fixed`
- `promptPreview`

### 怎么判断

如果 `bundle.currentProcess` 为空，同时 `bundle.diagnostics.fixed.skipped` 里有 `Step` 或 `Process`：

- 说明不是没识别到
- 而是固定项因为预算不够被跳过了

如果 `fixed.skipped` 里也没有：

- 说明流程节点可能根本没进图
- 或者 query 不足以把它排到最前面

### 下一步

先用 `query_nodes` 查 `Process / Step`：

```json
{
  "filter": {
    "sessionId": "session-a",
    "types": ["Process", "Step"]
  },
  "explain": true
}
```

---

## 5. 场景 C：为什么某条风险进了 bundle，或者为什么没进

典型症状：

- 某个失败信息总是被带进来
- 某个明显的阻塞点却没被带进来
- 风险和普通 evidence 的优先级看起来不对

### 先调什么

1. `compact-context.query_nodes`
2. `compact-context.explain`

### 第一步

先查风险候选：

```json
{
  "filter": {
    "sessionId": "session-a",
    "types": ["Risk"],
    "text": "timeout blocked failure"
  },
  "explain": true,
  "explainLimit": 5
}
```

### 看哪里

- `nodes`
- `explain.explanations[].selection`

### 怎么判断

如果 `selection.included=true` 且 `slot=openRisks`：

- 说明风险已经被明确选中

如果 `selection.included=false` 且 reason 里是：

- `skipped because total budget was exhausted`
  - 说明预算不够
- `skipped because the category budget was reserved for higher-priority items`
  - 说明分类预算内有更高优先级候选

### 下一步

如果风险节点根本查不到：

- 问题更可能在 ingest/识别阶段
- 要回头检查 transcript 或 tool result 是否被正确沉淀成 `Risk`

---

## 6. 场景 D：为什么这条知识是 raw、compressed 还是 derived

典型症状：

- 怀疑某条节点其实来自压缩摘要，不是原文
- 想确认 explain 里引用的是不是派生产物
- 想确认旧数据有没有被 provenance 回填错

### 先调什么

直接调 `compact-context.explain`

```json
{
  "nodeId": "node-123",
  "sessionId": "session-a",
  "query": "why is this node here",
  "tokenBudget": 1000
}
```

### 重点看

- `provenance.originKind`
- `provenance.sourceStage`
- `summary`
- `relatedNodes[].provenance`

### 怎么判断

通常可以这样读：

- `raw`
  - 优先看作原文事实源
- `compressed`
  - 表示来自摘要、compaction、或压缩后的 tool result
- `derived`
  - 表示来自 checkpoint、delta、skill candidate、runtime bundle 等派生产物

如果你要确认“这条派生产物到底从哪些原始节点来”：

- 看 `provenance.derivedFromNodeIds`

---

## 7. 场景 E：query_nodes 查出来很多噪音，不知道该看哪条

典型症状：

- 一次查出来很多节点
- 每条看起来都像有点相关
- 不知道先解释哪一条最值

### 先调什么

调 `compact-context.query_nodes`，并打开 explain 附加输出

```json
{
  "filter": {
    "sessionId": "session-a",
    "text": "build blocked sqlite timeout",
    "types": ["Risk", "Evidence", "State"]
  },
  "explain": true,
  "explainLimit": 3
}
```

### 先看哪里

- `queryMatch.diagnostics`
- `explain.explanations[].selection.included`
- `explain.explanations[].selection.slot`
- `explain.explanations[].selection.reason`

### 怎么用

先用 `queryMatch` 做第一层排噪：

- `coverage` 更高
- `matchedTerms` 更多
- `bestField=label`

这种节点通常更值得先看。

优先继续深挖这些节点：

- `included=true`
- slot 落在 `openRisks`、`activeConstraints`、`activeRules`
- reason 里明显是 `raw:*`

先不要花时间深挖这些节点：

- `included=false`
- 明显是 `compressed` fallback
- 只是普通 `relevantEvidence`，且没有直指当前问题

---

## 8. 场景 F：怀疑 tool result 压缩后失真了

典型症状：

- tool 输出被压缩过
- 但你怀疑压缩丢掉了关键报错
- explain 里看起来更像“摘要”不是“原文”

### 先调什么

1. `query_nodes` 查相关 `Risk / Evidence / State`
2. `explain` 看 provenance

示例：

```json
{
  "filter": {
    "sessionId": "session-a",
    "originKinds": ["compressed"],
    "text": "sqlite timeout"
  },
  "explain": true
}
```

### 重点看

- `provenance.originKind=compressed`
- `provenance.sourceStage`
- `summary`

### 怎么判断

如果 `sourceStage=tool_result_persist`：

- 说明这条内容来自被压缩过的 tool result

如果当前需要进一步追原文：

- 结合 `rawSourceId`
- 回查 transcript 或 artifact sidecar

---

## 9. 场景 G：想知道当前这轮 compile 到底在“为什么选”

典型症状：

- 不只是想看结果
- 更想看 compiler 的选择逻辑有没有跑偏

### 先调什么

直接调 `compact-context.inspect_bundle`

```json
{
  "sessionId": "session-a",
  "query": "inspect current context bundle",
  "tokenBudget": 1200,
  "explainLimit": 5
}
```

### 重点看

- `bundle.diagnostics.categoryBudgets`
- `bundle.diagnostics.categories`
- `summary`
- `promptPreview`

### 怎么判断

看每个分类时，重点问四个问题：

1. 这一类分到了多少预算
2. 这一类输入候选有多少
3. 最后选中了多少
4. 没选中的原因主要是什么

如果 `summary` 很有帮助但 `promptPreview` 很干净：

- 说明现在“调试信息”和“模型可见 prompt”已经被成功分层

---

## 10. 推荐的固定排查模板

如果你不想每次临时组织思路，可以直接照这个模板跑：

### 模板 1：bundle 异常

1. 调 `inspect_bundle`
2. 看 `bundle`、`summary`、`promptPreview`
3. 找到异常的分类
4. 记下对应 nodeId
5. 调 `explain`

### 模板 2：节点异常

1. 调 `explain`
2. 看 provenance
3. 看 selection
4. 看 relatedNodes

### 模板 3：候选过多

1. 调 `query_nodes`
2. 先看 `queryMatch.diagnostics`
3. 再带 `explain=true`
4. 只解释前 3 到 5 条
5. 从 `included=true` 且 `coverage` 更高的条目里继续深挖

---

## 11. 什么时候该怀疑哪一层

如果问题表现是这样，优先怀疑的层也可以固定下来：

- 查不到 node
  - 优先怀疑 ingest / transcript 导入 / 识别映射
- 查得到 node，但没进 bundle
  - 优先怀疑 compiler 排序 / 预算 / query
- 进了 bundle，但 prompt 没体现
  - 优先怀疑 adapter 格式化 / 宿主拼装
- provenance 对不上
  - 优先怀疑 loader / ingress provenance 标记 / 旧数据回填
- explain 看起来合理，但实际效果还是差
  - 优先怀疑模型行为，而不是 context engine 主链

---

## 12. 相关文档

- 调试入口说明：
  [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/gateway-debug-usage.zh-CN.md)
- 原生插件接入：
  [openclaw-native-plugin.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/openclaw-native-plugin.zh-CN.md)
- 路线图：
  [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
- 总交付计划：
  [context-engine-delivery-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-engine-delivery-plan.zh-CN.md)
