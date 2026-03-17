# Control Plane Server 第一轮

## 目标
把阶段 6 已有的 `governance / observability / import / runtime snapshot` 服务能力，收成一个独立 control-plane HTTP 进程，并提供最小 Web console。

## 代码入口
- HTTP server：
  - [server.ts](/d:/C_Project/openclaw_compact_context/packages/control-plane-shell/src/server.ts)
- 最小 console：
  - [console.ts](/d:/C_Project/openclaw_compact_context/packages/control-plane-shell/src/console.ts)
- bin：
  - [openclaw-control-plane.ts](/d:/C_Project/openclaw_compact_context/apps/control-plane/src/bin/openclaw-control-plane.ts)

## 当前 API 范围
- `GET /api/health`
- `GET /api/runtime/snapshots`
- `POST /api/runtime/explain`
- `GET /api/governance/proposals`
- `GET /api/governance/audit`
- `POST /api/governance/proposals`
- `POST /api/governance/proposals/:id/review`
- `POST /api/governance/proposals/:id/apply`
- `POST /api/governance/proposals/:id/rollback`
- `GET /api/observability/dashboard`
- `POST /api/observability/snapshots`
- `GET /api/observability/history`
- `GET /api/import/catalog`
- `GET /api/import/jobs`
- `GET /api/import/jobs/:id`
- `GET /api/import/jobs/:id/history`
- `POST /api/import/jobs`
- `POST /api/import/jobs/:id/run`
- `POST /api/import/jobs/:id/retry`
- `POST /api/import/jobs/:id/rerun`
- `POST /api/import/jobs/:id/schedule`
- `POST /api/import/jobs/batch/run`
- `POST /api/import/jobs/batch/stop`
- `POST /api/import/jobs/batch/resume`
- `GET /api/import/dead-letters`

## 控制台范围
第一轮 console 是零依赖单页：
- health 面板
- observability dashboard / history
- import catalog / jobs / dead letters
- governance proposals / audit
- runtime snapshot 查看

## 约束
- control-plane 不直接写底层 store
- 治理和导入仍通过 runtime engine 能力回流
- runtime snapshot 仍然是 runtime plane 与 control-plane 之间的主要只读桥梁

## 当前定位
这是“可运行的最小平台层”，不是最终形态的独立 Web 产品。
