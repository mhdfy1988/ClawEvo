# Control Plane Service Contracts

这份文档用于收敛阶段 6 第一轮与第二轮已经落地的 control plane contracts 与服务边界。

相关代码：
- [contracts.ts](/d:/C_Project/openclaw_compact_context/packages/control-plane-core/src/contracts.ts)
- [governance-policy.ts](/d:/C_Project/openclaw_compact_context/packages/control-plane-core/src/governance-policy.ts)
- [governance-service.ts](/d:/C_Project/openclaw_compact_context/packages/control-plane-core/src/governance-service.ts)
- [observability-service.ts](/d:/C_Project/openclaw_compact_context/packages/control-plane-core/src/observability-service.ts)
- [import-service.ts](/d:/C_Project/openclaw_compact_context/packages/control-plane-core/src/import-service.ts)
- [control-plane-facade.ts](/d:/C_Project/openclaw_compact_context/packages/control-plane-core/src/control-plane-facade.ts)
- [control-plane-services.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/control-plane-services.test.ts)

配套文档：
- [control-plane-api-matrix.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-api-matrix.zh-CN.md)
- [governance-workflow-runbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/governance-workflow-runbook.zh-CN.md)
- [import-source-spec.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/import-source-spec.zh-CN.md)
- [observability-metrics-dictionary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/observability-metrics-dictionary.zh-CN.md)

## 1. 一句话边界
`Runtime Plane 继续掌握在线上下文处理与知识写入权威；Control Plane 通过稳定 contract 读 runtime / readonly source，并且不直接写底层 SQLite。`

## 2. API 分层
当前代码已经把四类入口分开：
1. `runtime API`
   - `bootstrap`
   - `ingest`
   - `ingestBatch`
   - `afterTurn`
   - `assemble`
   - `compact`
2. `debug API`
   - `compact-context.health`
   - `compact-context.inspect_bundle`
   - `compact-context.inspect_runtime_window`
   - `compact-context.inspect_observability_dashboard`
   - `compact-context.inspect_observability_history`
   - 其他 query / checkpoint / skill 调试方法
3. `control-plane service`
   - `governance-service`
   - `observability-service`
   - `import-service`
4. `control-plane facade`
   - `control-plane-facade`

这些边界已经通过 `ControlPlaneBoundaryDescriptor` 固定下来，所有项都带：
- `surface`
- `readonly`
- `authority`
- `directStoreAccess=false`

## 3. 只读数据源
当前 control plane 固定只认三类只读来源：
- `live_runtime_snapshot`
- `persisted_runtime_snapshot`
- `transcript_session_file`

它们分别代表：
1. `live_runtime_snapshot`
   - 当前 `assemble()` 看到的真实运行时窗口
2. `persisted_runtime_snapshot`
   - `assemble()` 持久化后的运行时快照
3. `transcript_session_file`
   - 冷启动、fallback 和只读回放来源

## 4. Governance Service
当前治理服务已经实现闭环：

`proposal -> approval -> apply -> rollback`

并通过 gateway 暴露：
- `compact-context.submit_correction_proposal`
- `compact-context.review_correction_proposal`
- `compact-context.apply_correction_proposal`
- `compact-context.rollback_correction_proposal`
- `compact-context.list_correction_proposals`
- `compact-context.list_correction_audit`

### 4.1 Proposal Contract
每个 proposal 至少包含：
- `targetScope`
- `submittedBy`
- `submittedAuthority`
- `reason`
- `corrections`
- `status`
- `runtimeSnapshot`

### 4.2 Scope Authority
当前 authority 模型是：
- `session_operator`
- `workspace_reviewer`
- `global_reviewer`

对应边界：
1. `session`
   - 三种 authority 都可 submit / review / apply / rollback
2. `workspace`
   - `workspace_reviewer / global_reviewer` 可 submit / review / apply / rollback
3. `global`
   - 仅 `global_reviewer` 可 submit / review / apply / rollback

### 4.3 Apply 与 Rollback
治理服务不会直接写存储，而是通过 runtime engine 回流：

```ts
applyManualCorrections(corrections)
```

因此：
- `apply` 通过 engine 应用 corrections
- `rollback` 通过生成反向 corrections 再回流

## 5. Observability Service
当前 observability service 负责：
1. `buildStageReport`
2. `summarizeRuntimeWindows`
3. `buildContractBundle`
4. `buildDashboard`
5. `recordDashboardSnapshot`
6. `listDashboardSnapshots`
7. `buildDashboardHistory`

同时 gateway 暴露：
- `compact-context.inspect_observability_dashboard`
- `compact-context.capture_observability_snapshot`
- `compact-context.inspect_observability_history`

这意味着 observability 已经不再只是阶段报告 helper，而是有了：
- 当前态 dashboard
- snapshot 记录
- metric history series

## 6. Import Service
当前 import service 已进入第二轮，负责：
1. `createJob`
   - 创建导入任务
   - 推断 source / flow / incremental / versionInfo
2. `runJob`
   - 执行 `parse -> normalize -> materialize`
   - 记录 `stageTrace`
   - 失败时记录 `failureTrace`
3. `retryJob / rerunJob`
   - 基于 attempt history 重试失败任务或重跑已完成任务
4. `scheduleJob / runDueJobs`
   - 提供最小调度与批处理入口
5. `getJob / listJobs / getJobHistory`
   - 查询任务状态与 attempt history

同时 gateway 暴露：
- `compact-context.create_import_job`
- `compact-context.run_import_job`
- `compact-context.get_import_job`
- `compact-context.list_import_jobs`
- `compact-context.retry_import_job`
- `compact-context.rerun_import_job`
- `compact-context.schedule_import_job`
- `compact-context.run_due_import_jobs`
- `compact-context.list_import_job_history`

一句话说：
`导入服务编排 job，但真正入图仍由 runtime engine 完成。`

## 7. Control Plane Facade
第二轮新增的 `control-plane-facade` 把：
- `governance`
- `observability`
- `import`

三类能力收成一个稳定 service surface，用于承接：
- gateway handler
- 未来独立 control-plane API
- 未来 Web UI / console

这意味着上层已经不需要直接感知多个 service 的组合细节。

## 8. 当前还没做完的
虽然 control plane 第一轮与第二轮都已落地，但还缺：
1. 更细的治理权限模型
2. 更成熟的审批策略
3. 独立进程级 control-plane API
4. 更完整的 import source-specific orchestration
5. dashboard 配置与告警策略持久化

## 9. 对阶段 6 的意义
这一轮的完成意味着：
- `TODO 3` 已经不只是设计想法，而是实际代码边界
- `TODO 4` 已有可用治理闭环，并带 runtime snapshot trace
- `TODO 5` 已能直接消费 runtime snapshot 做 dashboard bundle 和 history
- `TODO 6` 已可直接复用 import job contract，并具备第二轮治理能力
