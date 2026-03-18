# Workspace Test Ownership

这份文档把当�?`tests` 的测试归属固定下来，避免 package、app、smoke、evaluation 再次混回同一层�?
相关文档�?- [workspace-test-and-release-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-and-release-boundary.zh-CN.md)
- [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md)

## 当前分组

### package unit

- `package:contracts`
  - `context-processing-contracts.test.ts`
- `package:runtime-core`
  - `audit-explainer.test.ts`
  - `concept-normalizer.test.ts`
  - `context-processing-experience.test.ts`
  - `context-processing-harness.test.ts`
  - `context-processing-pipeline.test.ts`
  - `experience-learning.test.ts`
  - `ingest-and-compiler.test.ts`
  - `knowledge-promotion.test.ts`
  - `manual-corrections.test.ts`
  - `multi-source-ingest.test.ts`
  - `noise-policy.test.ts`
  - `semantic-spans.test.ts`
  - `summary-planner.test.ts`
  - `utterance-parser.test.ts`
- `package:compact-context-core`
  - `control-plane-services.test.ts`
  - `observability-report.test.ts`
- `package:openclaw-adapter`
  - `context-engine-adapter.test.ts`
  - `hook-coordinator.test.ts`
  - `tool-result-artifact-store.test.ts`
  - `tool-result-policy.test.ts`
  - `transcript-loader.test.ts`
- `package:control-plane-shell`
  - `control-plane-server.test.ts`

### app integration

- `app:openclaw-plugin`
  - `openclaw-plugin-app.test.ts`
- `app:control-plane`
  - `control-plane-app.test.ts`

### root smoke

- `smoke:required`
  - `workspace-smoke.test.ts`
  - `layer-boundaries.test.ts`
- `smoke:release`
  - `workspace-smoke.test.ts`
  - `layer-boundaries.test.ts`
  - `debug-smoke.test.ts`

### evaluation

- `evaluation`
  - `evaluation-harness.test.ts`

## 当前边界

当前边界约束是：

- package tests
  - 不再依赖 root 固定 `dist`
  - 统一�?run-scoped 编译目录
  - 只验证各�?workspace 的共享行�?- app tests
  - 只验证薄壳入口、依赖、manifest 和壳层导�?  - 不重复覆�?runtime/core 细节
- root smoke
  - 只保留跨 workspace 的边界验�?  - `required` 不包�?`debug-smoke`
  - `release` 可以包含 `debug-smoke + pack:workspace`
- evaluation
  - 保持独立，不并入 package/app/smoke

## 哪些测试必须保留�?root

当前仍必须保留在 root 的测试只有这几类�?
- `workspace-smoke.test.ts`
  - 用来做跨 workspace 的发布与编排验收
- `layer-boundaries.test.ts`
  - 用来做跨层依赖方向约�?- `debug-smoke.test.ts`
  - 用来做发布前调试面回�?- `evaluation-harness.test.ts`
  - 用来�?repo 级评估基�?
这些测试的共同特征是：它们天然跨多个 workspace，或者直接服务于 repo-level 验收，而不是单个包壳�?
## 新增 root 测试的规�?
后面如果要往 `tests` �?root smoke / evaluation 再新增测试，应该先回答一句话�?
`为什么这条测试不能下沉到 package unit �?app integration？`

如果答不上来，就不应该新增到 root 级�?
