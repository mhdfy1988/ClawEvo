# 阶段 4 前置事项

## 1. 目标

这份文档用于把阶段 3 第二轮之后最自然的下一步，收敛成一份阶段 4 前置事项列表。

它不是正式的阶段 4 TODO，而是帮助我们回答：

1. 阶段 4 真正要解决什么
2. 哪些能力可以直接进入阶段 4
3. 哪些前置约束如果不先明确，阶段 4 会越做越散

配套审查建议见：
[stage-4-readiness-review.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-readiness-review.zh-CN.md)
配套执行清单见：
[stage-4-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-todo.zh-CN.md)

---

## 2. 当前进入阶段 4 前置准备的原因

阶段 3 第二轮已经完成：

- persistence trace 深化
- relation-aware recall 第一轮
- memory lineage 第一轮

这意味着当前主链已经从：

`治理 -> 裁决 -> 追查`

推进到了：

`治理 -> 裁决 -> 追查 -> 关系增强 / 记忆来源链`

所以接下来最合理的不是继续无序加点，而是把阶段 4 的主线收束清楚。

---

## 3. 阶段 4 建议聚焦的三条主线

### 3.1 Recall 扩边与关系优先级

目标：

- 让 relation-aware recall 从一跳 `supported_by` 扩到更有价值的关系边

优先考虑：

- `requires`
- `next_step`
- `supersedes`
- `overrides`

前置问题：

- 哪些边能进 recall 主链
- 哪些边只适合 explain / diagnostics
- 边优先级如何排序

### 3.2 长期记忆治理

目标：

- 让 `checkpoint / delta / skill candidate` 从“可追踪”推进到“可管理”

优先考虑：

- 频率统计
- 稳定性评分
- 成功率 / 冲突率
- 聚合 / 淘汰策略

前置问题：

- 什么样的 candidate 才值得升级
- 哪些记忆只保留 session 内，哪些能升到 workspace
- 多个相似 skill 如何合并

### 3.3 主题层与长期记忆层接入

目标：

- 把主题概念层和长期记忆层谨慎接入 recall / compiler

优先考虑：

- 主题聚类
- topic-aware recall
- workspace / global 级记忆召回

前置问题：

- topic 节点怎么建
- 主题层是增强层还是主链依赖
- 如何避免主题总结反向污染 evidence-first 主链

---

## 4. 阶段 4 前必须先定清楚的治理约束

阶段 4 开始前，建议先把下面这些约束写死。

### 4.1 Evidence-first 不变

- 原文证据层仍然优先于主题层、长期记忆层和总结层
- 任何增强层都不能覆盖原始 evidence 的优先级

### 4.2 Provenance 继续做横切约束

- 新增的记忆对象和主题对象仍然必须带 provenance
- `raw / compressed / derived` 不能在阶段 4 被弱化

### 4.3 Recall 扩边必须可解释

- 新增 recall 边必须同时接 diagnostics / explain
- 不能只提升召回，却看不出为什么召回了它

### 4.4 长期记忆必须可淘汰

- 阶段 4 不应该只考虑“怎么积累”，还要同时定义“怎么清理”
- 没有淘汰机制，长期记忆层会迅速退化成噪音层

### 4.5 扩边前必须先定义 relation production contract

- 不是所有已定义的边都能直接进入 recall 主链
- 必须先明确：
  - 哪些边稳定生成
  - 哪些边允许进入 recall
  - 哪些边只用于 explain / diagnostics
  - 边的 priority / confidence / freshness 如何表达

### 4.6 扩 scope 前必须先定义 promotion policy

- 阶段 4 如果要碰 workspace / global 记忆，必须先明确：
  - session -> workspace -> global 的升级条件
  - higher-scope 的写入门槛
  - higher-scope recall 的优先级与回退策略

### 4.7 扩关系和记忆前必须先定义评估指标

- recall 扩边后如何判断召回更好而不是更吵
- 长期记忆接入后如何判断 bundle 更稳而不是更乱
- explain 和 trace 扩展后如何判断可读性没有退化

### 4.8 扩边前必须先定义 relation retrieval / explain 成本口径

- 阶段 4 如果继续扩 relation recall，检索与 explain 的成本会先放大
- 进入实现前应先明确：
  - relation retrieval 的 batch / cache 策略
  - persistence lineage 的 lookup 策略
  - SQLite / GraphStore 的索引与查询路径
  - 何时需要把“功能正确”升级为“成本可控”

---

## 5. 建议的阶段 4 启动顺序

### P0

- 定义 recall 扩边白名单与优先级
- 定义 relation production contract
- 定义 relation retrieval / explain cost model
- 定义阶段 4 评估指标与 fixture 范围
- 定义长期记忆评分字段
- 定义 skill 聚合 / 淘汰最小规则
- 定义 session -> workspace -> global promotion policy

### P1

- 接 `requires / next_step / overrides` 到 recall 主链
- 做第一轮记忆评分与 skill merge 原型
- 规划 relation retrieval / explain lineage 的成本控制

### P2

- 接主题层最小模型
- 试验 workspace / global 级别的长期记忆召回

---

## 6. 不建议现在立刻做的事

- 不建议一开始就做多跳复杂图推理
- 不建议一开始就让主题层主导 prompt 编译
- 不建议一开始就引入重型外部记忆 / 图数据库依赖
- 不建议在没有淘汰策略前扩大长期记忆层规模

---

## 7. 建议的阶段 4 启动条件

满足下面这些条件时，再正式起阶段 4 TODO 会更稳：

1. 阶段 3 第二轮总结文档已完成
2. relation production contract 已明确
3. recall 扩边优先级有明确口径
4. relation retrieval / explain 成本口径已确定
5. 长期记忆评分与淘汰最小契约已确定
6. session / workspace / global promotion policy 已确定
7. 主题层是否进入主链已有明确边界
8. 阶段 4 评估指标与最小 fixture 范围已确定

---

## 8. 阶段 4 以后仍建议预留的方向

这些不一定要放在阶段 4 第一轮，但建议现在就先留在路线图里：

- `Topic / Concept` 的显式主题层模型
- 多跳 relation recall 与 path explanation
- workspace / global 级别的跨任务记忆复用
- bundle 质量、relation 贡献、memory lifecycle 的阶段级观测输出

---

## 9. 一句话结论

`阶段 4 不该从“再加更多层”开始，而该从“先把 recall 扩边、长期记忆治理和主题层边界讲清楚”开始。`

