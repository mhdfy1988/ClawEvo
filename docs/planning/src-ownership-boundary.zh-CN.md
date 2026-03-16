# `src` 长期归属与边界

这份文档对应 [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md) 的 `TODO 8`，目标是把 root `src` 明确拆成两类：

1. `repo-internal 长期源码`
2. `迁移兼容 compat 转发层`

它回答的核心问题是：

- 为什么 `src` 现在不会被整体清空
- 哪些目录会长期留在 `src`
- 哪些目录只是 compat 层，后面还会继续收缩
- 什么时候值得把剩余 `src` 目录再提升成独立 package

相关文档：
- [src-compat-inventory.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-compat-inventory.zh-CN.md)
- [project-split-compatibility-note.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-compatibility-note.zh-CN.md)
- [workspace-test-ownership.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-ownership.zh-CN.md)
- [workspace-test-and-release-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-and-release-boundary.zh-CN.md)

## 1. 一句话结论

后续目标不是“清空整个 `src`”，而是：

`只保留真正有长期价值的 repo 内部源码，把 compat 转发层持续收缩。`

也就是说：

- `src/types`
- `src/contracts`
- `src/evaluation`
- `src/tests`

这批目录当前属于`长期保留的 repo-internal 源码层`。

而下面这些则属于`兼容转发层`：

- `src/index.ts`
- `src/openclaw/*`
- `src/plugin/*`
- `src/control-plane/*`
- `src/control-plane-core/*`
- `src/engine/*`
- `src/adapters/index.ts`
- `src/bin/*`

## 2. 长期保留的 repo-internal 源码

### `src/types`

角色：
- 共享纯类型真源
- 为 `packages/contracts` 和 repo 内部源码提供稳定输入

为什么留在 `src`：
- 它本质上是源码真源，不是 compat 壳
- 目前没有独立发布节奏，直接留在 repo 内部更清晰

### `src/contracts`

角色：
- repo 内部 contracts 聚合源码
- 供 `@openclaw-compact-context/contracts` 构建使用

为什么留在 `src`：
- 它是 contracts 包的源码输入层，而不是旧路径兼容
- 保持和 `src/types` 同层更利于维护 shared contracts 真源

### `src/evaluation`

角色：
- repo-level evaluation harness
- 负责跨 workspace 的评估输入、评估输出和报告格式

为什么留在 `src`：
- 它当前更像仓库内部评估工具链，而不是稳定 public package
- 与 package unit test / app integration / smoke 的边界已经通过文档和脚本收紧

### `src/tests`

角色：
- root smoke
- evaluation tests
- 跨 workspace 的整体验收和边界测试

为什么留在 `src`：
- 当前仍需要统一测试源码层来支撑 repo-level 验收
- 已经明确不是“所有测试都堆在 root”，而是只保留跨 workspace 的那部分

## 3. 仍保留的 compat 转发层

这批路径现在保留，但不再是推荐主入口：

| 路径 | 角色 | 当前作用 |
| --- | --- | --- |
| `src/index.ts` | compat | root 源码聚合入口，仅保留历史 src 顶层导入兼容。 |
| `src/openclaw/*` | compat | OpenClaw 宿主适配的历史 src 入口。 |
| `src/plugin/*` | compat | 插件 API / bridge / stdio 的历史 src 入口。 |
| `src/control-plane/*` | compat | control-plane shell 的历史 src 入口。 |
| `src/control-plane-core/*` | compat | control-plane-core 的历史 src 聚合入口。 |
| `src/engine/*` | compat | runtime-core engine 的历史 src 入口。 |
| `src/adapters/index.ts` | compat | adapters 最小聚合兼容入口。 |
| `src/bin/*` | compat | 历史 CLI compat 壳。 |

这批路径必须遵守的规则是：

1. 只允许单跳转发
2. 不允许新增真实实现
3. 不再作为 README / 设计文档中的推荐入口

## 4. 什么情况下值得继续 package 化

对于仍留在 `src` 的 repo-internal 目录，只有满足下面条件之一时，才值得再拆成独立 package：

1. 需要稳定 public API
2. 需要独立版本节奏
3. 需要独立发布 / 安装 / 复用
4. 已经形成明确的 package-level build / test / pack / explain 边界

按这个标准看：

- `src/types` / `src/contracts`
  - 当前更适合继续作为 contracts 包的源码真源
- `src/evaluation`
  - 后续只有在评估工具链需要独立发布时，才值得单独 package 化
- `src/tests`
  - 后续更可能继续保持 repo-level harness，而不是直接拆成一个可发布 package

## 5. 不允许再回流的情况

后续明确不希望再出现这些情况：

1. 已经迁出的运行时真源再次回流到 `src/runtime/*`
2. 把新的共享实现塞回 `src`，却不给出它到底是 repo-internal 还是 compat 的分类
3. 把 root `src` 重新变成“杂物间”

更具体地说：

`root src 未来只能承载两类东西：长期 repo-internal 源码，或显式标注的 compat 转发层。`

## 6. 当前推荐心智模型

可以把当前仓库理解成：

- `packages/*`
  - 可复用、可发布的共享能力
- `apps/*`
  - 可运行的壳层
- `src/*`
  - repo 内部源码真源 + 少量迁移 compat

所以现在对 `src` 的正确问题不是：

`什么时候把 src 全部挪空？`

而是：

`src 里剩下的这些，谁是长期真源，谁只是兼容层，边界有没有被锁住？`
