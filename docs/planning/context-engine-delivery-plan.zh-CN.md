# OpenClaw Context Engine 实施拆分与验收清单

参照总设计：
- [context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-design-v2.zh-CN.md)

## 1. 这份文档解决什么问题

这份文档把 v2 设计稿进一步拆成：

- 里程碑
- 功能任务
- 技术落点
- 依赖关系
- 验收标准

目标不是继续讨论“应该做什么”，而是明确“先做什么、做到什么算完成”。

## 2. 当前基线

截至当前仓库状态，已经具备的能力：

- OpenClaw 原生插件入口
- `context-engine` slot 接入
- provenance 主链
- transcript JSONL 导入与当前叶子分支恢复
- SQLite 图谱持久化
- `checkpoints / deltas / skill_candidates` 持久化
- `before_compaction / after_compaction` hook 协同
- `tool_result_persist` 源头治理
- `assemble()` 中的早期历史压缩
- `recentRawMessageCount` 配置
- bundle diagnostics / selection explain
- `inspect_bundle / query_nodes + explain / queryMatch`
- debug smoke 与 snapshot 回归

因此，后续工作不是“从零开始”，而是在现有可运行骨架上做增强。

## 3. 里程碑总览

### M0 已完成：骨架与闭环

目标：

- 插件能被 OpenClaw 加载
- 可以 ingest、compile、checkpoint、skill crystallize
- 可以用 SQLite 落盘

状态：

- 已完成

### M1 P0：把上下文压缩主链路做稳

目标：

- 让 prompt token 控制更稳定
- 让压缩、checkpoint、skill 沉淀的联动更可靠

### M2 P0：把 transcript 膨胀源头控住

目标：

- 在工具结果写入 transcript 之前就开始减肥
- 避免后面再花更高代价压缩垃圾上下文

### M3 P1：把图谱质量做上来

目标：

- 让规则、流程、约束、状态的识别更准
- 让 bundle 选择更像“裁决”而不是“抓关键词”

### M4 P1：把 skill candidate 真的做成能力沉淀

目标：

- skill 候选不只是“当前 bundle 的镜像”
- 能基于多轮行为和稳定模式打分

### M5 P2：把 explain、评测、运维补齐

目标：

- 可解释
- 可回归
- 可排障

## 4. 工作流分解

## 4.1 工作流 A：Prompt 压缩主链路

目标：

- 真正减少进入模型的原始消息
- 确保压缩时同步沉淀结构化知识

当前实现：

- `assemble()` 已经会压缩较早历史
- 仅保留最近 `recentRawMessageCount` 条非 `system` 原始消息

后续任务：

- A1. 把“按消息条数保留”升级成“按轮次保留”
- A2. 区分 `user / assistant / tool / system` 的保留策略
- A3. 给 `systemPromptAddition` 增加更稳定的预算估算
- A4. 给“是否更新 checkpoint”的判断增加更细粒度阈值
- A5. 在 bundle 中记录“本轮压缩覆盖了多少旧历史”

技术落点：

- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
- [checkpoint-manager.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/checkpoint-manager.ts)

验收标准：

- 长会话下最终 prompt 中的原始消息数量稳定下降
- `systemPromptAddition + trimmed messages` 的估算 token 明显小于未压缩前
- 历史被压缩后，checkpoint 会同步更新
- 同一会话连续 assemble 时不会无意义重复生成 checkpoint

优先级：

- P0

## 4.2 工作流 B：`tool_result_persist` Transcript 瘦身

目标：

- 在 transcript 持久化之前控制超大 tool result

当前状态：

- 已接入 `tool_result_persist` hook
- 超大 tool result 会在写入 transcript 前被压缩
- 压缩结果已带 `compressed / tool_result_persist` provenance
- transcript loader / adapter / ingest 已能识别压缩后结果

剩余任务：

- B5. 给 Explain 接口补充“该 tool result 如何被压缩”的说明
- B6. 增加 artifact sidecar 的真正落盘与回查策略

技术落点：

- [hook-coordinator.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/hook-coordinator.ts)
- [tool-result-policy.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/tool-result-policy.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- [transcript-loader.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/transcript-loader.ts)

验收标准：

- 大体量 tool result 不再完整写入 transcript
- 保留下来的字段足以支撑后续图谱 ingest
- 不会因为裁剪 tool result 导致错误排查失真
- 对同一类 tool result 的压缩行为可重复、可解释

优先级：

- P0

## 4.3 工作流 C：Graph Ingest 质量提升

目标：

- 让图谱从“可跑”提升到“可用”

当前实现：

- 已有 `Evidence + semantic node + supported_by`
- 已识别 `Constraint / Process / Step / Risk / Mode / Outcome / Tool`
- `custom_message / compaction` 已有更细映射
- stable semantic key、dedupe、version 更新已接入

剩余任务：

- C3. 为不同 sourceType 提供专门的 ingest policy
- C4. 增加冲突关系生成
- C5. 让 compressed tool result 的结构字段更直接驱动入图

技术落点：

- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
- [transcript-loader.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/transcript-loader.ts)

验收标准：

- 相同语义记录不会大量重复入图
- 规则与状态的误分类率下降
- custom message / compaction entry 能稳定映射到预期节点类型

优先级：

- P1

## 4.4 工作流 D：Context Compiler 裁决能力增强

目标：

- 让 bundle 选择更像“当前有效知识的裁决”

当前实现：

- 已有分类型预算池
- 已有 `raw-first / compressed-fallback`
- 已有 bundle diagnostics 与 selection explain
- 已有 `inspect_bundle / query_nodes + explain / queryMatch`
- 已有 token-overlap 文本匹配与更稳排序

剩余任务：

- D1. 引入 relationship-aware 选择
- D2. 增强“为什么某段历史没被保留”的 explain
- D3. 让 selection 更直接利用图关系和结构字段

技术落点：

- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)

验收标准：

- 同样 budget 下，bundle 中无关证据明显减少
- 规则与约束比普通 evidence 更稳定地进入 bundle
- explain 结果能说明 selection reason

优先级：

- P1

## 4.5 工作流 E：Checkpoint / Delta 策略增强

目标：

- 让 checkpoint 真正成为会话的结构化记忆锚点

当前实现：

- 已支持 checkpoint 和 delta 的生成与持久化

后续任务：

- E1. 增加 checkpoint 层级策略
- E2. 定义 checkpoint 过期清理和保留策略
- E3. 为 delta 增加语义分类
- E4. 增加“关键 checkpoint”标记
- E5. 增加“由 assemble 触发”与“由 compaction 触发”的来源标记

技术落点：

- [checkpoint-manager.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/checkpoint-manager.ts)
- [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/infrastructure/sqlite-graph-store.ts)

验收标准：

- 长会话里 checkpoint 数量可控
- 可以明确知道某个 checkpoint 由什么路径生成
- delta 能说明结构化变化，而不仅是 id diff

优先级：

- P1

## 4.6 工作流 F：Skill Candidate 演进

目标：

- skill candidate 从“单轮 bundle 摘要”进化成“跨轮稳定模式”

当前实现：

- 已能从当前 bundle 生成 skill candidate

后续任务：

- F1. 引入跨 checkpoint 的频率统计
- F2. 引入稳定性和成功率评分
- F3. 定义 skill 升格阈值
- F4. 区分“候选 skill”与“已固化 skill”
- F5. 记录候选 skill 的冲突和失败信号

技术落点：

- [skill-crystallizer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/skill-crystallizer.ts)
- [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/infrastructure/sqlite-graph-store.ts)

验收标准：

- 相似 bundle 多次出现时，skill candidate 分数会上升
- skill candidate 不会因为单次偶然上下文就快速升格
- 候选 skill 的 evidence refs 可追溯

优先级：

- P1

## 4.7 工作流 G：Hook 生命周期扩展

目标：

- 让插件更完整地跟随 OpenClaw 生命周期

当前实现：

- 已接 `before_compaction / after_compaction`
- 已接 `tool_result_persist`

后续任务：

- G1. 评估 `session_start / session_end`
- G2. 评估 `before_reset`
- G3. 评估 `before_prompt_build` 作为辅助注入，而非主裁剪器

技术落点：

- [hook-coordinator.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/hook-coordinator.ts)
- [types.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/types.ts)

验收标准：

- OpenClaw 侧关键生命周期不会和插件状态失步
- 宿主侧 compaction、reset、session end 都有明确同步策略

优先级：

- P1

## 4.8 工作流 H：Explain 与调试能力

目标：

- 让系统可观察、可定位问题

当前实现：

- 已有 Gateway debug methods
- 已有 selection-aware explain
- 已有 `inspect_bundle`
- 已有 `query_nodes + explain`
- 已有 `queryMatch`
- 已有 debug playbook 和 smoke checklist

后续任务：

- H1. 增加 checkpoint explain
- H2. 增加“为什么这条消息被压掉”的 explain
- H3. 增加 tool-result 压缩 explain

技术落点：

- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
- [context-engine-plugin.ts](/d:/C_Project/openclaw_compact_context/src/plugin/context-engine-plugin.ts)

验收标准：

- 能解释某个节点从哪来
- 能解释某个 bundle 为什么长这样
- 能解释为什么某段历史没进最终 prompt

优先级：

- P2

## 4.9 工作流 I：评测与回归

目标：

- 每次改压缩、图谱、skill 逻辑时都有可验证依据

当前实现：

- 已有单元回归、adapter/explain regression、debug smoke、snapshot smoke
- 已形成一组 `31` 项的测试基线

后续任务：

- I1. 建立规则激活用例集
- I2. 建立流程编排用例集
- I3. 建立 prompt 压缩回归用例
- I4. 建立 skill candidate 回归用例
- I5. 建立 transcript tool-result 膨胀与压缩率回归用例

技术落点：

- 新增 `fixtures/`
- 新增 `smoke-tests/` 或轻量测试脚本

验收标准：

- 至少有一批固定 transcript / message fixtures
- 每次重要策略变更都能复跑回归

优先级：

- P2

## 5. 依赖关系

推荐的依赖顺序：

1. A Prompt 压缩主链路
2. B `tool_result_persist`
3. C Graph Ingest 质量
4. D Context Compiler 增强
5. E Checkpoint / Delta 增强
6. F Skill Candidate 演进
7. H Explain 与调试
8. I 评测与回归

其中最关键的前置关系：

- B 依赖对 transcript 与 provenance 策略先定规则
- D 依赖 C 的节点质量
- F 依赖 E 的 checkpoint 稳定性
- H 依赖 D/E/F 的结构化输出更稳定

## 6. 推荐执行顺序

如果按实际开发来排，我建议这样切：

### Sprint 1

- 完成 A2 / A3 / A4
- 完成 B1 / B2 的策略定义

完成标志：

- prompt 压缩主链路可稳定运行
- 明确哪些 tool result 可安全裁剪

### Sprint 2

- 完成 B3 / B4
- 完成 C1 / C2 / C3

完成标志：

- transcript 膨胀开始被源头控制
- 图谱 ingest 的语义质量明显提升

### Sprint 3

- 完成 D1 / D2 / D3
- 完成 E3 / E5
- 完成 F1 / F2

完成标志：

- bundle 更稳定
- checkpoint / delta 更有语义
- skill candidate 开始体现跨轮模式

### Sprint 4

- 完成 H 系列
- 完成 I 系列
- 视情况补 G 系列扩展

完成标志：

- 系统可解释
- 系统可回归
- 系统可排障

## 7. MVP 完成定义

如果只给一个“阶段性完成标准”，我建议定义为：

1. 长会话下 prompt token 明显下降
2. 压缩后的知识会同步沉淀到 graph / checkpoint
3. 大 tool result 不再无限膨胀 transcript
4. 能解释为什么某些上下文被保留、压缩或丢弃
5. 能看到稳定的 skill candidate 输出

满足这 5 条，整个 Context Engine 就已经从“骨架”进入“可用系统”。



