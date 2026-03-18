# `src` Compat 清单

这份文档对应 [src-convergence-next-steps-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-convergence-next-steps-todo.zh-CN.md)，记录当前 `src/*` 中仍保留的 compat 转发层，以及已经删除的历史 compat 入口。

相关文档：
- [src-ownership-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-ownership-boundary.zh-CN.md)
- [project-split-compatibility-note.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-compatibility-note.zh-CN.md)

## 当前保留的 compat 入口

当前 `src/*` compat 已全部删除，活动 compat 入口数为 `0`。

后续如果需要重新引入迁移窗口，必须先说明为什么正式的 `apps/*` / `packages/*` 入口不够用，并同步补 smoke 审查。

## 已删除的 compat 入口

| 路径 | 状态 | 说明 |
| --- | --- | --- |
| `root-compat/*` | 已删 | root 已退化为 workspace orchestrator。 |
| `src/core/*` | 已删 | 历史杂项 shim 已清空。 |
| `src/index.ts` | 已删 | root 级历史聚合入口已退役，统一直接使用 apps / packages 正式入口。 |
| `src/openclaw/*` | 已删 | OpenClaw 宿主适配 compat 已删除，统一切到 `@openclaw-compact-context/openclaw-adapter/openclaw/*`。 |
| `src/plugin/*` | 已删 | 插件 API / bridge / stdio compat 已删除，统一切到 `@openclaw-compact-context/openclaw-adapter/plugin/*`。 |
| `src/control-plane/*` | 已删 | control-plane compat 已删除，统一切到 `@openclaw-compact-context/compact-context-core` / `@openclaw-compact-context/control-plane-shell/*`。 |
| `src/compact-context-core/*` | 已删 | compact-context-core compat 已删除，统一切到 `@openclaw-compact-context/compact-context-core`。 |
| `src/runtime/*` | 已删 | 运行时真源已收敛到 `packages/runtime-core/src/runtime/*`。 |
| `src/context-processing/*` | 已删 | 上下文处理真源已收敛到 `packages/runtime-core/src/context-processing/*`。 |
| `src/governance/*` | 已删 | governance 真源已收敛到 `packages/runtime-core/src/governance/*`。 |
| `src/infrastructure/*` | 已删 | infrastructure 真源已收敛到 `packages/runtime-core/src/infrastructure/*`。 |
| `src/runtime-core/index.ts` | 已删 | runtime-core 的历史 `src` 聚合入口已移除。 |
| `src/engine/*` | 已删 | engine compat 已删除，统一切到 `@openclaw-compact-context/runtime-core/engine/context-engine`。 |
| `src/adapters/index.ts` | 已删 | adapters 最小 compat 聚合入口已移除，统一由 `src/index.ts` 直接转发到 `@openclaw-compact-context/openclaw-adapter`。 |
| `src/bin/*` | 已删 | 历史 CLI compat 壳已移除，统一使用 app-local CLI 入口。 |
| `packages/openclaw-adapter/src/adapters/openclaw` | 已删 | 旧别名目录已删除。 |

## 规则

当前对 compat 层的约束是：

1. legacy compat 已全部删除，不允许在 `root src` 下恢复新的 compat 转发层。
2. 不允许新增真实实现伪装成 compat。
3. README / 设计文档中的推荐入口必须直接指向 `apps/*` 或 `packages/*`。
