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

为了控制迁移风险，当前 `src/core/*` 已经改成 compatibility shim：
- 主实现已迁到新目录
- 旧 import 暂时仍可工作
- 后续会逐步把 shim 清零

参考：
- [project-split-compatibility-note.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-compatibility-note.zh-CN.md)

## 6. 验收口径

本轮拆分视为完成的条件：
- shared contract 已抽离
- plugin -> platform concrete 直接依赖已拆掉
- platform -> plugin concrete 直接依赖已拆掉
- `src/core` 主实现已经迁出
- `apps/* + packages/*` workspace 壳子已存在
- root export 与 workspace smoke test 已收紧

参考：
- [project-split-dependency-acceptance.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-dependency-acceptance.zh-CN.md)
- [project-split-migration-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-migration-report.zh-CN.md)
