# 目录架构重构第一轮

这份文档用于收敛阶段 6 `TODO 7` 第一轮已经落地的目录分层方案。

相关代码：
- [runtime/index.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/index.ts)
- [context-processing/index.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/index.ts)
- [governance/index.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/index.ts)
- [infrastructure/index.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/infrastructure/index.ts)
- [index.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/index.ts)
- [index.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/index.ts)
- [layer-boundaries.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/layer-boundaries.test.ts)

## 1. 一句话目标
`第一轮重构不重写主链，而是先把分层入口建出来，让 runtime / context-processing / governance / infrastructure / adapters 有正式边界。`

## 2. 新的分层入口
当前已经新增：

```text
src/
  runtime/
  context-processing/
  governance/
  infrastructure/
  adapters/
```

### 2.1 `src/runtime`
承载：
- `ContextEngine`
- `IngestPipeline`
- `ContextCompiler`
- `AuditExplainer`
- `CheckpointManager`
- `SkillCrystallizer`
- `experience-learning`

### 2.2 `src/context-processing`
承载：
- parser
- concept normalizer
- noise policy
- semantic spans
- semantic classifier
- node materializer
- summary planner
- context-processing pipeline

### 2.3 `src/governance`
承载：
- governance
- relation contract
- knowledge promotion
- manual corrections
- memory lifecycle
- scope policy

### 2.4 `src/infrastructure`
承载：
- graph store
- sqlite graph store
- context persistence
- tool-result artifact store

### 2.5 `src/adapters`
承载：
- OpenClaw adapter 边界
- transcript loader
- tool-result policy
- hook coordinator

## 3. 为什么这一轮不直接大搬家
第一轮刻意没有把旧文件全部 physically move 走，原因是：
- 当前 runtime 主链已经稳定
- 直接大规模 move 风险高
- 现有 import 路径很多，贸然全改会把阶段 6 变成纯工程消耗

所以这一轮的策略是：

`先建新边界入口 + 保留旧路径兼容`

## 4. 第一轮的收获
这一轮之后，项目已经可以清晰地区分：
- 运行时主链
- 上下文处理能力
- 治理能力
- 基础设施能力
- 适配层能力

这对后面的几件事特别重要：
- control plane service 继续长大
- 导入平台接入
- Web UI / console 承接
- 真正 move 文件时不迷路

## 5. 兼容策略
当前兼容策略是：
1. 旧路径继续可用
2. 新路径开始作为推荐边界
3. root export 暂不强行只走新层级
4. 通过 [layer-boundaries.test.ts](/d:/C_Project/openclaw_compact_context/src/tests/layer-boundaries.test.ts) 保证新边界可导入

## 6. 当前边界
第一轮已经完成：
- 新层级目录
- 分层入口
- 兼容保留
- 基础回归

第一轮还没做：
- 大规模 move 旧文件
- 清理旧路径 import
- root export 收紧
- 按目录重写测试布局

## 7. 对阶段 6 的意义
`TODO 7` 第一轮完成后，项目已经不再是“所有能力继续堆进 src/core”，而是正式进入了分层演进状态。`

