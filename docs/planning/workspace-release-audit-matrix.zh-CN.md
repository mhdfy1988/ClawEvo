# Workspace Release Audit Matrix

这份文档把当前可发布 workspace �?`files / exports / bin / openclaw.extensions / prepack` 边界收成一张固定矩阵，避免发布边界只停留在脚本实现里�?
相关文档�?- [workspace-test-and-release-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-and-release-boundary.zh-CN.md)
- [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md)
- [workspace-release-readiness.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-release-readiness.zh-CN.md)

## 审计范围

当前 `pack:workspace` 覆盖�?
- `packages/contracts`
- `packages/runtime-core`
- `packages/compact-context-core`
- `packages/openclaw-adapter`
- `packages/control-plane-shell`
- `apps/openclaw-plugin`
- `apps/control-plane`

## 发布矩阵

| Workspace | `files` | `exports` / `main` | `bin` | 额外入口 | `prepack` |
| --- | --- | --- | --- | --- | --- |
| `contracts` | `dist`, `README.md` | `.` + `main/types` 指向 `dist/contracts/*` | �?| �?| `npm run build` |
| `runtime-core` | `dist`, `schema`, `src`, `README.md` | `.`、`./runtime`、`./context-processing`、`./governance`、`./infrastructure`、`./engine/context-engine` | �?| `schema/sqlite/001_init.sql` 作为唯一 schema 真源 | `npm run build` |
| `compact-context-core` | `dist`, `src`, `README.md` | `.` + `main/types` | �?| �?| `npm run build` |
| `openclaw-adapter` | `dist`, `README.md` | `.`、`./openclaw`、`./bin` 与若�?OpenClaw 子路�?| �?| �?| `npm run build` |
| `control-plane-shell` | `dist`, `README.md` | `.`、`./server`、`./client`、`./console` | �?| �?| `npm run build` |
| `openclaw-plugin` | `dist`, `openclaw.plugin.json`, `README.md` | `.` + `main/types` | `openclaw-context-plugin` | `openclaw.extensions -> ./src/index.ts` | `npm run build` |
| `control-plane` | `dist`, `README.md` | `.`, `./client`, `./bin` | `openclaw-control-plane` | �?| `npm run build` |

## 当前约束

当前已经固定下来的发布约束是�?
- `pack:workspace` 只校�?manifest 明确声明的现有产�?- `npm pack --dry-run --ignore-scripts` 不再依赖 `prepack` 隐式补救
- app 包只发布薄壳产物，不回带整棵 runtime/control-plane 实现�?- shared/core 包不能重新把 compat 层、测试目录或 `.tmp/` 带回产物

## 绝不能重新进入产物的目录

下面这些目录或路径，不应该再次进入任�?workspace 的发布产物：

- root `.tmp/`
- root `dist-smoke/`
- root `node_modules/`
- 已移除的 `root-compat/`
- root `schema/sqlite/001_init.sql`
- `tests/`
- �?compat 目录，例如旧�?`packages/openclaw-adapter/src/adapters/openclaw`

## 当前结论

现在 `pack:workspace` 已经不只�?dry-run，而是带着一套明确的发布边界�?
- 先校�?manifest 声明的路径是否存�?- 再做 dry-run 打包
- 再由 smoke 验证 shared/core/app 边界不回�?
后面如果继续�?`TODO 9` 的独立发布单元准备，这份矩阵就是当前的发布基线�?
