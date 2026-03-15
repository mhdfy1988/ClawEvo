# 项目拆分迁移报告

## 本轮完成内容

### 1. 共享 contract 抽离

- `runtime context / prompt assembly` 抽到共享类型层
- `logger contract` 抽到共享类型层

关键文件：
- [runtime-context.ts](/d:/C_Project/openclaw_compact_context/src/types/runtime-context.ts)
- [logging.ts](/d:/C_Project/openclaw_compact_context/src/types/logging.ts)

### 2. 插件与平台解除直接互引

- 插件侧：
  - [control-plane-bridge.ts](/d:/C_Project/openclaw_compact_context/src/plugin/control-plane-bridge.ts)
- 平台侧：
  - [control-plane-runtime-bridge.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/control-plane-runtime-bridge.ts)

### 3. `src/core` 主实现迁出

迁移结果：
- `src/context-processing/*`
- `src/runtime/*`
- `src/governance/*`
- `src/infrastructure/*`

`src/core/*` 现在只保留兼容 shim。

### 4. workspace 壳子建立

新增：
- `apps/openclaw-plugin`
- `apps/control-plane`
- `packages/contracts`
- `packages/runtime-core`
- `packages/control-plane-core`

### 5. 构建与验收

新增：
- workspace smoke test
- GitHub Actions CI
- root `exports` / `workspaces` / workspace scripts

## 目录映射

### 上下文处理

- `src/core/concept-normalizer.ts` -> [src/context-processing/concept-normalizer.ts](/d:/C_Project/openclaw_compact_context/src/context-processing/concept-normalizer.ts)
- `src/core/context-processing-pipeline.ts` -> [src/context-processing/context-processing-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/context-processing/context-processing-pipeline.ts)
- `src/core/semantic-spans.ts` -> [src/context-processing/semantic-spans.ts](/d:/C_Project/openclaw_compact_context/src/context-processing/semantic-spans.ts)

### 运行时

- `src/core/ingest-pipeline.ts` -> [src/runtime/ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/src/runtime/ingest-pipeline.ts)
- `src/core/context-compiler.ts` -> [src/runtime/context-compiler.ts](/d:/C_Project/openclaw_compact_context/src/runtime/context-compiler.ts)
- `src/core/audit-explainer.ts` -> [src/runtime/audit-explainer.ts](/d:/C_Project/openclaw_compact_context/src/runtime/audit-explainer.ts)

### 治理

- `src/core/governance.ts` -> [src/governance/governance.ts](/d:/C_Project/openclaw_compact_context/src/governance/governance.ts)
- `src/core/knowledge-promotion.ts` -> [src/governance/knowledge-promotion.ts](/d:/C_Project/openclaw_compact_context/src/governance/knowledge-promotion.ts)
- `src/core/relation-contract.ts` -> [src/governance/relation-contract.ts](/d:/C_Project/openclaw_compact_context/src/governance/relation-contract.ts)

### 基础设施

- `src/core/context-persistence.ts` -> [src/infrastructure/context-persistence.ts](/d:/C_Project/openclaw_compact_context/src/infrastructure/context-persistence.ts)
- `src/core/graph-store.ts` -> [src/infrastructure/graph-store.ts](/d:/C_Project/openclaw_compact_context/src/infrastructure/graph-store.ts)
- `src/core/sqlite-graph-store.ts` -> [src/infrastructure/sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/src/infrastructure/sqlite-graph-store.ts)

## 验证

- `npm run check`
- `npm test`
- `npm run test:evaluation`
- `npm run test:smoke:workspace`
