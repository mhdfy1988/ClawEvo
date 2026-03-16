# OpenClaw Adapter Package

这个 package 承接 OpenClaw 插件壳层与适配入口。

- 目标内容：`src/openclaw`、`src/plugin`、`src/bin/openclaw-context-plugin`
- 作用：给 `apps/openclaw-plugin` 提供稳定依赖面，避免 app 继续直接编译 root `src`
- 当前状态：已经切到 package-local `src/*`，并显式依赖 `contracts / runtime-core`
- 装配边界：默认 facade 装配不再留在 adapter，已经回到 `apps/openclaw-plugin`
- 推荐入口：
  - OpenClaw 宿主适配：`@openclaw-compact-context/openclaw-adapter/openclaw`
  - 插件桥接与 stdio：`@openclaw-compact-context/openclaw-adapter/plugin/*`
