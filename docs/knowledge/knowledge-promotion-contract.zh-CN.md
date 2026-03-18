# 知识晋升合同方案

配套阅读：
- [experience-learning-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/experience-learning-plan.zh-CN.md)
- [stage-5-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-prework.zh-CN.md)
- [stage-5-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-todo.zh-CN.md)

## 1. 目标

这份文档用于收敛：

`Attempt -> Episode -> Pattern -> Skill / Rule / Process`

这一条长期知识晋升合同。

## 2. 晋升链

建议维持下面这条链：

```text
Trace
-> Attempt
-> Episode
-> Pattern
-> Skill / Rule / Process / Constraint
```

## 3. Pattern 类型

建议至少区分：

- `FailurePattern`
- `SuccessfulProcedure`
- `CriticalStepPattern`
- `ConstraintPattern`

## 4. 晋升门槛

建议每次晋升都检查：

- `evidenceCount`
- `episodeCount`
- `successRate`
- `stability`
- `transferability`
- `contradictionCount`

### 4.1 Attempt -> Episode

门槛最低，只要求：

- 同一目标
- 可归组的尝试集合

### 4.2 Episode -> Pattern

至少要求：

- 不是一次性的噪音
- 有稳定失败或成功信号
- 能明确抽出关键步骤或约束

### 4.3 Pattern -> Skill / Rule / Process

至少要求：

- 多次复现
- 证据充足
- 迁移边界可描述
- 反例数量可接受

## 5. 负向知识的处理

失败经验不应直接变成硬约束。

建议至少区分：

- `warning`
- `soft_constraint`
- `hard_constraint`

只有当失败模式非常稳定时，才允许升级为硬约束。

## 6. 回退与降级

长期知识必须支持降级：

- `validated -> contested`
- `contested -> stale`
- `stale -> retired`

也就是说，晋升不是一次性的，后面还要允许退役。

## 7. 一句话结论

`知识晋升的关键不是“把成功经验升上去”，而是“定义清楚为什么可以升、为什么还可以降”。`

