# `src` Compat 清单

这份文档对应 [src-convergence-next-steps-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-convergence-next-steps-todo.zh-CN.md)，记录当前 `src/*` 中仍保留的 compat 转发层，以及已经删除的历史 compat 入口。

相关文档：
- [src-ownership-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-ownership-boundary.zh-CN.md)
- [project-split-compatibility-note.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-compatibility-note.zh-CN.md)

## 当前保留的 compat 入口

| 路径 | 状态 | 目标状态 | 保留理由 | repo 内部使用 | 正式替代入口 | 删除前条件 |
| --- | --- | --- | --- | --- | --- | --- |
| `src/index.ts` | 保留 | `retire-after-root-src-aggregate-window` | root 级历史聚合入口，只保留顶层 `src` 导入兼容。 | 极少量 | 对应的 `apps/*` / `packages/*` 正式入口 | 1. 外部消费者不再依赖 root 级 `src` 聚合导入 2. root 聚合入口完成退役 |
| `src/openclaw/*` | 保留 | `retire-after-host-migration-window` | OpenClaw 宿主适配的历史 `src` 入口。 | 无 | `@openclaw-compact-context/openclaw-adapter/openclaw/*` | 1. repo 内部源码与测试持续保持零引用 2. 迁移文档和外部集成说明不再把它列为仍在窗口内的旧入口 |
| `src/plugin/*` | 保留 | `retire-after-plugin-migration-window` | 插件 API / bridge / stdio 的历史 `src` 入口。 | 无 | `@openclaw-compact-context/openclaw-adapter/plugin/*` | 1. repo 内部源码与测试持续保持零引用 2. 旧 plugin / stdio 消费面可接受 breaking removal |
| `src/control-plane/*` | 保留 | `retire-after-platform-migration-window` | control-plane 的历史 `src` 聚合入口，当前直接转发到 `control-plane-core` 与 `control-plane-shell`。 | 极少量 | `@openclaw-compact-context/control-plane-core` / `@openclaw-compact-context/control-plane-shell/*` | 1. repo 内部不再需要 `src/control-plane` compat 跳转 2. 外部迁移说明统一切到 package/app 入口 |
| `src/control-plane-core/*` | 保留 | `retire-after-platform-migration-window` | control-plane-core 的历史 `src` 聚合入口，当前只做 package 根入口别名。 | 极少量 | `@openclaw-compact-context/control-plane-core` | 1. repo 内部和文档不再需要 `src/control-plane-core` compat 说明 2. 正式包入口完全稳定替代 |

这些路径仍然存在，但已经不是推荐入口。

## 已删除的 compat 入口

| 路径 | 状态 | 说明 |
| --- | --- | --- |
| `root-compat/*` | 已删 | root 已退化为 workspace orchestrator。 |
| `src/core/*` | 已删 | 历史杂项 shim 已清空。 |
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

1. 只允许单跳转发。
2. 不允许新增真实实现。
3. 不再作为 README / 设计文档中的推荐入口。
