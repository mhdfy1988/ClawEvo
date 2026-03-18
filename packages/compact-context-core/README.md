# Compact Context Core Package

Compact Context 内部业务核心入口，不包含 `server`、`console` 和 app 壳子。

- 源码入口：`packages/compact-context-core/src/index.ts`
- 推荐导入：`@openclaw-compact-context/compact-context-core`
- 目标内容：`governance`、`observability`、`import`、`extension`、`workspace`、`platform event`、`facade`
- 当前状态：已经切到 package-local `src/*`，由 `packages/control-plane-shell`、`apps/openclaw-plugin` 和其它上层入口消费
- 默认装配入口：`createCompactContextCore()`
- 导出约束：只保留聚合根入口，不再推荐也不再暴露逐文件子路径导入
- 边界约束：上层 app/CLI 需要上下文运行时能力时，优先通过 `@openclaw-compact-context/compact-context-core` 统一转出的 `ContextEngine`、contract 构造器和 `context-processing` 工具使用，不再直接 import `runtime-core` / `contracts`
