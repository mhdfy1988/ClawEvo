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
