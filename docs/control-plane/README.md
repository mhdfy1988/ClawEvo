# Control Plane 文档说明

这个目录放平台控制面的文档，重点回答：

- governance / observability / import 三类 service 如何对外暴露
- control plane 和 runtime plane 的边界是什么
- 人工治理、审计、回滚和 import job 怎么运行
- dashboard 指标和告警怎么解释

适合放在这里的文档：
- service contract
- API / gateway method matrix
- governance workflow runbook
- import source spec
- observability metrics dictionary

推荐先看：
1. [control-plane-service-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-service-contracts.zh-CN.md)
2. [control-plane-api-matrix.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-api-matrix.zh-CN.md)
3. [governance-workflow-runbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/governance-workflow-runbook.zh-CN.md)
4. [import-source-spec.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/import-source-spec.zh-CN.md)
5. [observability-metrics-dictionary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/observability-metrics-dictionary.zh-CN.md)

不建议放在这里的内容：
- 宿主插件接入说明
- 上下文解析算法细节
- 阶段状态 / 阶段总结
