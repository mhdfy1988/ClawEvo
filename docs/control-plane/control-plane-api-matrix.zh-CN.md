# Control Plane API Matrix

这份文档把当前 runtime API、debug API 和 control-plane service 的边界与入口集中成一张矩阵。

相关代码：
- [contracts.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/contracts.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

## 1. 总原则

当前系统把入口分成三层：
1. `runtime API`
2. `debug API`
3. `control-plane service`

共同原则：
- 不直接写底层 SQLite
- 通过 runtime engine 回流
- 对外边界以 contract 为准

## 2. Runtime API

| 名称 | 只读 | 作用 |
|---|---:|---|
| `bootstrap` | 否 | 从 session file 冷启动导入 |
| `ingest` | 否 | 增量摄入单条消息 |
| `ingestBatch` | 否 | 批量摄入消息 |
| `afterTurn` | 否 | 回合结束后的沉淀与学习 |
| `assemble` | 是 | 计算最终 runtime window 和 prompt 结果 |
| `compact` | 否 | 执行 compact 主链 |

## 3. Debug API

### 健康与上下文
- `compact-context.health`
- `compact-context.inspect_bundle`
- `compact-context.inspect_runtime_window`
- `compact-context.inspect_observability_dashboard`
- `compact-context.explain`

### 图谱与沉淀
- `compact-context.ingest_context`
- `compact-context.compile_context`
- `compact-context.create_checkpoint`
- `compact-context.query_nodes`
- `compact-context.query_edges`
- `compact-context.get_latest_checkpoint`
- `compact-context.list_checkpoints`
- `compact-context.crystallize_skills`
- `compact-context.list_skill_candidates`

### 手动校正
- `compact-context.apply_corrections`
- `compact-context.list_corrections`

### 导入任务
- `compact-context.create_import_job`
- `compact-context.run_import_job`
- `compact-context.get_import_job`
- `compact-context.list_import_jobs`

### 治理 proposal
- `compact-context.submit_correction_proposal`
- `compact-context.review_correction_proposal`
- `compact-context.apply_correction_proposal`
- `compact-context.rollback_correction_proposal`
- `compact-context.list_correction_proposals`
- `compact-context.list_correction_audit`

## 4. Control Plane Service

| Service | 只读 | 作用 |
|---|---:|---|
| `governance-service` | 否 | proposal / approval / apply / rollback |
| `observability-service` | 是 | dashboard、stage report、runtime summary |
| `import-service` | 否 | import job 生命周期与 stage trace |

## 5. 只读来源矩阵

当前 control plane 第一轮固定只认三种只读来源：

| 来源 | 用途 |
|---|---|
| `live_runtime_snapshot` | 当前运行中的真实窗口 |
| `persisted_runtime_snapshot` | 最近一次 assemble 持久化结果 |
| `transcript_session_file` | 冷启动与回放 fallback |

## 6. Authority 说明

当前 authority 只在治理 proposal 上显式区分：
- `session_operator`
- `workspace_reviewer`
- `global_reviewer`

具体规则见：
- [governance-workflow-runbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/governance-workflow-runbook.zh-CN.md)

## 7. 当前缺口

后续还值得补：
- 独立 control plane API facade
- auth / identity 更细化
- import scheduler / retry API
- dashboard 历史查询 API
