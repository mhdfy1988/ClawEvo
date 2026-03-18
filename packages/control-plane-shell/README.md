# Control Plane Shell Package

这个 package 承接 control-plane app 的 `server`、`client` 和 `console` 入口。

- 源码入口：`packages/control-plane-shell/src/*`
- 作用：给 `apps/control-plane` 提供稳定依赖面，避免 app 继续直接编译 root `src`
- 当前状态：已经切到 package-local `src/*`，并且只依赖 `contracts + compact-context-core`
- 装配边界：OpenClaw 专属 CLI/runtime 装配不再留在 shell，已经回到 `apps/control-plane`
