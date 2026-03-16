# `src` 收缩仪表板与基线

这份文档对应 [src-convergence-next-steps-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-convergence-next-steps-todo.zh-CN.md) 的 `TODO 6`，用于固定 `src/` 退役后的最终基线。

相关文档：
- [src-compat-inventory.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-compat-inventory.zh-CN.md)
- [src-ownership-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-ownership-boundary.zh-CN.md)
- [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md)

## 基线快照

- 记录日期：`2026-03-16`
- 仪表脚本：`node ./scripts/src-convergence-dashboard.mjs`

## 当前结构口径

当前 root `src/` 已完全退役：
- top-level entry count = `0`
- files = `0`
- dirs = `0`
- tsFiles = `0`

repo-internal 测试与工具现在位于：
- `tests`
- `internal/evaluation`

可点击入口：
- [tests](/d:/C_Project/openclaw_compact_context/tests)
- [internal/evaluation](/d:/C_Project/openclaw_compact_context/internal/evaluation)

当前活动 compat 区域为：
- `0`

## 已移除 compat 基线

当前已移除的 compat 路径以 [src-compat-metadata.mjs](/d:/C_Project/openclaw_compact_context/scripts/src-compat-metadata.mjs) 为准，主要包括：
- `root-compat`
- `src/core`
- `src/adapters`
- `src/index.ts`
- `src/openclaw`
- `src/plugin`
- `src/control-plane`
- `src/control-plane-core`
- `src/runtime`
- `src/context-processing`
- `src/governance`
- `src/infrastructure`
- `src/runtime-core/index.ts`
- `src/engine`
- `src/bin`
- `packages/openclaw-adapter/src/adapters/openclaw`

## 使用方式

每次涉及 root `src` 退役状态变化时，至少同步这三处：
1. [src-compat-metadata.mjs](/d:/C_Project/openclaw_compact_context/scripts/src-compat-metadata.mjs)
2. [src-ownership-metadata.mjs](/d:/C_Project/openclaw_compact_context/scripts/src-ownership-metadata.mjs)
3. [src-convergence-dashboard.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-convergence-dashboard.zh-CN.md)

## 一句话结论

`src/` 已经不再存在；当前关注点已转为维持 `tests` 和 `internal/evaluation` 的 repo-internal 边界。
