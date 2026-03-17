# 项目拆分 TODO

这份 TODO 用来跟踪“把当前仓库逐步收成 插件 / 共享底座 / 平台 多项目结构”的执行情况�?
相关文档�?- 拆分方案：[multi-project-split-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/multi-project-split-plan.zh-CN.md)
- 当前分层：[current-system-layering.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/current-system-layering.zh-CN.md)
- 迁移报告：[project-split-migration-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/archive/planning/project-split-migration-report.zh-CN.md)
- 后续结构收口：[structure-convergence-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/structure-convergence-todo.zh-CN.md)

## 已完�?- [x] TODO 1：先把共�?contract 抽到共享底座�?  - [x] 抽出 runtime context / prompt assembly shared contract
  - [x] 抽出 shared logger contract
  - [x] �?control-plane 不再反向依赖 `openclaw/types`

- [x] TODO 2：拆掉插件对平台实现的直接依�?  - [x] `context-engine-adapter` 改为吃注入进来的 `ControlPlaneFacadeContract`
  - [x] 引入 `plugin/control-plane-bridge`
  - [x] 插件默认装配�?adapter 内部挪到 bridge
  - [x] 对应回归保持通过

- [x] TODO 3：拆掉平台对插件实现的直接依�?  - [x] `control-plane server` 改为依赖 shared runtime read-model contract
  - [x] 引入 `openclaw/control-plane-runtime-bridge`
  - [x] `server.ts` 不再直接依赖 adapter helper / config concrete
  - [x] `control-plane-server` 回归改为�?read-model contract

- [x] TODO 4：把 `src/core` 真正拆空并物理迁�?  - [x] 上下文处理实现迁�?`src/context-processing`
  - [x] 运行时主链实现迁�?`src/runtime`
  - [x] 治理域规则迁�?`src/governance`
  - [x] 存储与持久化迁到 `src/infrastructure`
  - [x] `src/core` 保留兼容 shim，避免一次性打断旧 import

- [x] TODO 5：引�?`apps/* + packages/*` workspace 结构
  - [x] 建立 `apps/openclaw-plugin`
  - [x] 建立 `apps/control-plane`
  - [x] 建立 `packages/contracts`
  - [x] 建立 `packages/runtime-core`
  - [x] 建立 `packages/control-plane-core`
  - [x] 建立对应 source entrypoint：`src/contracts` / `src/runtime-core` / `src/control-plane-core`

- [x] TODO 6：收紧导出与构建边界
  - [x] root export 改为稳定公共入口
  - [x] 每个 shared package 有明�?public API
  - [x] 新增 layer-boundary / workspace-boundary 回归

- [x] TODO 7：补�?workspace、CI 与发布链�?  - [x] 更新 `package.json` workspace / exports / scripts
  - [x] 增加 workspace smoke test
  - [x] 增加 GitHub Actions CI
  - [x] 插件 / control-plane 启动脚本补齐 workspace 语义入口

- [x] TODO 8：输出迁移报告与验收文档
  - [x] 记录旧目录到新目录的映射
  - [x] 记录 breakage / compatibility note
  - [x] 输出“拆分完成后的依赖方向”验收页

- [x] TODO 9：清理仓库内部对 `src/core` 兼容 shim 的依�?  - [x] 运行时主链源码改为直接引�?`context-processing / runtime / governance / infrastructure`
  - [x] evaluation 与测试改为直接引用新层目�?  - [x] 新增边界回归，确�?`src/core/*` 不再被仓库内部源码直�?import

- [x] TODO 10：把 `apps/*` �?`packages/*` �?manifest 壳子推进到本地可独立构建单元
  - [x] 为每�?app / package 增加本地 `tsconfig.json`
  - [x] 为每�?app / package 增加本地 `build / check` 脚本
  - [x] package `exports / bin / types` 改为指向各自 `./dist/*`
  - [x] root 增加 `check:workspace / build:workspace`
  - [x] workspace smoke 改为校验本地 tsconfig、脚本和 package-local export

- [x] TODO 11：正式删�?`src/core/*` compatibility shim，并�?workspace 单元推进到可打包发布语义
  - [x] 删除 `src/core/*` 兼容层文件，避免继续制造过渡态噪�?  - [x] 清理拆分文档中“shim 仍存在”的旧口�?  - [x] �?`apps/*` / `packages/*` 补齐本地 `version / files / prepack`
  - [x] root 增加 `pack:workspace`
  - [x] workspace smoke 扩展�?package-local publish metadata

- [x] TODO 12：继续收�?shared package 边界并消�?workspace 旧产物噪�?  - [x] �?control-plane 共享 contract 下沉�?`src/types/control-plane.ts`
  - [x] �?evaluation 纯类型下沉到 `src/types/evaluation.ts`
  - [x] `packages/contracts` 不再通过 `internal/evaluation/*` 传递类型依�?  - [x] root 与所�?workspace 单元统一改为 `clean dist -> build`
  - [x] workspace smoke 增加 `packages/contracts/dist` 目录边界断言

## 当前结果

- 插件�?  - 宿主适配、hook、assemble、gateway 调试入口
- 共享底座�?  - `contracts`
  - `runtime-core`
  - `context-processing / runtime / governance / infrastructure`
- 平台�?  - `control-plane-core`
  - `control-plane server / console / client`
- workspace 单元�?  - `apps/*` �?`packages/*` 已经具备本地 `build / check / dist / prepack` 语义，不再只是指�?root `dist` �?manifest 壳子
  - `packages/contracts` �?dry-run 打包内容已经收窄�?`contracts + types` 共享表面

## 当前完成�?
- `src/core/*` 已彻底删除，兼容层过渡阶段结�?- 仓库内部源码、测试和 evaluation 已全部改为直接走新层目录
- `apps/*` �?`packages/*` 已经能各自本�?`build / check / pack(dry-run)`
- workspace 构建前会先清理本�?`dist`，打包结果不再混入历史旧产物
- root workspace 仍负责统一编排和总体验证

## 下一�?- �?`packages/runtime-core` �?`packages/control-plane-core` 继续从“可打包 workspace 单元”推进到“真正独立发布单元�?- 继续收紧 root package 的职责，逐步退化成�?workspace orchestrator
- 评估是否需要从 monorepo 继续演进到多仓库


