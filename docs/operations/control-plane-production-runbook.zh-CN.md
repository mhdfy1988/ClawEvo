# Control Plane Production Runbook

这份 runbook 用于阶段 8 之后的 control-plane 日常运维、发布核对和异常处置。

相关文档：
- [control-plane-release-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/control-plane-release-checklist.zh-CN.md)
- [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/gateway-debug-usage.zh-CN.md)
- [dashboard-observability-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/dashboard-observability-contracts.zh-CN.md)
- [control-plane-service-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-service-contracts.zh-CN.md)

## 适用范围
- governance proposal / review / apply / rollback
- observability dashboard / history / thresholds / subscriptions
- import job create / run / retry / rerun / schedule
- runtime snapshot 与 workbench 联动排查

## 日常巡检
1. 确认 control-plane 进程可启动：
   - `npm run build`
   - `npm run start:control-plane`
2. 确认基础健康：
   - `GET /health`
   - `GET /api/catalog`
3. 确认关键只读接口：
   - `GET /api/observability/dashboard`
   - `GET /api/runtime/snapshots`
   - `GET /api/governance/proposals`
   - `GET /api/import/jobs`
4. 确认最近一次 dashboard snapshot 可读，且 `metricCards`、`alerts`、`snapshotHistory` 不为空。
5. 确认最近 import job 没有持续堆积在 `running` 或 `failed`。

## 发布前检查
1. 运行：
   - `npm run check`
   - `npm test`
   - `npm run test:evaluation`
2. 用 [control-plane-release-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/control-plane-release-checklist.zh-CN.md) 逐项核对：
   - governance
   - observability
   - import
   - runtime snapshot
   - workbench
3. 确认本次变更涉及的 contract 文档已经同步：
   - `docs/control-plane/`
   - `docs/operations/`
   - `docs/stages/`
4. 确认 README 和索引入口没有断链。

## 常见异常处理

### 1. Governance proposal 无法应用
- 先看 proposal 当前状态是否已被 `reviewed` 或已 `rolled_back`
- 再看 conflict 检测输出
- 最后看 audit 记录是否存在同 target 的 blocking conflict

优先排查入口：
- `GET /api/governance/proposals`
- `POST /api/governance/conflicts`
- `GET /api/governance/audit`

### 2. Dashboard 指标异常或无历史
- 检查 runtime snapshot 是否持续写入
- 检查 observability service 是否记录了 dashboard history
- 检查 thresholds 是否误配置得过严

优先排查入口：
- `GET /api/runtime/snapshots`
- `GET /api/observability/history/page`
- `GET /api/observability/thresholds`
- `GET /api/observability/notifications`

### 3. Import job 持续失败
- 看 stage trace 停在哪个阶段：
  - `parse`
  - `normalize`
  - `materialize`
- 看 source-specific normalize / dedupe / version 是否和输入类型匹配
- 对失败 job 先 `retry`，确认是否为瞬时问题；必要时 `rerun`

优先排查入口：
- `GET /api/import/jobs`
- `GET /api/import/jobs/:jobId`
- `POST /api/import/jobs/:jobId/retry`
- `POST /api/import/jobs/:jobId/rerun`

### 4. Runtime snapshot 与治理结果不一致
- 先确认是否读取到了最新 snapshot
- 再确认相关 proposal 是否已经 apply 或 rollback
- 最后查看 runtime-governance trace 联合视图

优先排查入口：
- `GET /api/runtime/snapshots`
- `GET /api/workbench/runtime-governance-trace`
- `GET /api/governance/audit`

## 回滚原则
- 不直接绕过 runtime engine 写底层 store
- rollback 必须带原因，并保留 audit 记录
- 批量 rollback 先看 conflict，再执行
- 发布级回滚优先恢复 control-plane contract 和 gateway 可用性，再处理业务数据

## 一句话结论
`这份 runbook 的目标不是代替测试，而是让 control-plane 在真实运行中出现问题时，有一套固定、可重复、可审计的排查和回滚路径。`
