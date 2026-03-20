# Agent Workbench 平台重构 TODO

这份 TODO 用来跟踪“把现有平台壳重构成 Agent Workbench，并以 P0 上下文监控优先”为主线的执行情况。

相关文档：
- 总方案：[agent-workbench-platform-rebuild-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/agent-workbench-platform-rebuild-plan.zh-CN.md)
- Runtime Context Window contract：[runtime-context-window-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-context-window-contract.zh-CN.md)
- Prompt Assembly contract：[prompt-assembly-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/prompt-assembly-contract.zh-CN.md)
- Runtime Snapshot Persistence：[runtime-snapshot-persistence.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-snapshot-persistence.zh-CN.md)
- Dashboard Observability contracts：[dashboard-observability-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/dashboard-observability-contracts.zh-CN.md)
- 控制台改造 TODO：[console-improvement-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/console-improvement-todo.zh-CN.md)
- 当前执行真源：[context-engine-compression-and-observability-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-engine-compression-and-observability-todo.zh-CN.md)

## 当前关系说明

当前阶段这份文档主要承担“平台上层路线图”职责，不作为 `P0 上下文监控 + OpenClaw 联调` 的日常执行真源。

如果目标是：

- 先把 `Live / Context / Prompt` 做出来
- 先验证上下文压缩效果
- 先完成 OpenClaw 插件联调

则以 [context-engine-compression-and-observability-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-engine-compression-and-observability-todo.zh-CN.md) 为准；这份文档只保留平台级依赖、后续扩展和更完整的 Workbench 路线。

当前重叠映射固定为：

1. 平台 `TODO 1 / TODO 2` 中 `PromptAssemblySnapshot` 相关项
   已由压缩与观测 TODO 的 `TODO 7` 完成最小版
2. 平台 `TODO 6`
   与压缩与观测 TODO 的 `TODO 8` 指向同一批 `Live / Context / Prompt` P0 页面
3. 平台 `TODO 8`
   与压缩与观测 TODO 的 `TODO 9` 指向同一批 OpenClaw 联调与 smoke

## 待办

- [ ] TODO 1：固定 P0 共享 contract 与事件模型 ~2d #P0 #架构 #后端 @Codex 2026-03-20
  - [ ] 在 `packages/contracts` 增加 `AgentRunEvent`
  - [ ] 增加 `AgentCurrentAction`
  - [ ] 增加 `ContextWorkbenchReadModel`
  - [x] 增加 `PromptAssemblySnapshot`
    已由压缩与观测 TODO 的 `TODO 7` 完成最小版；这里后续只补平台级事件/读模型衔接
  - [ ] 增加 `GraphWorkbenchReadModel` 最小版
  - [ ] 增加对应 fixture / contract test

- [ ] TODO 2：补 Runtime Plane 事件发射与只读快照出口 ~3d #P0 #runtime #后端 @Codex 2026-03-22
  - [ ] 在 `context-engine-adapter` 收口 `assemble / prompt build / tool / compact / afterTurn` 事件
  - [x] 产出 `PromptAssemblySnapshot`
    已由压缩与观测 TODO 的 `TODO 7` 完成最小版；这里后续只补 runtime event / runtime_subgraph 出口
  - [ ] 产出 `runtime_subgraph` 最小查询出口
  - [ ] 保持 `assemble.final -> runtime snapshot -> transcript` 真相源优先级不变
  - [ ] 补回归，确保 explain / inspect 不漂移

- [ ] TODO 3：补 Control Plane read-model 与查询服务 ~3d #P0 #control-plane #后端 @Codex 2026-03-24
  - [ ] 新增 `context-workbench-service`
  - [ ] 新增 `timeline-service`
  - [ ] 新增 `graph-workbench-service`
  - [ ] 新增 `current-action-service`
  - [ ] 收口 `current action / context / prompt / timeline / graph` 查询面

- [ ] TODO 4：补 REST / SSE API 与 client contract ~2d #P0 #api #control-plane @Codex 2026-03-25
  - [ ] 增加 `GET /api/live/agents`
  - [ ] 增加 `GET /api/runs/:runId/context`
  - [ ] 增加 `GET /api/runs/:runId/messages`
  - [ ] 增加 `GET /api/runs/:runId/prompt`
  - [ ] 增加 `GET /api/runs/:runId/graph?mode=runtime_subgraph`
  - [ ] 增加 `GET /api/runs/:runId/timeline`
  - [ ] 增加 `GET /api/stream/live`

- [ ] TODO 5：重做 P0 Workbench Shell 与主导航 ~3d #P0 #UI #前端 @Codex 2026-03-27
  - [ ] 建立 `Live / Context / Prompt / Graph / Timeline / Observability` 主导航
  - [ ] 建立全局 `Runtime Bar`
  - [ ] 建立 `QuickFilterBar`
  - [ ] 建立统一 `DetailDrawer`
  - [ ] 建立页面级 loading / empty / error 状态

- [ ] TODO 6：落地 Live / Context / Prompt 三个 P0 页面 ~4d #P0 #UI #前端 @Codex 2026-03-29
  当前以压缩与观测 TODO 的 `TODO 8` 作为执行真源；这里保留为完整 Workbench 视角下的页面定义。
  - [ ] `Live` 页支持 active agents、current action、recent steps、alerts
  - [ ] `Context` 页支持 `inbound / preferred / final` compare
  - [ ] `Context` 页支持 `raw / compressed / derived` 分层
  - [ ] `Prompt` 页支持 `Logical View`
  - [ ] `Prompt` 页支持 `Provider Payload View`
  - [ ] 页面间对象联动到 `DetailDrawer`

- [ ] TODO 7：补 runtime subgraph 与 timeline drilldown 第一轮 ~3d #P0 #UI #图谱 @Codex 2026-03-31
  - [ ] `Graph` 页显示 `runtime_subgraph`
  - [ ] included / omitted / recalled 节点可视化
  - [ ] `Timeline` 页显示 step 卡片与耗时
  - [ ] message / graph / timeline 联动高亮
  - [ ] 右侧显示 provenance / raw evidence / related message

- [ ] TODO 8：建立 OpenClaw 插件联调与 smoke baseline ~2d #P0 #验证 #openclaw @Codex 2026-04-01
  当前以压缩与观测 TODO 的 `TODO 9` 作为执行真源；这里保留为平台总体验收口径。
  - [ ] 打包并安装 `compact-context` 插件到 OpenClaw
  - [ ] 跑短会话，验证 `compressionMode=none`
  - [ ] 跑长会话，验证 `incremental` 压缩路径
  - [ ] 跑超阈值场景，验证 `full` 重压缩路径
  - [ ] 记录插件前后 `context occupancy / final message count / rawTail` 对比

- [ ] TODO 9：补 P1 图谱 / trace / drilldown 深化 ~4d #P1 #图谱 #trace @Codex 2026-04-04
  - [ ] 图谱节点支持 trace drilldown
  - [ ] `omitted / superseded / suppressed / summary_only` 可视化
  - [ ] checkpoint / delta / skill lineage 查看
  - [ ] 历史回放与本轮对比第一版

- [ ] TODO 10：补 P2 平台扩展位与后续模块骨架 ~1w #P2 #平台 #扩展 @Codex 2026-04-11
  - [ ] `Governance` 模块入口骨架
  - [ ] `Import` 模块入口骨架
  - [ ] `Evaluation` 模块入口骨架
  - [ ] `Knowledge / Workspace / Platform` 模块入口骨架
  - [ ] 模块注册与扩展位 contract 稳定化

## 进行中

当前还未进入代码实现，下一条默认从 `TODO 1` 开始。

## 已完成

- [x] 输出 Agent Workbench 平台重构总方案 #文档 #架构 @Codex 2026-03-19
  - [x] 明确 Runtime / Control / UI 边界
  - [x] 明确 P0 上下文监控优先
  - [x] 明确事件模型、read-model、API、阶段安排

- [x] 补 UI / UX 设计方案 #文档 #UI @Codex 2026-03-19
  - [x] 明确主导航与工作台布局
  - [x] 明确 P0 页面与线框建议
  - [x] 明确可借鉴的成熟方案与实现方向

## 执行顺序建议

推荐严格按这个依赖顺序推进：

1. `contract`
2. `runtime event / snapshot`
3. `read-model`
4. `API / SSE`
5. `UI shell`
6. `P0 页面`
7. `OpenClaw 联调`
8. `P1 / P2 扩展`

原因是：

- 如果先做 UI，很快会变成临时拼 payload
- 如果先做 API 但 contract 没定死，后面很容易全线返工
- 如果不上 OpenClaw 真机场景，压缩效果无法验证

## P0 出口验收

P0 完成后，至少要满足下面这些条件：

1. 能实时看到 `currentAction`
2. 能看到 `inbound / preferred / final`
3. 能看到 `systemPromptAddition` 和最终 payload preview
4. 能看到 `contextOccupancyRatio`
5. 能看到 `compressionMode / compressionReason / rawTail`
6. 能看到 `runtime_subgraph`
7. 能看到关键 step timeline
8. 插件装进 OpenClaw 后能完成短会话、长会话、超阈值三类联调

## 当前暂缓

P0 阶段默认不先做：

- 全局大图浏览
- 图谱写入式编辑器
- 复杂权限系统
- 全量治理工作台
- 全量导入平台
- 自动自治建议闭环

## 一句话总结

`这份 TODO 以“先把上下文监控做出来，再把 compact-context 插件装进 OpenClaw 做真实调试”为主线，先收 contract、事件、read-model、API 和 P0 页面，再向图谱、trace 和平台扩展位推进。`
