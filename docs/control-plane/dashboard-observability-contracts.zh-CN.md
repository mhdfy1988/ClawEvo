# Dashboard Observability Contracts

这份文档用于收敛阶段 6 `TODO 5` 第一轮已经落地的 dashboard 级 observability contract。

相关代码：
- [contracts.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/contracts.ts)
- [observability-service.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/observability-service.ts)
- [observability-report.ts](/d:/C_Project/openclaw_compact_context/src/evaluation/observability-report.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- [control-plane-services.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/control-plane-services.test.ts)
- [context-engine-adapter.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/context-engine-adapter.test.ts)

## 1. 一句话结论

`observability` 现在不再只是阶段报告 formatter，而是已经能输出 `dashboard contract = stage report + runtime window summary + metric cards + alerts`。

## 2. 这轮新增了什么

### 2.1 `ObservabilityDashboardContract`

新的 dashboard contract 由 5 部分组成：

1. `readonlySources`
   - 当前只读数据源边界
   - 包括：
     - `live_runtime_snapshot`
     - `persisted_runtime_snapshot`
     - `transcript_session_file`

2. `latestStageReport`
   - evaluation reports 聚合出的阶段级报告

3. `runtimeWindowSummary`
   - runtime snapshot 汇总结果

4. `metricCards`
   - dashboard 固定指标卡片

5. `alerts`
   - 基于阈值的最小告警结果

同时还会带：
- `thresholds`

### 2.2 `buildDashboard(...)`

[observability-service.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/observability-service.ts) 现在已经支持：

- `buildStageReport(...)`
- `summarizeRuntimeWindows(...)`
- `buildContractBundle(...)`
- `buildDashboard(...)`

其中 `buildDashboard(...)` 会：
- 汇总阶段报告
- 汇总 runtime windows
- 产出固定 metric cards
- 按阈值生成 alerts

## 3. 固定 dashboard 指标

第一轮固定了 10 张 card：

### 3.1 runtime snapshot 指标

- `runtime_live_window_ratio`
- `runtime_transcript_fallback_ratio`
- `runtime_average_compressed_count`
- `runtime_average_final_message_count`

这说明：
- runtime snapshot 已经是一等数据源
- dashboard 可以直接看到当前更多是 `live_runtime` 还是 `transcript_fallback`
- 也能看到平均压缩量与最终窗口大小

### 3.2 stage report 指标

- `recall_noise_rate`
- `promotion_quality`
- `knowledge_pollution_rate`
- `high_scope_reuse_benefit`
- `high_scope_reuse_intrusion`
- `multi_source_coverage`

这几类指标正好对应阶段 6 之前已经做完的几条攻坚主线。

## 4. 告警阈值

当前第一轮默认阈值是：

- `minLiveRuntimeRatio = 0.5`
- `maxTranscriptFallbackRatio = 0.4`
- `maxRecallNoiseRate = 0.35`
- `minPromotionQuality = 0.6`
- `maxKnowledgePollutionRate = 0.2`
- `minHighScopeReuseBenefit = 0.4`
- `maxHighScopeReuseIntrusion = 0.3`
- `minMultiSourceCoverage = 0.5`

### 4.1 告警等级

目前只分两档：
- `warning`
- `critical`

规则是：
- 超过 `max` 或低于 `min` 就会出告警
- 偏离较大时提升到 `critical`

### 4.2 未知状态

如果当前没有 stage reports，或没有 runtime windows，对应 card 不会强行填 0，而是：

- `status = unknown`

这样 dashboard 不会把“没有数据”误报成“质量为 0”。

## 5. Gateway 调试入口

这一轮还新增了 gateway 调试入口：

- `compact-context.inspect_observability_dashboard`

它的目标不是替代未来 control plane UI，而是提供一个最小可调用入口，让我们现在就能：

- 看 runtime snapshot 汇总
- 看 dashboard cards
- 看 alerts

### 5.1 最小请求

```json
{
  "sessionId": "session-a"
}
```

### 5.2 多 session 请求

```json
{
  "sessionIds": ["session-a", "session-b"],
  "stage": "stage-6-dashboard"
}
```

### 5.3 阈值覆盖

```json
{
  "sessionId": "session-a",
  "thresholds": {
    "maxTranscriptFallbackRatio": 0.2,
    "minMultiSourceCoverage": 0.9
  }
}
```

## 6. 当前边界

这一轮已经完成的是：

- dashboard contract
- 固定指标卡片
- 最小告警阈值
- runtime snapshot 一等数据源
- gateway 调试入口

这一轮还没做的是：

- 真正的 control plane query API
- 趋势持久化存储
- dashboard 历史窗口分页
- 告警配置的持久化管理
- Web UI

## 7. 对阶段 6 的意义

`TODO 5` 第一轮完成后，阶段 6 的控制面已经不只是“有 observability service 骨架”，而是已经具备：

- `report`
- `snapshot`
- `dashboard card`
- `alert`
- `gateway inspection`

所以后面的 `TODO 6-8` 可以直接建立在这层 contract 之上，而不是再从阶段报告 helper 往回推。
