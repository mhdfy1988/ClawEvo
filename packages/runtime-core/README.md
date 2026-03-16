# Runtime Core Package

插件与平台共享的运行时核心包。

- 当前源码入口：`packages/runtime-core/src/index.ts`
- 当前目标内容：`runtime`、`context-processing`、`governance`、`infrastructure`、`engine`
- 当前状态：已经切到 package-local `src/*`，并通过 `@openclaw-compact-context/contracts` 复用共享类型契约
- schema 真源：`packages/runtime-core/schema/sqlite/001_init.sql`
