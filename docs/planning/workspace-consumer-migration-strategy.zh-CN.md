# Workspace 消费者迁移策略

这份文档对应 [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md) 的 `TODO 9`，专门回答：

- 消费者现在应该用哪些正式入口
- 从 root 旧入口迁到哪里
- 从 compat `src/*` 入口迁到哪里

相关文档：

- [project-split-compatibility-note.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-compatibility-note.zh-CN.md)
- [src-ownership-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-ownership-boundary.zh-CN.md)
- [workspace-release-readiness.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-release-readiness.zh-CN.md)

## 1. 当前正式入口

当前应该优先使用：

- shared contracts：`@openclaw-compact-context/contracts`
- shared runtime core：`@openclaw-compact-context/runtime-core`
- runtime 子入口：
  - `@openclaw-compact-context/runtime-core/runtime`
  - `@openclaw-compact-context/runtime-core/context-processing`
  - `@openclaw-compact-context/runtime-core/governance`
  - `@openclaw-compact-context/runtime-core/infrastructure`
  - `@openclaw-compact-context/runtime-core/engine/context-engine`
- control-plane core：`@openclaw-compact-context/control-plane-core`
- control-plane shell：`@openclaw-compact-context/control-plane-shell/*`
- OpenClaw 适配：`@openclaw-compact-context/openclaw-adapter/openclaw`
- plugin bridge / stdio：`@openclaw-compact-context/openclaw-adapter/plugin/*`
- apps：
  - `@openclaw-compact-context/openclaw-plugin`
  - `@openclaw-compact-context/control-plane`

## 2. 从 root 旧入口迁移

### 已移除的旧入口

下面这些入口已经不再作为正式消费面存在：

- root `exports`
- root `bin`
- root `openclaw.extensions`
- `root-compat/*`

### 当前迁移方式

| 旧入口 | 新入口 |
| --- | --- |
| root 顶层导入 | 按能力改用具体 workspace 包 |
| root `openclaw-context-plugin` | `@openclaw-compact-context/openclaw-plugin` |
| root `openclaw-control-plane` | `@openclaw-compact-context/control-plane` |

## 3. 从 compat `src/*` 入口迁移

下面这些 `src/*` 路径仍在迁移窗口内保留，但已经不是推荐主入口：

| compat 路径 | 推荐迁移目标 |
| --- | --- |
| `src/openclaw/*` | `@openclaw-compact-context/openclaw-adapter/openclaw` |
| `src/plugin/*` | `@openclaw-compact-context/openclaw-adapter/plugin/*` |
| `src/control-plane/*` | `@openclaw-compact-context/control-plane-shell/*` 或 `@openclaw-compact-context/control-plane-core` |
| `src/control-plane-core/*` | `@openclaw-compact-context/control-plane-core` |
| `src/engine/*` | `@openclaw-compact-context/runtime-core/engine/context-engine` |
| `src/index.ts` | 对应的 workspace 正式入口 |

## 4. 哪些 `src` 路径不会再成为正式公共入口

即便当前还在迁移窗口中，这些路径也不应该再被写进新的 README / 集成说明 / 示例代码：

- `src/index.ts`
- `src/openclaw/*`
- `src/plugin/*`
- `src/control-plane/*`
- `src/control-plane-core/*`
- `src/engine/*`
- `src/adapters/index.ts`
- `src/bin/*`

## 5. breaking change note 的最低要求

如果后面删除某条 compat 路径，至少要说明：

1. 被删的旧入口是什么
2. 对应的新入口是什么
3. 是否有行为变化
4. app / package / shell 的职责有没有变化

## 6. 一句话结论

`从现在开始，消费者应当直接面向 apps/* 和 packages/* 的正式入口；剩余 src/* 只用于迁移窗口兼容，不再作为推荐 API。`
