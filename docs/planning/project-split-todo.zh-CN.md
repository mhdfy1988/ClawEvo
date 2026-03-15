# 项目拆分 TODO

这份 TODO 用来跟踪“把当前仓库逐步收成 插件 / 共享底座 / 平台 多项目结构”的执行情况。

相关文档：
- 拆分方案：[multi-project-split-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/multi-project-split-plan.zh-CN.md)
- 当前分层：[current-system-layering.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/current-system-layering.zh-CN.md)
- 迁移报告：[project-split-migration-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-migration-report.zh-CN.md)

## 已完成
- [x] TODO 1：先把共享 contract 抽到共享底座层
  - [x] 抽出 runtime context / prompt assembly shared contract
  - [x] 抽出 shared logger contract
  - [x] 让 control-plane 不再反向依赖 `openclaw/types`

- [x] TODO 2：拆掉插件对平台实现的直接依赖
  - [x] `context-engine-adapter` 改为吃注入进来的 `ControlPlaneFacadeContract`
  - [x] 引入 `plugin/control-plane-bridge`
  - [x] 插件默认装配从 adapter 内部挪到 bridge
  - [x] 对应回归保持通过

- [x] TODO 3：拆掉平台对插件实现的直接依赖
  - [x] `control-plane server` 改为依赖 shared runtime read-model contract
  - [x] 引入 `openclaw/control-plane-runtime-bridge`
  - [x] `server.ts` 不再直接依赖 adapter helper / config concrete
  - [x] `control-plane-server` 回归改为走 read-model contract

- [x] TODO 4：把 `src/core` 真正拆空并物理迁移
  - [x] 上下文处理实现迁到 `src/context-processing`
  - [x] 运行时主链实现迁到 `src/runtime`
  - [x] 治理域规则迁到 `src/governance`
  - [x] 存储与持久化迁到 `src/infrastructure`
  - [x] `src/core` 保留兼容 shim，避免一次性打断旧 import

- [x] TODO 5：引入 `apps/* + packages/*` workspace 结构
  - [x] 建立 `apps/openclaw-plugin`
  - [x] 建立 `apps/control-plane`
  - [x] 建立 `packages/contracts`
  - [x] 建立 `packages/runtime-core`
  - [x] 建立 `packages/control-plane-core`
  - [x] 建立对应 source entrypoint：`src/contracts` / `src/runtime-core` / `src/control-plane-core`

- [x] TODO 6：收紧导出与构建边界
  - [x] root export 改为稳定公共入口
  - [x] 每个 shared package 有明确 public API
  - [x] 新增 layer-boundary / workspace-boundary 回归

- [x] TODO 7：补齐 workspace、CI 与发布链路
  - [x] 更新 `package.json` workspace / exports / scripts
  - [x] 增加 workspace smoke test
  - [x] 增加 GitHub Actions CI
  - [x] 插件 / control-plane 启动脚本补齐 workspace 语义入口

- [x] TODO 8：输出迁移报告与验收文档
  - [x] 记录旧目录到新目录的映射
  - [x] 记录 breakage / compatibility note
  - [x] 输出“拆分完成后的依赖方向”验收页

- [x] TODO 9：清理仓库内部对 `src/core` 兼容 shim 的依赖
  - [x] 运行时主链源码改为直接引用 `context-processing / runtime / governance / infrastructure`
  - [x] evaluation 与测试改为直接引用新层目录
  - [x] 新增边界回归，确保 `src/core/*` 不再被仓库内部源码直接 import

## 当前结果

- 插件：
  - 宿主适配、hook、assemble、gateway 调试入口
- 共享底座：
  - `contracts`
  - `runtime-core`
  - `context-processing / runtime / governance / infrastructure`
- 平台：
  - `control-plane-core`
  - `control-plane server / console / client`
- 兼容层：
  - `src/core/*` 目前只保留给历史路径和外部兼容使用，仓库内部源码已经不再直接依赖

## 下一步
- 评估是否要正式删除 `src/core/*` shim，而不是继续长期保留
- 把 `apps/*` 和 `packages/*` 从“结构壳子”继续推进到“独立构建 / 发布单元”
- 评估是否需要从 monorepo 继续演进到多仓库
