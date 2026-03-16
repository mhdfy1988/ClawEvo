# 项目拆分兼容说明

## 当前兼容策略

为了把拆分风险压低，这轮拆分采用了“先迁实现，再收兼容层”的方式：

1. 主实现先迁出到 `apps/*` 和 `packages/*`
2. 仓库内部源码先停止依赖旧路径
3. 再逐步把 root 和 `src/*` 的旧入口收缩成最小兼容层

这意味着：
- 仓库内部源码已经不再直接依赖 `src/core/*`
- `src/core/*` 代码 shim 已经删除
- root `src/*` compat 已经删除，后续不再把兼容层放回 root `src`

## 推荐新入口

- shared contracts：`@openclaw-compact-context/contracts`
- shared runtime core：`@openclaw-compact-context/runtime-core`
- 运行时子入口：
  - `@openclaw-compact-context/runtime-core/runtime`
  - `@openclaw-compact-context/runtime-core/context-processing`
  - `@openclaw-compact-context/runtime-core/governance`
  - `@openclaw-compact-context/runtime-core/infrastructure`
- control-plane core：`@openclaw-compact-context/control-plane-core`
- control-plane shell：`@openclaw-compact-context/control-plane-shell/*`
- OpenClaw 宿主适配：`@openclaw-compact-context/openclaw-adapter/openclaw`
- 插件 API / bridge / stdio：`@openclaw-compact-context/openclaw-adapter/plugin/*`
- 默认插件装配点：`apps/openclaw-plugin/src/index.ts`
- 默认 control-plane CLI 装配点：`apps/control-plane/src/bin/openclaw-control-plane.ts`

补充约束：
- `control-plane-core` 现在只推荐使用聚合根入口，不再推荐逐文件子路径导入
- OpenClaw 插件默认 facade 装配位于 `apps/openclaw-plugin`
- OpenClaw 专属 control-plane CLI/runtime 装配位于 `apps/control-plane`
- `src/*` 兼容层已完成退役，不再作为历史路径兼容窗口存在

## 当前兼容层的落点

root `src/*` compat 已全部删除。当前只保留：
- package/app 正式入口
- 迁移说明中的历史路径记录

## 当前仍保留的过渡性装配

当前仍然存在，但已经被明确限制为“迁移兼容或 app 装配”的部分有：

1. app 层默认装配
- `apps/openclaw-plugin/src/index.ts`
  - 负责默认 `ControlPlaneFacade` 装配
  - 这是当前正式默认装配点，不是 shim
- `apps/control-plane/src/bin/openclaw-control-plane.ts`
  - 负责 OpenClaw runtime read-model + control-plane server 的 CLI 装配
  - 这是当前正式默认装配点，不是 shim

已经删除的 compat 入口：
- `src/index.ts`
- `src/openclaw/*`
- `src/plugin/*`
- `src/control-plane/*`
- `src/control-plane-core/*`
- `src/runtime/*`
- `src/context-processing/*`
- `src/governance/*`
- `src/infrastructure/*`
- `src/runtime-core/index.ts`

## 兼容风险

- 如果外部调用方仍直接依赖已经删除的 `src/core/*`，现在会直接 break，需要按迁移文档改路径。
- 当前 app/package manifests 已经具备本地打包语义，root 不再承担兼容发布职责。
- root 现在只适合作为 workspace orchestrator；新的内部模块不应继续直接挂到 root。

## 推荐依赖入口表

### 插件侧

| 目标 | 推荐入口 |
| --- | --- |
| OpenClaw 宿主适配 | `@openclaw-compact-context/openclaw-adapter/openclaw` |
| 插件 API / stdio / bridge | `@openclaw-compact-context/openclaw-adapter/plugin/*` |
| 共享 contracts | `@openclaw-compact-context/contracts` |
| 共享运行时底座 | `@openclaw-compact-context/runtime-core` |
| 默认插件装配点 | `apps/openclaw-plugin/src/index.ts` |

### 平台侧

| 目标 | 推荐入口 |
| --- | --- |
| control-plane 核心能力 | `@openclaw-compact-context/control-plane-core` |
| server / client / console 壳层 | `@openclaw-compact-context/control-plane-shell/*` |
| 共享 contracts | `@openclaw-compact-context/contracts` |
| OpenClaw runtime read-model 适配 | `@openclaw-compact-context/openclaw-adapter/openclaw/*` |
| 默认 control-plane CLI 装配点 | `apps/control-plane/src/bin/openclaw-control-plane.ts` |
