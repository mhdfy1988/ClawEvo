# 阶段 6 TODO

这份清单用于跟踪阶段 6 的平台化与分层重构工作。

当前判断：
`阶段 6 第一轮已经完成。`

相关文档：
- 路线图：[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)
- 主设计稿：[context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-design-v2.zh-CN.md)
- 分层架构：[layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/layered-knowledge-graph-architecture.zh-CN.md)
- 平台化方案：[stage-6-platformization-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-platformization-plan.zh-CN.md)
- 运行时上下文策略：[openclaw-runtime-context-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/openclaw-runtime-context-strategy.zh-CN.md)
- Runtime Window contract：[runtime-context-window-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-context-window-contract.zh-CN.md)
- Prompt Assembly contract：[prompt-assembly-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/prompt-assembly-contract.zh-CN.md)
- Runtime Snapshot Persistence：[runtime-snapshot-persistence.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-snapshot-persistence.zh-CN.md)
- 外部参考整理：[openclaw-external-context-references.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/references/openclaw-external-context-references.zh-CN.md)
- Control Plane contracts：[control-plane-service-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-service-contracts.zh-CN.md)
- Control Plane API Matrix：[control-plane-api-matrix.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-api-matrix.zh-CN.md)
- Governance Runbook：[governance-workflow-runbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/governance-workflow-runbook.zh-CN.md)
- Dashboard observability contracts：[dashboard-observability-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/dashboard-observability-contracts.zh-CN.md)
- Observability Metrics Dictionary：[observability-metrics-dictionary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/observability-metrics-dictionary.zh-CN.md)
- Import Source Spec：[import-source-spec.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/import-source-spec.zh-CN.md)
- 第一轮状态页：[stage-6-first-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-first-pass-status.zh-CN.md)
- 第一轮总结页：[stage-6-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-first-pass-report.zh-CN.md)

## 已完成
- [x] TODO 1: 明确 `Runtime Plane / Control Plane / UI Plane` 分层边界
  - [x] 明确插件继续作为 runtime 主链
  - [x] 明确 control plane 不直接写底层 SQLite
  - [x] 明确未来 UI 只调用 control plane
  - [x] 明确本项目只产出 `provider-neutral runtime context result`
- [x] TODO 2: 落运行时上下文 contract 第一轮
  - [x] `Runtime Context Window Contract`
  - [x] `Prompt Assembly Contract`
  - [x] `Runtime Snapshot Persistence`
  - [x] `compact-context.inspect_runtime_window`
  - [x] 参考优先级固定为：`graph-memory` 主参考，`memory-lancedb-pro` 局部参考，`openclaw-control-center` 控制面参考
- [x] TODO 3: 落 `Control Plane service contract` 第一轮
  - [x] `governance-service`
  - [x] `observability-service`
  - [x] `import-service`
  - [x] 固定 `runtime API / debug API / control-plane API` 分层
  - [x] 固定只读来源：`live_runtime_snapshot / persisted_runtime_snapshot / transcript_session_file`
- [x] TODO 4: 落平台化人工治理第一轮
  - [x] `proposal -> approval -> apply -> rollback`
  - [x] `session / workspace / global` authority 边界
  - [x] correction audit trace
  - [x] gateway 治理入口
- [x] TODO 5: 落 dashboard 级 observability 第一轮
  - [x] dashboard contract
  - [x] fixed metric cards
  - [x] alerts / thresholds
  - [x] `compact-context.inspect_observability_dashboard`
- [x] TODO 6: 落多来源知识导入平台第一轮
  - [x] `ImportJob` / `ImportJobFlow` / `ImportStageTrace` contract
  - [x] 固定 `document / repo_structure / structured_input` 三类来源
  - [x] 增加 `incremental / versionInfo / failureTrace`
  - [x] 新增 gateway 生命周期：
    - [x] `compact-context.create_import_job`
    - [x] `compact-context.run_import_job`
    - [x] `compact-context.get_import_job`
    - [x] `compact-context.list_import_jobs`
- [x] TODO 7: 目录架构重构第一轮
  - [x] 建立 `src/runtime`
  - [x] 建立 `src/context-processing`
  - [x] 建立 `src/governance`
  - [x] 建立 `src/infrastructure`
  - [x] 建立 `src/adapters`
  - [x] 保留旧路径兼容，不做行为重写
- [x] TODO 8: 完成阶段 6 第一轮验收与基线更新
  - [x] 同步 README、索引、设计稿、平台入口文档
  - [x] 输出阶段 6 能力边界
  - [x] 输出阶段 6 第一轮状态页与总结报告

## 当前结论
- 阶段 6 第一轮已经从“平台化方向”落成了真实的 contract、service、gateway 和目录边界。
- 运行时上下文、人工治理、observability 和 import 都已具备第一轮可用能力。
- 目录分层已经启动，但还没有进入大规模物理迁移。

## 下一步建议
优先进入：
1. 阶段 6 第二轮深化
2. 或阶段 7 规划

更具体地说，后面最值得做的是：
- import history / retry / scheduler
- dashboard 历史查询与长期趋势
- 独立 control plane API / facade
- 更深的目录迁移与 root export 收紧

