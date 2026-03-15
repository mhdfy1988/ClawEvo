# 多来源知识导入平台第一轮

这份文档用于收敛阶段 6 `TODO 6` 第一轮已经落地的多来源知识导入平台。

相关代码：
- [contracts.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/contracts.ts)
- [import-service.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/import-service.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- [control-plane-services.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/control-plane-services.test.ts)
- [context-engine-adapter.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/context-engine-adapter.test.ts)

## 1. 一句话目标
`导入平台负责编排 source-specific parser / normalizer / materializer 流程，并通过 runtime engine 入图；它不负责 provider-specific prompt 组装。`

## 2. 第一轮范围
这一轮固定了三类来源：
- `document`
- `repo_structure`
- `structured_input`

每类来源都有一条显式 flow：

### 2.1 `document`
- parser: `document_parser`
- normalizer: `document`
- materializer: `source_entities`

### 2.2 `repo_structure`
- parser: `repo_structure_parser`
- normalizer: `repo_structure`
- materializer: `source_entities`

### 2.3 `structured_input`
- parser: `structured_payload_parser`
- normalizer: `structured_input`
- materializer: `runtime_ingest`

## 3. Import Job Contract
第一轮的 `ImportJob` 不再只有 `sourceKind` 和 `status`，而是显式包含：
- `source`
  - `kind / path / uri / repoRoot / format / checksum`
- `flow`
  - `parser / normalizer / materializer / stageOrder`
- `incremental`
  - `enabled / previousJobId / cursor / changedRecordIds`
- `versionInfo`
  - `sourceVersion`
  - `schemaVersion`
  - `parserVersion`
  - `normalizerVersion`
  - `materializerVersion`
  - `dedupeKey`
  - `recordVersion`
- `failureTrace`
  - `stage / failedAt / message / retriable`

## 4. 运行阶段
当前 `runJob(...)` 已固定三段：
1. `parse`
2. `normalize`
3. `materialize`

每段都会记录：
- `stage`
- `status`
- `recordCount`
- `warningCount`
- `durationMs`
- `completedAt`

也就是说，第一轮已经具备：

`job orchestration + stage trace + failure trace`

## 5. 增量导入与版本化
第一轮还没有做真正的外部 source diff 引擎，但已经把后续必需字段固定下来了：
- `incremental.enabled`
- `incremental.previousJobId`
- `incremental.cursor`
- `incremental.changedRecordIds`
- `versionInfo.dedupeKey`
- `versionInfo.recordVersion`
- `versionInfo.sourceVersion`

因此后续如果要补：
- 增量扫描
- 断点续跑
- 版本比对

不需要再推翻 job 模型。

## 6. Gateway 入口
这一轮新增了 4 个 gateway 方法：
- `compact-context.create_import_job`
- `compact-context.run_import_job`
- `compact-context.get_import_job`
- `compact-context.list_import_jobs`

它们的定位是：
- 先提供最小 control-plane 入口
- 让导入平台在没有 Web UI 的情况下也能实际调用

## 7. 和 runtime 的关系
第一轮坚持下面这条边界：
- import service 编排 job
- runtime engine 负责真实 ingest
- 导入平台不直接写底层 SQLite
- 导入平台不做最终 prompt/provider payload 组装

也就是说：

`Import Plane -> Runtime Engine -> Graph / Persistence`

而不是：

`Import Plane -> 直接改底层存储`

## 8. 当前边界
这一轮已经做完的：
- import job model
- source-specific flow contract
- incremental / version / failure 字段
- gateway 生命周期
- 通过 runtime engine 的 materialize 闭环

这一轮还没做的：
- 真正的文档解析器 / 仓库扫描器
- 批量 source catalog
- import history 持久化
- import dashboard
- import retry policy

## 9. 对阶段 6 的意义
`TODO 6` 第一轮完成后，control plane 已经不再只是“知道可以导入”，而是已经具备：
- job
- flow
- stage trace
- failure trace
- gateway lifecycle

后面的目录重构和阶段总结，都可以把这条线视为正式能力，而不是预研口径。
