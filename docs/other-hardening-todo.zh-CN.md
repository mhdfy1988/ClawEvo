# 其他专项攻坚 TODO
本清单用于整理“除上下文处理之外”仍需要继续攻坚的主线，重点覆盖长期记忆治理、多跳 recall、高 scope 复用、多来源入图、人工校正和专项观测。

相关文档：
- 上下文处理攻坚：[context-processing-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing-hardening-todo.zh-CN.md)
- 总攻坚路线图：[hardening-master-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/hardening-master-roadmap.zh-CN.md)
- 多跳 recall 方案：[multi-hop-recall-and-path-explain-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/multi-hop-recall-and-path-explain-plan.zh-CN.md)
- 跨任务记忆复用：[cross-task-memory-reuse-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/cross-task-memory-reuse-plan.zh-CN.md)
- 知识晋升合同：[knowledge-promotion-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge-promotion-contract.zh-CN.md)
- Topic / Concept / Skill 融合：[topic-concept-skill-fusion-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/topic-concept-skill-fusion-plan.zh-CN.md)
- 人工校正与观测：[observability-human-in-the-loop-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/observability-human-in-the-loop-plan.zh-CN.md)

## 待办
- [ ] TODO 4: 落高 scope 记忆治理与跨任务复用第二轮 ~5d #后端 #scope @Codex 2026-03-18
  - [ ] 明确 `session / workspace / global` 的写入门槛与提升条件
  - [ ] 控制 higher-scope fallback 的噪音与污染边界
  - [ ] 让 workspace/global 记忆复用有更清晰的 admission 与 explain
  - [ ] 补跨任务场景的回归与评估
- [ ] TODO 5: 落多来源知识图谱输入 ~6d #后端 #图谱 @Codex 2026-03-19
  - [ ] 新增文档入图主链：README / 设计文档 / 规范文档 / issue 摘要
  - [ ] 设计代码与仓库结构入图最小模型：`Repo / Module / File / API / Command`
  - [ ] 设计结构化输入入图最小模型：JSON / 配置 / 报告 / CI 产物
  - [ ] 明确人工整理知识的准入方式，不只停在 alias correction
- [ ] TODO 6: 落人工校正产品化与知识维护入口 ~4d #后端 #治理 @Codex 2026-03-20
  - [ ] 让人工校正不只覆盖 concept alias，还能覆盖 promotion / suppression / rule fix
  - [ ] 为 correction 增加更清晰的 authoring、rollback、audit trace
  - [ ] 让 correction 能回流到图谱与评估链
  - [ ] 为人工维护知识的最小入口补文档和测试
- [ ] TODO 7: 落观测与专项评估矩阵第二轮 ~4d #测试 #观测 @Codex 2026-03-21
  - [ ] 将多跳 recall、知识晋升、高 scope 复用、多来源入图纳入统一评估视图
  - [ ] 增加趋势指标，而不只是单轮测试通过/失败
  - [ ] 增加“知识污染率 / recall 噪音率 / 记忆复用收益”指标
  - [ ] 输出专项状态文档与阶段报告
- [ ] TODO 8: 完成其他专项攻坚验收与收口 ~2d #文档 #验收 @Codex 2026-03-22
  - [ ] 校正 README、路线图、索引与调试文档
  - [ ] 收敛“已实现 / 半实现 / 未实现”的专项能力边界
  - [ ] 给后续阶段留下明确承接项

## 进行中
- [ ] TODO 3: 落多跳 recall 与路径裁决深化 ~5d #后端 #召回 @Codex 2026-03-17
  - [ ] 把 path budget / pruning / ranking 做成可配置策略
  - [ ] 扩更多受控 relation path，但保持白名单治理
  - [ ] 让 explain 输出路径为什么被选中、为什么被剪枝
  - [ ] 为多跳噪音、路径漂移、成本失控补 fixture

## 已完成
- [x] TODO 1: 收敛多来源知识与长期治理的整体边界 #架构 @Codex 2026-03-15
  - [x] 明确哪些专项属于“上下文处理之外的主攻线”
  - [x] 明确与 `context-processing-hardening-todo` 的分工边界
  - [x] 固定优先级：长期记忆治理 -> 多跳 recall -> 高 scope 复用 -> 多来源入图 -> 人工校正 -> 观测评估
  - [x] 为后续实现拆出稳定文档入口
- [x] TODO 2: 落长期记忆与知识晋升治理第二轮 ~5d #后端 #记忆 @Codex 2026-03-16
  - [x] 收敛 `Attempt -> Episode -> Pattern -> Skill / Rule / Process` 的统一晋升门槛
  - [x] 补齐 downgrade / retire / decay / rollback 的生命周期规则
  - [x] 区分“失败经验”“局部流程”“稳定技能”“硬约束候选”的准入边界
  - [x] 让 explain 与全局提升判断能直接展示污染风险与晋升理由
