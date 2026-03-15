# 项目拆分兼容说明

## 当前兼容策略

为了把拆分风险压低，本轮没有直接删除旧路径，而是采用：
- 主实现迁出到新目录
- 旧的 `src/core/*` 保留 `re-export shim`

这意味着：
- 外部旧 import 短期内还能继续工作
- 仓库内部源码已经不再直接依赖 `src/core/*`
- 后续可以分批清理 shim，而不是一次性全部打断

## 推荐新入口
- 上下文处理：`src/context-processing/*`
- 运行时主链：`src/runtime/*`
- 治理域：`src/governance/*`
- 基础设施：`src/infrastructure/*`
- shared contracts：`src/contracts/index.ts`
- shared runtime core：`src/runtime-core/index.ts`
- control-plane core：`src/control-plane-core/index.ts`

## 当前 shim 的用途

`src/core/*` 现在只保留两类用途：
- 对外兼容旧路径
- 给历史文档、历史阶段说明和外部脚本留过渡窗口

它已经不再是仓库内部源码的推荐入口，也不再承载主实现。

## 兼容风险

- 如果后续继续调整 `src/core/*` shim 指向，需要同步检查外部调用方
- app/package manifests 目前还是 workspace-first 壳子，不是最终独立发布体系
- root export 已收紧，未来不建议再把新的内部模块直接挂到 root
