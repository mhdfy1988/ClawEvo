# Workspace 测试与发布边界

这份文档用来说明 workspace-first 拆分之后，测试应该怎么分层，以及每个 workspace 当前承担的 public API 与发布职责。

相关文档：
- [structure-convergence-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/structure-convergence-todo.zh-CN.md)
- [multi-project-split-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/multi-project-split-plan.zh-CN.md)
- [project-split-dependency-acceptance.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-dependency-acceptance.zh-CN.md)

## 测试分层

### 1. package unit tests

目标：验证共享包自己的导出面、服务行为和边界，不把 app 壳层和 root 兼容层混进来。

当前对应脚本：
- `npm run test:package:contracts`
- `npm run test:package:runtime-core`
- `npm run test:package:control-plane-core`
- `npm run test:package:openclaw-adapter`
- `npm run test:package:control-plane-shell`
- `npm run test:packages`

适合放在这一层的内容：
- shared contracts / runtime core / control-plane core 的单元与服务测试
- adapter / shell 的 package-local 行为测试
- 不依赖 root compatibility `dist` 的边界测试

### 2. app integration tests

目标：验证 app 只是薄壳，且能正确 re-export / 装配对应 package。

当前对应脚本：
- `npm run test:app:openclaw-plugin`
- `npm run test:app:control-plane`
- `npm run test:apps`

适合放在这一层的内容：
- app manifest 是否只依赖对应 shell / adapter package
- app dist 是否仍然保持薄壳结构
- app 入口是否正确 re-export 运行时入口或 client/server 入口

### 3. root e2e / smoke tests

目标：只验证跨 workspace 的整体验收，不再让 root 继续承担所有细粒度测试。

当前对应脚本：
- `npm run test:smoke:root`
- `npm run test:smoke:workspace`

适合放在这一层的内容：
- workspace pack/build smoke
- root compatibility `dist` 是否仍然收敛
- layer boundary / debug smoke

### 4. evaluation tests

目标：保持和业务评估链路独立，不与 package/app 边界测试混在一起。

当前对应脚本：
- `npm run test:evaluation`

## 发布边界

### root package

职责：
- workspace orchestrator
- repo 级 `check / build / test / smoke / CI`
- 最小 compatibility package

不再承担：
- 真实主实现发布单元
- 持续扩张的内部模块公共出口

### `@openclaw-compact-context/contracts`

职责：
- shared contracts
- shared pure types

public API 期望：
- 稳定、小而明确
- 不带 runtime / platform / adapter concrete

版本节奏：
- 只在 contract 变化时才需要提升可见版本

### `@openclaw-compact-context/runtime-core`

职责：
- 上下文处理
- 运行时知识图谱与记忆底座
- 共享 persistence / governance core

public API 期望：
- 只暴露共享运行时核心入口
- 不反向暴露 OpenClaw adapter 侧实现

版本节奏：
- 跟随 runtime / knowledge / persistence shared core 演进

### `@openclaw-compact-context/control-plane-core`

职责：
- governance / observability / import / facade 等平台核心服务

public API 期望：
- 只暴露平台核心服务与 contract
- 不反向带入 plugin runtime concrete

版本节奏：
- 跟随控制平台服务协议变化

### `@openclaw-compact-context/openclaw-adapter`

职责：
- OpenClaw 宿主适配
- plugin shell
- hooks / gateway / stdio 桥接

public API 期望：
- 只暴露宿主适配与插件壳层需要的入口
- 不带入整棵 runtime/control-plane implementation tree

版本节奏：
- 跟随宿主适配协议变化

### `@openclaw-compact-context/control-plane-shell`

职责：
- control-plane `server / client / console / CLI` 壳层

public API 期望：
- 只暴露平台壳层入口
- 平台核心行为来自 `control-plane-core`

版本节奏：
- 跟随控制面入口协议变化

### `@openclaw-compact-context/openclaw-plugin`

职责：
- 发布 OpenClaw 插件 app 薄壳

public API 期望：
- 只承担 app-local 入口与 bin
- 真正实现来自 `openclaw-adapter`

### `@openclaw-compact-context/control-plane`

职责：
- 发布 control-plane app 薄壳

public API 期望：
- 只承担 app-local 入口、client 入口与 bin
- 真正实现来自 `control-plane-shell`

## 当前结论

现在可以把 workspace 的职责理解成：

- `packages/*`：共享能力和可复用服务
- `apps/*`：可运行的发布壳层
- `root`：编排与最小兼容面

后续如果继续往多仓库推进，这份文档就是 workspace 级发布边界的基础版本。
