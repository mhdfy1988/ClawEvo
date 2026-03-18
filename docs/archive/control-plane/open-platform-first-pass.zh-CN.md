# 开放平台第一轮

这份文档说明阶段 9 为 Control Plane 新增的开放平台能力。

## 范围
阶段 9 新增的重点是：
- extension registry
- autonomy recommendations
- global governance recovery
- workspace catalog
- platform events / webhooks
- control-plane client

## 关键模块
- 扩展注册表：[extension-registry.ts](/d:/C_Project/openclaw_compact_context/packages/compact-context-core/src/extension-registry.ts)
- 自治建议：[autonomy-service.ts](/d:/C_Project/openclaw_compact_context/packages/compact-context-core/src/autonomy-service.ts)
- 多工作区目录：[workspace-catalog-service.ts](/d:/C_Project/openclaw_compact_context/packages/compact-context-core/src/workspace-catalog-service.ts)
- 平台事件：[platform-event-service.ts](/d:/C_Project/openclaw_compact_context/packages/compact-context-core/src/platform-event-service.ts)
- 外部 client：[client.ts](/d:/C_Project/openclaw_compact_context/packages/control-plane-shell/src/client.ts)
- HTTP server：[server.ts](/d:/C_Project/openclaw_compact_context/packages/control-plane-shell/src/server.ts)

## 开放扩展
平台通过 host manifest 声明：
- `apiVersion`
- `platformVersion`
- `providerNeutral`
- `capabilities`

extension manifest 声明：
- 扩展类型
- 来源
- 版本
- 所需能力
- 签名状态

当前第一轮仍然以“注册 / 列出 / 协商”为主，不直接执行第三方扩展代码。

## 自治建议
自治服务当前输出两类结果：
- recommendation bundle
- simulation result

这条线的目标不是让平台自动修改知识，而是：
- 先识别可以优化的地方
- 再模拟潜在影响
- 最后仍然保留人工治理边界

## 多工作区视角
多工作区服务会把三类输入聚合在一起：
- import jobs
- governance proposals
- dashboard snapshots

然后形成：
- workspace catalog
- workspace aggregate view
- isolation / authority policy

## 平台事件
第一轮平台事件覆盖：
- extension registration
- governance mutation
- observability snapshot
- import job lifecycle
- workspace policy save
- autonomy recommendation generation

事件目前既可直接查询，也可通过简单 webhook subscription 观察。

## 当前边界
阶段 9 仍然坚持：
- 不把平台做成 provider payload assembler
- 不让 control plane 直接替代 runtime plane
- 不让外部扩展直接越过治理边界写底层库

开放平台只是建立在现有 runtime + control-plane 合同之上的扩展层。
