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

- `src` 顶层条目数：`9`
- `src` 递归目录数：`9`
- `src` 递归文件数：`91`
- `src` 递归 TypeScript 文件数：`83`

当前顶层条目是：

- `contracts/`
- `control-plane/`
- `control-plane-core/`
- `evaluation/`
- `openclaw/`
- `plugin/`
- `tests/`
- `types/`
- `index.ts`

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

- 条目数：`5`
- 递归文件数：`30`
- 递归目录数：`0`
- TypeScript 文件数：`30`

对应路径：

- `src/index.ts`
- `src/openclaw`
- `src/plugin`
- `src/control-plane`
- `src/control-plane-core`

目标状态分布：

- `retire-after-root-src-aggregate-window`：`1`
- `retire-after-host-migration-window`：`1`
- `retire-after-plugin-migration-window`：`1`
- `retire-after-platform-migration-window`：`2`

## 已移除 compat 基线

- 已移除 compat 路径数：`11`

当前已移除的路径包括：

- `root-compat`
- `src/core`
- `src/adapters`
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
- `5` 个仍处于迁移窗口的 compat 区域

后续的重点不是再大范围搬迁，而是继续把这 `5` 个 compat 区域逐步压缩到能安全退役的阈值。
