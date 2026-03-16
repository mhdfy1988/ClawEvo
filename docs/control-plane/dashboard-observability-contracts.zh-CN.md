# Dashboard Observability Contracts

这份文档用于收敛阶段 6 第一轮与第二轮已经落地的 dashboard 级 observability contract。

相关代码：
- [contracts.ts](/d:/C_Project/openclaw_compact_context/packages/control-plane-core/src/contracts.ts)
- [observability-service.ts](/d:/C_Project/openclaw_compact_context/packages/control-plane-core/src/observability-service.ts)
- [observability-report.ts](/d:/C_Project/openclaw_compact_context/src/evaluation/observability-report.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/context-engine-adapter.ts)
- [control-plane-services.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/control-plane-services.test.ts)
- [context-engine-adapter.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/context-engine-adapter.test.ts)

## 1. 一句话结论
`observability` 现在不再只是阶段报告 formatter，而是已经能输出 `dashboard contract + snapshot history + metric series + alerts`。

## 2. 第一轮交付

### 2.1 `ObservabilityDashboardContract`
第一轮 dashboard contract 由 5 部分组成：
1. `readonlySources`
2. `latestStageReport`
3. `runtimeWindowSummary`
4. `metricCards`
5. `alerts`

同时还会带：
- `thresholds`

### 2.2 `buildDashboard(...)`
[observability-service.ts](/d:/C_Project/openclaw_compact_context/packages/control-plane-core/src/observability-service.ts) 已支持：
- `buildStageReport(...)`
- `summarizeRuntimeWindows(...)`
- `buildContractBundle(...)`
- `buildDashboard(...)`

其中 `buildDashboard(...)` 会：
- 汇总阶段报告
- 汇总 runtime windows
- 产出固定 metric cards
- 按阈值生成 alerts

## 3. 第二轮补充

### 3.1 Dashboard Snapshot
第二轮新增：
- `recordDashboardSnapshot(...)`
- `listDashboardSnapshots(...)`

这意味着 dashboard 已有显式历史快照，而不是只能看“当前态”。

### 3.2 Dashboard History
第二轮新增：
- `buildDashboardHistory(...)`

返回对象会固定包含：
- `snapshots`
- `metricSeries`
- `sessionIds`
- `stage`

### 3.3 Gateway 入口
当前 gateway 已暴露：
- `compact-context.inspect_observability_dashboard`
- `compact-context.capture_observability_snapshot`
- `compact-context.inspect_observability_history`

## 4. 固定 dashboard 指标
当前固定的 card 仍然覆盖两组指标：

### 4.1 runtime snapshot 指标
- `runtime_live_window_ratio`
- `runtime_transcript_fallback_ratio`
- `runtime_average_compressed_count`
- `runtime_average_final_message_count`

### 4.2 stage report 指标
- `recall_noise_rate`
- `promotion_quality`
- `knowledge_pollution_rate`
- `high_scope_reuse_benefit`
- `high_scope_reuse_intrusion`
- `multi_source_coverage`

## 5. 告警阈值
当前默认阈值包括：
- `minLiveRuntimeRatio`
- `maxTranscriptFallbackRatio`
- `maxRecallNoiseRate`
- `minPromotionQuality`
- `maxKnowledgePollutionRate`
- `minHighScopeReuseBenefit`
- `maxHighScopeReuseIntrusion`
- `minMultiSourceCoverage`

### 5.1 告警等级
目前仍然只分两档：
- `warning`
- `critical`

### 5.2 未知状态
如果当前没有 stage reports 或 runtime windows，对应 card 不会强行填 0，而是：
- `status = unknown`

## 6. 当前边界
已完成：
- dashboard contract
- 固定指标卡片
- 最小告警阈值
- runtime snapshot 一等数据源
- snapshot history
- metric history series
- gateway inspection

还没做完：
- 真正的 control plane query API
- 策略配置持久化管理
- dashboard 历史分页
- Web UI

## 7. 对阶段 6 的意义
这一轮完成后，阶段 6 的 observability 已经不只是：
- `report`
- `snapshot`
- `dashboard card`
- `alert`

还进一步具备了：
- `snapshot history`
- `metric series`
- `history inspection`

所以后面的 control-plane API 与 Web UI 可以直接建立在这层 contract 之上。
