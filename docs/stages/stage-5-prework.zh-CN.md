# 阶段 5 预研说明

这份文档用于收敛阶段 5 的进入边界、核心问题和推荐输出。

阶段 5 不再以“补齐阶段 4 backlog”为目标，而是把已经稳定的：

- context-processing 主链
- relation recall 第一轮与第二轮
- memory lifecycle / experience learning 第一轮
- evaluation harness

作为基线，转向更长期的知识复用与知识晋升问题。

## 当前判断

当前更准确的定位是：

`阶段 4 第一轮与第二轮已完成，阶段 5 预研已完成第一轮收敛，下一步更适合进入正式实现规划。`

## 阶段 5 真正要回答什么

### 1. 多跳 relation recall 什么时候值得进入主链

需要收敛：

- 哪些 relation type 允许进入多跳路径
- path explain 最少需要输出什么
- 多跳召回的预算、成本和降级规则
- 什么时候只做 explain，不进入 bundle

### 2. workspace / global 级记忆如何复用

需要收敛：

- 哪些 session 级对象允许 promotion
- 哪些记忆只能保留在 session
- higher-scope 召回的优先级与隔离规则
- 跨任务复用如何避免噪音侵入当前 prompt

### 3. 试错学习如何晋升成长期知识

需要收敛：

- `Attempt -> Episode -> Pattern -> Skill / Rule / Process` 的晋升门槛
- `FailurePattern / SuccessfulProcedure / CriticalStep` 的治理状态
- 什么情况下失败经验只保留为 warning
- 什么情况下成功流程可以升级为稳定知识

### 4. Topic / Concept / Skill 的长期融合怎么做

需要收敛：

- Topic / Concept 什么时候从 hint 升到 admission 候选
- Skill 与 Topic / Concept 的关系是否需要显式图谱化
- 概念层和长期技能层如何避免重复建模

### 5. 观测、人工校正和 LLM 增强的边界

需要收敛：

- 哪些指标值得做成长期 dashboard
- 哪些对象允许人工校正
- 可选 LLM extractor 能增强什么，不能替代什么
- 如何保证 LLM 增强不破坏 `Evidence-first`

## 阶段 5 不应该一开始就做什么

- 不应该先把多跳 recall 全量接进 compiler
- 不应该先把 Topic / Concept 变成主 bundle admission 层
- 不应该先做大而全的长期记忆平台
- 不应该让可选 LLM extractor 接管主抽取链

## 阶段 5 建议交付物

建议先交付文档和评估基线，而不是马上铺大量代码：

- 阶段 5 TODO
- 多跳 recall 与 path explain 设计
- 高 scope 记忆复用设计
- 知识晋升合同设计
- 观测与人工校正边界说明

## 与阶段 4 的边界

阶段 4 已经解决的是：

- 上下文理解进入主链
- compiler 能消费语义原子与经验信号
- explain / evaluation 能覆盖这一层

阶段 5 才开始解决的是：

- 跨任务与高 scope 长期复用
- 多跳路径级 reasoning
- 试错经验向稳定知识体系的长期晋升
- 人工与 LLM 增强如何进入长期治理闭环

## 一句话结论

`阶段 5 预研的重点，不是继续扩阶段 4 的局部能力，而是把“多跳关系、跨任务复用、知识晋升、人工校正”这几条长期主线讲清楚。`
