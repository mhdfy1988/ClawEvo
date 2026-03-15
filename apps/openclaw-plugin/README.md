# OpenClaw Plugin App

这个 app workspace 现在只负责本地 app 壳层与发布入口。

- 运行入口：`src/bin/openclaw-context-plugin.ts`
- 包入口：`src/index.ts`
- 直接依赖：`@openclaw-compact-context/openclaw-adapter`
- 目标：app 不再直接编译 root `src`，只保留本地启动壳层

当前状态：
- `apps/openclaw-plugin` 已经切到 app-local `src/*`
- OpenClaw 插件实现仍由 `packages/openclaw-adapter` 承接
- 后续再继续收敛 `openclaw-adapter` 的物理包边界
