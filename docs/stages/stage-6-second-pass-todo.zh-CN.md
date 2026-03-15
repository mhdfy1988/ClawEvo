# 阶段 6 第二轮 TODO

这份清单用于跟踪阶段 6 第二轮深化工作。

当前判断：
`阶段 6 第一轮与第二轮都已完成，下一步更适合进入阶段 7 规划。`

相关文档：
- 第一轮 TODO：[stage-6-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-todo.zh-CN.md)
- 第一轮状态页：[stage-6-first-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-first-pass-status.zh-CN.md)
- 第一轮总结页：[stage-6-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-first-pass-report.zh-CN.md)
- 第二轮状态页：[stage-6-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-status.zh-CN.md)
- 第二轮总结页：[stage-6-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-report.zh-CN.md)
- 能力边界：[stage-6-capability-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-capability-boundary.zh-CN.md)
- 平台化方案：[stage-6-platformization-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-platformization-plan.zh-CN.md)
- Runtime 上下文策略：[openclaw-runtime-context-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/openclaw-runtime-context-strategy.zh-CN.md)
- Control Plane contracts：[control-plane-service-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-service-contracts.zh-CN.md)
- Dashboard observability contracts：[dashboard-observability-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/dashboard-observability-contracts.zh-CN.md)

## 已完成
- [x] TODO 1: 补导入平台第二轮治理能力
  - [x] 增加 `import history`
  - [x] 增加 `retry / rerun`
  - [x] 增加最小 `scheduler` 和批处理入口
  - [x] 固定 import job 状态迁移与失败恢复规则
- [x] TODO 2: 补 dashboard 历史查询与长期趋势
  - [x] 固定历史 snapshot 查询 contract
  - [x] 增加趋势聚合视图
  - [x] 增加指标时间窗和阈值说明
  - [x] 明确 dashboard 与 evaluation report 的边界
- [x] TODO 3: 落独立 Control Plane facade 第一轮
  - [x] 把 `governance / observability / import` 收到统一 facade
  - [x] 区分 `runtime / debug / control-plane` 入口
  - [x] 固定只读查询和写入操作的 authority 边界
  - [x] 为未来独立 API 或 Web UI 保留稳定 service surface
- [x] TODO 4: 深化目录迁移与 root export 收紧
  - [x] 继续把分层入口收敛到 `runtime / context-processing / governance / infrastructure / adapters / control-plane`
  - [x] 清理一轮过渡 import
  - [x] 收紧 root export
  - [x] 更新代码入口文档
- [x] TODO 5: 补运行时上下文与治理联动
  - [x] 让 runtime snapshot 更稳定服务于 observability
  - [x] 明确治理操作与 runtime snapshot 的关联 trace
  - [x] 固定导入结果与 runtime/debug 检查入口的对照关系
- [x] TODO 6: 完成阶段 6 第二轮验收与基线更新
  - [x] 输出第二轮状态页
  - [x] 输出第二轮总结页
  - [x] 更新 README、索引和路线图
  - [x] 明确下一步进入阶段 7 规划

## 本轮目标
- 不推翻阶段 6 第一轮已完成的 contract、service 和目录边界。
- 重点把第一轮“能用”的平台底座做成第二轮“更稳、更可运营”的能力。
- 延续当前边界：
  - 本项目负责 `provider-neutral runtime context result`
  - OpenClaw 或宿主 adapter 负责最终 provider payload 组装

## 一句话结论
`阶段 6 第二轮已经把第一轮跑通的 runtime/control-plane/import/observability 底座进一步做深、做稳，并把控制面入口、观测历史、导入治理和目录边界收口成可持续运营的形态。`
