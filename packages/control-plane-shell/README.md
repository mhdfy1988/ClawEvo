# Control Plane Shell Package

这个 package 承接 control-plane app 的 `server`、`client`、`console` 和 `CLI` 入口。

- 源码入口：`packages/control-plane-shell/src/*`
- 作用：给 `apps/control-plane` 提供稳定依赖面，避免 app 继续直接编译 root `src`
- 当前状态：已经切到 package-local `src/*`，下一步重点是继续收窄对 `openclaw-adapter` 的宽依赖
