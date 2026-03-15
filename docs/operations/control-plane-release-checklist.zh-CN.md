# Control Plane Release Checklist

## 发布前
- 运行 `npm run check`
- 运行 `npm test`
- 运行 `npm run test:evaluation`
- 确认 `control-plane-server.test.ts` 通过
- 确认 `control-plane-services.test.ts` 通过

## 发布核对
- 确认 governance batch / preview / conflict API 可访问
- 确认 observability thresholds / subscriptions / compare API 可访问
- 确认 import catalog / jobs / dead letters / batch API 可访问
- 确认 workbench 4 个聚合视图可访问
- 确认 runtime snapshot 仍然能读到 `live_runtime / persisted_snapshot / transcript_fallback`

## 发布后
- 创建一条 dashboard snapshot
- 确认 alert subscription 正常生成 notification
- 创建并运行一个 import job
- 提交并 review 一条 governance proposal
- 观察控制台首页和 API `/api/health`
