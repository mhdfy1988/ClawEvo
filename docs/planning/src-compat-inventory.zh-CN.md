# `src/*` compat 清单

这份文档对应 [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md) 的 `TODO 7`，专门回答 3 个问题：

1. 现在 `src/*` 下哪些目录仍然是 compat 转发层
2. 哪些 compat 入口继续保留，哪些已经删除
3. 后续继续收缩 compat 时应遵守什么规则

相关约束来源：
- [project-split-compatibility-note.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-compatibility-note.zh-CN.md)
- [workspace-test-and-release-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-and-release-boundary.zh-CN.md)
- [workspace-smoke.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/workspace-smoke.test.ts)

## 当前规则

`src/*` compat 层只允许做单跳转发，不再承载真实实现。

当前统一规则是：

1. compat 文件只能包含 `import/export` 级别的转发语句，不允许新增业务逻辑、状态或流程控制。
2. README / 设计文档不再把 compat 路径描述为推荐主入口；推荐入口应指向 `apps/*` 或 `packages/*`。
3. 如果确实要新增 compat 入口，必须先说明为什么现有 package/app 入口不足，并同步补 smoke 审查。

## 仍保留的 compat 入口

这批入口当前仍然保留迁移窗口：

| 路径 | 状态 | 原因 |
| --- | --- | --- |
| `src/openclaw/*` | 保留 | OpenClaw 宿主适配的历史 `src` 入口，仍承接宿主侧旧导入。 |
| `src/plugin/*` | 保留 | 插件 API / bridge / stdio 的历史 `src` 入口。 |
| `src/control-plane/*` | 保留 | control-plane shell/core 的历史 `src` 入口。 |
| `src/control-plane-core/*` | 保留 | control-plane-core 的历史 `src` 聚合入口，目前只做 compat 聚合转发。 |
| `src/engine/*` | 保留 | runtime-core engine 的历史 `src` 入口，目前只做单跳转发。 |
| `src/index.ts` | 保留 | root 源码聚合 compat 入口。 |
| `src/adapters/index.ts` | 保留 | 最小 compat 聚合入口，保留给旧的 adapters 顶层导入。 |
| `src/bin/*` | 保留 | 历史 CLI 壳入口，目前只做单跳转发。 |

这批路径仍然存在，但它们不再是推荐入口。

## 已删除的 compat 入口

以下 compat 层已经退场：

| 路径 | 状态 | 说明 |
| --- | --- | --- |
| `root-compat/*` | 已删 | root 已退化为 workspace orchestrator。 |
| `src/core/*` | 已删 | 历史杂项 shim 已清空。 |
| `src/adapters/openclaw/*` | 已删 | 旧 `adapters/openclaw` compat 入口已移除。 |
| `packages/openclaw-adapter/src/adapters/openclaw/*` | 已删 | 包内空 compat 别名已移除。 |
| `src/runtime/*` | 已删 | 真源已收敛到 `packages/runtime-core/src/runtime/*`。 |
| `src/context-processing/*` | 已删 | 真源已收敛到 `packages/runtime-core/src/context-processing/*`。 |
| `src/governance/*` | 已删 | 真源已收敛到 `packages/runtime-core/src/governance/*`。 |
| `src/infrastructure/*` | 已删 | 真源已收敛到 `packages/runtime-core/src/infrastructure/*`。 |
| `src/runtime-core/index.ts` | 已删 | 统一改走 `@openclaw-compact-context/runtime-core`。 |

## 当前建议

对于后续开发，入口选择应遵守：

- OpenClaw 宿主适配：`@openclaw-compact-context/openclaw-adapter/openclaw`
- 插件 API / bridge / stdio：`@openclaw-compact-context/openclaw-adapter/plugin/*`
- control-plane 核心：`@openclaw-compact-context/control-plane-core`
- control-plane shell：`@openclaw-compact-context/control-plane-shell/*`
- shared runtime core：`@openclaw-compact-context/runtime-core`
- shared contracts：`@openclaw-compact-context/contracts`

换句话说：

`src/* compat 路径现在只保留迁移意义，不再作为新增依赖入口。`
