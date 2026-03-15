# 阶段 6 能力边界

这份文档用于回答：
- 阶段 6 第一轮与第二轮已经真正做到了什么
- 哪些还是半实现
- 哪些还没有进入正式实现

## 已实现

### 1. Runtime Context Contract
- `Runtime Context Window Contract`
- `Prompt Assembly Contract`
- `Runtime Snapshot Persistence`
- `compact-context.inspect_runtime_window`

### 2. Control Plane Service
- `governance-service`
- `observability-service`
- `import-service`
- `control-plane-facade`

### 3. 人工治理
- `proposal -> approval -> apply -> rollback`
- scope-aware authority
- correction audit trace
- gateway 治理入口
- runtime snapshot trace 关联

### 4. Dashboard Observability
- dashboard contract
- metric cards
- alerts
- runtime snapshot 一等数据源
- dashboard snapshot history
- `compact-context.inspect_observability_dashboard`
- `compact-context.capture_observability_snapshot`
- `compact-context.inspect_observability_history`

### 5. 多来源导入平台
- import job contract
- source-specific flow contract
- incremental / version / failure 字段
- gateway import lifecycle
- import attempt history
- `retry / rerun / schedule / runDueJobs`
- `compact-context.retry_import_job`
- `compact-context.rerun_import_job`
- `compact-context.schedule_import_job`
- `compact-context.run_due_import_jobs`
- `compact-context.list_import_job_history`

### 6. 目录重构
- `runtime / context-processing / governance / infrastructure / adapters / control-plane`
- 分层入口
- root export 第一轮收紧
- 兼容保留

## 半实现

### 1. Control Plane
已有 service contract、facade 和 gateway 入口，但还不是独立进程级 control plane。

### 2. Import Platform
已有 job / flow / history / schedule 模型，但还没有真正的文档抓取器、仓库扫描器和批量 source catalog。

### 3. Dashboard Observability
已有 contract、snapshot history 和 history query，但还没有分页 query、持久化策略治理和 Web dashboard。

### 4. Directory Refactor
已有分层入口和 root export 收紧，但还没有大规模 move 旧文件与清理旧 import。

## 未实现

### 1. Web UI / Console
当前仍然没有正式控制台页面。

### 2. 独立 Control Plane API
当前仍以 facade + service + gateway 入口为主。

### 3. 更成熟的 Import Scheduler / Source Catalog
当前只有最小调度与作业治理，还没有完整的调度平台与 source catalog。

### 4. 阶段 7
阶段 6 第二轮已完成，下一步更适合进入阶段 7 规划：
- [stage-6-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-second-pass-todo.zh-CN.md)

阶段 7 更可能聚焦于：
- 独立 control-plane API / process
- Web UI / console
- 更成熟的 importer 和 source catalog
- 更深的目录迁移与内部 API 清理

## 一句话结论
`阶段 6 第一轮与第二轮已经把“平台化”从文档方向推进成了可运行的 contract + service + facade + gateway + import/observability/gov 联动底座；但它仍然不是最终的独立控制台或产品化 control plane。`
