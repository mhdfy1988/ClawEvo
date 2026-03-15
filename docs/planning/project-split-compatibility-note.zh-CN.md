# 项目拆分兼容说明

## 当前兼容策略

为了把拆分风险压低，这轮拆分采用了“先迁实现，再收兼容层”的方式：

1. 主实现先迁出到 app / package workspace
2. 仓库内部源码先停止依赖旧路径
3. 再逐步把 root 和 `src/*` 的旧入口收缩成最小兼容层

这意味着：
- 仓库内部源码已经不再直接依赖 `src/core/*`
- `src/core/*` 代码 shim 已经删除
- 当前保留的兼容，主要是为了支撑历史入口和迁移窗口，而不是继续承载真实实现

## 推荐新入口

- 上下文处理：`src/context-processing/*`
- 运行时主链：`src/runtime/*`
- 治理域：`src/governance/*`
- 基础设施：`src/infrastructure/*`
- shared contracts：`src/contracts/index.ts`
- shared runtime core：`src/runtime-core/index.ts`
- control-plane core：`src/control-plane-core/index.ts`
- OpenClaw 宿主适配：`src/openclaw/*`

## 当前兼容层的落点

当前仍保留的代码兼容层主要有两类：

1. root package 的最小兼容壳
- 只保留 `exports / bin` 和聚合入口
- 真实实现来自 workspace 包
- root `dist` 不再承载整仓实现产物

2. 历史路径 shim
- `src/openclaw/*`
- `src/plugin/*`
- `src/control-plane/*`
- `src/adapters/openclaw/*`

这些 shim 的作用是：
- 让历史导入路径在迁移窗口内继续可用
- 把调用转发到新的 workspace 包

它们不再是主实现位置。

## 兼容风险

- 如果外部调用方仍直接依赖已经删除的 `src/core/*`，现在会直接 break，需要按迁移文档改路径。
- 当前 app/package manifests 已经具备本地打包语义，但仍处在 workspace-first 的收口阶段，不建议把 root 继续当成主发布单元。
- root 现在只适合作为 orchestrator + compatibility package；新的内部模块不应继续直接挂到 root。
