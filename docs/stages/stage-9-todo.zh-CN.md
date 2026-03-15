# 阶段 9 TODO

这份清单用于跟踪阶段 9 的“开放平台与更高阶自治优化”工作。

当前判断：
`阶段 9 已完成第一轮收口。`

相关文档：
- [stage-8-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-todo.zh-CN.md)
- [openclaw-runtime-context-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/openclaw-runtime-context-strategy.zh-CN.md)
- [control-plane-service-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-service-contracts.zh-CN.md)
- [open-platform-first-pass.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/open-platform-first-pass.zh-CN.md)

## 待办
- [x] TODO 1: 开放插件与 importer 生态第一轮 ~2w #平台 #生态 @Codex 2026-05-28
  - [x] importer / governance / observability plugin registry
  - [x] capability manifest 与版本协商
  - [x] 第三方 provider-neutral extension contract
  - [x] 开放扩展的测试与签名状态

- [x] TODO 2: 知识平台自治优化第一轮 ~2w #知识 #智能 @Codex 2026-06-03
  - [x] 自动 threshold tuning 候选
  - [x] import / recall / promotion 的自适应策略建议
  - [x] 低风险自动化治理建议
  - [x] 人工确认前的模拟执行与预估影响

- [x] TODO 3: 全局知识治理第二轮 ~2w #知识 #治理 @Codex 2026-06-10
  - [x] 更成熟的 `global` 审批 / 合并 / 冲突调解
  - [x] workspace / global 知识隔离与共享策略
  - [x] 知识污染恢复与批量回滚工具
  - [x] 长周期 `decay / retire / refresh` 策略

- [x] TODO 4: 平台级多工作区能力 ~2w #平台 #运维 @Codex 2026-06-17
  - [x] workspace catalog
  - [x] 多工作区 authority / isolation policy
  - [x] import / governance / dashboard 的多工作区聚合
  - [x] workspace policy 与 platform event 联动

- [x] TODO 5: 开放 API 与生态集成 ~2w #API #集成 @Codex 2026-06-24
  - [x] 外部系统接入 control-plane API
  - [x] webhook / event stream
  - [x] 平台级 SDK / client
  - [x] 平台事件与控制面路由测试

- [x] TODO 6: 阶段 9 验收与长期路线收口 ~1w #文档 #规划 @Codex 2026-07-01
  - [x] 输出阶段 9 状态页
  - [x] 输出阶段 9 总结页
  - [x] 更新阶段目录入口
  - [x] 为阶段 10 / 长期路线保留承接点

## 本轮目标
- 把控制面从“项目内控制台”推进成“可扩展、可接入、可自治优化”的开放平台。
- 让扩展注册、自治建议、全局治理、多工作区和平台事件形成同一张平台能力图。

## 一句话结论
`阶段 9 的重点不是重写运行时主链，而是让已经完成的 Runtime Plane + Control Plane 具备开放平台能力。`
