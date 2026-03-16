# `src` 后续收口 TODO

这份 TODO 专门跟踪 `post-split cleanup` 完成之后，`src/` 目录后续还值得继续做的收口工作。

相关文档：
- [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md)
- [src-ownership-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-ownership-boundary.zh-CN.md)
- [src-compat-inventory.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-compat-inventory.zh-CN.md)
- [project-split-compatibility-note.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-compatibility-note.zh-CN.md)

## 当前判断

当前 `src/` 已经不再是“大杂烩”，而是两类内容并存：

1. `长期保留的 repo 内部源码`
   - `src/types`
   - `src/contracts`
   - `src/evaluation`
   - `src/tests`
2. `迁移窗口 compat 转发层`
   - `src/index.ts`
   - `src/openclaw/*`
   - `src/plugin/*`
   - `src/control-plane/*`
   - `src/control-plane-core/*`

所以后面的重点不是“把整个 `src` 清空”，而是：
- 继续减少对 compat 路径的认知噪音
- 继续去掉重复、重叠、语义不干净的 compat 壳
- 只留下真正有价值的 repo 内部源码

## TODO

- [x] TODO 1：先把文档与示例去 compat 化
  - [x] 盘点 README、架构文档、阶段文档、集成文档里仍然把 `src/openclaw/*`、`src/plugin/*`、`src/control-plane/*`、`src/engine/*` 当主实现入口引用的地方
  - [x] 把推荐入口统一改成 `packages/*` / `apps/*`
  - [x] `src/*` compat 路径只允许出现在兼容说明、迁移说明、历史阶段复盘里
  - [x] 为这类文档引用补一条 smoke / lint 级别的回归约束，避免新的主文档再回指 compat

- [x] TODO 2：收紧 `src/control-plane*` 这组 compat 的语义
  - [x] 盘点 `src/control-plane/*` 和 `src/control-plane-core/*` 是否存在语义重复
  - [x] 重点评估：
    - [x] `src/control-plane/index.ts`
    - [x] `src/control-plane/contracts.ts`
    - [x] `src/control-plane-core/index.ts`
  - [x] 明确哪些入口必须继续保留迁移窗口，哪些可以并到单一 compat 聚合入口
  - [x] 收掉“目录名像实现层、实际只是在转发层”的不干净语义

- [x] TODO 3：收掉 `src/engine/*` compat
  - [x] 盘点内部和文档是否还在使用 `src/engine/context-engine.ts`
  - [x] 全部切到 `@openclaw-compact-context/runtime-core/engine/context-engine`
  - [x] 删除 `src/engine/*`
  - [x] 补 smoke 防止 `src/engine/*` 回流

- [x] TODO 4：继续处理 `src/adapters/index.ts` 和 `src/bin/*`
  - [x] 盘点是否还有脚本、命令示例、阶段文档依赖：
    - [x] `src/adapters/index.ts`
    - [x] `src/bin/openclaw-context-plugin.ts`
    - [x] `src/bin/openclaw-control-plane.ts`
  - [x] 确认这组只剩迁移兼容后，直接移除并把入口收敛到 `src/index.ts` / app-local CLI
  - [x] 同步更新 compat 清单、边界说明和死链接文档

- [x] TODO 5：继续评估 `src/openclaw/*` 和 `src/plugin/*` 的迁移窗口
  - [x] 盘点仓库内部、文档和潜在外部消费面还剩多少对这两组 compat 的引用
  - [x] 区分：
    - [x] 需要继续保留的宿主侧 compat 窗口：`src/openclaw/*`
    - [x] 已无 repo 内部依赖、仅保留外部迁移窗口的插件侧 compat：`src/plugin/*`
  - [x] 将 repo 内部测试与 fixture 从 `src/openclaw/*` compat 全部切到 `@openclaw-compact-context/openclaw-adapter/openclaw/*`
  - [x] 为 `src/openclaw/*`、`src/plugin/*` 各自写清“保留理由 / 删除前条件”

- [x] TODO 6：给 `src/` 建立持续收缩仪表盘
  - [x] 让 [src-compat-metadata.mjs](/d:/C_Project/openclaw_compact_context/scripts/src-compat-metadata.mjs) 和 [src-ownership-metadata.mjs](/d:/C_Project/openclaw_compact_context/scripts/src-ownership-metadata.mjs) 支持更清晰的目标状态
  - [x] 补一版 `src` 目录数量 / 文件数量基线
  - [x] 每次删 compat 后同步更新 inventory，而不是只改文档文字

## 推荐顺序

1. 文档与示例去 compat 化
2. 收紧 `src/control-plane*` 语义
3. 删除 `src/engine/*`
4. 删除 `src/adapters/index.ts` 与 `src/bin/*`
5. 评估 `src/openclaw/*` 与 `src/plugin/*` 的删除阈值
6. 建立 `src` 收缩基线与仪表板

## 完成标志

这份 TODO 可以视为完成的条件是：

- 主文档和集成说明不再把 `src/*` compat 当主入口
- `src/control-plane*`、`src/engine/*`、`src/adapters/index.ts`、`src/bin/*` 都不再存在语义重复或纯噪音 compat
- `src/openclaw/*`、`src/plugin/*` 都有明确的保留理由或删除条件
- `src/` 最终只剩：
  - 长期保留的 repo 内部源码
  - 少量确实仍需存在的 compat 壳
