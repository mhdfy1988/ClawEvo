# 项目拆分依赖方向验收

## 目标依赖方向

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

## 本轮验收项
- [x] `control-plane/contracts` 不再反向依赖 `openclaw/types`
- [x] `context-engine-adapter` 不再直接实例化平台 service concrete
- [x] `control-plane/server` 不再直接依赖 adapter helper / config concrete
- [x] root public entry 改为稳定 shared entrypoint
- [x] `layer-boundaries.test.ts` 增加 workspace entrypoint 边界检查
- [x] `workspace-smoke.test.ts` 检查 app/package manifests 与 dist entrypoint
- [x] 仓库内部源码不再直接 import `src/core/*` 兼容 shim

## 当前未做成独立单元的地方

- `apps/*` 和 `packages/*` 已是可本地构建和 dry-run 打包的 workspace 单元，但还不是完全独立发布单元
- 还没有拆到多 Git 仓库

## 结论

当前可以认为：
`插件 / 共享底座 / 平台` 的依赖方向已经立住，代码物理结构也已经进入 workspace-first 阶段。

现在的重点已经从“讨论边界”转成：
- 何时把 workspace 单元收成独立构建 / 发布单元
- 是否继续演进到多仓库
