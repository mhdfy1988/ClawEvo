# 阶段 8 TODO

这份清单用于跟踪阶段 8 的“生产级知识运维与导入平台化”工作。

当前结论：
`阶段 8 已完成，control-plane 已从最小平台能力推进到更接近生产级治理、观测与导入的平台形态。`

相关文档：
- 阶段 7 TODO：[stage-7-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-todo.zh-CN.md)
- 阶段 7 状态：[stage-7-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-7-status.zh-CN.md)
- 阶段 8 状态：[stage-8-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-status.zh-CN.md)
- 阶段 8 总结：[stage-8-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-8-report.zh-CN.md)
- Control Plane 第二轮说明：[control-plane-second-pass.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-second-pass.zh-CN.md)
- 发布检查清单：[control-plane-release-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/control-plane-release-checklist.zh-CN.md)
- 生产 runbook：[control-plane-production-runbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/control-plane-production-runbook.zh-CN.md)

## 待办
- [x] TODO 1: 治理流产品化第二轮
  - [x] 增加审批策略模板
  - [x] 增加批量提案、批量审核与批量回滚
  - [x] 增加冲突提案检测
  - [x] 增加治理变更 diff / preview

- [x] TODO 2: Observability 运维化第二轮
  - [x] 增加 dashboard 历史分页查询
  - [x] 增加阈值策略持久化
  - [x] 增加告警订阅 / 通知输出
  - [x] 增加 release-to-release 回归对比视图

- [x] TODO 3: Source-specific importer 第二轮
  - [x] document importer 深化
  - [x] repo structure importer 深化
  - [x] structured input importer 深化
  - [x] source-specific normalize / dedupe / version 策略

- [x] TODO 4: 知识治理工作台深化
  - [x] concept / alias 管理视图
  - [x] pattern / skill / rule 审核视图
  - [x] import result review 视图
  - [x] runtime snapshot 与治理 trace 联合视图

- [x] TODO 5: 长期运维基线与回归体系
  - [x] control-plane e2e 场景回归
  - [x] import / governance / observability 历史行为覆盖
  - [x] 平台 smoke / release checklist 第一轮
  - [x] 生产 runbook 第一轮文档

- [x] TODO 6: 阶段 8 验收与总结
  - [x] 输出阶段 8 状态页
  - [x] 输出阶段 8 总结页
  - [x] 更新 README、索引和路线图
  - [x] 明确进入阶段 9

## 本轮目标
- 把 control-plane 的治理、观测、导入，从“可演示”推进到“更像生产级”的第二轮形态。
- 让批量化、历史化、告警化和 source-specific importer 都成为正式能力，而不是只存在于单点 helper。

## 一句话结论
`阶段 8 的重点是把 control-plane 从第一代平台雏形推进到更可运维、更可审查、更可回归的生产级知识治理平台。`
