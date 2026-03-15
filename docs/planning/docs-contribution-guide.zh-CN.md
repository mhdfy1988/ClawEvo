# Docs Contribution Guide

这份文档约定以后新增或修改文档时的基本规则。

## 1. 命名规则

### 中文主文档
统一使用：

`<topic>.zh-CN.md`

例如：
- `runtime-context-window-contract.zh-CN.md`
- `governance-workflow-runbook.zh-CN.md`

### 目录 README
统一使用：

`README.md`

## 2. 放置规则

### `docs/architecture/`
- 核心设计
- 图谱架构
- provenance / schema / traceability

### `docs/context-processing/`
- runtime context
- prompt assembly
- snapshot persistence
- 上下文处理链路

### `docs/control-plane/`
- governance / observability / import
- service contract
- API matrix
- workflow runbook

### `docs/integrations/`
- 宿主接入
- hook / gateway / stdio

### `docs/knowledge/`
- experience learning
- knowledge promotion
- recall / skill / memory

### `docs/operations/`
- 调试
- 观测
- 排障

### `docs/planning/`
- 路线图
- 模板
- 跨阶段 TODO
- 文档治理

### `docs/references/`
- 外部参考
- 调研纪要

### `docs/stages/`
- 阶段 TODO / 状态 / 总结

## 3. 链接规则

- 文档内统一使用绝对文件路径链接
- 新增文档后，至少检查：
  - [documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)
  - [README.md](/d:/C_Project/openclaw_compact_context/README.md)

## 4. 更新优先级

如果变更属于：

### 设计边界变化
优先同步：
- `architecture/`
- `context-processing/`
- `control-plane/`

### 阶段状态变化
优先同步：
- `docs/stages/`
- `README.md`
- `documentation-index.zh-CN.md`

### 调试入口变化
优先同步：
- `operations/gateway-debug-usage.zh-CN.md`
- `integrations/openclaw-native-plugin.zh-CN.md`

## 5. 不建议的做法

- 把阶段总结写进主设计稿
- 把外部参考直接混进阶段 TODO
- 新增文档后不挂索引
- 同一概念在多个文档里使用不同名字
