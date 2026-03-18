# Context Compression Stage TODO

## 阶段目标

这一阶段只做一件事：

`把 compact-context 的上下文压缩主链做完整，让我能先稳定用起来。`

当前阶段的主路线已经定死为：

- `ingest`
  - 构建结构化输入与知识图谱
- `assemble`
  - 作为自动上下文治理主入口
  - 每轮增量压缩
  - 超过阈值时直接全量重压缩
- `compact`
  - 保留为手动 / 兼容 / 调试入口
- `hook`
  - 保留代码与注册面
  - 当前不承担主链职责

## 完成定义

只有同时满足下面这些条件，才算这一阶段完成：

1. `assemble()` 能独立完成当前轮的上下文获取、图谱召回、压缩决策和最终返回。
2. 系统已经明确区分：
   - 长期压缩基线
   - 近期增量摘要层
   - 最新原文窗口
3. 超过上下文阈值时，会在 `assemble()` 内触发一次全量重压缩，而不是依赖手动 `compact`。
4. 压缩结果返回给宿主时，仍然遵守 provider-neutral 输出合同：
   - `messages`
   - `systemPromptAddition`
   - `estimatedTokens`
5. 图谱主干继续来自原始证据，不把压缩摘要当成唯一事实源。
6. 这条链能在：
   - 本地 CLI
   - OpenClaw 宿主
   两边稳定验证通过。

## 当前共识

### 一、主线边界

- 真相源优先级：
  1. `assemble.final`
  2. `runtime snapshot`
  3. `transcript / session file`

- 当前不再把 hook 当主链：
  - `tool_result_persist`
  - `before_compaction`
  - `after_compaction`
  - `before_prompt_build`
  这些都先保留，但不作为当前完成阶段目标的前提。

### 二、压缩策略

- 每轮 `assemble()` 都做增量压缩
- 当上下文占比超过 `50% ~ 60%` 时：
  - 在 `assemble()` 内直接做一次全量重压缩
- 全量重压缩后：
  - 生成新的压缩基线
  - 重置旧的增量摘要层
  - 保留最新原文窗口

### 三、知识图谱分工

- `ingest`
  - 建图谱
  - 记录证据、来源、时间、关系
- `assemble`
  - 用图谱
  - 做召回、筛选、压缩编排

## P0：必须完成

### 1. 锁定主合同

- [ ] 把 `assemble` 主治理路线写回实现注释和文档，不再保留“hook 也可能是主链”的模糊口径
- [ ] 把真相源优先级固定进实现约束：
  - `assemble.final > runtime snapshot > transcript`
- [ ] 把 provider-neutral 输出合同固定下来：
  - `messages`
  - `systemPromptAddition`
  - `estimatedTokens`
- [ ] 把 runtime window 合同固定下来：
  - `inbound`
  - `preferred`
  - `final`
  - `latestPointers`
  - `toolCallResultPairs`

### 2. 建立压缩状态模型

- [ ] 明确并实现“长期压缩基线”的存储结构
- [ ] 明确并实现“近期增量摘要层”的存储结构
- [ ] 明确并实现“最新原文窗口”的存储结构
- [ ] 给压缩状态增加版本和来源标记：
  - `baselineId`
  - `compressionMode`
  - `derivedFrom`
  - `createdAt`

### 3. 完成 assemble 主链

- [ ] `assemble()` 内统一完成：
  - 读取当前窗口
  - 计算预算占比
  - 图谱召回
  - 增量压缩
  - 必要时全量重压缩
  - 组装最终上下文
- [ ] 把“是否触发全量重压缩”的判断收成可复用函数
- [ ] 在 `assemble()` 的最终结果中显式记录：
  - 本轮压缩模式：`none | incremental | full`
  - 触发原因：如 `budget_over_60_percent`

### 4. 让 ingest 成为唯一建图入口

- [ ] 继续保证原始消息、工具结果、transcript 回放都先经过 `ingest`
- [ ] 明确禁止在 `assemble()` 里直接往主图谱写“事实节点”
- [ ] 如果 `assemble()` 需要落库，只允许写：
  - `derived summary`
  - `checkpoint`
  - `delta`
  - 这类派生产物

### 5. 接上 checkpoint / delta / skill 同步

- [ ] 定义“增量压缩后是否更新 delta”的规则
- [ ] 定义“全量重压缩后何时重建 checkpoint”的规则
- [ ] 定义“skill candidate 何时更新”的最小规则
- [ ] 区分：
  - `assemble` 触发的状态更新
  - `compact` 触发的手动状态更新

### 6. 固定 bundle / summary 结构

- [ ] 继续使用固定结构：
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
- [ ] 不允许把主压缩结果退回成自由文本摘要为主
- [ ] 给 bundle 增补轻量元信息：
  - `compressionMode`
  - `baselineId`
  - `evidenceCoverage`

### 7. 保住 recent raw tail

- [ ] 明确保留最近原文窗口的规则
- [ ] 区分：
  - `user`
  - `assistant`
  - `tool`
  - `system`
  的保留策略
- [ ] 明确哪些内容绝不能过早压扁：
  - 当前目标
  - 硬约束
  - 当前流程位置
  - 最近关键决策
  - 最近关键 tool result

### 8. 做完最小可用验证

- [ ] 本地 CLI 验证：
  - `summarize`
  - `roundtrip`
  - `explain`
- [ ] OpenClaw 宿主验证：
  - `openclaw compact-context summarize`
  - `openclaw compact-context explain`
- [ ] 至少验证一条长上下文场景：
  - 连续多轮消息后触发增量压缩
- [ ] 至少验证一条超阈值场景：
  - 触发 assemble 内全量重压缩

## P1：阶段内增强，但不阻塞先用起来

### 9. 优化 explain / inspect

- [ ] explain 能回答：
  - 本轮是增量压缩还是全量重压缩
  - 为什么触发
  - 哪些节点被召回
  - 哪些原文窗口被保留
- [ ] runtime window snapshot 能显示：
  - `inbound / preferred / final`
  - `compactionMode`
  - `compactionReason`

### 10. 优化关系召回

- [ ] 把 relation recall / learning recall 明确纳入 assemble 召回阶段
- [ ] 区分“直接文本命中”和“图谱关系命中”
- [ ] 对图谱召回增加 explain 说明

### 11. 优化 checkpoint / delta 语义

- [ ] delta 不只记录 id diff，还要尽量记录语义变化类型
- [ ] checkpoint 增加“由 assemble 触发 / 由 compact 触发”的来源标记

## 暂缓，不作为本阶段完成条件

- [ ] hook 深度治理
- [ ] 大规模 skill 自动晋升
- [ ] 图谱可视化
- [ ] 多人协作图谱
- [ ] provider-specific payload 优化

## 建议实施顺序

1. 锁合同和真相源优先级
2. 落压缩状态模型
3. 打通 `assemble` 主链
4. 接上 checkpoint / delta / skill 最小同步
5. 跑 CLI / OpenClaw 两条验证链
6. 再做 explain / inspect 和关系召回增强

## 阶段验收命令

### 本地 CLI

```powershell
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --text "测试一句话能不能被压缩。"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js roundtrip --text "今天先把首页做成控制塔视角，并保留任务总览。"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js explain --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
```

### OpenClaw 宿主

```powershell
openclaw.cmd compact-context summarize --text "测试一句话能不能被压缩。"
openclaw.cmd compact-context explain --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
```

## 一句话收尾

这一阶段只围绕一个目标推进：

`让 compact-context 在 assemble 主链中稳定完成上下文获取、图谱召回、增量压缩、阈值全量重压缩与 provider-neutral 返回，先成为可稳定使用的上下文压缩引擎。`
