# 阶段 4 TODO
本清单用于跟踪阶段 4 第一轮落地工作。当前判断：`TODO 1-8 已全部完成`，阶段 4 第一轮已经收口。

相关文档：
- 当前状态：[stage-4-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-status.zh-CN.md)
- 第一轮总结：[stage-4-first-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-first-pass-report.zh-CN.md)
- 评估基座：[stage-4-evaluation-harness.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-evaluation-harness.zh-CN.md)
- 历史准备文档：[stage-4-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-prework.zh-CN.md)
- 准备度审查：[stage-4-readiness-review.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-readiness-review.zh-CN.md)
- 总体路线图：[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)
- TODO 模板：[todo-template.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/todo-template.zh-CN.md)

## 待办
- [ ] 第一轮已收口；后续工作请转到 [stage-4-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-second-pass-todo.zh-CN.md)。

## 进行中
- [ ] 暂无。

## 已完成
- [x] TODO 8: 接入最小 `Topic / Concept` 模型与阶段 4 第一轮验收 ~4d #架构 #文档 2026-04-08
  - [x] 接入最小 `Topic / Concept` 数据模型，但不让主题层主导主链
  - [x] 在 compiler diagnostics 中保留 `topicHints`
  - [x] 在 explain 中输出“topic-aware recall hint”的保留原因
  - [x] 输出阶段 4 第一轮状态文档与总结报告

- [x] TODO 7: 做第一轮 skill merge / retire 原型 ~3d #后端 #记忆 2026-04-03
  - [x] 落相似 `skill candidate` 的 merge 规则
  - [x] 明确 retire / decay 对 recall 与 explain 的影响
  - [x] 把 memory lifecycle 和 persistence trace 串起来
  - [x] 补 merge / retire fixture 与 SQLite round-trip 回归

- [x] TODO 6: 扩高价值 relation 到 recall 主链 ~4d #后端 #架构 2026-03-31
  - [x] 在 relation production contract 稳定后接入 `requires / next_step / overrides`
  - [x] 为新增 relation 明确 recall eligibility / priority / confidence
  - [x] 让 diagnostics / explain 能说明 relation contribution
  - [x] 补 relation-aware recall 第二轮回归与 topic hint 回归

- [x] TODO 5: 落阶段 4 evaluation harness ~3d #测试 #评估 2026-03-27
  - [x] 定义 relation recall precision / recall / noise 指标
  - [x] 定义 long-memory usefulness / intrusion 指标
  - [x] 定义 bundle quality / explain completeness / retrieval cost 指标
  - [x] 准备 representative transcript / relation / memory fixture
  - [x] 接入 `test:evaluation`

- [x] TODO 4: 落 scope promotion policy 第一轮 ~3d #后端 #治理 2026-03-24
  - [x] 定义 `session -> workspace -> global` 升级条件
  - [x] 定义 higher-scope write gate 与 recall precedence
  - [x] 明确 higher-scope fallback policy 与 explain 输出
  - [x] 补 scope promotion fixture 与最小回归

- [x] TODO 3: 落长期记忆生命周期第一轮 ~4d #后端 #记忆 2026-03-21
  - [x] 定义 `promotion / merge / retire / decay` 最小合同
  - [x] 明确 `SkillCandidate -> Skill` 的升级条件
  - [x] 给 checkpoint / skill candidate 补生命周期字段与策略读取点
  - [x] 补 memory lifecycle explain 与回归测试

- [x] TODO 2: 落 relation retrieval 与 explain 成本控制 ~3d #后端 #架构 2026-03-18
  - [x] 明确 relation retrieval 的 batch / adjacency lookup 策略
  - [x] 为 `compile()` 和 explain 补最小成本口径与回退路径
  - [x] 评估 SQLite / GraphStore 的索引与批量读取改造点
  - [x] 补 relation retrieval / explain 成本回归 fixture

- [x] TODO 1: 收敛 relation production contract 与 recall 白名单 ~3d #后端 #架构 2026-03-15
  - [x] 明确当前稳定生成的 relation 清单
  - [x] 区分 `recall_eligible / explain_only / governance_only`
  - [x] 定义 edge priority / confidence / freshness 的最小治理口径
  - [x] 输出阶段 4 第一轮 relation whitelist 与接入顺序

- [x] 启动阶段 4 TODO 并对齐前置文档 #文档 2026-03-13
  - [x] 基于 `stage-4-prework` 与准备度审查整理任务主线
  - [x] 按统一 TODO 模板收敛成待办 / 进行中 / 已完成结构
  - [x] 将阶段 4 TODO 挂到文档索引入口

