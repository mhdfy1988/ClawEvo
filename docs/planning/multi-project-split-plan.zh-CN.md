# 多项目拆分方案

这份文档收敛“如何把当前仓库从单项目逐步拆成 插件 / 共享底座 / 平台 的多项目结构”。

## 1. 目标

目标不是立刻拆成多个 Git 仓库，而是先在同一仓库内把边界收紧成：

- 插件壳子
- 共享底座
- 平台壳子

推荐先走 `monorepo-first`：

```text
apps/
  openclaw-plugin/
  control-plane/

packages/
  contracts/
  runtime-core/
  control-plane-core/
```

## 2. 现在的落地形态

### 2.1 插件

- OpenClaw adapter / hooks / assemble 仍在插件侧
- 默认平台能力通过 bridge 注入，而不是 adapter 里直接实例化

关键入口：
- [src/openclaw/index.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/index.ts)
- [src/plugin/control-plane-bridge.ts](/d:/C_Project/openclaw_compact_context/src/plugin/control-plane-bridge.ts)

### 2.2 共享底座

共享底座只保留一份，不会插件一份、平台一份。

当前已经分成：
- [src/contracts/index.ts](/d:/C_Project/openclaw_compact_context/src/contracts/index.ts)
- [src/runtime-core/index.ts](/d:/C_Project/openclaw_compact_context/src/runtime-core/index.ts)

底下继续细分为：
- `src/context-processing`
- `src/runtime`
- `src/governance`
- `src/infrastructure`
- `src/types`

### 2.3 平台

control-plane server 已经改成依赖 shared runtime read-model contract，而不是直接依赖 adapter concrete。

关键入口：
- [src/control-plane/server.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/server.ts)
- [src/openclaw/control-plane-runtime-bridge.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/control-plane-runtime-bridge.ts)
- [src/control-plane-core/index.ts](/d:/C_Project/openclaw_compact_context/src/control-plane-core/index.ts)

### 2.4 workspace 单元

`apps/*` 和 `packages/*` 现在已经不是纯 manifest 壳子，而是具备本地 build/check 入口的 workspace 单元：
- 每个单元都有自己的 `tsconfig.json`
- 每个单元都有自己的 `build / check` 脚本
- 每个单元的 `exports / bin / types` 都指向自己的 `./dist/*`
- workspace 构建前会先清理各自本地 `dist`

这一步的意义是：
- 先在单仓库内形成“独立构建语义”
- 再决定是否继续演进到独立发布单元或多仓库

## 3. 当前物理结构

```text
apps/
  openclaw-plugin/
  control-plane/

packages/
  contracts/
  runtime-core/
  control-plane-core/

src/
  contracts/
  runtime-core/
  control-plane-core/
  context-processing/
  runtime/
  governance/
  infrastructure/
  adapters/
  control-plane/
  openclaw/
  plugin/
  types/
```

## 4. 依赖方向

正确依赖方向是：

```text
contracts
  <- runtime-core
  <- control-plane-core
  <- openclaw adapter

runtime-core + openclaw adapter
  <- plugin app

runtime-core + control-plane-core
  <- control-plane app
```

关键约束：
- 平台不再直接 import 插件 adapter concrete
- 插件不再直接 import 平台 service concrete
- 共享底座只保留一份

## 5. 兼容策略

为了控制迁移风险，拆分经历过一个 `src/core/*` compatibility shim 过渡阶段：
- 主实现先迁到新目录
- 仓库内部源码先停止依赖 shim
- 之后再正式删除 shim 文件

当前状态是：
- `src/core/*` compatibility shim 已删除
- 仓库内部源码与测试已全部改走新层目录
- 兼容策略已经从“保留 shim”切到“仅保留文档映射与迁移说明”

与此同时：
- `apps/*` / `packages/*` 已经能各自本地构建
- `apps/*` / `packages/*` 已经具备本地 `version / files / prepack / dist` 语义，可执行 dry-run 打包
- `packages/contracts` 已经把共享 contract 面收窄到 `contracts + types`
- root workspace 仍然负责编排统一检查、统一测试和统一发布节奏

参考：
- [project-split-compatibility-note.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-compatibility-note.zh-CN.md)

## 6. 验收口径

本轮拆分视为完成的条件：
- shared contract 已抽离
- plugin -> platform concrete 直接依赖已拆掉
- platform -> plugin concrete 直接依赖已拆掉
- `src/core` 主实现已经迁出
- `apps/* + packages/*` workspace 壳子已存在
- `apps/* + packages/*` 已具备本地 build/check 语义
- `apps/* + packages/*` 已具备本地 pack(dry-run) 语义
- `packages/contracts` 的构建与 dry-run 打包结果不再包含 `runtime / evaluation / infrastructure` 等实现目录
- root export 与 workspace smoke test 已收紧

参考：
- [project-split-dependency-acceptance.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-dependency-acceptance.zh-CN.md)
- [project-split-migration-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-migration-report.zh-CN.md)
