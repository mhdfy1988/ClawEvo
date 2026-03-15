# Docs Migration Map

这份文档说明本次 `docs/` 目录重排后的映射关系，方便后续查找旧文件和新增文档归位。

## 1. 重排目标

目录重排的目标不是改文档内容，而是把原来平铺的文档按主题归类，减少：
- 同类文档散落
- 阶段文档和设计文档混放
- 新文档不知道该放哪

## 2. 新目录到内容类型的映射

| 目录 | 主要内容 |
|---|---|
| `docs/architecture/` | 主设计、图谱分层、schema/provenance/traceability |
| `docs/context-processing/` | 上下文处理 contract、代码流转、runtime 策略 |
| `docs/control-plane/` | control plane contract、governance、observability、import |
| `docs/integrations/` | OpenClaw 插件、hook、stdio 等宿主接入 |
| `docs/knowledge/` | 经验学习、知识晋升、跨任务记忆、多跳 recall |
| `docs/operations/` | gateway 调试、debug playbook、故障注入 |
| `docs/planning/` | 路线图、交付计划、目录与文档治理 |
| `docs/references/` | 外部参考、讨论纪要、借鉴分析 |
| `docs/stages/` | 阶段 TODO、状态、报告 |

## 3. 典型迁移示例

### 设计稿类
- `context-engine-design-v2.zh-CN.md`
  -> `docs/architecture/`
- `layered-knowledge-graph-architecture.zh-CN.md`
  -> `docs/architecture/`

### 上下文处理类
- `openclaw-runtime-context-strategy.zh-CN.md`
  -> `docs/context-processing/`
- `context-processing-code-flow.zh-CN.md`
  -> `docs/context-processing/`

### Control Plane 类
- `control-plane-service-contracts.zh-CN.md`
  -> `docs/control-plane/`
- `dashboard-observability-contracts.zh-CN.md`
  -> `docs/control-plane/`

### 阶段类
- `stage-6-todo.zh-CN.md`
  -> `docs/stages/`
- `stage-6-first-pass-status.zh-CN.md`
  -> `docs/stages/`

## 4. 以后新增文档怎么放

### 放到 `docs/stages/`
- 文件名是 `stage-N-*`
- 内容主要是阶段任务、阶段状态、阶段报告

### 放到 `docs/planning/`
- 不是某个阶段专属
- 更像跨阶段路线图、治理规则、模板、迁移说明

### 放到 `docs/references/`
- 外部仓库分析
- 外部方案借鉴
- 会议 / 讨论纪要

## 5. 兼容性说明

本次迁移已经同步修复了：
- README 导航
- documentation index
- 文档内部绝对链接

如果后续再调整目录，建议先更新：
- [documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)
- [README.md](/d:/C_Project/openclaw_compact_context/README.md)
