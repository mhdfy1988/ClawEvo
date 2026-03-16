# `src` 收缩仪表板与基线

这份文档对应 [src-convergence-next-steps-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-convergence-next-steps-todo.zh-CN.md) 的 `TODO 6`，用来固定当前 `src/` 的收缩基线，并作为后续 compat 清理时的对照面。

相关文档：
- [src-compat-inventory.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-compat-inventory.zh-CN.md)
- [src-ownership-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-ownership-boundary.zh-CN.md)
- [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md)

## 基线快照

- 记录日期：`2026-03-16`
- 仪表脚本：`node ./scripts/src-convergence-dashboard.mjs`

## 当前树形规模

- `src` 顶层条目数：`4`
- `src` 递归目录数：`5`
- `src` 递归文件数：`61`
- `src` 递归 TypeScript 文件数：`53`

当前顶层条目是：

- `contracts/`
- `evaluation/`
- `tests/`
- `types/`

## 结构分布

### 长期保留的 repo-internal 区域

- 条目数：`4`
- 递归文件数：`61`
- 递归目录数：`1`
- TypeScript 文件数：`53`

对应路径：

- `src/types`
- `src/contracts`
- `src/evaluation`
- `src/tests`

目标状态：

- `retain-as-repo-internal`：`4`

### 当前仍保留的 compat 区域

- 条目数：`0`
- 递归文件数：`0`
- 递归目录数：`0`
- TypeScript 文件数：`0`

当前没有仍保留的 `src/*` compat 区域，legacy compat 已全部删除。

## 已移除 compat 基线

- 已移除 compat 路径数：`16`

当前已移除的路径包括：

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

建议每次涉及 `src/*` compat 删除或保留状态变化时，至少同步这三处：

1. [src-compat-metadata.mjs](/d:/C_Project/openclaw_compact_context/scripts/src-compat-metadata.mjs)
2. [src-compat-inventory.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-compat-inventory.zh-CN.md)
3. [src-convergence-dashboard.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-convergence-dashboard.zh-CN.md)

## 一句话结论

当前 `src/` 已经收缩到：

- `4` 个长期保留的 repo-internal 区域
- `0` 个仍处于迁移窗口的 compat 区域

后续的重点不再是清理 `src/*` compat，而是继续维持 `src` 只承载长期 repo-internal 源码的边界。
