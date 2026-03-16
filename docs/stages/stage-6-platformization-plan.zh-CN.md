# 阶段 6 平台化方案

这份文档把“平台化”从方向性表述收敛成可执行方案。

当前进度补充：
- 阶段 6 第一轮已完成最小 control-plane contracts 和 `governance / observability / import` 三类 service。
- 阶段 6 第二轮已完成：
  - import history / retry / rerun / scheduler
  - dashboard snapshot history 与趋势 contract
  - `control-plane-facade`
  - runtime snapshot 与治理/观测/导入联动
  - root export 第一轮收紧
  - 第二轮状态、总结与基线更新

## 1. 一句话定义
这里说的平台化，不是“先做一个后台页面”，而是：

`先把插件之外的治理、观测、导入能力收成稳定 contract 和 service，再把它们组织成 control plane，最后才考虑最小 UI。`

## 2. 为什么不先做页面
如果直接从页面开始，最后很容易变成：
- 页面只是包了一层 debug RPC
- correction、report、import 仍然是一组零散命令
- 审批、回滚、审计和 authority 边界都不稳定
- UI 直接耦合插件内部实现

所以阶段 6 的顺序必须是：
`contract -> service -> control plane -> UI`

## 3. 四层结构

### 3.1 Contract 层
当前已经固定了三组 contract：
- Governance Contract
- Observability Contract
- Import Contract

它们的目标是让：
- gateway
- future control-plane API
- future Web UI
- runtime engine

都说同一种语言。

### 3.2 Service 层
当前已经落地：
- `governance-service`
- `observability-service`
- `import-service`

这些 service 的共同原则是：
- 可独立测试
- 有稳定输入输出
- 不绕过 runtime engine 直接写库

### 3.3 Control Plane 层
当前已经具备两轮能力：
- 治理 `proposal / approval / apply / rollback`
- dashboard contract 查询
- dashboard snapshot history
- import job 生命周期
- import history / retry / rerun / schedule / runDueJobs
- `control-plane-facade`

但还没有独立进程级 control plane API，这部分应放到后续阶段。

### 3.4 UI / Ops 层
未来最小 UI 建议只承接四类页面：
- correction 管理页
- observability 指标页
- import job 页
- explain / trace 检视页

这一层不是阶段 6 的主目标，但上层 contract 和 service 已经按“未来会被 UI 调用”来设计。

## 4. 和当前代码的关系
阶段 6 不是推翻 runtime 主链，而是在其外部长出 control plane。

继续保留为 runtime 主链的核心模块：
- [context-engine.ts](/d:/C_Project/openclaw_compact_context/src/engine/context-engine.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)

阶段 6 真正新增的是：
- contract
- service
- `control-plane-facade`
- gateway / control-plane 入口
- 目录分层入口

一句话说：
`平台化是在插件主链之外长出控制面，不是把插件主链拆掉重做。`

## 5. 阶段 6 交付
阶段 6 第一轮与第二轮已经交付：
1. `Runtime Context Window Contract`
2. `Prompt Assembly Contract`
3. `Runtime Snapshot Persistence`
4. `governance / observability / import` 三个最小 service
5. `control-plane-facade`
6. 人工治理 gateway 闭环
7. dashboard observability contract 与 history contract
8. import job 第一轮与第二轮治理能力
9. 目录分层入口与 root export 第一轮收紧
10. 两轮状态页、总结页和能力边界文档

## 6. 外部参考带来的约束
结合外部参考仓库：
- `graph-memory`
- `memory-lancedb-pro`
- `openclaw-control-center`

阶段 6 已经固定了这条优先级：
- `graph-memory`：上下文处理主链主参考
- `memory-lancedb-pro`：局部 hook / recall / noise filter 参考
- `openclaw-control-center`：控制面和只读观察参考

同时保留我们的边界：

`本项目负责 provider-neutral 的上下文处理结果，OpenClaw 或宿主 adapter 负责最终 provider payload 组装。`

## 7. 下一步建议
阶段 6 第一轮与第二轮都已完成，接下来更合理的是：
- 进入阶段 7 规划
- 或单独起控制台 / control-plane 进程化路线图

如果继续深化，优先建议：
1. 独立 control-plane API / process
2. Web UI / console
3. 更成熟的 importer 与 source catalog
4. 更深的目录迁移与内部 API 收敛


