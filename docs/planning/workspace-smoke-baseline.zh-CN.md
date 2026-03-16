# Workspace Smoke Baseline

这份文档记录当前 workspace smoke 的耗时基线，避免后续构建链或 smoke 链继续变重时没有参照。

相关文档：
- [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md)
- [workspace-test-and-release-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-and-release-boundary.zh-CN.md)
- [workspace-build-graph-and-cache-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-build-graph-and-cache-strategy.zh-CN.md)

## 基线环境

- 采样时间：`2026-03-16T05:18:06.089Z`
- 平台：`win32`
- Node：`v24.14.0`
- 命令：

```powershell
npm run benchmark:smoke
```

脚本会顺序执行：

1. `npm run test:smoke:required`
2. `npm run test:smoke:release`

并把结果写入 `.tmp/benchmarks/smoke-baseline-*.json`。

## 当前基线

| 链路 | 命令 | 耗时 |
| --- | --- | --- |
| 必要 smoke | `npm run test:smoke:required` | `18.4s` |
| 发布 smoke | `npm run test:smoke:release` | `26.0s` |

## 解读

- `必要 smoke`
  - 主要覆盖 `workspace-smoke + layer-boundaries`
  - 当前已经是本地开发和日常 CI 可以接受的重量
- `发布 smoke`
  - 额外包含 `debug-smoke + pack:workspace`
  - 当前更适合 release / prepublish / 边界收口场景

两者目前的差值大约是 `7.6s`，主要来自：

- `pack:workspace` 的 manifest 校验与 dry-run
- `debug-smoke` 的额外调试面回归

## 使用建议

- 本地日常开发优先跑：

```powershell
npm run test:smoke:required
```

- 发布前或重构边界后再跑：

```powershell
npm run test:smoke:release
```

- 当出现以下情况时，重新记录一次基线：
  - `build:workspace` 拓扑或 prepare 链调整
  - `pack:workspace` 校验逻辑变化
  - smoke 覆盖范围新增或拆分
  - 并发保护策略变化

## 当前结论

这版基线已经足够支撑 `TODO 5` 的“必要 smoke / 发布 smoke”分层验收。

后面如果 `required smoke` 长期超过 `25s`，或者 `release smoke` 长期超过 `35s`，就应该重新检查：

- prepare 链是否又开始重复构建
- 是否有新的 root-level 验收被误塞进 smoke
- pack 或 debug 路径是否膨胀
