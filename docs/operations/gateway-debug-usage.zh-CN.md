# Gateway 调试入口使用说明

## 1. 文档目标
这份文档用于固定当前 `compact-context` 在 gateway 层暴露出来的调试入口，以及最常用的排查路径。

当前最常用的入口有：
1. `compact-context.explain`
2. `compact-context.query_nodes`
3. `compact-context.inspect_bundle`
4. `compact-context.inspect_runtime_window`
5. `compact-context.inspect_observability_dashboard`
6. `compact-context.inspect_observability_history`
7. 治理入口
8. import job 入口

## 2. 入口概览

### 2.1 `compact-context.explain`
适合：
- 已经知道某个 `nodeId`
- 想看节点来源、关联、provenance
- 想知道它为什么进或没进当前 bundle

### 2.2 `compact-context.query_nodes`
适合：
- 还不知道具体 `nodeId`
- 先按 `type / text / sessionId / originKinds` 查一批节点
- 再附带 explain 或 query match 看命中原因

### 2.3 `compact-context.inspect_bundle`
适合：
- 直接看当前 compile 到底选了什么
- 同时拿到 bundle、summary、promptPreview 和 explain sample

### 2.4 `compact-context.inspect_runtime_window`
适合：
- 看宿主当前到底把哪些消息窗口交给了 `assemble()`
- 区分 `inboundMessages / preferredMessages / finalMessages`
- 判断当前窗口来自：
  - `live_runtime`
  - `persisted_snapshot`
  - `transcript_fallback`

当前返回会包含：
- `source`
- `query`
- `compressedCount`
- `inboundMessages / preferredMessages / finalMessages`
- `latestPointers`
- `toolCallResultPairs`
- `window`
- `promptAssembly`
- 若有快照则带 `systemPromptAddition`

### 2.5 治理入口
适合：
- 把人工校正从“直接 apply”收成可审查 proposal
- 验证 `proposal -> approval -> apply -> rollback`
- 查看 correction proposal 与 audit trace

当前方法：
- `compact-context.submit_correction_proposal`
- `compact-context.review_correction_proposal`
- `compact-context.apply_correction_proposal`
- `compact-context.rollback_correction_proposal`
- `compact-context.list_correction_proposals`
- `compact-context.list_correction_audit`

### 2.6 `compact-context.inspect_observability_dashboard`
适合：
- 直接看 dashboard 汇总
- 确认 runtime snapshot 是否进入 observability 一等数据源
- 先看 metric cards 和 alerts，再决定是否做更重的控制面

### 2.7 `compact-context.inspect_observability_history`
适合：
- 直接看 dashboard snapshot history 与 metric series
- 验证 runtime snapshot 是否持续进入 observability 历史数据面
- 对比不同 session 或时间窗下的趋势变化

当前方法：
- `compact-context.capture_observability_snapshot`
- `compact-context.inspect_observability_history`

### 2.8 Import Job 入口
适合：
- 创建导入任务
- 手动驱动导入生命周期
- 查看 import job 的 stage trace / failure trace
- 查看 attempt history
- 手动 retry / rerun / schedule

当前方法：
- `compact-context.create_import_job`
- `compact-context.run_import_job`
- `compact-context.get_import_job`
- `compact-context.list_import_jobs`
- `compact-context.retry_import_job`
- `compact-context.rerun_import_job`
- `compact-context.schedule_import_job`
- `compact-context.run_due_import_jobs`
- `compact-context.list_import_job_history`

## 3. 常用查看点

### `compact-context.explain`
重点看：
- `summary`
- `provenance`
- `selection.included`
- `selection.slot`
- `selection.reason`

### `compact-context.query_nodes`
重点看：
- `queryMatch`
- `explain`
- `selectionContext`

### `compact-context.inspect_bundle`
重点看：
- `summary`
- `promptPreview`
- `bundle.diagnostics`
- `explain.explanations`

### `compact-context.inspect_runtime_window`
重点看：
- `source`
- `window`
- `promptAssembly`
- `latestPointers`
- `toolCallResultPairs`

### `compact-context.inspect_observability_dashboard`
重点看：
- `dashboard.metricCards`
- `dashboard.alerts`
- `dashboard.thresholds`

### `compact-context.inspect_observability_history`
重点看：
- `history.snapshots`
- `history.metricSeries`
- `history.stage`
- `history.sessionIds`

### Import Job
典型顺序：
1. `compact-context.create_import_job`
2. `compact-context.run_import_job`
3. `compact-context.get_import_job`
4. `compact-context.list_import_jobs`
5. `compact-context.list_import_job_history`
6. `compact-context.retry_import_job` 或 `compact-context.rerun_import_job`
7. `compact-context.schedule_import_job`
8. `compact-context.run_due_import_jobs`

重点看：
- `job.flow`
- `job.incremental`
- `job.versionInfo`
- `job.attemptCount`
- `job.lastAttemptAction`
- `job.nextScheduledAt`
- `job.runtimeSnapshot`
- `result.stageTrace`
- `result.failureTrace`

## 4. 当前边界
当前这套调试入口已经能解释：
- 节点从哪里来
- 节点属于 `raw / compressed / derived` 哪类
- 节点为什么会被 `query_nodes` 召回
- 节点为什么进或没进 bundle
- 当前 runtime window 来自 live、persisted 还是 transcript fallback
- 当前 observability dashboard 看到了什么
- observability 历史里记录了什么
- import job 的阶段执行情况、attempt history 和调度行为

但还没有覆盖：
- 边为什么没有参与推理
- 某条历史消息为何未形成 node
- checkpoint 级 explain 聚合
- 真正的独立 control-plane API

## 5. 相关文档
- [manual-corrections-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/manual-corrections-usage.zh-CN.md)
- [observability-matrix.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/observability-matrix.zh-CN.md)
- [dashboard-observability-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/dashboard-observability-contracts.zh-CN.md)
- [import-source-spec.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/import-source-spec.zh-CN.md)
- [历史导入平台说明](/d:/C_Project/openclaw_compact_context/docs/archive/control-plane/multi-source-import-platform-first-pass.zh-CN.md)
