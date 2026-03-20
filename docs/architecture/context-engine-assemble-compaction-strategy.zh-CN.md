# Context Engine Assemble 压缩策略

补充说明：
- 如果要看当前已经进一步固定下来的 `baseline 列表 + rollup` 方案，请继续看：
  - [context-engine-baseline-list-compaction-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-baseline-list-compaction-strategy.zh-CN.md)

## 1. 背景

当前 `compact-context` 插件在 OpenClaw 里的主注册方式是：

- 原生插件入口：
  - [apps/openclaw-plugin/src/index.ts](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/src/index.ts)
- 宿主适配层：
  - [packages/openclaw-adapter/src/openclaw/index.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/index.ts)

核心注册调用是：

```ts
api.registerContextEngine('compact-context', factory)
```

也就是说，`compact-context` 当前的主身份是：

- OpenClaw 原生 `context engine plugin`

不是 hook-only 插件，也不是 provider plugin。

OpenClaw 官方插件文档里，对 `context engine plugin` 的职责定义很明确：

- `ingest()`
- `assemble()`
- `compact()`

参考：

- OpenClaw Plugins / Context engine plugins  
  https://docs.openclaw.ai/tools/plugin

## 2. 当前结论

这套插件后续的自动上下文治理，主入口应放在：

- `assemble()`

而不是依赖：

- 用户手动执行 `compact`
- 宿主是否主动调用某条外部压缩链路

一句话：

`assemble` 应该成为自动上下文治理主入口；`compact` 保留，但降级为手动 / 兼容 / 调试入口；hook 保留代码与注册面，但当前不承担主链职责。

## 3. 为什么主入口选 assemble

原因有三条：

1. `assemble()` 是每轮宿主取上下文时都会经过的阶段。
2. 它天然负责“给宿主返回什么上下文”，边界最清楚。
3. 不依赖宿主是否额外触发 `compact()`，产品体验更稳定。

如果把“自动压缩”完全依赖在 `compact()` 上，会有两个问题：

1. `compact()` 更像手动命令或特定恢复路径，不一定每轮都走。
2. 自动上下文治理会被宿主调用路径绑住，时机不稳定。

因此更合理的职责划分是：

- `assemble()`
  - 决定本轮最终上下文
  - 决定是否做增量压缩
  - 决定是否触发全量重压缩
- `compact()`
  - 保留实现
  - 主要用于手动命令、宿主显式调用、调试和兼容场景
- `hook`
  - 保留代码和宿主接缝
  - 当前不承担自动压缩、图谱主链、checkpoint 主链或 skill 主链

## 4. hook 当前定位

当前结论不是“删掉 hook”，而是：

- `保留 hook 代码`
- `保留 hook 注册面`
- `默认不让 hook 承担关键路径`

这样做的原因是：

1. 当前 `ingest + assemble` 已足够完成获取上下文、组织上下文和自动压缩。
2. 如果继续让 hook 参与主链，容易产生重复 ingest、重复 checkpoint、重复压缩和生命周期竞态。
3. 保留接缝后，未来如果宿主行为变化，或确实需要源头治理能力，再启用也不难。

当前推荐把 hook 理解为：

- `可选增强层`
- `宿主接缝保留层`

而不是：

- `自动上下文治理主入口`
- `当前版本的关键依赖`

### 4.1 当前保留策略

当前版本对 hook 的建议是：

- `tool_result_persist`
  - 代码保留
  - 暂不作为主链前提
- `before_compaction / after_compaction`
  - 代码保留
  - 暂不依赖其承担自动压缩或主状态同步
- 其他注入型 hook
  - 不作为当前版本主路线

也就是说：

`没有 hook 的额外处理，这套 context engine 也应该能独立正常工作。`

## 5. 当前入口清单

下面这份清单用于回答两个问题：

1. 当前上下文处理主链到底有哪些入口
2. 后续如果需要扩展，应该优先从哪个入口下手

### 5.1 Context Engine 生命周期入口

#### `bootstrap`

用途：

- 冷启动
- 恢复历史 session 状态
- 从 transcript / 持久化状态回放到运行时

当前定位：

- 恢复入口
- 不是每轮上下文治理主入口

#### `ingest`

用途：

- 接收新增原始输入
- 做标准化
- 建图谱 / 写结构化索引

当前定位：

- 图谱构建主入口
- 原始内容进入系统的主入口

#### `ingestBatch`

用途：

- 批量 ingest 多条记录
- 适合 transcript 回放、批量导入、批处理同步

当前定位：

- `ingest` 的批量版

#### `afterTurn`

用途：

- 一轮交互结束后的收尾
- 适合写 checkpoint / delta / skill candidate
- 适合做阶段性沉淀

当前定位：

- 轮次收尾入口
- 不是当前自动压缩主入口

#### `assemble`

用途：

- 送模前获取当前上下文
- 用图谱召回
- 做增量压缩
- 超阈值时触发全量重压缩
- 返回最终上下文给宿主

当前定位：

- 自动上下文治理主入口
- 当前最重要的主链入口

#### `compact`

用途：

- 手动 `/compact`
- 宿主显式压缩调用
- 调试 / 兼容 / 特殊恢复路径

当前定位：

- 手动和兼容入口
- 不承担日常自动压缩主逻辑

### 5.2 Hook 预留接缝

#### `tool_result_persist`

用途：

- 工具结果写入 transcript 前的源头治理接缝
- 适合以后处理超长 tool result

当前定位：

- 代码保留
- 预留增强点
- 当前不作为主链前提

#### `before_compaction`

用途：

- 宿主压缩前的同步接缝
- 适合以后在宿主要压缩前同步运行时状态

当前定位：

- 代码保留
- 预留增强点
- 当前不作为自动压缩主路径

#### `after_compaction`

用途：

- 宿主压缩后的同步接缝
- 适合以后刷新 checkpoint / delta / skill

当前定位：

- 代码保留
- 预留增强点
- 当前不作为主链依赖

#### `before_prompt_build`

用途：

- prompt 真正拼装前的辅助注入接缝
- 适合以后做轻量补充上下文

当前定位：

- 可选辅助位
- 当前不作为主路线

### 5.3 当前推荐优先级

后续如果要扩展，建议优先按下面顺序考虑：

1. `assemble`
   - 自动上下文治理
   - 压缩策略
   - 图谱召回
2. `ingest / ingestBatch`
   - 图谱构建
   - 原始输入标准化
3. `afterTurn`
   - checkpoint / delta / skill 沉淀
4. `compact`
   - 手动与兼容能力增强
5. `hook`
   - 只有当主链确实不够时，再启用这些接缝

一句话：

`先想 context engine 主链，再想 hook。`

## 6. 总体策略

### 6.1 核心思想

自动压缩策略采用两层：

1. 每轮增量压缩
2. 超阈值时全量重压缩

也就是说：

- 平时每轮只处理新增内容
- 当上下文占比达到 `50% ~ 60%` 左右时
- 在 `assemble()` 里直接做一次全量重压缩

### 6.2 配套约束建议

为了让这套 `assemble` 主治理路线后续真正落稳，当前建议把下面 6 条约束一起固定下来。

#### 6.2.1 真相源优先级

当前建议锁定为：

1. `assemble.final`
2. `runtime snapshot`
3. `transcript / session file`

解释：

- `assemble.final` 才代表这一轮真正送模前的最终上下文
- `runtime snapshot` 是运行时观察副本
- `transcript / session file` 只适合作为恢复源和回放源

建议：

- 调试、explain、dashboard 都要显式标明当前数据来自哪一层
- 凡是“这一轮上下文到底是什么”的判断，默认先信 `assemble.final`

#### 6.2.2 provider-neutral 输出合同

当前建议继续只保留这三个主输出：

- `messages`
- `systemPromptAddition`
- `estimatedTokens`

解释：

- 插件负责决定“上下文长什么样”
- 宿主负责决定“怎么把这些结果组装成具体 provider payload”

建议：

- 不要在 context engine 主输出里加入 provider-specific 参数
- 如果后续需要更多调试信息，优先放进 debug / inspect / snapshot，而不是主送模合同

#### 6.2.3 runtime window 合同

当前建议继续保留三层窗口：

- `inbound`
- `preferred`
- `final`

并继续保留：

- `latestPointers`
- `toolCallResultPairs`

建议：

- 后续补一个轻量字段：
  - `compactionMode: none | incremental | full`
  - `compactionReason`
- 无论后续压缩策略怎么演化，都要能回答：
  - 原来有什么
  - 本来想保留什么
  - 最后真正留下了什么

#### 6.2.4 bundle / summary 合同

当前建议继续固定这套最小结构，不要回退成自由文本摘要：

- `goal`
- `intent`
- `currentProcess`
- `activeRules`
- `activeConstraints`
- `openRisks`
- `recentDecisions`
- `recentStateChanges`
- `relevantEvidence`
- `candidateSkills`

建议：

- 这套固定槽位和分类继续作为 explain / checkpoint / evaluation 的共同锚点
- 可以在此基础上补轻量 metadata，例如：
  - `compressionMode`
  - `baselineId`
  - `evidenceCoverage`
- 但不要把主 contract 重新做成任意文本块

当前实现已经收成：

- `RuntimeContextBundle.metadata`
- `ContextSummaryContract.metadata`
- `BundleContractSnapshot.metadata`

其中第一版 `metadata` 固定包含：

- `compressionMode`
- `baselineId`
- `evidenceCoverage`
  - `requiresEvidenceSelectionCount`
  - `supportingEvidenceCount`
  - `evidenceSatisfied`

当前测试也已经锁住：

- 主 contract 仍然围绕固定槽位组织，不回退成自由文本 `summary` 字段主导
- inspect / debug 入口返回的 `bundle / summaryContract / bundleContract` 都能看到同一套轻量 metadata
- `explain / inspect` 当前也应显式返回这类运行时压缩态：
  - 本轮 `compressionMode`
  - `compressionReason`
  - 当前 `baselineId`
  - 哪些节点被召回
  - 哪些 `rawTail` turn block 被保留
- `inspect_runtime_window` 应继续把：
  - `inbound / preferred / final`
  - `compressionMode`
  - `compressionReason`
  一起暴露出来，避免只能看到最终窗口，看不到压缩判断过程
- `assemble` 当前还把关系召回类型显式暴露出来：
  - `direct_text`
  - `relation_graph`
  - `learning_graph`
  这几类不再只埋在 `selection.reason` 文本里，而是通过：
  - `ContextSelection.primaryRecallKind`
  - `ContextSelection.recallKinds`
  - `ExplainResult.selection`
  - `inspect_bundle.recalledNodes`
  一起返回
- 当前判断逻辑的第一版是：
  - 没有图谱加成时，默认视为 `direct_text`
  - 有 relation recall 加成时，显式标为 `relation_graph`
  - 有 learning recall 加成时，显式标为 `learning_graph`
  - 如果同时命中多类来源，就保留 `recallKinds` 数组，并额外给出 `primaryRecallKind`

#### 6.2.5 checkpoint / delta / skill 同步规则

当前建议的职责划分是：

- `delta`
  - 相对频繁
  - 用于记录最近一轮或最近几轮的变化
- `checkpoint`
  - 相对克制
  - 用于记录阶段性压缩基线
- `skill candidate`
  - 更克制
  - 只在模式稳定时更新

建议：

- `assemble + none`
  - 只更新运行时窗口和压缩状态
  - 不默认刷新 checkpoint / delta / skill
- `assemble + incremental`
  - 只有在当前 bundle 相对最新 checkpoint 发生有效变化时，才刷新 checkpoint / delta / skill
  - 当前通过 bundle 差异判断避免每轮重复落同一份快照
- `assemble + full`
  - 一旦在 `assemble()` 内触发全量重压缩，就强制重建 checkpoint / delta
  - 然后再同步 skill candidate
- `compact`
  - 作为手动 / 兼容入口，始终强制重建 checkpoint / delta / skill
- `afterTurn`
  - 当前只负责 ingest 本轮新增内容
  - 普通轮次不再默认刷新 checkpoint / delta / skill
  - 只有出现 `autoCompactionSummary` 时，才补做一次派生产物同步
- `after_compaction`
  - 作为宿主手动压缩后的补充同步位
  - 如果这次压缩不是插件自己的 `compact()` 刚处理过，就强制刷新 checkpoint / delta / skill

当前还额外固定了一个可观察约束：

- `checkpoint / delta / skill candidate` 的 provenance 里统一写入：
  - `triggerSource`
  - `triggerCompressionMode`
- `SessionCheckpoint / SessionDelta` 也直接镜像暴露：
  - `triggerSource`
  - `triggerCompressionMode`
  这样消费方不需要每次都从 provenance 里反查

这样后续解释、审计和调试时，可以明确区分：

- 是 `assemble` 触发的
- 还是 `compact` 触发的
- 还是 `after_turn` / `after_compaction_hook` 补同步触发的

当前还把 `delta` 的语义变化类型固定成轻量枚举：

- `goal_changed`
- `intent_changed`
- `current_process_changed`
- `active_rules_changed`
- `active_constraints_changed`
- `recent_decisions_changed`
- `recent_state_changes_changed`
- `open_risks_changed`

这样 `delta` 不再只是 id diff，还能直接表达“这一轮到底是哪类语义发生了变化”。

#### 6.2.6 图谱治理与证据优先

当前建议保持：

- 图谱主干优先来自原始证据
- 压缩产物属于 derived layer

解释：

- 原文负责事实与证据
- 图谱负责结构化理解
- 压缩结果负责运行时投影与派生产物

建议：

- `ingest` 继续作为事实和证据入图主入口
- `assemble` 不直接往主图谱里随手写“事实节点”
- assemble 产生的压缩结果如果需要落库，应优先落为：
  - `derived summary`
  - `checkpoint`
  - `delta`
  - `skill candidate`
- 所有派生产物都应继续带：
  - `provenance`
  - `derivedFrom`
  - `freshness`
  - `version`

## 7. 阶段职责分工

### 7.1 ingest：建图谱

`ingest()` 的主职责不是做最终上下文拼装，而是：

- 接收原始输入
- 记录来源、时间、顺序、session、scope
- 抽取实体、关系、事件
- 写入知识图谱或结构化索引

一句话：

`ingest()` 负责“把原始内容变成可被后续利用的结构化资产”。

### 7.2 assemble：用图谱并做自动治理

`assemble()` 是主治理入口，职责包括：

- 读取当前图谱 / 历史压缩状态 / 最近原文窗口
- 结合当前 query 或当前会话目标做召回
- 计算当前上下文预算占比
- 每轮做增量压缩
- 超阈值时直接做一次全量重压缩
- 返回最终上下文给宿主

一句话：

`assemble()` 负责“决定这一轮真正要交给宿主的上下文是什么”。`

### 7.3 compact：手动与兼容入口

`compact()` 仍然保留，但不再承担日常自动压缩主逻辑。

它更适合负责：

- 手动 `/compact`
- 调试
- 宿主显式 compact 调用
- 特殊恢复路径

如果后续需要，也可以在这里补充：

- 历史压缩状态整理
- 图谱归并
- 检查点压缩

但这都不是自动上下文治理主路径。

## 8. 每轮 assemble 的处理流程

推荐流程如下：

1. 读取当前原始上下文、知识图谱、已有压缩基线、已有增量摘要层。
2. 计算本轮上下文预算占比，例如：
   - `estimatedTokens / tokenBudget`
3. 从图谱中召回与当前 query / session / 当前任务最相关的节点。
4. 对本轮新增内容做增量压缩。
5. 如果预算占比未超过阈值：
   - 直接用“基线摘要 + 增量摘要 + 最新原文窗口”拼出最终上下文。
6. 如果预算占比超过阈值：
   - 在 `assemble()` 内直接触发一次全量重压缩
   - 生成新的压缩基线
   - 重置旧的增量摘要层
   - 再拼上最新原文窗口
7. 返回最终上下文给宿主，由宿主发送给 LLM。

## 9. 推荐的数据结构

建议把上下文分成三层：

### 9.1 长期压缩基线

表示最近一次全量重压缩后的整体摘要。

作用：

- 稳定保存长期上下文
- 避免每轮都从头压缩全部历史

### 9.2 近期增量摘要层

第一版建议把近期增量摘要层收成：

- `永远只保留 1 块区间摘要`

不要把它做成：

- 多个轮次摘要列表
- 多个碎片摘要块的堆叠

它覆盖的范围固定为：

- `baseline` 之后
- `rawTail` 之前

也就是说：

`incremental = baseline 之后、rawTail 之前那一整段历史的单块摘要`

作用：

- 低成本维护近期变化
- 避免每轮都做全量重压缩
- 避免多块增量摘要彼此重叠、重复或难以清理

### 9.3 最新原文窗口

第一版建议固定为：

- `recent raw tail = 最近 2 轮原文块`

这里的“原文块”不是单条 message，而是一组：

- `user`
- `assistant`
- 相关 `toolResult`

第一版简单规则是：

1. 当前轮原文块必留
2. 上一轮原文块默认也保留
3. 更早历史一律不保留原文，进入压缩层

作用：

- 保留最近消息、工具结果和最新上下文细节
- 避免“刚发生的内容还没来得及充分结构化就被压扁”
- 让第一版实现足够简单，不先陷入复杂评分和召回策略

### 9.3.1 第一版角色保留策略

第一版把不同角色的保留策略明确收成下面这版：

- `system`
  - 不进入 `rawTail` 状态
  - 继续作为宿主系统层输入单独保留
- `user`
  - 进入最近 `2` 个 turn block 的 `rawTail`
- `assistant`
  - 跟随所属 `user` 一起进入同一个 turn block
- `tool / toolResult`
  - 跟随所属 `user / assistant` 所在 turn block 一起保留
  - 不允许把最近关键 tool result 从 turn block 里单独拆出来

一句话：

`recent raw tail 只负责最近 2 个 conversation turn block；system 单独保留，user / assistant / tool 一起按 turn block 保留。`

### 9.3.2 第一版绝不能过早压扁的内容

当前版本对“不要过早压扁”的理解固定成两层保护：

1. `recent raw tail`
   - 保护最近 `2` 个 turn block 的高保真原文
   - 尤其保护最近关键 tool result 与其上下文关系
2. `structured bundle`
   - 保护这些结构化槽位不会退化成“只剩自由文本摘要”
   - `goal`
   - `activeConstraints`
   - `currentProcess`
   - `recentDecisions`
   - `relevantEvidence`

也就是说：

- 当前目标
- 硬约束
- 当前流程位置
- 最近关键决策
- 最近关键 tool result

都不应该只靠“自由文本摘要”来兜底；要么还在 `rawTail`，要么已经进入固定 bundle 槽位。

### 9.4 第一版极简分层模型

第一版推荐直接锁成下面这个形态：

- `baseline`
  - 长期全量压缩基线
- `incremental`
  - 1 块区间摘要
- `rawTail`
  - 最近 2 轮原文块

也就是：

`baseline + 1块 incremental + 最近2轮 rawTail`

### 9.5 从第 1 轮到第 N 轮的演进方式

第一版建议按下面的节奏工作：

#### 第 1 轮

- `baseline = 空`
- `incremental = 空`
- `rawTail = 第1轮原文`

#### 第 2 轮

- `baseline = 空`
- `incremental = 空`
- `rawTail = 第1轮原文 + 第2轮原文`

#### 第 3 轮

- `baseline = 空`
- `incremental = 第1轮摘要`
- `rawTail = 第2轮原文 + 第3轮原文`

#### 第 4 轮

- `baseline = 空`
- `incremental = 第1~2轮摘要`
- `rawTail = 第3轮原文 + 第4轮原文`

#### 后续轮次

- `rawTail` 始终保最近 2 轮原文
- `incremental` 始终重算成：
  - `baseline` 之后
  - `rawTail` 之前
  的那整段历史的单块摘要

#### 超过阈值时

当上下文占比超过阈值，例如 `60%` 时：

- 把当前 `incremental` 覆盖的整段历史全量重压缩进新的 `baseline`
- `incremental` 清空
- `rawTail` 继续保最近 2 轮原文

后续再继续回到：

- `baseline + 1块 incremental + 最近2轮 rawTail`

## 10. 阈值策略

建议第一版采用简单阈值：

- 小于 `50%`
  - 正常增量压缩
- `50% ~ 60%`
  - 开始偏向更积极的增量压缩
- 大于 `60%`
  - 在 `assemble()` 内直接触发一次全量重压缩

后续可以再演化成更复杂的策略，例如结合：

- 原文窗口大小
- 增量摘要层累计轮数
- 图谱节点数量
- 最近工具结果体量
- query 是否需要更多高保真原文

## 11. 近期增量摘要层的数据来源

第一版不要把“近期增量摘要层”做复杂。

当前建议直接锁定为一个最简单的数据来源：

- `当前会话消息序列`

更具体地说：

`近期增量摘要输入 = 当前消息里，baseline 之后、rawTail 之前的那一段内容`

这意味着：

- 不从最终 prompt 反推
- 不从整段 transcript 现抓全部历史
- 不依赖多路图谱召回去拼增量摘要输入

第一版的工作顺序应是：

1. `assemble()` 先确定当前 `rawTail`
2. 再根据 `baselineCoveredUntilMessageId` 和 `rawTailStartMessageId` 切出中间区间
3. 这段区间直接作为 `incremental` 的输入
4. 对它生成 1 块新的区间摘要

一句话：

`第一版的近期增量摘要层，只从“当前消息序列里 baseline 之后、rawTail 之前的那一段”取。`

## 12. 状态边界与不变式

为了避免重复、混乱、误清空，第一版建议直接锁死下面这些不变式：

1. 三层绝不重叠
   - `baseline`
   - `incremental`
   - `rawTail`
   任意一条消息只能属于其中一层
2. 先选 `rawTail`，再定压缩切线
3. 一旦触发全量重压缩：
   - 新建 `baseline`
   - `incremental` 必须清空
4. 必须记录边界：
   - `baselineCoveredUntilMessageId`
   - `incrementalCoveredUntilMessageId`
   - `rawTailStartMessageId`
   - `baselineVersion`
   - `compressionMode`
5. `assemble()` 必须幂等
   - 同样输入应得到同样输出
6. 状态切换必须原子提交
   - 先计算 `nextState`
   - 再校验
   - 最后一次性替换旧状态

## 13. 原文存储分层

当前建议把原文分成四层保存：

1. 宿主 transcript / session file
   - 原始事实源
2. 图谱中的 `Evidence`
   - 系统内部证据副本
3. artifact / sidecar
   - 超长原文正文
4. `recent raw tail`
   - 当前轮运行时保留的最近原文窗口

这意味着：

- 宿主保一份原始真相
- 我们系统内部保一份可计算的证据副本
- 超长内容正文单独落文件
- `rawTail` 只负责当前轮运行时高保真窗口，不承担长期存储职责

## 14. 知识图谱在这套方案里的位置

当前讨论结论是：

- 知识图谱主要在 `ingest()` 构建
- 主要在 `assemble()` 使用

这意味着：

### ingest 中做

- 实体抽取
- 关系抽取
- 事件归档
- provenance 记录
- 节点去重 / 归属 / 标签

### assemble 中做

- 图谱召回
- 相关节点筛选
- 基于图谱的摘要候选整理
- 最终上下文编排

这样能避免：

- 每轮 assemble 大量重复建图
- 图谱构建和上下文编排互相耦死

## 15. 为什么不建议“所有压缩都只放 compact”

因为那样会有明显风险：

1. 自动压缩行为依赖宿主何时调用 `compact()`。
2. 用户可能只有在手动 `/compact` 时才能看到效果。
3. 自动上下文治理时机不稳定。

如果改成以 `assemble()` 为主：

- 每轮都会经过这套治理逻辑
- 宿主始终拿到已经处理好的上下文
- 用户不会感觉“怎么还得手动 compact 才正常”

## 16. 当前实现边界建议

这套方案下，后续实现边界建议固定为：

- `runtime-core`
  - 继续承接底层上下文处理、编排与压缩逻辑
- `compact-context-core`
  - 承接插件内部业务核心装配
- `openclaw-adapter`
  - 负责把 OpenClaw 的 context engine 生命周期接到运行时
- `openclaw-plugin`
  - 继续保持薄壳，只做宿主接入和 host CLI 注册

## 17. 第一版最小实现方向

第一版不建议一下子做复杂的分层压缩框架，推荐先做最小可行版：

1. 在 `assemble()` 中拿到当前上下文预算占比。
2. 固定保留最近 `2` 轮原文块作为 `rawTail`。
3. 把 `baseline` 之后、`rawTail` 之前的那段内容直接作为 `incremental` 输入。
4. 始终只生成 `1` 块新的 `incremental` 区间摘要。
5. 超过阈值时，在 `assemble()` 中直接重算一版新的全量摘要基线。
6. 把“基线摘要 + 1块增量摘要 + 最近2轮原文块”返回给宿主。

这样可以先验证三件事：

1. `incremental` 单块区间摘要是否足够稳
2. 最近 `2` 轮原文块是否足够保真
3. `50% ~ 60%` 阈值是否合理
4. `assemble()` 内直接触发全量重压缩的成本是否可接受

## 18. 当前结论摘要

这轮讨论最终收成一句话就是：

`compact-context` 作为 OpenClaw 的 context engine 插件，应以 `assemble()` 作为自动上下文治理主入口：`ingest()` 负责建图谱，`assemble()` 负责组织上下文，并按“baseline + 1块 incremental + 最近2轮 rawTail”工作；其中 `incremental` 只覆盖 baseline 之后、rawTail 之前的那一段内容，严格超过 50% 阈值时则在 `assemble()` 内直接做一次全量重压缩；`compact()` 只保留为手动 / 兼容入口。`
