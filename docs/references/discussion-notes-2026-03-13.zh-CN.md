# 讨论纪要 2026-03-13

关联文档：
- [context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-design-v2.zh-CN.md)
- [context-engine-delivery-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-engine-delivery-plan.zh-CN.md)

## 1. 这次讨论的总方向

这次我们把插件的定位从“普通上下文检索插件”收敛成了：

`Context Compiler + Graph Memory + Skill Crystallizer`

也就是说，这个插件不只是帮 OpenClaw 找相关文本，而是要把上下文持续编译成：

- 可查询的知识图谱
- 可控 token 的运行时压缩上下文
- 可沉淀的 skill candidate

## 2. 我们确认过的核心技术方案

### 2.1 知识图谱的中心对象

图谱中心不是“代码实体”，而是 OpenClaw 的行动语义：

- `Rule`
- `Constraint`
- `Process`
- `Step`
- `Skill`
- `State`
- `Decision`
- `Evidence`
- `Goal`
- `Intent`

结论：

- 代码只是证据源之一
- 真正要组织的是规则、流程、约束、技能和任务状态

### 2.2 图谱的作用

图谱不是拿来替代原文，而是做三件事：

- 组织上下文
- 支撑裁决
- 生成稳定模式

最终喂给模型的仍然是压缩后的结构化上下文和必要证据，而不是把整张图直接塞进 prompt。

### 2.3 压缩与知识沉淀必须是一件事

这是今天最重要的结论之一。

我们明确不走这条路：

- 先做会话摘要
- 以后再想办法沉淀知识

而是走：

```text
原始上下文
-> 图谱 ingest
-> 运行时 bundle 编译
-> prompt 压缩输出
-> checkpoint / delta
-> skill candidate
```

也就是：

- 压缩的同时沉淀 graph
- 压缩的同时更新 checkpoint
- 压缩的同时尝试结晶 skill candidate

### 2.4 Prompt 压缩的主战场

我们讨论过是否用 `before_prompt_build` 做压缩，最终结论是：

- `before_prompt_build` 可以做辅助注入
- 但真正的主压缩点应该放在 `assemble()`

原因：

- `before_prompt_build` 只能返回 prompt 注入字段
- 它不能真正替换原始消息数组
- 容易和 `assemble()` 重复注入上下文

因此当前技术路线是：

- `assemble()` 负责真正减少原始消息 token
- `before_prompt_build` 暂时不作为主压缩器

### 2.5 Prompt 压缩策略

我们收敛出的运行时压缩策略是：

- 保留最近一段原始消息
- 更早历史不再原样进入 prompt
- 更早历史由 `RuntimeContextBundle` 代表

当前实现对应的配置项是：

- `recentRawMessageCount`

它表示：

- 最终 prompt 中保留多少条最近的非 `system` 原始消息

### 2.6 长期压缩与宿主生命周期协同

我们确认 OpenClaw 插件不仅能注册 `context engine`，也能注册 typed hooks。

当前我们已经决定并实现的 hook 协同方案：

- `before_compaction`
  - 在宿主压缩前，先把最新 transcript / message snapshot ingest 到图谱
- `after_compaction`
  - 在宿主压缩后，重读 transcript
  - 更新 checkpoint
  - 更新 skill candidate

结论：

- hook 是 Context Engine 的生命周期协同层
- 不只是额外功能

### 2.7 `tool_result_persist` 的定位

我们没有立刻接它，但已经明确它的价值：

- 在工具结果写入 transcript 前做瘦身
- 从源头减少后续上下文膨胀

结论：

- 这是下一阶段优先级很高的功能点
- 但要先定“哪些字段可安全裁剪、哪些必须保留”的策略

### 2.8 插件与数据库的边界

我们讨论并收敛的边界是：

```text
OpenClaw
-> 调插件能力接口
-> 插件内部操作自己的图谱/压缩逻辑
-> 插件内部管理 SQLite
```

也就是说：

- OpenClaw 不直接操作插件表
- OpenClaw 调的是插件高层能力
- 数据库即使由插件自己管理，也还是通过插件来读写

### 2.9 SQLite 的落点

我们确认了两层结论：

1. 当前没有看到 OpenClaw 公开暴露“把宿主 SQLite 连接直接给插件”的稳定 API
2. 但 OpenClaw 有稳定的 `stateDir` 能力

所以当前采用的方案是：

- 优先落到 `OpenClaw stateDir/plugins/compact-context/`
- 插件自己管理 SQLite schema 和持久化

### 2.10 Transcript 导入方案

我们确认 session transcript 是 JSONL，并且有分支结构。

当前的技术方案是：

- 读取 JSONL transcript
- 识别 session header
- 根据 `id / parentId` 恢复当前叶子分支
- 只导入当前有效 branch
- 支持：
  - `message`
  - `custom_message`
  - `compaction`

结论：

- 不能把整个 transcript 平铺导入
- 要按当前有效分支恢复上下文

### 2.11 Skill 的来源

我们明确了 skill 不应该主要靠手工写，而应该来自稳定模式沉淀。

也就是：

- 重复出现
- 条件清晰
- 路径稳定
- 结果可靠

的上下文结构，会慢慢长成 `skill candidate`。

## 3. 今天产出的关键文档

这次讨论已经沉淀成下面几份文档：

- 总设计稿 v2
  - [context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-design-v2.zh-CN.md)
- 实施拆分与验收清单
  - [context-engine-delivery-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-engine-delivery-plan.zh-CN.md)
- Hook 结论
  - [openclaw-hook-findings.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/openclaw-hook-findings.zh-CN.md)
- Prompt 压缩说明
  - [prompt-compression.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/prompt-compression.zh-CN.md)

## 4. 当前已经落地到代码里的部分

- OpenClaw 原生插件入口
- context engine slot 接入
- transcript 导入与当前分支恢复
- SQLite 图谱/检查点/技能候选持久化
- `before_compaction / after_compaction` hook
- `assemble()` 中的历史压缩
- `recentRawMessageCount` 配置

## 5. 明天继续时建议直接从这里开始

建议继续顺序：

1. 先继续做 `assemble()` 压缩链路细化
2. 再设计并接入 `tool_result_persist`

原因：

- 这两块最直接影响 token 成本
- 也最直接影响“压缩时同步沉淀知识”这条主线能不能跑稳

## 6. 一句话总结

今天我们最终收敛出的技术主张是：

`让 OpenClaw 在每次处理上下文时，一边压缩 prompt，一边把旧历史沉淀成图谱、checkpoint 和 skill candidate，而不是把压缩和知识管理拆成两套系统。`

