# `src` 长期归属与边界

这份文档对应 [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md) 的 `TODO 8`，用于说明 root `src` 在完成拆分后的最终状态。

相关文档：
- [src-compat-inventory.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-compat-inventory.zh-CN.md)
- [project-split-compatibility-note.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-compatibility-note.zh-CN.md)
- [workspace-test-ownership.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-ownership.zh-CN.md)
- [workspace-test-and-release-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-and-release-boundary.zh-CN.md)

## 一句话结论

root `src` 已经退役。

现在 root 层的 repo-internal 代码只剩：
- [tests](/d:/C_Project/openclaw_compact_context/tests)
- [internal/evaluation](/d:/C_Project/openclaw_compact_context/internal/evaluation)

## 已迁出的原真源

以下内容已经不再保留在 root `src`：
- `src/types` -> [packages/contracts/src/types](/d:/C_Project/openclaw_compact_context/packages/contracts/src/types)
- `src/contracts` -> [packages/contracts/src/contracts](/d:/C_Project/openclaw_compact_context/packages/contracts/src/contracts)
- `src/evaluation` -> [internal/evaluation](/d:/C_Project/openclaw_compact_context/internal/evaluation)
- `src/tests` -> [tests](/d:/C_Project/openclaw_compact_context/tests)

这意味着：
1. 共享 contract 与类型真源已经 package-local 化。
2. evaluation harness 已转入 repo 内部工具目录。
3. repo 级测试已脱离 `src/`。
4. root `src/` 已不再承担任何职责。

## Compat 状态

当前 `src/*` compat 已全部删除，活动 compat 区域数为 `0`。

因此：
1. README 和设计文档必须直接指向 `apps/*`、`packages/*` 或 `internal/*`。
2. 不允许再把迁移窗口默认堆回 root `src`。
3. 如未来确有 compat 需求，必须先做专项评审并同步 smoke 规则。

## 什么时候还值得继续拆 package

对于仍留在仓库根目录的内容，只有满足以下条件时才值得继续 package 化：
1. 需要稳定 public API
2. 需要独立版本节奏
3. 需要独立安装、发布或复用
4. 已形成明确的 package-level `build / test / pack` 边界

按当前状态：[tests](/d:/C_Project/openclaw_compact_context/tests) 和 [internal/evaluation](/d:/C_Project/openclaw_compact_context/internal/evaluation) 更适合继续作为 repo-internal 目录存在。

## 不允许再回流的情况

后续明确不希望再出现：
1. 已迁出的共享 contract、类型或 evaluation 真源回流到 root `src`
2. 新共享实现继续堆到 `src`，却不说明它到底是 repo-internal 还是正式 package 真源
3. root `src` 再次变成“大一统源码目录”
