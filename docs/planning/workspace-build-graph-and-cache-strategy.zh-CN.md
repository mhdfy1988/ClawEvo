# Workspace Build Graph And Cache Strategy

这份文档用来回答 3 个问题：

- 当前 workspace 的编译依赖图到底是什么
- 为什么我们现在先不引入 `tsc -b`
- 当前已经落下来的增量构建与并发保护策略是什么

相关文档：
- [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md)
- [workspace-test-and-release-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-and-release-boundary.zh-CN.md)

## 当前依赖图

当前可发布 workspace 的编译依赖图如下：

- `@openclaw-compact-context/contracts`
  - 无依赖
- `@openclaw-compact-context/runtime-core`
  - 依赖 `@openclaw-compact-context/contracts`
- `@openclaw-compact-context/control-plane-core`
  - 依赖 `@openclaw-compact-context/contracts`
- `@openclaw-compact-context/openclaw-adapter`
  - 依赖 `@openclaw-compact-context/contracts`
  - 依赖 `@openclaw-compact-context/runtime-core`
- `@openclaw-compact-context/control-plane-shell`
  - 依赖 `@openclaw-compact-context/contracts`
  - 依赖 `@openclaw-compact-context/control-plane-core`
- `@openclaw-compact-context/openclaw-plugin`
  - 依赖 `@openclaw-compact-context/control-plane-core`
  - 依赖 `@openclaw-compact-context/openclaw-adapter`
- `@openclaw-compact-context/control-plane`
  - 依赖 `@openclaw-compact-context/control-plane-core`
  - 依赖 `@openclaw-compact-context/openclaw-adapter`
  - 依赖 `@openclaw-compact-context/control-plane-shell`

当前拓扑构建顺序是：

1. `contracts`
2. `runtime-core`
3. `control-plane-core`
4. `openclaw-adapter`
5. `control-plane-shell`
6. `openclaw-plugin`
7. `control-plane`

可以直接通过下面命令查看当前图和顺序：

```powershell
npm run describe:workspace:graph
```

## 当前策略

当前并没有把整仓直接切到 `tsc -b`，而是采用了更保守但已经稳定的组合策略：

- `run-workspace-plan.mjs`
  - 负责按依赖闭包和拓扑顺序执行 `build:self / check:self`
- `run-current-workspace-plan.mjs`
  - 让每个 workspace 自己的 `build / check` 也走统一图，而不是手写依赖链
- `workspace-tsc-task.mjs`
  - 负责单 workspace 的 `tsc` 调用和本地 `dist` 清理
- `repo-tsc-task.mjs`
  - 负责 repo 级 `dist` 构建，服务于 `src/tests`、`evaluation` 和少量 repo-internal 验收
- `pack-workspaces.mjs`
  - 只校验现有产物和 manifest 路径，不通过 `prepack` 反复触发重编
- `run-compiled-tests.mjs`
  - 使用 run-scoped 临时目录，避免 app / smoke 测试共享 `dist-smoke`
- `run-locked-npm-script.mjs` + `lock-utils.mjs`
  - 用 `workspace-artifacts` 和 per-workspace 锁避免共享产物并发互删

## 为什么现在先不引入 `tsc -b`

当前评估结果是：`先不引入`。

原因主要有 4 点：

1. `repo` 里仍然同时存在两套构建面
- workspace 包与 app 已经大体 package-local 化
- 但 repo 级 `src/tests`、`src/evaluation` 仍依赖 root `tsconfig.json -> dist`
- 这意味着即使引入 project references，也还需要保留一套 repo-level 编译链

2. `contracts` 仍然不是完全 package-local
- [packages/contracts/tsconfig.json](/d:/C_Project/openclaw_compact_context/packages/contracts/tsconfig.json) 目前仍直接指向 root `src/contracts/index.ts`
- 在这个状态下上 `tsc -b`，会把“还没最终稳定的源码归属”进一步固化成构建协议

3. 现在的痛点主要是“重复编译和并发互踩”，不是“缺少编译器级依赖图”
- 依赖图本身已经被 `workspace-metadata.mjs + run-workspace-plan.mjs` 显式建出来了
- 真正影响体验的是：
  - 同一条链反复 build
  - 多个顶层命令清理同一个 `dist`
  - smoke/test 复用固定临时目录
- 这些问题已经通过显式拓扑编排、现有产物校验、锁和 run-scoped 输出目录解决了一轮

4. 现在继续推进 `tsc -b` 的边际收益还不够高
- 引入 `composite`、`.tsbuildinfo`、references 之后，需要重新整理：
  - root `tsconfig`
  - repo-level tests/evaluation
  - package 间类型可见性
  - app/package/repo 三层编译职责
- 在 `TODO 7/8` 的 compat 收缩和 `src` 长期归属没完全定下来之前，这会让构建协议变得更僵硬

## 当前结论

当前阶段的结论是：

- `先保留显式脚本编排，不切 `tsc -b``
- 继续把 workspace 的 `build / check / test / pack` 职责收回到各自 package/app
- root 只保留 orchestration 和 repo-level 验收

## 何时重新评估 `tsc -b`

后面满足这些条件时，再重新评估 project references 更合适：

- `src/*` compat 层继续缩掉一轮
- `contracts` 真正 package-local 化
- repo-level `tests / evaluation` 与 workspace 级构建边界进一步稳定
- root `tsconfig` 不再承担过多 workspace 内部职责

到那时，如果目标变成：

- 更强的增量缓存
- 更标准的 editor/build graph
- 更正式的多仓前编译协议

再上 `tsc -b` 会更划算。
