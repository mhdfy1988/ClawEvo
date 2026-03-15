# 阶段 6 平台化方案

这份文档把“平台化”从方向性表述收敛成可执行方案。

当前进度补充：
- TODO 3 已完成最小 control-plane contracts 和 `governance / observability / import` 三类 service。
- TODO 4 已完成第一轮人工治理闭环，并接入 gateway。
- TODO 5 已完成 dashboard contract 和 `compact-context.inspect_observability_dashboard`。
- TODO 6 已完成 import job 第一轮。
- TODO 7 已完成目录分层第一轮。
- TODO 8 已完成第一轮状态与基线更新。

## 1. 一句话定义
这里说的平台化，不是“先做一个后台页面”，而是：

`先把插件之外的治理、观测、导入能力收成稳定 contract 和 service，再把它们组织成 control plane，最后才考虑最小 UI。`

## 2. 为什么不先做页面
如果直接从页面开始，最后很容易变成：
- 页面只是包了一层 debug RPC
- correction、report、import 仍然是一次性命令
- 权限、审批、回滚、审计都没有稳定边界
- UI 直接耦合插件内部实现

所以阶段 6 的顺序必须是：

`contract -> service -> control plane -> UI`

## 3. 四层结构
### 3.1 Contract 层
当前已经固定了三组 contract：
- Governance Contract
- Observability Contract
- Import Contract

它们的目标是让 CLI、Gateway、Control Plane API 和未来 Web UI 说同一种语言。

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
当前已经具备第一轮能力：
- 治理 proposal/approval/apply/rollback
- dashboard contract 查询
- import job 生命周期

但还没有独立进程级 control plane API，这部分应放到下一轮。

### 3.4 UI / Ops 层
未来最小 UI 建议只承接四类页面：
- correction 管理页
- observability 指标页
- import job 页
- explain / trace 检视页

这一层不是阶段 6 第一轮重点，但上层 contract 和 service 都已经按“未来会被 UI 调用”来设计。

## 4. 和当前代码的关系
阶段 6 不是推翻 runtime 主链，而是在其外部长出 control plane。

继续保留为 runtime 主链的核心模块：
- [context-engine.ts](/d:/C_Project/openclaw_compact_context/src/engine/context-engine.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/core/context-compiler.ts)
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/core/ingest-pipeline.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/core/audit-explainer.ts)

阶段 6 真正新增的是：
- contract
- service
- gateway / control-plane 入口
- 目录分层入口

一句话说：

`平台化是在插件主链之外长出控制面，不是把插件主链拆掉重做。`

## 5. 阶段 6 第一轮交付
阶段 6 第一轮已经交付：
1. `Runtime Context Window Contract`
2. `Prompt Assembly Contract`
3. `Runtime Snapshot Persistence`
4. `governance / observability / import` 三个最小 service
5. 人工治理 gateway 闭环
6. dashboard observability contract
7. import job 生命周期
8. 目录分层第一轮入口
9. 第一轮状态页、总结页和能力边界文档

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

`本项目负责 provider-neutral 的上下文处理结果；OpenClaw 或宿主 adapter 负责最终 provider payload 组装。`

## 7. 下一步建议
阶段 6 第一轮已经完成，接下来更合理的是：
- 进入阶段 6 第二轮深化
- 或进入阶段 7 规划

如果继续阶段 6，优先建议：
1. import history / retry / scheduler
2. dashboard 历史查询与趋势
3. 独立 control plane API / facade
4. 更深的目录迁移与 root export 收紧
