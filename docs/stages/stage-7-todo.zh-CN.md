# 阶段 7 TODO

这份清单用于跟踪阶段 7 的“独立 control-plane 与最小控制台”建设。

当前判断：
`阶段 7 已完成，独立 control-plane process、最小 Web console、importer registry 与目录分层第二轮入口已经落地。`

相关文档：
- 阶段 7 状态：[stage-7-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-status.zh-CN.md)
- 阶段 7 总结：[stage-7-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-report.zh-CN.md)
- 平台化方案：[stage-6-platformization-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-6-platformization-plan.zh-CN.md)
- Runtime 上下文策略：[openclaw-runtime-context-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/openclaw-runtime-context-strategy.zh-CN.md)
- Control Plane contracts：[control-plane-service-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-service-contracts.zh-CN.md)
- Control Plane server 第一轮：[control-plane-server-first-pass.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-server-first-pass.zh-CN.md)

## 已完成
- [x] TODO 1: 独立 `control-plane API / process` 第一轮
  - [x] 定义进程级 API surface
  - [x] 从 gateway handler 中抽离稳定 facade adapter
  - [x] 固定 auth / identity / authority 传递模型
  - [x] 明确 runtime plane 与 control plane 的跨进程通信边界

- [x] TODO 2: 最小 Web console 第一轮
  - [x] `governance` 提案列表页
  - [x] `observability` dashboard 页
  - [x] `import jobs` 列表与详情页
  - [x] `runtime snapshot / explain` 检视页

- [x] TODO 3: Source catalog 与 importer registry 第一轮
  - [x] 注册 `document / repo_structure / structured_input` importer
  - [x] 固定 source catalog schema
  - [x] 规范 source-specific parse / normalize / materialize hooks
  - [x] 增加 importer capability inspect 入口

- [x] TODO 4: 调度与作业治理深化
  - [x] 引入 `schedulerPolicy`
  - [x] 增加 `backoff / maxRetry / dead-letter`
  - [x] 增加批量 `run / stop / resume` contract
  - [x] 明确 import history 保留与裁剪策略

- [x] TODO 5: 目录重构第二轮
  - [x] 新增 `src/control-plane/server.ts`、`src/control-plane/console.ts`、`src/control-plane/importer-registry.ts`
  - [x] 通过分层入口暴露 control-plane server / registry
  - [x] 收紧对外 contract 与 facade 入口
  - [x] 补控制面相关回归

- [x] TODO 6: 阶段 7 验收与总结
  - [x] 输出阶段 7 状态页
  - [x] 输出阶段 7 总结页
  - [x] 更新 README、索引和路线图
  - [x] 明确进入阶段 8

## 本轮结果
- 独立 control-plane 进程入口：
  - [openclaw-control-plane.ts](/d:/C_Project/openclaw_compact_context/src/bin/openclaw-control-plane.ts)
- 最小 Web console：
  - [console.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/console.ts)
- HTTP server：
  - [server.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/server.ts)
- importer registry：
  - [importer-registry.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/importer-registry.ts)
- import 第二轮调度治理：
  - [import-service.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/import-service.ts)

## 一句话结论
`阶段 7 的重点已经从“在插件里补 gateway 方法”推进到了“独立 control-plane process + 最小 console + importer registry”的可演示平台层。`
