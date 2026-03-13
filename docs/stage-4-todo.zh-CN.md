# 阶段 4 TODO
本清单用于跟踪阶段 4 第一轮落地工作，重点围绕 `relation recall 扩边 -> 长期记忆治理 -> scope 升级边界 -> 评估基座` 推进。

相关文档：
- 当前状态：[stage-3-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-3-status.zh-CN.md)
- 阶段 3 第二轮总结：[stage-3-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-3-second-pass-report.zh-CN.md)
- 阶段 4 前置事项：[stage-4-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-prework.zh-CN.md)
- 阶段 4 准备度审查：[stage-4-readiness-review.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-readiness-review.zh-CN.md)
- 阶段 4 评估基座：[stage-4-evaluation-harness.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-evaluation-harness.zh-CN.md)
- 总体路线图：[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)
- 多层知识图谱架构：[layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/layered-knowledge-graph-architecture.zh-CN.md)
- TODO 模板：[todo-template.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/todo-template.zh-CN.md)

## 待办

- [ ] TODO 7: 做第一轮 skill merge / retire 原型 ~3d #后端 #记忆 2026-04-03
  - [ ] 试做相似 skill candidate 的 merge 规则
  - [ ] 明确 retire / decay 对 recall 与 explain 的影响
  - [ ] 把 memory lifecycle 和 persistence trace 串起来
  - [ ] 补 merge / retire fixture 与 SQLite round-trip 回归

- [ ] TODO 8: 接最小 Topic / Concept 模型与阶段 4 第一轮验收 ~4d #架构 #文档 2026-04-08
  - [ ] 只做最小 `Topic / Concept` 数据模型，不让主题层主导主链
  - [ ] 预留 topic-aware recall 的 explain 接口
  - [ ] 更新阶段状态、路线图、索引和 README
  - [ ] 输出阶段 4 第一轮总结与出口条件

## 进行中

- [ ] TODO 6: 扩高价值 relation 到 recall 主链 ~4d #后端 #架构 2026-03-31
  - [ ] 在 relation production contract 稳定后接入 `requires / next_step / overrides`
  - [ ] 为新增 relation 明确 recall eligibility / priority / confidence
  - [ ] 让 diagnostics / explain 能说明 relation contribution
  - [ ] 补 relation-aware recall 第二轮回归与 debug 快照

## 已完成

- [x] TODO 5: 落阶段 4 evaluation harness ~3d #测试 #评估 2026-03-27
  - [x] 定义 relation recall precision / recall / noise 指标
  - [x] 定义 long-memory usefulness / intrusion 指标
  - [x] 定义 bundle quality / explain completeness / retrieval cost 指标
  - [x] 准备 representative transcript / relation / memory fixture
  - [x] 接入 `test:evaluation`、评估报告格式化和文档入口

- [x] TODO 4: 落 scope promotion policy 第一轮 ~3d #后端 #治理 2026-03-24
  - [x] 定义 `session -> workspace -> global` 升级条件
  - [x] 定义 higher-scope write gate 与 recall precedence
  - [x] 明确 higher-scope fallback policy 与 explain 输出
  - [x] 补 scope promotion fixture 与最小回归

- [x] TODO 3: 落长期记忆生命周期第一轮 ~4d #后端 #记忆 2026-03-21
  - [x] 定义 `promotion / merge / retire / decay` 最小合同
  - [x] 明确 `SkillCandidate -> Skill` 的升级条件
  - [x] 给 checkpoint / skill candidate 补第一轮生命周期字段或策略读取点
  - [x] 补 memory lifecycle explain 与回归测试

- [x] TODO 2: 落 relation retrieval 与 explain 成本控制 ~3d #后端 #架构 2026-03-18
  - [x] 明确 relation retrieval 的 batch / cache / adjacency lookup 策略
  - [x] 为 `compile()` 和 explain 补最小成本口径与回退路径
  - [x] 评估 SQLite / GraphStore 的索引与批量读取改造点
  - [x] 补 relation retrieval / explain 成本回归 fixture

- [x] TODO 1: 收敛 relation production contract 与 recall 白名单 ~3d #后端 #架构 2026-03-15
  - [x] 明确当前稳定生成的 relation 清单
  - [x] 区分 `recall_eligible / explain_only / governance_only` 三类边
  - [x] 定义 edge priority / confidence / freshness 的最小治理口径
  - [x] 为阶段 4 第一轮输出 relation whitelist 与接入顺序

- [x] 启动阶段 4 TODO 并对齐前置文档 #文档 2026-03-13
  - [x] 基于 `stage-4-prework` 和准备度审查整理任务主线
  - [x] 按统一 TODO 模板收敛成待办 / 进行中 / 已完成结构
  - [x] 将阶段 4 TODO 挂到文档索引入口
