# Control Plane Core Package

平台核心服务入口，不包含 `server`、`console` 和 app 壳子。

- 源码入口：`packages/control-plane-core/src/index.ts`
- 目标内容：`governance`、`observability`、`import`、`extension`、`workspace`、`platform event`、`facade`
- 当前状态：已经切到 package-local `src/*`，由 `packages/control-plane-shell` 和其它上层入口消费
