# Governance Workflow Runbook

这份文档面向“怎么操作治理闭环”，把 contract 变成可执行流程。

相关文档：
- [control-plane-service-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-service-contracts.zh-CN.md)
- [manual-corrections-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/manual-corrections-usage.zh-CN.md)

## 1. 适用场景

这套 runbook 用于：
- concept alias 修正
- promotion / suppression 修正
- 误晋升知识回滚
- 跨 scope 的治理申请

## 2. 标准流程

治理流程固定为：

`proposal -> review -> apply -> rollback`

### 提交 proposal

提交时至少要明确：
- `targetScope`
- `submittedBy`
- `submittedAuthority`
- `reason`
- `corrections`

入口：
- `compact-context.submit_correction_proposal`

### 审核 proposal

审核结果只有两种：
- `approve`
- `reject`

入口：
- `compact-context.review_correction_proposal`

### 应用 proposal

已批准 proposal 才能进入 apply。

入口：
- `compact-context.apply_correction_proposal`

当前实现不是直接写库，而是通过 runtime engine 回流 corrections。

### 回滚 proposal

当应用结果不符合预期时：
- 生成反向 corrections
- 通过 runtime engine 回流

入口：
- `compact-context.rollback_correction_proposal`

## 3. Authority 规则

### `session`
- `session_operator`
- `workspace_reviewer`
- `global_reviewer`

都可以参与 submit / review / apply / rollback。

### `workspace`
- 仅 `workspace_reviewer`
- 或 `global_reviewer`

可以 submit / review / apply / rollback。

### `global`
- 仅 `global_reviewer`

可以 submit / review / apply / rollback。

## 4. 审计查看

proposal 和 audit 应该一起看，主要入口：
- `compact-context.list_correction_proposals`
- `compact-context.list_correction_audit`

建议排查顺序：
1. proposal 状态
2. review 结论
3. apply 时间和操作者
4. rollback 记录

## 5. 常见操作建议

### 只影响当前一次会话
- 优先用 `session`
- 不要轻易升 `workspace`

### 多个任务共享同一规则
- 先升 `workspace`
- 观察稳定后再考虑 `global`

### 不确定是否会污染长期知识
- 先走 `session`
- 记录 reason
- 等更多 evidence 再升 scope
