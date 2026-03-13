# Context Engine 路线图：短期目标、中期目标、长期目标

## 1. 文档目标

这份文档不讨论某个单独 feature 先做还是后做，而是回答更关键的问题：

1. 这个项目短期到底要先达成什么结果
2. 中期要把系统推进到什么层级
3. 长期要把它演进成什么形态
4. 每个阶段的出口条件是什么
5. 每个阶段对应的实现路径是什么

也就是说，这份文档的用途是把当前项目从“功能清单驱动”切换成“目标驱动”。

---

## 2. 北极星目标

这个项目的北极星目标不是“做一个更聪明的摘要器”，而是：

`让 OpenClaw 在长会话里持续吸收上下文、持续压缩上下文、持续沉淀结构化记忆，并最终形成可复用的能力图谱。`

拆开来说，它最终要同时满足四件事：

1. 长会话下 token 成本可控
2. 关键目标、约束、流程和证据不丢
3. 历史经验能沉淀成结构化记忆
4. 稳定模式能长成可复用 skill

所以这个系统的长期定位仍然是：

`Context Compiler + Graph Memory + Skill Crystallizer`

---

## 3. 当前项目所处阶段

结合当前仓库状态，项目已经不是从零开始，而是处在：

`骨架已跑通，但距离“可用系统”还有几段关键路要补。`

当前已具备：

- OpenClaw 原生插件接入
- `context-engine` 生命周期接入
- `before_compaction / after_compaction` hook 协同
- `tool_result_persist` 源头治理接入
- transcript JSONL 导入与分支恢复
- SQLite 图谱持久化
- `checkpoint / delta / skill_candidate` 持久化
- `assemble()` 中的早期历史压缩
- provenance 主链基础能力
- 更细粒度的 ingest 语义识别
- compiler 预算池、selection diagnostics 与 provenance-aware 选择
- `inspect_bundle / query_nodes + explain / queryMatch` 调试链
- debug smoke 与 snapshot 回归

这意味着当前最需要的不是“再多加一个点功能”，而是把后续工作组织成分阶段目标。

---

## 4. 三层目标体系

建议把后续路线分成三层：

### 短期目标

把系统从“能跑”推进到“稳定可用”。

### 中期目标

把系统从“稳定可用”推进到“结构化质量明显提升”。

### 长期目标

把系统从“结构化上下文引擎”推进到“真正可复用的记忆与能力系统”。

---

## 5. 短期目标

## 5.1 短期目标定义

短期目标不是追求最强效果，而是先把主链跑稳。

建议短期目标定义为：

`让上下文压缩、图谱沉淀、checkpoint、provenance 和解释能力形成一个稳定闭环。`

这意味着短期内我们最关心的不是“图谱多智能”，而是：

- 压缩后不要丢关键上下文
- 图谱里要分得清原文、压缩、派生
- checkpoint 要能可靠记录稳定状态
- explain 要能说明“为什么是这样”

## 5.2 短期目标的完成定义

满足下面这些条件时，可以认为短期目标完成：

1. 长会话下 prompt token 有稳定下降
2. 压缩后关键目标、约束、流程位置没有明显丢失
3. `raw / compressed / derived` 已经在系统里稳定区分
4. 新旧数据都能被 explain 成功解释
5. checkpoint / delta 能可靠跟随压缩链更新

## 5.3 短期阶段的主要工作

### A. 把压缩链路做稳

目标：

- 让 `assemble()` 的压缩策略更稳定

应完成：

- recent raw tail 策略继续细化
- budget 估算更稳定
- checkpoint 更新阈值更合理

### B. 把 provenance 链打透

目标：

- 让所有上下文对象都能区分原文、压缩、派生

应完成：

- loader / adapter / hook / ingest 全链路 provenance
- SQLite 落盘
- 历史数据回填
- compiler 使用 provenance 选择
- explain 输出 provenance

### C. 把 explain 做到够用

目标：

- 至少能回答：
  - 这条知识从哪来
  - 它是 raw 还是 compressed
  - 为什么被选进 bundle

### D. 建立最小回归检查

目标：

- 后续改压缩逻辑时不至于把系统改坏

应完成：

- 若干固定 transcript/message fixture
- 至少覆盖 compile / checkpoint / provenance / explain 的 smoke check

## 5.4 短期目标对应的系统能力

短期目标完成后，系统应该具备这样的能力：

```text
能稳定压缩
能稳定入图
能稳定沉淀 checkpoint
能稳定区分 raw/compressed/derived
能基础 explain
```

一句话说：

`短期目标是把它做成“稳定可用的上下文系统”，不是“最强上下文系统”。`

---

## 6. 中期目标

## 6.1 中期目标定义

中期目标是在短期闭环稳定的前提下，提升结构化质量和决策质量。

建议定义为：

`让图谱质量、上下文裁决质量和 transcript 源头治理能力显著提升。`

也就是说，中期要解决的不是“有没有闭环”，而是“闭环输出够不够准、够不够值”。

## 6.2 中期目标的完成定义

满足下面这些条件时，可以认为中期目标完成：

1. tool result 膨胀开始在写 transcript 前就被控制
2. 图谱对 `Rule / Constraint / Process / State / Risk` 的识别质量明显提升
3. bundle 选择更像裁决，而不是简单关键词排序
4. checkpoint 不只是 id 快照，而是更接近结构化阶段状态
5. explain 能回答“为什么某条历史没被保留”

## 6.3 中期阶段的主要工作

### A. 接入 `tool_result_persist`（已完成）

目标：

- 从源头减轻 transcript 膨胀

应完成：

- 明确定义 tool result 裁剪白名单
- 保留 provenance
- 可解释“裁剪了什么、为什么能裁”

### B. 提升 ingest 语义质量（已完成）

目标：

- 不再只依赖粗粒度 role 映射

应完成：

- 更细粒度识别 `Constraint / Process / Step / Risk`
- custom message / compaction entry 更细映射
- 去重与版本更新策略更完善

### C. 提升 compiler 的裁决能力（已完成）

目标：

- 让 bundle 选择更接近“当前生效知识”

应完成：

- 规则、约束、证据、状态分预算池
- 优先级更清晰
- relationship-aware 选择逐步接入

### D. 提升 explain 的反向能力（已完成）

目标：

- 不只是解释“选了什么”
- 还要能解释“没选什么、为什么”

当前状态：

- `inspect_bundle / query_nodes + explain / explain(selectionContext)` 已经可用
- provenance、selection diagnostics、queryMatch 已接入调试链
- 剩余重点是“为什么某段历史没保留”与 `tool_result_persist` 裁剪原因解释

## 6.4 中期目标对应的系统能力

中期目标完成后，系统应该具备这样的能力：

```text
能稳定压缩
+ 能从源头治理 transcript 膨胀
+ 能较准确识别规则/约束/流程/风险
+ 能更像裁决器而不是摘要器
+ 能解释选择与未选择
```

一句话说：

`中期目标是把它做成“高质量的上下文治理系统”。`

---

## 7. 长期目标

## 7.1 长期目标定义

长期目标不是继续无限堆压缩策略，而是让系统具备真正的长期记忆和能力沉淀能力。

建议定义为：

`让 Context Engine 从上下文治理层，演进成可复用的项目记忆与能力系统。`

## 7.2 长期目标的完成定义

满足下面这些条件时，可以认为长期方向已经成立：

1. skill candidate 不再是单轮 bundle 镜像，而是跨轮稳定模式
2. checkpoint 形成分层记忆，而不是单层快照堆积
3. 图谱开始承载冲突、覆盖、版本与时效
4. 支持更强的检索、解释和长期复用
5. 可以把稳定模式反哺后续新任务，而不是只服务当前 session

## 7.3 长期阶段的主要工作

### A. skill crystallization 升级

目标：

- skill 候选从“当前会话总结”升级为“跨多轮可复用能力”

应完成：

- 频率统计
- 稳定性评分
- 成功率 / 冲突率度量
- skill 升格与淘汰机制

### B. checkpoint 分层化

目标：

- 支持短期 / 中期 / 长期记忆层

### C. 图谱关系增强

目标：

- 真正表达：
  - `conflicts_with`
  - `supersedes`
  - `overrides`
  - `requires`
  - `next_step`

### D. 检索增强

目标：

- 在本地检索能力不够时，引入更强的 FTS / rerank / embedding 增强层

注意：

- 这仍应是增强层，不是主链替代层

### E. 跨任务复用

目标：

- 从单 session 沉淀走向 workspace / global 级别复用

## 7.4 长期目标对应的系统能力

长期目标完成后，系统应该具备这样的能力：

```text
能治理当前上下文
+ 能保留长期结构化记忆
+ 能发现并复用稳定能力模式
+ 能把历史经验反哺未来任务
```

一句话说：

`长期目标是把它做成“上下文记忆与能力沉淀平台”。`

---

## 8. 推荐阶段划分

为了更实际地推进，建议把三层目标再落成四个阶段。

## 阶段 1：稳定闭环

对应：

- 短期目标前半段

重点：

- provenance 主链
- 压缩闭环
- checkpoint 同步
- explain 基础可用

完成标志：

- 能稳定区分 `raw / compressed / derived`
- 长会话压缩有效
- explain 不再是黑盒

## 阶段 2：源头治理 + 结构提升

对应：

- 短期目标后半段 + 中期目标前半段

重点：

- `tool_result_persist`
- ingest 质量提升
- compiler 预算与优先级优化

完成标志：

- transcript 膨胀从源头可控
- bundle 质量明显提高

## 阶段 3：裁决增强 + 记忆增强

对应：

- 中期目标后半段

重点：

- relation-aware selection
- checkpoint 语义增强
- explain 反向能力

完成标志：

- 系统更像裁决引擎，而不是压缩器

## 阶段 4：能力沉淀平台

对应：

- 长期目标

重点：

- skill 演进
- 记忆分层
- graph 关系增强
- workspace/global 级复用

完成标志：

- 系统开始具备真正的长期复用价值

---

## 9. 每个阶段的出口条件

## 阶段 1 出口

- provenance 完整接入主链
- raw/compressed/derived 区分稳定
- assemble 压缩有效
- checkpoint 能可靠跟随
- explain 能说明来源

## 阶段 2 出口

- tool result 膨胀受控
- ingest 质量提升
- bundle 里无关信息明显减少
- provenance 与压缩策略能一起解释

## 阶段 3 出口

- compiler 具备更强裁决能力
- checkpoint 不只是快照堆积
- explain 能解释“为什么没选”

## 阶段 4 出口

- skill candidate 具备跨轮稳定性
- 形成层次化记忆
- 可以把经验反哺未来任务

---

## 10. 实施时应该遵守的节奏

后续实现建议坚持这三条节奏原则：

### 原则 1：先闭环，再智能

先把链路跑稳，再提升抽取和裁决精度。

### 原则 2：先主链，再增强层

主链必须本地稳定可控，外部 API 只能增强，不要反客为主。

### 原则 3：先目标，再 feature

任何新 feature 都要先回答：

- 它服务的是短期目标、中期目标，还是长期目标
- 如果不服务阶段目标，就先不做

---

## 11. 当前建议

结合现在的代码状态，我建议项目当前明确站在：

`阶段 2 已完成收口，当前进入阶段 3 准备阶段`

原因是：

- `tool_result_persist` 已接入并在主链生效
- artifact sidecar、structured ingest、selection explain 已形成闭环
- explain / inspect_bundle / query_nodes + explain / queryMatch 调试链已经成型
- 当前最需要推进的，不再是阶段 2 收尾，而是阶段 3 的增强项：
  - 历史未保留原因 explain
  - 更强的关系感知检索和排序
  - 阶段指标自动采集
  - 长期记忆与技能沉淀增强

也就是：

`下一步不是继续补阶段 2，而是开始阶段 3 规划。`

当前更细的完成度盘点见：
[stage-2-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-2-status.zh-CN.md)

---

## 12. 一句话总结

后续推进这个项目，最重要的不是问“下一个最该做的功能是什么”，而是先问：

`我们现在是要把系统做稳、做准，还是做成长期能力平台？`

只有先明确短期、中期、长期目标，功能优先级才会自然排出来，系统也才不会陷入“哪里看起来重要就先补哪里”的碎片化推进。
