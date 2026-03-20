# Context Engine 压缩与观测 TODO

这份 TODO 用来跟踪“先做压缩主链，再做上下文监控 P0，再进 OpenClaw 联调”的执行顺序。

相关文档：
- 总方案：[context-engine-compression-and-observability-delivery-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-engine-compression-and-observability-delivery-plan.zh-CN.md)
- 压缩策略定稿：[context-engine-baseline-list-compaction-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-baseline-list-compaction-strategy.zh-CN.md)
- Agent Workbench 总方案：[agent-workbench-platform-rebuild-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/agent-workbench-platform-rebuild-plan.zh-CN.md)
- Agent Workbench TODO：[agent-workbench-platform-rebuild-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/agent-workbench-platform-rebuild-todo.zh-CN.md)

## 当前执行真源

当前阶段如果目标是：

- 先把上下文压缩主链做稳
- 先把 `Live / Context / Prompt` 三个 P0 页面做出来
- 先把插件装进 OpenClaw 看压缩效果

则以这份 TODO 作为执行真源。

`agent-workbench-platform-rebuild-todo.zh-CN.md` 当前保留为上层平台路线图；和这份文档重叠的条目，默认以这份文档的完成状态为准，不再重复记账。

当前映射关系固定为：

1. 这里的 `TODO 7`
   对应平台 TODO 里的 `PromptAssemblySnapshot` 最小版
2. 这里的 `TODO 8`
   对应平台 TODO 里的 `Live / Context / Prompt` P0 页面
3. 这里的 `TODO 9`
   对应平台 TODO 里的 OpenClaw 插件联调与 smoke baseline

## 进展补记

- 2026-03-20：已补最小压缩策略配置入口，真源仍在插件侧。当前可配置项为
  `rawTailTurnCount / fullCompactionThresholdRatio / maxBaselineCount / maxBaselineRollupRatio`；
  平台页只展示当前生效值，不单独维护压缩策略真源。

## 待办

- [x] TODO 1：固定压缩 contract 与诊断模型 ~2d #P0 #架构 #后端 @Codex 2026-03-19
  - [x] 把 `SessionCompressionState.baseline` 升级为 `baselines[]`
  - [x] 给 baseline 增加 `generation`
  - [x] 给 baseline 增加 `sourceBaselineIds`
  - [x] 增加 `CompressionDiagnostics`
  - [x] 收口 `rollback / evict / sidecarReferenceCount / fallbackLevel`
  - [x] 补 contract fixture / type test

- [x] TODO 2：实现 baseline list / rollup / rollback / evict 主链 ~3d #P0 #runtime #后端 @Codex 2026-03-19
  - [x] 在 `context-engine-adapter` 把单 baseline 升级成 `baselines[]`
  - [x] `contextOccupancyRatio > 0.50` 时触发 full
  - [x] `incremental` 封存为新 baseline
  - [x] `baselines.length > 4` 时 rollup 最老半边
  - [x] rollup 超过 `20%` 预算时 rollback + evict 最老 baseline
  - [x] `formatCompressionStateForPrompt(...)` 支持 baseline list 展示

- [x] TODO 3：收口 `rawTail + sidecar` 边界 ~2d #P0 #runtime #后端 @Codex 2026-03-23
  - [x] 明确最近两轮超长 `tool result` 仍属于 `rawTail` 结构
  - [x] prompt-visible 内容只保结构化压缩结果
  - [x] sidecar 回查路径在 explain / inspect 可见
  - [x] 补“rawTail 结构保留但正文走 sidecar”的回归测试

- [x] TODO 4：补 compression diagnostics 与 explain / inspect 出口 ~2d #P0 #可观测 #后端 @Codex 2026-03-24
  - [x] 记录 `trigger / occupancy before-after`
  - [x] 记录 `sealedIncrementalId / appendedBaselineId`
  - [x] 记录 `mergedBaselineIds / mergedBaselineResultId`
  - [x] 记录 `rollback / evictedBaselineId`
  - [x] 记录 `rawTail / incremental / baseline` token estimate
  - [x] explain / inspect 能稳定返回这些字段

- [x] TODO 5：补运行时护栏 `live fallback + per-session 串行化` ~2d #P0 #稳定性 #后端 @Codex 2026-03-25
  - [x] assemble 异常或 coverage 不完整时退回 live fallback
  - [x] 同一 session 的 `ingest / assemble / compact / afterTurn` 串行执行
  - [x] 补并发 / fallback 回归测试

- [x] TODO 6：补压缩主链回归与 smoke 基线 ~2d #P0 #测试 @Codex 2026-03-26
  - [x] 第 3 轮生成单 incremental
  - [x] 严格超过 `50%` 后 incremental 封存为 baseline
  - [x] baseline 超限后 rollup
  - [x] rollup 超限后 rollback + evict
  - [x] `rawTail / incremental / baselines[]` 的 `derivedFrom` 不重叠
  - [x] 最近两轮超长 tool result 的 sidecar 口径稳定

- [x] TODO 7：产出 `PromptAssemblySnapshot` 与最小上下文读模型 ~2d #P0 #control-plane #后端 @Codex 2026-03-27
  - [x] 增加 `PromptAssemblySnapshot`
  - [x] snapshot 包含 `messages / systemPromptAddition / estimatedTokens`
  - [x] snapshot 带 compression diagnostics
  - [x] snapshot 带 sidecar 概况与 toolCallResultPairs
  - [x] 对接现有 runtime snapshot persistence

- [x] TODO 8：落地 `Live / Context / Prompt` 三个 P0 页面 ~4d #P0 #UI #前端 @Codex 2026-03-29
  - [x] `Live` 页显示 active run / current action / recent events
  - [x] `Context` 页显示 `inbound / preferred / final`
  - [x] `Context` 页显示 `raw / compressed / derived`
  - [x] `Context` 页显示 `rawTail / incremental / baselines[]`
  - [x] `Prompt` 页显示 `messages + systemPromptAddition`
  - [x] `Prompt` 页显示 sidecar 与 prompt-visible 内容的区别
  - [x] 前台壳重做为 `Agent Debug Workbench`，不再沿旧 overview/runtime 大首页继续扩展
  - [x] `Live` 页当前动作按 snapshot + diagnostics 做 P0 近似态，后续再切换到正式 timeline/current-action 服务

- [ ] TODO 9：建立 OpenClaw 联调与压缩效果验证基线 ~2d #P0 #验证 #openclaw @Codex 2026-03-31
  - [ ] 打包并安装 `compact-context` 插件到 OpenClaw
  - [ ] 短会话验证 `compressionMode=none`
  - [ ] 中等长度会话验证 `incremental`
  - [ ] 长会话验证 `full + baseline list + rollup`
  - [ ] 记录 `context occupancy / final message count / rawTail / baselineCount`
  - [ ] 记录 sidecar 命中与 rollback / evict 情况

- [ ] TODO 10：P1 收尾与增强项整理 ~3d #P1 #收口 @Codex 2026-04-03
  - [ ] 评估 `ignore / stateless session patterns`
  - [ ] 评估 pairing sanitize 是否要升级成 assemble 前清洗
  - [ ] 评估更细粒度 `message parts` 是否值得进入下一轮
  - [ ] 把 P0 联调结论回写到文档 / smoke / AGENTS 之一

## 执行顺序建议

建议严格按下面顺序推进：

1. `TODO 3`
2. `TODO 4`
3. `TODO 5`
4. `TODO 6`
5. `TODO 7`
6. `TODO 8`
7. `TODO 9`
8. `TODO 10`

原因是：

- contract 不定，后面 explain / inspect / UI 都会漂
- 压缩主链没稳，先做监控意义不大
- 没有 diagnostics 和 fallback，OpenClaw 联调会很难排障

## 当前不排进 P0 的事项

这几项先不进这轮 TODO 主链：

- 完整 `summary DAG`
- 通用 `message_parts archive` 全量重构
- delegated expansion grant / token cap
- repair / rewrite / transplant 工作台
- 全局知识图谱治理台

## 完成标准

这份 TODO 这一轮算完成，至少要满足：

1. 压缩主链已经切到 `baseline list + rollup`
2. explain / inspect 已能看出压缩动作
3. `Live / Context / Prompt` 页面可直接观察上下文
4. 插件已经装进 OpenClaw 跑过短会话和长会话
5. 能对比出压缩前后的上下文占比与消息规模变化
