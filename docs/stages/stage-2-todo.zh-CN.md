# 阶段 2 收尾 TODO

本清单用于跟踪阶段 2 的收尾任务。当前 `TODO 1 -> TODO 4` 已按顺序完成，阶段 2 已收口；后续新增事项请转入 [阶段 3 治理主线 TODO](/d:/C_Project/openclaw_compact_context/docs/stages/stage-3-todo.zh-CN.md)。

相关文档：
- 阶段状态: [stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-2-status.zh-CN.md)
- 阶段出口: [stage-2-exit-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-2-exit-report.zh-CN.md)
- 执行计划: [stage-2-execution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-2-execution-plan.zh-CN.md)
- 阶段 3 TODO: [stage-3-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-3-todo.zh-CN.md)
- TODO 模板: [todo-template.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/todo-template.zh-CN.md)

## 待办

- [x] 阶段 2 收尾项已全部完成，新增工作请转入 [阶段 3 治理主线 TODO](/d:/C_Project/openclaw_compact_context/docs/stages/stage-3-todo.zh-CN.md)

## 进行中

- [x] 当前无进行中的阶段 2 收尾项

## 已完成

- [x] TODO 1: 补齐 `tool_result_persist` 的裁剪原因 explain ~1d #后端 2026-03-13
  - [x] explain 输出 `policyId`
  - [x] explain 输出压缩触发原因
  - [x] explain 输出 `droppedSections`
  - [x] explain 输出 `artifact / sourcePath / sourceUrl / rawSourceId` 回查信息
  - [x] 为 compressed tool result 增加 explain 回归测试
  - [x] 更新调试文档示例

- [x] TODO 2: 补 artifact sidecar 的真实落盘与回查闭环 ~3d #后端 2026-03-18
  - [x] 增加 artifact store
  - [x] 约定 artifact 文件命名和存储目录
  - [x] 压缩时将超长正文真正落盘
  - [x] 在 metadata / explain 中保留稳定回查路径
  - [x] 定义最小生命周期和清理策略
  - [x] 增加 artifact sidecar 单测和降级回查测试

- [x] TODO 3: 提升 compressed tool result 结构字段的直接消费 ~2d #后端 2026-03-20
  - [x] 更充分消费 `keySignals`
  - [x] 更充分消费 `affectedPaths`
  - [x] 更充分消费 `error`
  - [x] 更充分消费 `truncation`
  - [x] 让结构化字段更直接驱动 `Risk / State / Tool / Evidence`
  - [x] 为结构化字段补 fixture 和回归测试

- [x] TODO 4: 补阶段 2 指标、阶段总结与出口验收 ~2d #文档 2026-03-22
  - [x] 定义阶段 2 最小指标
  - [x] 补阶段 2 完成度对照
  - [x] 形成阶段总结文档
  - [x] 明确哪些项结束于阶段 2、哪些保留到阶段 3
  - [x] 同步更新状态文档和索引文档

- [x] 整理阶段 2 收尾 TODO 初版 #文档 2026-03-13

- [x] 补 TODO 模板并接入文档索引 #文档 2026-03-13

