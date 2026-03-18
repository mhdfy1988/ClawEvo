# Context Engine Assemble 压缩策略

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

- 每轮 assemble 可更新增量状态，但不要每轮都重建完整 checkpoint
- 全量重压缩后，优先触发：
  - 新基线
  - checkpoint 更新
  - 必要时 skill candidate 更新
- 后续实现时要把“增量压缩”和“全量重压缩”的同步规则分开定义

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

表示在基线之后，每轮新增内容滚动形成的摘要层。

作用：

- 低成本维护近期变化
- 避免每轮都做全量重压缩

### 9.3 最新原文窗口

表示最近几轮高保真原始内容。

作用：

- 保留最近消息、工具结果和最新上下文细节
- 避免“刚发生的内容还没来得及充分结构化就被压扁”

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

## 11. 知识图谱在这套方案里的位置

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

## 12. 为什么不建议“所有压缩都只放 compact”

因为那样会有明显风险：

1. 自动压缩行为依赖宿主何时调用 `compact()`。
2. 用户可能只有在手动 `/compact` 时才能看到效果。
3. 自动上下文治理时机不稳定。

如果改成以 `assemble()` 为主：

- 每轮都会经过这套治理逻辑
- 宿主始终拿到已经处理好的上下文
- 用户不会感觉“怎么还得手动 compact 才正常”

## 13. 当前实现边界建议

这套方案下，后续实现边界建议固定为：

- `runtime-core`
  - 继续承接底层上下文处理、编排与压缩逻辑
- `compact-context-core`
  - 承接插件内部业务核心装配
- `openclaw-adapter`
  - 负责把 OpenClaw 的 context engine 生命周期接到运行时
- `openclaw-plugin`
  - 继续保持薄壳，只做宿主接入和 host CLI 注册

## 12. 第一版最小实现方向

第一版不建议一下子做复杂的分层压缩框架，推荐先做最小可行版：

1. 在 `assemble()` 中拿到当前上下文预算占比。
2. 先对新增内容做轻量增量摘要。
3. 超过阈值时，在 `assemble()` 中直接重算一版全量摘要基线。
4. 保留最近若干轮原文窗口。
5. 把“基线摘要 + 增量摘要 + 原文窗口”返回给宿主。

这样可以先验证三件事：

1. 每轮增量压缩是否足够稳
2. `50% ~ 60%` 阈值是否合理
3. `assemble()` 内直接触发全量重压缩的成本是否可接受

## 13. 当前结论摘要

这轮讨论最终收成一句话就是：

`compact-context` 作为 OpenClaw 的 context engine 插件，应以 `assemble()` 作为自动上下文治理主入口：`ingest()` 负责建图谱，`assemble()` 负责取图谱、做每轮增量压缩，并在上下文达到 50%~60% 阈值时直接做一次全量重压缩，然后把最终上下文返回给宿主发送给 LLM；`compact()` 保留为手动 / 兼容入口。`
