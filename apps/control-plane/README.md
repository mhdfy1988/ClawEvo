# Control Plane App

这个 app workspace 现在只负责本地 app 壳层与运行入口。

- 运行入口：`src/bin/openclaw-control-plane.ts`
- 包入口：`src/index.ts`
- 客户端入口：`src/client.ts`
- 直接依赖：`@openclaw-compact-context/control-plane-shell`、`@openclaw-compact-context/compact-context-core`、`@openclaw-compact-context/openclaw-adapter`
- 目标：app 不再直接编译 root `src`，只保留本地启动壳层

当前状态：
- `apps/control-plane` 已经切到 app-local `src/*`
- control-plane 的 `server / client / console` 入口由 `packages/control-plane-shell` 承接
- OpenClaw 专属 CLI 装配已经回到 `apps/control-plane`
- 这里是当前默认 control-plane + OpenClaw runtime 装配点，不属于过渡 shim
- 后续再继续收敛 `control-plane-shell` 的物理包边界

## 发布与安装

当前平台包已经按 standalone release 方式打包：

- release 时会把内部 workspace 依赖一起带进最终 `.tgz`
- 安装时不再要求额外从 npm registry 拉取 `@openclaw-compact-context/*` 内部包

常用命令：

```powershell
npm.cmd run pack:release:control-plane
npm.cmd install -g artifacts/releases/control-plane/openclaw-compact-context-control-plane-0.1.0.tgz
```
