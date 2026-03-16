# `src` 后续收口 TODO

这份 TODO 记录 `post-split cleanup` 之后，root `src` 收口工作的最终状态。

相关文档：
- [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md)
- [src-ownership-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-ownership-boundary.zh-CN.md)
- [src-compat-inventory.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-compat-inventory.zh-CN.md)
- [project-split-compatibility-note.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-compatibility-note.zh-CN.md)

## 当前判断

这条线现在已经完成：

1. legacy compat 已全部删除。
2. `src/types + src/contracts + src/evaluation` 已迁出 root `src`。
3. `src/tests` 已迁到 root [tests](/d:/C_Project/openclaw_compact_context/tests)。
4. root `src/` 目录已退役。

## TODO 状态
- [x] TODO 1：主文档与示例去 compat 化
- [x] TODO 2：收紧 `src/control-plane*` compat 语义
- [x] TODO 3：删除 `src/engine/*`
- [x] TODO 4：删除 `src/adapters/index.ts` 与 `src/bin/*`
- [x] TODO 5：退役 `src/openclaw/*` 与 `src/plugin/*`
- [x] TODO 6：建立 `src` 收缩仪表与基线
- [x] TODO 7：迁出 `src/types + src/contracts + src/evaluation`
- [x] TODO 8：迁出 `src/tests`

## 结果

当前已经达到：
- 主文档不再把 `src/*` 当成推荐入口
- compat 全部退役
- 共享 contract 与类型真源进入 [packages/contracts/src](/d:/C_Project/openclaw_compact_context/packages/contracts/src)
- evaluation harness 进入 [internal/evaluation](/d:/C_Project/openclaw_compact_context/internal/evaluation)
- repo 级测试进入 [tests](/d:/C_Project/openclaw_compact_context/tests)
- root `src/` 已不存在

## 后续方向

`src` 这条线后面不再有新的 compat 清理工作。更实际的后续方向是：
1. 继续保持 [tests](/d:/C_Project/openclaw_compact_context/tests) 只承载仓库级测试
2. 如后续出现新的共享真源，优先直接放进 package-local `src`
3. 如 evaluation 工具继续增长，再评估是否从 [internal/evaluation](/d:/C_Project/openclaw_compact_context/internal/evaluation) 升级为独立 package

## 完成标志

这份 TODO 现在可以视为完成。判断依据是：
- root `src` 已不再承担任何实现层职责
- compat 已清零
- repo 级测试已脱离 `src/`
