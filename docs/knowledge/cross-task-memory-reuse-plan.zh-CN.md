# 跨任务记忆复用与高 Scope 治理方案

配套阅读：
- [stage-5-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-prework.zh-CN.md)
- [scope-policy.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/scope-policy.ts)
- [stage-4-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-status.zh-CN.md)

## 1. 目标

这份文档用于回答：

`哪些记忆可以从 session 升到 workspace / global，升上去之后怎么召回、怎么冲突裁决、怎么退役。`

## 2. 当前基线

当前系统已经有：

- `session / workspace / global` scope policy
- higher-scope fallback
- scope-aware compiler 排序

当前还没有：

- 跨任务记忆 promotion 门槛
- 高 scope 记忆的长期退役与冲突合同
- 跨任务复用的独立评估口径

## 3. Promotion 门槛

建议 promotion 至少分三层：

### 3.1 session-only

只保留在单会话：

- 临时状态
- 单次失败
- 未验证流程
- 当前任务临时约束

### 3.2 workspace-candidate

允许升到 workspace 的候选：

- 多次在同一 workspace 复现的流程
- 与项目结构、代码库、工作流强相关的约束
- 局部领域技能

### 3.3 global-candidate

允许升到 global 的候选：

- 强迁移性流程
- 通用知识晋升后的稳定技能
- 跨项目都成立的约束或方法

## 4. Recall Tier 与隔离

建议保持严格优先级：

1. `session`
2. `workspace`
3. `global`

并加上隔离条件：

- workspace 记忆必须匹配 workspaceId
- global 记忆默认只作为 fallback
- 高 scope 记忆不允许压过当前 session 的高置信事实

## 5. 清理、退役与冲突裁决

高 scope 记忆至少要支持：

- `active`
- `stale`
- `retired`
- `superseded`

并至少满足：

- 有新的高置信版本时，老版本进入 `superseded`
- 长期不被命中时，进入 `stale`
- 被明确证伪时，进入 `retired`

## 6. 推荐评估项

建议阶段 5 后续补：

- workspace recall precision
- global fallback usefulness
- cross-task intrusion rate
- high-scope stale ratio

## 7. 一句话结论

`跨任务记忆复用的关键不是“升得快”，而是“升得慢、召回稳、退得掉”。`



