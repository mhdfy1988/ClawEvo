# 结构收口 TODO

这份 TODO 用来跟踪 workspace-first 拆分之后，仍然需要继续完成的物理结构收口工作。

相关文档：
- [multi-project-split-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/multi-project-split-plan.zh-CN.md)
- [project-split-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-todo.zh-CN.md)
- [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md)
- [current-system-layering.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/current-system-layering.zh-CN.md)

## 当前判断

已经完成的部分：
- `src/core/*` 兼容层已经移除。
- `apps/* + packages/*` workspace 结构已经建立。
- `packages/contracts` 已经收窄到共享 contract 和 types。
- `apps/openclaw-plugin` 已经切到 app-local `src/*`。
- `apps/control-plane` 已经切到 app-local `src/*`。
- `packages/runtime-core` 第一轮收窄已经完成，不再把 `openclaw` 目录打进包产物。
- `packages/runtime-core` 已经把 `tool-result-artifact-store` 和 `tool-result-policy` 这类 OpenClaw 专属实现从共享 `infrastructure / runtime` 入口里切走，`runtime-core` 可以独立 build。
- `packages/runtime-core` 已经切到 package-local `src/*`，并通过 `@openclaw-compact-context/contracts` 复用共享类型，不再把 `types` 目录打进包产物。
- `packages/control-plane-core` 已经切到 package-local `src/*`，且不再把 `evaluation / runtime / infrastructure / governance` 的大面积实现打进包产物。
- `packages/openclaw-adapter` 已经切到 package-local `src/*`，并把主入口收敛到 `openclaw/*` + `plugin/*` 两层。
- `packages/control-plane-shell` 已经切到 package-local `src/*`，且只保留 `server / client / console / CLI` 壳层。
- 插件目录已经收敛成“宿主适配层 + 插件壳层”，`src/adapters/index.ts` 仅保留最小兼容聚合入口。
- root package 已经退化成“workspace 编排层”：
  - repo 级 `build / check / test / smoke / CI` 继续留在 root
  - 对外运行入口和共享实现都已经迁到 workspace 包
  - root 不再承接兼容发布产物

仍然需要继续收口的重点：
- shared foundation 已经基本切开，但各包的 public API 还可以继续收窄。
- workspace 测试分层和发布边界说明已经建立，下一步更适合继续压缩包暴露面，而不是再扩目录。
- 结构收口完成后，后续收尾工作转入 [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md)。

## TODO

- [x] TODO 1：把 `apps/openclaw-plugin` 变成真正的 app 本地源码入口
  - [x] 新建 `apps/openclaw-plugin/src/*`
  - [x] 收敛到 `src/index.ts` 和 `src/bin/openclaw-context-plugin.ts`
  - [x] `apps/openclaw-plugin/tsconfig.json` 不再以 root `src` 作为 `rootDir`
  - [x] 通过 `packages/openclaw-adapter` 承接插件壳层
  - [x] 增加 workspace smoke，确保 app `dist` 只保留本地壳层

- [x] TODO 2：把 `apps/control-plane` 变成真正的 app 本地源码入口
  - [x] 新建 `apps/control-plane/src/*`
  - [x] 收敛到 `src/index.ts`、`src/client.ts` 和 `src/bin/openclaw-control-plane.ts`
  - [x] `apps/control-plane/tsconfig.json` 不再以 root `src` 作为 `rootDir`
  - [x] 通过 `packages/control-plane-shell` 承接控制面壳层
  - [x] 增加 workspace smoke，确保 app `dist` 只保留本地壳层

- [x] TODO 3：继续收窄 `packages/runtime-core`
  - [x] 最终切到 package-local `src/*`
  - [x] 先把共享运行时底座和 OpenClaw 适配面拆开
  - [x] 禁止 `runtime-core` 再把 `openclaw` 目录带进包产物
  - [x] 禁止 `runtime-core` 再把 `types` 目录带进包产物
  - [x] 增加 pack/build 边界 smoke

- [x] TODO 4：继续收窄 `packages/control-plane-core`
  - [x] 切到 package-local `src/*`
  - [x] 把 `evaluation` helper 从平台核心服务里拆开
  - [x] 禁止 `control-plane-core` 再把 plugin/runtime adapter 侧实现打进包产物
  - [x] 增加 pack/build 边界 smoke

- [x] TODO 5：收窄承接层 package
  - [x] 让 `openclaw-adapter` 切到真正 package-local 源码入口
  - [x] 只保留 OpenClaw 适配、hook、plugin shell 和相关桥接
  - [x] 禁止把 runtime/control-plane 的大面积实现继续打进 adapter 包
  - [x] 让 `control-plane-shell` 切到真正 package-local 源码入口
  - [x] 只保留 `control-plane` 的 `server / client / console / CLI` 壳层
  - [x] 禁止把 runtime/plugin/openclaw 的大面积实现继续打进 shell 包
  - [x] 给 `openclaw-adapter` 和 `control-plane-shell` 增加 pack/build 边界 smoke 断言

- [x] TODO 6：收敛插件目录结构
  - [x] 重新定义 `src/openclaw`、`src/adapters/index.ts`、`src/plugin` 的边界
  - [x] 合并重复壳层，只保留“宿主适配层 + 插件壳层”两层
  - [x] 更新插件入口导出，避免三层结构长期并存

- [x] TODO 7：收紧 root package 职责
  - [x] 让 root `package.json` 退化成 workspace orchestrator
  - [x] root 只保留 repo 级 `check / build / test / smoke / CI` 编排
  - [x] root `exports / bin` 退化成最小兼容层或聚合层
  - [x] 单独引入 root 兼容源码树和专用 `tsconfig.root-package.json`
  - [x] 增加 root `dist` 的边界 smoke，防止再次编出整仓产物

- [x] TODO 8：按层拆分测试与独立发布边界
  - [x] package unit tests：`contracts / runtime-core / control-plane-core / openclaw-adapter / control-plane-shell`
  - [x] app integration tests：`openclaw-plugin / control-plane`
  - [x] root e2e / smoke tests：只保留跨 workspace 的整体验收
  - [x] 形成每个 workspace 的 public API、版本节奏和发布职责说明

## 推荐顺序

建议按下面顺序继续推进：

1. `packages/runtime-core`
2. `进一步收窄 shared foundation 包内容`
3. `评估是否进入真正独立发布单元`

## 完成标志

这份 TODO 可以视为完成的条件是：
- `apps/*` 不再直接编译 root `src`
- `packages/runtime-core`、`packages/control-plane-core`、`packages/openclaw-adapter`、`packages/control-plane-shell` 都不再直接编译宽泛的 root `src`
- plugin / platform / shared foundation 三者的物理目录边界清晰
- root package 退化成纯 workspace orchestrator
- workspace tests 和 pack smoke 能稳定阻止边界回退
