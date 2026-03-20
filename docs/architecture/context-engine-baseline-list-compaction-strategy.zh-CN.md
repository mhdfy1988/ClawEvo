# Context Engine Baseline List 压缩策略

这份文档用于把当前 `assemble()` 主治理路线下的压缩状态进一步收敛成一套明确方案：

`保留最近 2 轮原文 + 1 块中间层 incremental + N 块历史 baseline 列表，并在 baseline 超限时做 rollup；超长正文通过 sidecar 旁路保真相层，压缩过程通过 diagnostics 明确暴露。`

相关文档：
- 当前主路线：[context-engine-assemble-compaction-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-assemble-compaction-strategy.zh-CN.md)
- Runtime Window contract：[runtime-context-window-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-context-window-contract.zh-CN.md)
- Prompt Assembly contract：[prompt-assembly-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/prompt-assembly-contract.zh-CN.md)
- 当前压缩合同代码：[core.ts](/d:/C_Project/openclaw_compact_context/packages/contracts/src/types/core.ts)
- 当前宿主适配实现：[context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/context-engine-adapter.ts)

## 1. 文档目标

这份文档专门回答 8 个问题：

1. 当前单 `baseline` 方案的问题是什么
2. 为什么要把 `baseline` 改成列表
3. `rawTail / incremental / baselines[]` 三层到底怎么协同
4. `full` 压缩和 `baseline rollup` 分别在什么情况下触发
5. 超限后为什么要“回退并移除最老 baseline”
6. `rawTail` 遇到超长正文时为什么也不能无脑全文直送
7. `sidecar` 应该和这套压缩主链怎么配合
8. `compression diagnostics` 应该记录什么

## 2. 一句话结论

推荐的新压缩状态是：

```text
system messages
+ recent raw tail (最近 2 轮原文)
+ incremental (1 块滚动中间层)
+ baselines[] (按从老到新排列的历史摘要列表)
```

其中：

- `rawTail`
  - 永远保最近 2 个对话 turn block 原始结构
  - 普通短文本保原文
  - 超长 `tool result / file / log` 不要求全文直送 prompt，可保结构化压缩版本并旁路 sidecar
- `incremental`
  - 永远只有 1 块
  - 每轮 `assemble()` 都按当前边界滚动替换
- `baselines[]`
  - 由旧历史组成
  - 超过上限后对最老一半做 rollup
  - 如果 rollup 结果太大，就回退，并把最老 baseline 从“活跃可见历史层”里移除；本轮不再继续重试 merge

一句话：

`不要再让所有更早历史都挤进同一个 baseline；让 baseline 变成有界列表，并允许最老部分继续整理。`

## 3. 当前单 baseline 方案的问题

当前实现的第一版合同是：

- `rawTail`
  - 最近 2 轮原文块
- `incremental`
  - 1 块中间层摘要
- `baseline`
  - 1 块历史摘要

当前问题不在“层数不够”，而在：

1. `baseline` 只有 1 块
2. `baseline.summaryText` 当前是截断过的压缩预览，不是无限承载历史的稳定层
3. 历史越长，单块 `baseline` 覆盖范围越大，信息密度越来越高
4. 即使 `summaryText` 字数有上限，`baseline` 的语义负载和 `derivedFrom` 范围仍会持续变重

所以当前风险不是：

- `baseline` 字符串无限长

而是：

- `baseline` 变成“越来越厚、越来越粗”的单点历史块

## 4. 目标状态

## 4.1 三层主结构

### `rawTail`

固定保留：

- 最近 2 个 conversation turn block

约束：

- 不和 `incremental`
- 不和 `baselines[]`

重叠。

补充口径：

- `rawTail` 保的是最近 turn block 的原始结构与关键语义
- 不是“最近两轮里所有 message content 都必须全文进入 prompt”
- 如果最近两轮里包含超长 `tool result / file / log`
  - prompt 可见层可以只保压缩后的结构化内容
  - 完整原文继续留在 transcript / artifact sidecar / provenance 真相层

### `incremental`

固定保留：

- `baseline` 之后
- `rawTail` 之前

的最近一段历史。

约束：

- 永远只有 1 块
- 每轮 `assemble()` 重新计算
- 是替换式，不是 append 式

### `baselines[]`

固定保留：

- 比 `incremental` 更早的历史

约束：

- 按 `最老 -> 最新` 排列
- 数量有上限
- 超限后允许最老一半继续 rollup

## 4.2 system messages 的位置

`system` 不参与这三层的持久化边界。

也就是说：

- `system`
  - 始终单独保留
- `rawTail / incremental / baselines[]`
  - 只覆盖 conversation messages

## 5. Contract 目标形态

当前单 baseline 建议演进为：

```ts
type SessionCompressionState = {
  id: string
  sessionId: string
  compressionMode: "none" | "incremental" | "full"
  baselines?: SessionCompressionBaselineState[]
  incremental?: SessionCompressionIncrementalState
  rawTail: SessionCompressionRawTailState
  latestBaselineCoveredUntilMessageId?: string
  incrementalCoveredUntilMessageId?: string
  rawTailStartMessageId?: string
  baselineVersion: number
  derivedFrom: string[]
  createdAt: string
  updatedAt: string
}
```

其中 `SessionCompressionBaselineState` 继续保留：

- `baselineId`
- `baselineVersion`
- `summary`
- `derivedFrom`
- `createdAt`

建议再补：

- `generation`
  - 表示这块 baseline 是第几代 rollup
- `sourceBaselineIds`
  - 表示它由哪些旧 baseline 合并而来

## 6. 触发规则

## 6.1 incremental 触发

每轮 `assemble()` 都先计算：

- 最近 2 轮 `rawTail`
- `rawTail` 之前、最新 `baseline` 之后的中间段

如果中间段非空，就生成：

- `incremental`

它是：

- 替换式滚动更新
- 永远只有 1 块

## 6.2 full 触发

当前方案建议把 `full` 阈值固定为：

- `contextOccupancyRatio > 0.50`

也就是说：

- 一旦 conversation 内容占预算达到 `50%`
- 直接进入一次历史层整理

## 6.3 baseline rollup 触发

当 `full` 生成了新 baseline 后，如果：

- `baselines.length > maxBaselineCount`

就进入：

- `baseline rollup`

第一版推荐：

- `maxBaselineCount = 4`

## 7. full 压缩的具体流程

当前推荐把 `full` 理解成：

`把当前 incremental 封存进 baselines[]，然后整理 baselines[]。`

而不是：

`把所有更早历史重新折成唯一一个 baseline。`

具体步骤：

1. 计算 `rawTail`
2. 计算当前 `incremental`
3. 进入 `full`
4. 把当前 `incremental` 封存成新的 `baseline block`
5. 追加到 `baselines[]` 末尾
6. 清空运行态里的 `incremental`
7. 如果 `baselines[]` 超限，执行 `baseline rollup`

## 8. baseline rollup 的具体流程

第一版推荐规则：

1. 当 `baselines.length > 4`
2. 取最老前一半
3. 合并成一个新的老 baseline
4. 替换掉这前一半

例如：

```text
[B1, B2, B3, B4, B5]
-> merge [B1, B2]
-> [B12, B3, B4, B5]
```

如果后面再次超限：

```text
[B12, B3, B4, B5, B6]
-> merge [B12, B3]
-> [B123, B4, B5, B6]
```

也就是说：

- 历史层不是越来越多块
- 最老的那部分会逐代变得更粗
- 但可见列表始终有界

## 9. Rollup 超限回退

这是这份方案最关键的差异点。

如果 rollup 后的新 baseline：

- `tokenEstimate > totalBudget * 0.20`

则：

1. 回退这次 rollup
2. 把原来最老的第一个 baseline 从“活跃可见 baseline 列表”里移除
3. 本轮结束，不再继续重试 merge

例如：

```text
[B1, B2, B3, B4, B5]
-> merge [B1, B2]
-> oversized
-> rollback
-> evict B1 from active baseline list
-> [B2, B3, B4, B5]
```

这里的“移除”必须明确成：

- 从 prompt 可见历史层移除

不是：

- 从 archive / checkpoint / graph / transcript 真相层删除

## 10. 为什么要这样回退

原因有三条：

1. 如果最老一半压完还是太大，说明这段历史已经不适合继续作为“高可见历史层”存在
2. 与其让一个 oversized baseline 长时间挤占 prompt，不如把更早那块退出 prompt 可见层
3. archive / checkpoint / graph 仍然保留更早历史，所以这不是信息删除，而是 prompt-visible history 的退场

一句话：

`历史可以继续留在真相层，但不是所有历史都必须长期留在 prompt 可见的 baseline 列表里。`

## 11. baseline 内容来源

这条很重要。

rollup 不建议只基于：

- 已经截断过的 `baseline.summaryText`

继续压。

推荐优先级是：

1. `sourceCheckpointId`
2. `sourceBundleId`
3. baseline block 自身的结构化 metadata
4. 最后才退回 `summaryText`

原因是：

- 如果只是把已经截断过的 preview 再压一次
- 会很快变成“预览的预览的预览”

质量会塌得很快。

## 12. Prompt 组装口径

当前建议继续保持：

- `messages`
  - system + rawTail
- `systemPromptAddition`
  - compression state + bundle summary

也就是说：

- `baselines[]`
- `incremental`

仍然不直接进入普通 `messages` 列表，而是继续通过：

- `systemPromptAddition`

暴露给模型。

推荐展示顺序：

1. `Mode`
2. `Baselines` 按老到新
3. `Incremental`
4. `Recent raw tail turns`

## 12.1 `rawTail` 与 sidecar 的配合

这条口径需要明确写死：

`保留最近 2 轮原文` 不等于 `把最近 2 轮里出现的所有超长正文全文直接送模`。

更准确的规则是：

1. 对普通 user / assistant 短文本
   - 继续按原文留在 `rawTail`
2. 对超长 `tool result / file / log`
   - 继续保留它属于最近 turn block 的位置与 provenance
   - prompt 可见层只放压缩后的结构化内容
   - 完整正文走 `artifact sidecar`
3. `sidecar` 的职责是保真相层，不是替代 `rawTail`

第 1 轮例子：

- assistant 调工具
- tool 返回 20KB 构建日志
- 这轮 turn 仍然属于最近两轮，所以位置上仍在 `rawTail`
- 但 prompt 中的这条 tool result 不要求带 20KB 全文
- 更合理的是保留：
  - 错误摘要
  - 关键路径
  - truncation / compression 说明
  - artifact path / content hash / provenance
- 完整日志正文继续在 sidecar 回查

一句话：

`rawTail` 保最近结构，`sidecar` 保完整长文；两者不是二选一。`

## 12.2 Compression Diagnostics

除了压缩结构本身，这套方案还要求每次 `assemble / full / baseline rollup` 都能产出结构化压缩诊断。

目标不是写一段自由文本日志，而是让 explain / inspect / dashboard / workbench 能稳定回答：

1. 这轮为什么触发压缩
2. 这轮压了什么
3. 这轮替换了什么
4. 这轮有没有回退或 evict
5. 压完后当前上下文占比和各层规模是多少

第一版建议最少记录：

- `trigger`
  - `occupancy`
  - `baseline_rollup`
  - `manual_rebuild`
- `occupancyRatioBefore`
- `occupancyRatioAfter`
- `sealedIncrementalId`
- `appendedBaselineId`
- `mergedBaselineIds`
- `mergedBaselineResultId`
- `rollback`
- `evictedBaselineId`
- `rawTailTokenEstimate`
- `incrementalTokenEstimate`
- `baselineTokenEstimate`
- `baselineCount`
- `sidecarReferenceCount`

第 1 轮例子：

- `occupancyRatio = 0.42`
- 不触发 full
- diagnostics 只记录当前 `mode = incremental`

第 2 轮例子：

- `occupancyRatio = 0.53`
- 触发 full
- diagnostics 可以记录：
  - `trigger = occupancy`
  - `sealedIncrementalId = I3`
  - `appendedBaselineId = B3`
  - `baselineCount = 5`
  - `mergedBaselineIds = [B1, B2]`
  - `mergedBaselineResultId = B12`

第 N 轮例子：

- rollup 后 `B12` 超过总预算 `20%`
- diagnostics 可以记录：
  - `rollback = true`
  - `evictedBaselineId = B1`
  - `mergedBaselineIds = [B1, B2]`
  - `mergedBaselineResultId` 为空，因为这轮 rollup 没有真正落地

一句话：

`compression diagnostics` 是为了把“为什么压、压了谁、替换了谁、为什么回退”变成 explain 和监控里可直接消费的结构化事实。

## 13. 第 1 轮 / 第 2 轮 / 第 N 轮例子

### 第 1 轮

- 只有 `rawTail`
- 没有 `incremental`
- 没有 `baselines[]`

### 第 2 轮

- 还是只有最近 2 轮原文
- 没有 `baseline`

### 第 3 轮

- 最近 2 轮进入 `rawTail`
- 更早 1 轮进入 `incremental`
- `compressionMode = incremental`

### 严格超过 50%

- 当前 `incremental` 封存为 `B1`
- `baselines = [B1]`
- `incremental` 清空

### 后续多轮

- 新历史继续先进入 `incremental`
- 达到 `full` 时再封存成 `B2`
- 逐步形成：
  - `[B1, B2, B3, B4]`

### 超过 baseline 上限

- `[B1, B2, B3, B4, B5]`
- 合并最老前一半
- 变成：
  - `[B12, B3, B4, B5]`

### 如果合并结果太大

- 回退
- 移除 `B1`
- 本轮不再重试 merge
- 得到：
  - `[B2, B3, B4, B5]`

## 14. 不变式

这套方案建议锁死下面这些不变式：

1. `system` 不进入 `rawTail / incremental / baselines[]`
2. `rawTail / incremental / baselines[]` 之间的 `derivedFrom` 不允许重叠
3. `incremental` 永远最多 1 块
4. `baselines[]` 数量永远有上限
5. `baseline` 超限时优先 rollup，rollup 失败则只 evict 最老块，本轮不再继续 retry merge
6. evict 只影响 prompt-visible baseline list，不影响 archive / checkpoint / graph / transcript
7. `assemble()` 仍然是自动治理主入口

## 15. 对当前代码的改动建议

### 15.1 `packages/contracts`

需要调整：

- `SessionCompressionState`
- `SessionCompressionBaselineState`

需要新增：

- `generation`
- `sourceBaselineIds`
- `compressionDiagnostics`

### 15.2 `packages/openclaw-adapter`

需要调整：

- `resolveBaselineStartIndex(...)`
- `buildNextBaselineState(...)`
- `buildIncrementalState(...)`
- `formatCompressionStateForPrompt(...)`
- `shouldTriggerFullCompaction(...)`
- `formatExplainResult(...)`

需要新增：

- `appendBaselineBlock(...)`
- `rollupBaselineBlocks(...)`
- `tryMergeOldestBaselineHalf(...)`
- `evictOldestBaselineFromPromptHistory(...)`
- `buildCompressionDiagnostics(...)`

### 15.3 测试

至少补这几类：

1. 第 3 轮生成单 incremental
2. 严格超过 50% 后 incremental 封存为首个 baseline
3. baseline 超过上限后最老半边 rollup
4. rollup 结果超过 20% 预算后回退并 evict 最老块，本轮不再继续 retry merge
5. `derivedFrom` 在 `rawTail / incremental / baselines[]` 之间不重叠
6. 最近两轮里的超长 tool result 仍留在 `rawTail` 结构内，但正文走 sidecar
7. explain / inspect 能稳定返回 compression diagnostics

## 16. 当前不建议先做的事

第一版不建议顺手做：

- 完整 summary DAG
- delegated expansion grant
- graph 侧多层历史树可视化
- repair / rewrite / transplant 工作台

当前先把：

- `baseline list + rollup + rollback/evict`
- `rawTail + sidecar` 的边界
- `compression diagnostics`

做稳就够。

## 17. 一句话结论

`当前压缩方案建议正式从“单 baseline + 单 incremental + 最近 2 轮 raw tail”演进为“baseline 列表 + 单 incremental + 最近 2 轮 raw tail”。当 baseline 列表超限时，优先对最老一半做 rollup；如果 rollup 后仍超过总上下文预算的 20%，则回退并移除最老 baseline 的 prompt 可见性，本轮不再继续 retry merge。这样能保留当前三层主结构，又避免单 baseline 随历史增长变成越来越厚的单点。`
