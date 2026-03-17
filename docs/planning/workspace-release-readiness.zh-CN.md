# Workspace 发布就绪与多仓准备

这份文档对应 [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md) 的 `TODO 9`，目标是把“当前 workspace 是否已经具备独立发布单元 / 多仓准备条件”收成一份固定口径。

相关文档：

- [workspace-release-audit-matrix.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-release-audit-matrix.zh-CN.md)
- [project-split-compatibility-note.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-compatibility-note.zh-CN.md)
- [workspace-test-and-release-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-and-release-boundary.zh-CN.md)

## 1. 当前总判断

当前仓库已经具备：

- `workspace-first` 的稳定 build / check / pack / smoke 链
- app / package / root smoke 的职责边界
- 共享核心与壳层的清晰拆分

但还没有到“现在就应该拆多仓”的阶段。

更准确的判断是：

`当前已经完成“独立发布准备”，但仍处于 monorepo-first 阶段。`

## 2. 每个 workspace 的发布与多仓判断

| Workspace | 当前角色 | 是否适合独立发布 | 是否建议现在独立仓库化 | 判断 |
| --- | --- | --- | --- | --- |
| `contracts` | shared foundation | 未来可独立 | 暂不建议 | API 面已经小，未来若出现外部消费节奏，可优先独立；当前先继续锁步。 |
| `runtime-core` | shared foundation | 未来可独立 | 暂不建议 | 是最接近独立核心库的单元，但当前仍与 adapter / apps 强协同。 |
| `control-plane-core` | platform foundation | monorepo 内发布 | 不建议 | 主要服务平台内部壳层，外部消费面还不够稳定。 |
| `openclaw-adapter` | host adapter | 未来可独立 | 暂不建议 | 边界清楚，未来可能作为宿主适配库独立；当前仍依赖 runtime-core 同步演进。 |
| `control-plane-shell` | platform shell | monorepo 内发布 | 不建议 | 更像平台内部壳层，而不是长期独立对外库。 |
| `openclaw-plugin` | runtime app shell | 可独立交付 | 不建议单独仓库 | 它是可运行 app，不是共享库；适合部署/安装，不适合先拆仓。 |
| `control-plane` | platform app shell | 可独立交付 | 不建议单独仓库 | 同上，更适合作为部署壳而非多仓核心。 |

## 3. 当前版本联动策略

当前建议继续使用：

`lockstep release train`

也就是：

- 所有 `@openclaw-compact-context/*` workspace 当前保持同一版本列车
- 发布、smoke、pack 审计仍按 monorepo 统一执行

### 3.1 应该锁步版本的单元

当前建议全部锁步：

- `@openclaw-compact-context/contracts`
- `@openclaw-compact-context/runtime-core`
- `@openclaw-compact-context/control-plane-core`
- `@openclaw-compact-context/openclaw-adapter`
- `@openclaw-compact-context/control-plane-shell`
- `@openclaw-compact-context/openclaw-plugin`
- `@openclaw-compact-context/control-plane`

### 3.2 未来最有机会独立演进的候选

如果后面需要拆出独立版本节奏，优先候选是：

- `contracts`
- `runtime-core`
- `openclaw-adapter`

原因是：

- 它们最接近清晰的公共包边界
- 已经有相对稳定的 exports / pack 表面
- 将来更可能被外部消费者直接依赖

### 3.3 什么时候必须补 breaking change migration note

以下情况必须补迁移说明：

- 公共 package 的 `exports / main / types / bin / openclaw.extensions` 发生 breaking change
- 推荐入口从一个 workspace 包迁移到另一个 workspace 包
- `compat src/*` 入口被删除或停止支持
- 某个 workspace 从 `monorepo-first` 转成“独立发布候选”

## 4. Release automation 评估

当前不急着上完整 release automation / changelog / tag 策略。

原因是：

- 目前版本仍锁步
- compat 收尾刚到“可控”状态
- 先把发布边界和消费者迁移路径写死，收益更高

当前更稳的模式是：

- 继续使用 `build/check/pack/smoke` 的显式编排
- 用 `pack:workspace` 做 manifest + 产物审计
- 用 `required smoke / release smoke` 做整体验收

### 4.1 什么时候再引入自动化

后续如果出现下面任一条件，就值得开始评估：

- 至少一个 shared package 开始按独立节奏发布
- 需要自动生成 changelog / migration note
- 需要 apps 与 packages 分别打 tag 或维护多条发布列车

那时优先考虑：

- `changesets`
- 或等价的 monorepo release 工具

## 5. 多仓前验收基线

在真正考虑多仓前，先达到这条基线：

1. 每个 workspace 都能独立 `build / check / explain`
2. 所有 publishable workspace 都能通过 `pack:workspace` dry-run 审计
3. `package / app / root smoke` 三层测试责任固定，不再依赖 root compat 假设
4. 消费者迁移路径和 breaking change 规则都已经文档化
5. 哪些继续锁步、哪些以后可能独立演进，已经写成固定口径

## 6. 一句话结论

`我们现在已经具备独立发布准备，但还不建议马上拆多仓；下一阶段更适合继续保持 monorepo-first，并让 contracts / runtime-core / openclaw-adapter 成为未来独立发布候选。`

## 7. 真实打包目录约定

真实生产打包现在只保留两个正式交付物：

- `openclaw-plugin`
- `control-plane`

当前命令约定：
- `npm run pack:release`
  - 顺序生成两个最终交付包
  - 产物分别落到 `artifacts/releases/openclaw-plugin/` 和 `artifacts/releases/control-plane/`
- `npm run pack:release:plugin`
  - 只生成 `artifacts/releases/openclaw-plugin/*.tgz`
- `npm run pack:release:control-plane`
  - 只生成 `artifacts/releases/control-plane/*.tgz`

固定目录映射如下：
- `@openclaw-compact-context/openclaw-plugin` -> `artifacts/releases/openclaw-plugin/`
- `@openclaw-compact-context/control-plane` -> `artifacts/releases/control-plane/`

这两个 app release 包当前按 standalone 方式生成：

- release 打包时会把内部 workspace 依赖一起带进最终 `.tgz`
- 最终安装时不再要求额外从 npm registry 拉取 `@openclaw-compact-context/*` 内部包
- release 专用 manifest 也会把工作区内的 `src/*` 类型/入口路径改写成正式可发布的 `dist/*` 路径

共享 packages 继续通过 `npm run pack:workspace` 做 dry-run 审计，但不再作为真实生产交付包单独生成 `.tgz` 发布目录。

## 8. 当前真实安装验证与已确认结论

这部分专门记录当前这轮已经实际验证过、不能只停留在聊天里的 release 结论。

### 8.1 当前 app release 包已经是 standalone 包

当前两个正式交付包：

- `openclaw-plugin`
- `control-plane`

都不再只是“app 壳 + 外部 workspace 依赖声明”，而是：

- release 打包时会把内部 `@openclaw-compact-context/*` workspace 依赖一起带进最终 `.tgz`
- 最终安装时不再要求额外从 npm registry 拉这些内部包

当前实现方式是：

- release 打包时先生成 standalone staging 目录
- 为 app 生成 release 专用 manifest
- 把内部 workspace 依赖一并放入最终包内的 `node_modules`

### 8.2 release 专用 manifest 会把工作区路径改写成正式发布路径

当前已经确认，app release 包在正式交付时不会再保留工作区内部专用路径，例如：

- `openclaw.extensions: ./src/index.ts`
- `exports.types: ./src/...`

而是会自动改写为正式发布可用的：

- `./dist/index.js`
- `./dist/*.d.ts`

这一步是必须的，否则“包虽然能打出来，但安装后仍然不是正式可运行入口”。

### 8.3 standalone 安装已被真实验证

这轮已经实际做过两类验证：

1. 插件包安装后直接调用 CLI
2. 平台包安装后直接加载主入口模块

插件验证结论：

- `openclaw-context-cli` 已经可以从 release 安装结果里直接运行
- 不是只在仓库源码目录或 `dist` 目录里可用
- `summarize` 和 `roundtrip` 两类子命令都已经做过真实安装验证
- `explain` 子命令也已经做过真实安装验证

平台验证结论：

- `control-plane` release 包安装后，主入口模块可正常加载

### 8.4 单包 release 会清理非目标 app 目录

当前 release 脚本还有一个重要行为约定：

- `npm run pack:release:plugin`
  - 会只保留插件包目录
- `npm run pack:release:control-plane`
  - 会只保留平台包目录

也就是说，单包 release 命令默认会清理其他 app 的 release 目录。

因此：

- 如果你要同时得到两个最终交付包，应该先跑：
  - `npm run pack:release`
- 如果你只想重打一种交付物，再跑对应单包命令

这不是 bug，而是当前脚本的明确行为。

### 8.5 当前最推荐的安装验证方式

对这两个正式包，当前最稳的本机验证方式是：

- 先跑：
  - `npm.cmd run pack:release`
- 再用本地 prefix 安装：
  - `npm.cmd install -g --prefix <temp-dir> <tgz>`

这样可以直接验证：

- 包是否自包含
- bin 是否真的可执行
- 入口模块是否真的能加载
