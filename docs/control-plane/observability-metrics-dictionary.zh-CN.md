# Observability Metrics Dictionary

这份文档解释 dashboard contract 里的固定指标、含义和阈值方向。

相关代码：
- [contracts.ts](/d:/C_Project/openclaw_compact_context/packages/compact-context-core/src/contracts.ts)
- [dashboard-observability-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/dashboard-observability-contracts.zh-CN.md)

## 1. 指标原则

当前第一轮 dashboard 指标分两类来源：
- `runtime_windows`
- `stage_report`

并统一使用：
- `ratio`
- `count`

两种单位。

## 2. 指标解释

### `runtime_live_window_ratio`
- 含义：当前观察窗口中，来自 `live_runtime` 的比例
- 越高越好

### `runtime_transcript_fallback_ratio`
- 含义：当前观察窗口中，落到 `transcript_fallback` 的比例
- 越低越好

### `runtime_average_compressed_count`
- 含义：平均每个 session 压缩掉多少条历史消息

### `runtime_average_final_message_count`
- 含义：最终 raw window 平均保留多少条消息

### `recall_noise_rate`
- 含义：召回噪音率
- 越低越好

### `promotion_quality`
- 含义：知识晋升质量
- 越高越好

### `knowledge_pollution_rate`
- 含义：知识污染率
- 越低越好

### `high_scope_reuse_benefit`
- 含义：高 scope 复用收益
- 越高越好

### `high_scope_reuse_intrusion`
- 含义：高 scope 复用带来的侵入风险
- 越低越好

### `multi_source_coverage`
- 含义：多来源导入覆盖度
- 越高越好

## 3. 当前默认阈值

- `minLiveRuntimeRatio`: `0.5`
- `maxTranscriptFallbackRatio`: `0.4`
- `maxRecallNoiseRate`: `0.35`
- `minPromotionQuality`: `0.6`
- `maxKnowledgePollutionRate`: `0.2`
- `minHighScopeReuseBenefit`: `0.4`
- `maxHighScopeReuseIntrusion`: `0.3`
- `minMultiSourceCoverage`: `0.5`
