# `src` 长期归属与边界

这份文档对应 [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md) 的 `TODO 8`，目标是把 root `src` 明确拆成两类：

1. `repo-internal` 长期源码
2. 迁移兼容 compat 转发层

相关文档：
- [src-compat-inventory.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-compat-inventory.zh-CN.md)
- [project-split-compatibility-note.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-compatibility-note.zh-CN.md)
- [workspace-test-ownership.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-ownership.zh-CN.md)
- [workspace-test-and-release-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-and-release-boundary.zh-CN.md)

## 一句话结论

后续目标不是“清空整个 `src`”，而是：

`只保留真正有长期价值的 repo 内部源码，并持续收缩 compat 转发层。`

## 长期保留的 repo-internal 源码

### `src/types`

角色：
- 共享纯类型真源
- 为 `packages/contracts` 和 repo 内部源码提供稳定输入

目标状态：
- `retain-as-repo-internal`

### `src/contracts`

角色：
- repo 内部 contracts 聚合源码
- 作为 `@openclaw-compact-context/contracts` 的源输入层

目标状态：
- `retain-as-repo-internal`

### `src/evaluation`

角色：
- repo-level evaluation harness
- 负责跨 workspace 的评估输入、评估输出和报告格式

目标状态：
- `retain-as-repo-internal`

### `src/tests`

角色：
- root smoke
- evaluation tests
- 跨 workspace 的整体验收和边界测试

目标状态：
- `retain-as-repo-internal`

## 当前仍保留的 compat 转发层

| 路径 | 角色 | 当前作用 | 目标状态 | repo 内部使用 | 删除前条件 |
| --- | --- | --- | --- | --- | --- |
| `src/index.ts` | compat | root 级历史聚合入口，只保留顶层 `src` 导入兼容。 | `retire-after-root-src-aggregate-window` | 极少量 | root 聚合入口完成退役 |
| `src/openclaw/*` | compat | OpenClaw 宿主适配的历史 `src` 入口。 | `retire-after-host-migration-window` | 无 | 1. repo 内部持续零引用 2. 宿主侧旧导入窗口关闭 |
| `src/plugin/*` | compat | 插件 API / bridge / stdio 的历史 `src` 入口。 | `retire-after-plugin-migration-window` | 无 | 1. repo 内部持续零引用 2. 旧 plugin / stdio 导入可接受 breaking removal |
| `src/control-plane/*` | compat | control-plane 的历史 `src` 聚合入口。 | `retire-after-platform-migration-window` | 极少量 | repo 内部和文档不再需要 compat 跳转 |
| `src/control-plane-core/*` | compat | control-plane-core 的历史 `src` 聚合入口。 | `retire-after-platform-migration-window` | 极少量 | 正式包入口完全替代旧导入 |

这些路径必须遵守：

1. 只允许单跳转发。
2. 不允许新增真实实现。
3. 不再作为 README / 设计文档中的推荐入口。

## 什么情况下值得继续 package 化

对于仍留在 `src` 的 repo-internal 目录，只有满足下面条件之一时，才值得继续拆成独立 package：

1. 需要稳定 public API
2. 需要独立版本节奏
3. 需要独立发布 / 安装 / 复用
4. 已经形成明确的 package-level `build / test / pack` 边界

## 不允许再回流的情况

后续明确不希望再出现：

1. 已经迁出的运行时真源回流到 root `src`
2. 新的共享实现继续堆到 `src`，却不说明它到底是 repo-internal 还是 compat
3. root `src` 重新变回“杂物间”

更具体地说：

`root src` 未来只应承载两类东西：长期 repo-internal 源码，或显式标注的 compat 转发层。`
