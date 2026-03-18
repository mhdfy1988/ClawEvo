# 观测、人工校正与可选 LLM Extractor 边界方案

配套阅读：
- [stage-4-evaluation-harness.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-evaluation-harness.zh-CN.md)
- [stage-5-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-prework.zh-CN.md)
- [context-processing-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/context-processing-contracts.zh-CN.md)

## 1. 目标

这份文档用于收敛阶段 5 的三条平台边界：

- 长期观测
- 人工校正
- 可选 LLM extractor

## 2. 观测范围

建议长期 dashboard 最小只覆盖：

- relation recall precision / noise
- context-processing coverage
- experience learning coverage
- bundle intrusion / omission
- high-scope memory hit rate

先不建议上来就做大而全可视化平台。

## 3. 人工校正入口

建议只允许人工校正下面这些对象：

- concept alias
- promotion decision
- memory retirement
- pattern validation state

不建议人工直接改原始 evidence。

### 3.1 回滚要求

人工校正至少要有：

- operator
- changedAt
- before / after
- rollbackRef

## 4. 可选 LLM Extractor 的边界

LLM extractor 只适合做增强：

- 复杂长句 clause 提示
- 长文档结构辅助
- pattern clustering 辅助

LLM extractor 不应该直接接管：

- 原文 evidence
- 主 parser
- 主 bundle compiler
- provenance 真相层

## 5. Evidence-first 约束

无论是人工还是 LLM 增强，都必须保证：

- 不覆盖原始 evidence
- 不绕过 provenance
- 不直接改写主图谱真相层

## 6. 一句话结论

`阶段 5 的平台增强要遵守一个原则：观测可以更强，人工可以纠偏，LLM 可以辅助，但都不能越过 Evidence-first 和可追溯主链。`

