# Control Plane Core Package

平台核心服务入口，不包含 `server`、`console` 和 app 壳子。

- 源码入口：`packages/control-plane-core/src/index.ts`
- 推荐导入：`@openclaw-compact-context/control-plane-core`
- 目标内容：`governance`、`observability`、`import`、`extension`、`workspace`、`platform event`、`facade`
- 当前状态：已经切到 package-local `src/*`，由 `packages/control-plane-shell` 和其它上层入口消费
- 导出约束：只保留聚合根入口，不再推荐也不再暴露逐文件子路径导入
