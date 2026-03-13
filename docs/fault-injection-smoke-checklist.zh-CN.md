# 故障注入与 Smoke Checklist

## 1. 文档目标

这份文档用于把上下文链里最容易退化的能力，固定成一组可以重复执行的检查项。

它不是自动化测试代码，也不是设计文档，而是给下面这些场景用的：

- 改了 compiler / ingest / explain / gateway debug 之后做快速回归
- 怀疑某次改动让“上下文看起来还能跑，但已经不对劲”时做人工复查
- 发布前做一次统一 smoke check

建议和下面两份文档配套使用：

- 调试入口说明：
  [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/gateway-debug-usage.zh-CN.md)
- 场景化排查手册：
  [debug-playbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/debug-playbook.zh-CN.md)

当前已经有一组最小自动化 smoke 套件：

- `npm run test:smoke:debug`
- [debug-smoke.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/debug-smoke.test.ts)

---

## 2. 使用方式

建议把这份 checklist 分成两层执行：

### 2.1 快速 Smoke

适合：

- 每次重要改动后
- 想在 5 到 10 分钟内确认主链没坏

### 2.2 故障注入

适合：

- compiler / provenance / explain 出现疑似退化
- 想确认边界场景是否还成立
- 发布前做更有针对性的回归

---

## 3. 快速 Smoke Checklist

下面这些项建议每次改完关键链路都跑一遍。

### Smoke 1：`inspect_bundle` 还能正常给出 bundle 诊断

检查动作：

1. 调 `compact-context.inspect_bundle`
2. 确认返回里有：
   - `bundle`
   - `summary`
   - `promptPreview`
   - `selectionContext`

预期结果：

- `summary` 里有 selection diagnostics
- `promptPreview` 不应该带详细 diagnostics header

如果失败，优先怀疑：

- adapter 格式化层
- inspect_bundle 聚合层

### Smoke 2：`query_nodes` 还能给出召回诊断，并可叠加 explain

检查动作：

1. 调 `compact-context.query_nodes`
2. 带上 `filter.text`
3. 再打开 `explain=true`

预期结果：

- 返回里除了 `nodes`，还有 `queryMatch`
- `queryMatch.queryTerms` 非空
- `queryMatch.diagnostics` 能看出每条节点命中了哪些词
- 返回里还能叠加 `explain`
- `explain.explanations` 至少能解释前几个节点
- `selectionContext` 能被推导出来

如果失败，优先怀疑：

- text-search / queryMatch 聚合层
- gateway payload normalization
- query_nodes explain 附加层

### Smoke 3：单点 `explain` 还能说明 selection

检查动作：

1. 找一个确定会被选中的 `Risk` 或 `Rule`
2. 调 `compact-context.explain`

预期结果：

- `selection.included=true`
- `selection.slot` 合理
- `selection.reason` 非空

如果失败，优先怀疑：

- `AuditExplainer`
- explain selectionContext 编译链

### Smoke 4：tool result 压缩后 provenance 还在

检查动作：

1. 导入一条被 `tool_result_persist` 压缩过的 tool 结果
2. 查相关节点并 explain

预期结果：

- `provenance.originKind=compressed`
- `provenance.sourceStage=tool_result_persist`
- explain 还能指出它为什么被选中或没被选中

如果失败，优先怀疑：

- transcript loader
- ingest provenance 透传

### Smoke 5：预算拒绝 currentProcess 时仍可解释

检查动作：

1. 构造一个很长的 `Step`
2. 给很小的 compile budget
3. 调 `inspect_bundle`

预期结果：

- `bundle.currentProcess` 为空
- `bundle.diagnostics.fixed.skipped` 里能看到对应 `Step` / `Process`

如果失败，优先怀疑：

- compiler fixed selection
- diagnostics 输出

---

## 4. 故障注入 Checklist

下面这些场景建议在关键策略变更时跑。

## 4.1 注入：风险和普通 evidence 同时存在

目的：

- 验证 `openRisks` 仍然优先于低优先级 evidence

注入方式：

1. 准备 1 条明确失败的 tool output
2. 再准备多条长篇背景 evidence
3. 给一个偏紧的 token budget

预期结果：

- `openRisks` 仍然有内容
- `relevantEvidence` 会被裁掉一部分
- diagnostics 里能看见 evidence skip reason

如果退化，说明：

- compiler 预算池可能失效

## 4.2 注入：只有 compaction / compressed 线索，没有 raw

目的：

- 验证 fallback 逻辑是否还能工作

注入方式：

1. 构造一批 `compressed` 节点
2. 不放对应 `raw` 节点
3. 编译 bundle

预期结果：

- bundle 仍可降级工作
- explain 里要明确它来自 `compressed`

如果退化，说明：

- provenance-aware fallback 逻辑可能丢了

## 4.3 注入：raw 与 compressed 同时存在

目的：

- 验证 raw 优先级没有被回退逻辑覆盖

注入方式：

1. 同时准备同主题的 `raw` 与 `compressed` 节点
2. query 指向该主题
3. 编译 bundle

预期结果：

- 优先被选中的应该是 `raw`
- diagnostics / explain 要能看出选择依据

如果退化，说明：

- compiler 排序或 provenance score 可能被改坏

## 4.4 注入：query_nodes 返回很多噪音候选

目的：

- 验证 `query_nodes + explainLimit + queryMatch` 仍然能帮助缩小范围

注入方式：

1. 准备多条相关但不等价的 `Risk / Evidence / State`
2. 用较宽的 text 查询
3. 打开 `explain=true`

预期结果：

- `queryMatch.diagnostics` 里能看出谁的 `coverage` 更高
- `bestField=label` 的强命中候选应更容易被人工优先挑出
- 返回有 `truncated`
- `explainedCount <= explainLimit`
- 前几条 explain 至少能指出哪些 actually included

如果退化，说明：

- text match 诊断可能失效
- gateway query explain 聚合层可能出问题

## 4.5 注入：旧数据 / legacy 数据解释能力

目的：

- 验证旧数据回填后 explain 没失效

注入方式：

1. 用带旧节点风格的数据打开数据库
2. 调 explain 或 query_nodes + explain

预期结果：

- provenance 至少有可读的默认解释
- 不应直接报错或返回空 explain

如果退化，说明：

- sqlite 回填或 explain 容错链可能坏了

---

## 5. 发布前最小回归包

如果时间很紧，发布前至少跑下面 7 项：

1. `inspect_bundle` 正常返回 `bundle + summary + promptPreview`
2. `query_nodes` 在有 `filter.text` 时正常返回 `queryMatch`
3. `query_nodes + explain` 正常返回 `explain`
4. `explain` 能解释一个被选中的 `Risk`
5. `explain` 能解释一个被跳过的 `Step`
6. `tool_result_persist` 压缩结果仍带 provenance
7. raw 与 compressed 共存时 raw 优先

这 7 项如果有任何一项不通过，都不建议把当前版本当成“调试能力稳定”的版本。

---

## 6. 每项失败后该先看哪

为了避免失败后又不知道从哪下手，可以直接按下面这个映射排查：

- `inspect_bundle` 坏了
  - 先看 `context-engine-adapter.ts`
- `query_nodes` 没有 `queryMatch`
  - 先看 `text-search.ts` 和 gateway success payload 聚合逻辑
- explain 没有 selection
  - 先看 `audit-explainer.ts`
- query_nodes 没有 explain 附加块
  - 先看 gateway success payload 聚合逻辑
- provenance 不对
  - 先看 `transcript-loader.ts`、`ingest-pipeline.ts`
- 风险优先级异常
  - 先看 `context-compiler.ts`

---

## 7. 建议落地方式

这份 checklist 后面建议继续落两层：

### 层 1：文档 checklist

保留当前这份，适合人工复核与团队协作。

### 层 2：自动化 smoke fixture

后续可以把其中最稳定的几项，逐步转成：

- `node:test` fixture
- 固定 transcript 样本
- 固定 inspect/query/explain 快照

这样每次改动后就不只靠人工判断。

---

## 8. 相关代码

- Gateway 聚合与调试入口：
  [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- explain 核心：
  [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts)
- compiler：
  [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts)
- ingest：
  [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/ingest-pipeline.ts)
- transcript 导入：
  [transcript-loader.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/transcript-loader.ts)
