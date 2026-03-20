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
npm.cmd run start:control-plane
npm.cmd run start:control-plane:bg
npm.cmd run stop:control-plane:bg
npm.cmd run pack:release:control-plane
npm.cmd install -g artifacts/releases/control-plane/openclaw-compact-context-control-plane-0.1.0.tgz
```

补充说明：

- `npm.cmd run start:control-plane`
  - 前台启动，适合本地开发时直接看日志。
- `npm.cmd run start:control-plane:bg`
  - 后台启动，日志写到 `.tmp/control-plane/stdout.log` 与 `.tmp/control-plane/stderr.log`。
  - 默认直接使用当前已有的 `dist`，不额外触发整仓 build。
  - 当前脚本按 `node apps/control-plane/dist/bin/openclaw-control-plane.js` 的直启口径运行，并且只有在 `/api/health` 通过后才算启动成功。
- `npm.cmd run stop:control-plane:bg`
  - 停止后台 control-plane，并等待进程真正退出。

本地排障补充：

- 不要把 `stop:control-plane:bg` 和 `start:control-plane:bg` 并行执行。
- 如果后台脚本提示已启动，仍然可以再补一次 `http://127.0.0.1:3210/api/health` 或端口探测，确认服务确实还活着。
