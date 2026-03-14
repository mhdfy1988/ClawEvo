# Topic / Concept / Skill 长期融合方案

配套阅读：
- [layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/layered-knowledge-graph-architecture.zh-CN.md)
- [stage-4-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-status.zh-CN.md)
- [stage-5-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-5-prework.zh-CN.md)

## 1. 当前基线

当前系统已经有：

- 最小 `Topic / Concept` 节点
- `topicHints`
- bilingual concept normalization

但它们仍然只是：

- 受控 hint
- explain / diagnostics 辅助层

还不是主 bundle admission 层。

## 2. 阶段 5 要解决什么

### 2.1 什么时候从 hint 升到 admission 候选

建议至少要求：

- concept 命中稳定
- 有明确 evidence 支撑
- 不会和当前 session 事实冲突

### 2.2 Topic / Concept 与 Skill 如何建模

建议职责分开：

- `Topic`
  - 问题域和主题簇
- `Concept`
  - 统一术语和规范化概念
- `Skill`
  - 长期可复用能力

不建议让概念层直接替代技能层。

### 2.3 如何避免重复建模

建议保持：

- Concept 负责“这是什么”
- Skill 负责“怎么做”
- Topic 负责“属于哪个问题域”

## 3. 关系建议

可以预留：

- `Skill -> applies_to -> Topic`
- `Skill -> uses_concept -> Concept`
- `Concept -> belongs_to -> Topic`

但不建议第一批就强制大量产边。

## 4. Admission 边界

建议阶段 5 仍然保持：

- Topic / Concept 默认不直接压过 Goal / Constraint / Risk
- 只在证据充分、路径清晰时进入主 bundle
- 大部分情况下仍以 hint / explain 形式存在

## 5. 一句话结论

`Topic / Concept / Skill 的融合不该走“概念替代技能”，而应该走“概念帮技能归一、主题帮技能组织”的路线。`
