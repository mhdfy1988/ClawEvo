# 其他专项攻坚能力边界

这份文档用于收口“上下文处理之外的其他专项攻坚”，给出当前已经做到哪里、哪些仍然只是受控版本、哪些还没有进入主链，以及下一阶段应该如何承接。

相关文档：
- [other-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/other-hardening-todo.zh-CN.md)
- [hardening-master-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/hardening-master-roadmap.zh-CN.md)
- [stage-5-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-second-pass-status.zh-CN.md)
- [stage-5-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-second-pass-report.zh-CN.md)

## 当前结论

当前“其他专项攻坚”已经完成第二轮收口，项目已经具备：

- 更成熟的长期记忆与知识晋升治理
- 受控多跳 recall 与路径裁决
- `session / workspace / global` 的高 scope 复用边界
- 多来源知识图谱输入的最小主链
- 人工校正进入 compiler / explain / gateway / evaluation
- 统一的 observability snapshot / trend / report

但它们仍然不是“无限扩展的通用平台”，当前形态更准确地说是：

`已进入主链、可解释、可评估、可治理，但仍保持白名单与受控边界。`

## 已实现

### 1. 长期记忆与知识晋升治理

已经具备：
- `Attempt -> Episode -> Pattern -> Skill / Rule / Process` 的统一晋升判断
- `downgrade / retire / decay / rollback` 的主链规则
- `failure_experience / local_procedure / stable_skill / hard_constraint_candidate` 分类
- explain 可直接显示污染风险与晋升理由

对应代码：
- [knowledge-promotion.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/knowledge-promotion.ts)
- [memory-lifecycle.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/memory-lifecycle.ts)
- [experience-learning.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/experience-learning.ts)

### 2. 多跳 recall 与路径裁决

已经具备：
- 受控 2-hop 以上路径扩展
- `path budget / pruning / ranking`
- explain 输出路径选中与裁剪原因
- evaluation fixture 覆盖路径噪音、预算与漂移

对应代码：
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
- [evaluation-harness.ts](/d:/C_Project/openclaw_compact_context/src/evaluation/evaluation-harness.ts)

### 3. 高 scope 记忆治理与跨任务复用

已经具备：
- `session / workspace / global` 的提升与 fallback 规则
- 弱失败模式限制在低 scope
- `workspace` 成功流程复用与 `global` 受控 fallback
- explain 可显示 scope fallback 与 admission 理由

对应代码：
- [scope-policy.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/scope-policy.ts)
- [knowledge-promotion.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/knowledge-promotion.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)

### 4. 多来源知识图谱输入

已经具备最小入图主链：
- 文档类实体：`Document`
- 仓库结构类实体：`Repo / Module / File / API / Command`
- 结构化输入可通过 source-entity materialization 进入图谱

对应代码：
- [source-entity-materializer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/source-entity-materializer.ts)
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
- [evaluation-harness-fixtures.ts](/d:/C_Project/openclaw_compact_context/src/tests/fixtures/evaluation-harness-fixtures.ts)

### 5. 人工校正与可观测性

已经具备：
- alias / promotion / suppression / rule fix 的持久化校正
- correction rollback 与 trace
- gateway 侧 authoring 与 list 能力
- observability snapshot / trend / report
- second-pass 评估矩阵：污染率、噪音率、复用收益、多来源覆盖率

对应代码：
- [manual-corrections.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/manual-corrections.ts)
- [observability-report.ts](/d:/C_Project/openclaw_compact_context/src/evaluation/observability-report.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

## 半实现

### 1. 多跳 recall 仍是受控策略

当前不是通用图搜索引擎，也不是学习型路径发现器。

现在有：
- 白名单 relation path
- 显式预算
- 明确 explain

还没有：
- 任意深度搜索
- 自动学习路径模板
- 长路径上的自适应裁决

### 2. `global` 写入治理仍偏规则化

当前已经能受控晋升到 `global`，但还没有：
- 成熟的审批流
- 更细粒度的人机协同放行
- 面向团队/组织级的治理策略

### 3. 人工校正已进入主链，但还不是完整产品界面

当前有工程入口和 gateway 调试入口，但还没有：
- 可视化编辑器
- 成批审批与审阅面板
- 更友好的历史 diff 与恢复界面

### 4. observability 已可输出阶段报告，但还不是 dashboard

当前已有：
- snapshot
- trend
- report formatter

但还没有：
- 持续展示界面
- 时序对比面板
- 人工治理与质量趋势联动视图

## 未实现

### 1. 通用平台化治理层

还没有真正做成：
- 产品化人工治理平台
- 审批式 `global` 知识写入
- 长期运行的观测后台

### 2. 更自由的知识输入编排

当前多来源输入还是最小主链，尚未做到：
- 完整的文档 ingestion workflow
- 代码仓库批量扫描入图平台
- CSV / JSON / 报告的独立导入器

### 3. 更成熟的学习型 recall

当前 recall 仍由规则、预算和 relation policy 主导，尚未做到：
- 自动路径发现
- 基于历史收益的动态路径排序
- 更开放的探索式召回

## 后续承接项

下一阶段更适合接的，不是再开一轮“补零散功能”，而是围绕平台化与产品化收敛：

1. 平台化人工治理
   - correction authoring UI
   - 审批与回滚面板
   - 团队级知识维护流程

2. 更成熟的高 scope 治理
   - `global` 准入审批
   - 跨 workspace 共享策略
   - 长期知识冲突治理

3. dashboard 级 observability
   - 趋势面板
   - 质量回归告警
   - recall / memory / promotion 联动视图

4. 更完整的多来源入图平台
   - 文档批量导入
   - 仓库结构扫描
   - 结构化输入标准化导入

## 一句话总结

`其他专项攻坚已经把长期记忆治理、多跳 recall、高 scope 复用、多来源入图、人工校正和 observability 收到了“可用且可治理”的状态；下一阶段该从能力补齐转向平台化与产品化。`



