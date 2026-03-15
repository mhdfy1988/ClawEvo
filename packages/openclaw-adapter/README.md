# OpenClaw Adapter Package

这个 package 承接 OpenClaw 插件壳层与适配入口。

- 目标内容：`src/openclaw`、`src/plugin`、`src/adapters/openclaw`、`src/bin/openclaw-context-plugin`
- 作用：给 `apps/openclaw-plugin` 提供稳定依赖面，避免 app 继续直接编译 root `src`
- 当前状态：已经切到 package-local `src/*`，并显式依赖 `contracts / runtime-core / control-plane-core`
