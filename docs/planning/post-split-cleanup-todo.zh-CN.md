# 拆分后收�?TODO

这份 TODO 用来跟踪 `workspace-first` 拆分和结构收口完成之后，仍然值得继续推进的第二轮工程收尾工作�?
相关文档�?- [multi-project-split-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/multi-project-split-plan.zh-CN.md)
- [project-split-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-todo.zh-CN.md)
- [structure-convergence-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/structure-convergence-todo.zh-CN.md)
- [workspace-test-and-release-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-and-release-boundary.zh-CN.md)

## 当前判断

第一轮和第二轮的结构拆分已经基本完成�?- `apps/*` 不再直接编译宽泛�?root `src`
- `packages/runtime-core`、`packages/compact-context-core`、`packages/openclaw-adapter`、`packages/control-plane-shell` 都已经切�?package-local `src/*`
- root package 已经退化成 `workspace orchestrator`
- package / app / root smoke 的测试分层已经建�?
现在更适合做的是：
- 继续收窄 public API 和依赖方�?- 继续缩小兼容�?- 让对外命名、导出语义和发布边界更稳�?- 持续降低构建�?smoke 成本

当前已完成的第一刀�?- `packages/runtime-core` 已经移除 `./runtime/*`、`./context-processing/*`、`./governance/*`、`./infrastructure/*` 这类通配子路径导出�?- 根级兼容壳已经移除，root 不再承接 `exports / bin / openclaw.extensions` 入口�?
## TODO

- [x] TODO 1：继续收�?shared package �?public API
  - [x] 评估 `packages/runtime-core` 当前子路径导出是否过�?  - [x] 评估 `packages/compact-context-core` 当前子路径导出是否过�?  - [x] 先把 `runtime-core` 收敛到稳定聚合入�?+ 明确�?engine 入口
  - [x] 再继续收�?`compact-context-core` 的逐文件子路径导出
  - [x] 为当前稳定入口补�?smoke 断言，防止导出面回涨

- [x] TODO 2：继续拆�?package 之间的依赖方�?  - [x] 评估 `control-plane-shell -> openclaw-adapter` 是否还能继续改成只依�?shared runtime read-model contract
  - [x] 评估 `openclaw-adapter -> compact-context-core` 的默�?bridge 装配是否可以下沉�?app 层或独立 integration �?  - [x] 记录当前依赖方向中仍然属于“过渡性装配”的部分
  - 当前已完成：
    - OpenClaw 专属 control-plane CLI 装配已回�?`apps/control-plane`
    - OpenClaw 插件默认 facade 装配已回�?`apps/openclaw-plugin`

## 当前仍属于过渡性装配的部分

- app 层默认装配点�?  - `apps/openclaw-plugin/src/index.ts`
    - 负责默认 `ControlPlaneFacade` 装配
  - `apps/control-plane/src/bin/openclaw-control-plane.ts`
    - 负责 OpenClaw runtime read-model + control-plane server �?CLI 装配
- 兼容转发层：
  - `src/openclaw/*`
  - `src/plugin/*`
  - `src/control-plane/*`
  - `src/adapters/index.ts`

这些路径现在只承担迁移兼容和转发职责，不再承担主实现或默认装配职责�?
- [x] TODO 3：彻底移�?`root-compat`
  - [x] 盘点当前 root `exports / bin` 仍承接的入口
    - root `exports`
      - `.`
      - `./contracts`
      - `./runtime-core`
      - `./compact-context-core`
      - `./openclaw`
    - root `bin`
      - `openclaw-context-plugin`
      - `openclaw-control-plane`
  - [x] 确认这些入口都已有明确的 workspace 对应落点
    - `packages/contracts`
    - `packages/runtime-core`
    - `packages/compact-context-core`
    - `packages/openclaw-adapter`
    - `apps/openclaw-plugin`
    - `apps/control-plane`
  - [x] 盘点当前 `root-compat` 实际仍承接的源码�?    - `root-compat/index.ts`
    - `root-compat/contracts/index.ts`
    - `root-compat/runtime-core/index.ts`
    - `root-compat/compact-context-core/index.ts`
    - `root-compat/openclaw/index.ts`
    - `root-compat/adapters/index.ts`
    - `root-compat/adapters/openclaw/index.ts`
    - `root-compat/bin/openclaw-context-plugin.ts`
    - `root-compat/bin/openclaw-control-plane.ts`
  - [x] �?root package 退化成�?orchestrator
    - [x] 移除 root `exports`
    - [x] 移除 root `bin`
    - [x] 移除 root `openclaw.extensions` 的宿主入口声�?    - [x] 移除 root `start / start:plugin / start:control-plane` �?`./dist/bin/*` 的依�?  - [x] 删除 `root-compat/` �?`tsconfig.root-package.json`
  - [x] 删除 root `build:root:compat`、`check:root:compat` 以及对它们的脚本依赖
  - [x] �?root smoke 从“兼容壳验收”改成“workspace 编排验收�?    - [x] 更新 `test:smoke:root`
    - [x] 更新 `test:smoke:workspace`
    - [x] 更新 `workspace-smoke.test.ts` 中对 root `dist/*` 的存在断言
  - [x] 更新 README / 迁移说明，明�?root 不再是兼容发布单元，只负�?workspace 编排
    - [x] 更新仍引�?root `dist/bin/*` 的命令示�?    - [x] 更新仍描�?root 兼容壳的拆分文档

- [x] TODO 4：再整理一轮命名和导出语义
  - [x] �?`adapter / shell / core / app` 四层的定位在包名、README 和导出路径上更一�?  - [x] 避免同一能力同时存在“旧别名 + 新包�?+ root 兼容名”三种说�?  - [x] 收掉 `packages/openclaw-adapter` 中仅用于兼容�?`./adapters/openclaw` 导出别名
  - [x] 删除 `packages/openclaw-adapter/src/adapters/openclaw` 这类空兼容目录，并补 smoke 防回退
  - [x] �?`packages/runtime-core/schema/sqlite/001_init.sql` 收成唯一 schema 真源
  - [x] 删除 root `schema/sqlite/001_init.sql` 这类重复副本，并把文档引用统一改到 package �?schema
  - [x] 为插件侧和平台侧分别补一张“推荐依赖入口表�?
- [x] TODO 5：继续优�?workspace 构建�?smoke �?  - [x] 继续减少 `build:workspace` �?`pack:workspace` 中的重复构建
    - [x] �?root `build:workspace` 拆成更明确的分层编排，例如：
      - shared packages：`contracts -> runtime-core -> compact-context-core`
      - adapter / shell：`openclaw-adapter -> control-plane-shell`
      - apps：`openclaw-plugin -> control-plane`
    - [x] 避免 `test:package:*`、`test:app:*`、`test:smoke:*` 每次都重复触发整�?`build:workspace`
    - [x] 让各�?workspace 自己�?`build / check` 也走统一依赖图，而不是继续手写依赖链
    - [x] �?`pack:workspace` 增加“仅校验现有产物”的模式，避�?pack 再次隐式重编
      - [x] `pack:workspace` 先校�?manifest 声明的现有产物，再执�?`npm pack --dry-run --ignore-scripts`
      - [x] `pack:workspace` 覆盖 shared packages、shell packages �?apps 全量可发�?workspace
  - [x] 评估是否引入 TS project references 或更明确的增量构建缓�?    - [x] 先盘点每�?workspace 之间当前的编译依赖图
    - [x] 评估 `tsc -b` 是否能覆盖当�?`contracts / runtime-core / compact-context-core / openclaw-adapter / control-plane-shell / apps` 的构建顺�?    - [x] 在暂不引�?project references 的前提下，补一�?repo 级增量构建与缓存策略说明
    - [x] 相关文档�?      - [workspace-build-graph-and-cache-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-build-graph-and-cache-strategy.zh-CN.md)
  - [x] 继续收轻 root 级编排脚本，减少“所有验证都堆在 root”带来的重链�?    - [x] �?package / app 自己承担更多 `build / check / test` 责任
    - [x] root 只保�?orchestration，而不再夹带过�?workspace 内部细节
    - [x] 通过 `run-current-workspace-plan.mjs` �?`run-current-workspace-script.mjs` �?workspace 自己的职责收回各自包�?  - [x] 把最慢的 root smoke 进一步拆成“必�?smoke”和“发�?smoke�?    - [x] `必要 smoke`：本地开发和日常 CI 必跑，优先覆盖边界回退和最小整体验�?      - [x] 当前脚本：`npm run test:smoke:required`
      - [x] 当前范围：`workspace-smoke + layer-boundaries`
      - [x] 编译产物改为 run-scoped 临时目录，不再复用固�?`dist-smoke`
    - [x] `发布 smoke`：只�?release / pack / prepublish 场景跑，允许更重
      - [x] 当前脚本：`npm run test:smoke:release`
      - [x] 当前范围：`workspace-smoke + layer-boundaries + debug-smoke + pack:workspace`
    - [x] 明确两者与 `debug smoke`、`evaluation` 的职责边�?      - [x] `debug smoke` 归入 `发布 smoke`
      - [x] `evaluation` 继续保持独立，不并入 smoke
    - [x] �?smoke 链补一版耗时基线，避免后续继续无感膨胀
      - [x] 相关文档�?        - [workspace-smoke-baseline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-smoke-baseline.zh-CN.md)
  - [x] 为共享输出目录补并发保护
    - [x] workspace `build:self / check:self` 改成受锁执行，避免并发清理同一�?`dist`
    - [x] `pack:workspace` 校验�?dry-run 复用同一�?workspace 锁，避免读到半成品或被并发清�?    - [x] app / smoke 编译产物改成唯一目录，避免并发测试互�?`dist-smoke`
    - [x] root �?`build / check / pack / test:*` 入口补同一�?`workspace-artifacts` 锁，避免两个顶层命令交叉清理依赖 workspace 产物

- [x] TODO 6：继续收紧测试与发布边界
  - [x] 继续把测试按 `package unit / app integration / root smoke` 三层拆得更独�?    - [x] 盘点当前 `tests` 中哪些仍然混合了 package / app / root 关注�?    - [x] �?package 级测试继续往各自 workspace 的职责边界收�?    - [x] 明确哪些测试必须保留�?root 作为�?workspace 验收
    - [x] 相关文档�?      - [workspace-test-ownership.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-ownership.zh-CN.md)
  - [x] �?package unit tests 更少依赖 root 编译产物
    - [x] 优先减少 package 测试�?repo �?`tsc -p tsconfig.json` 产物的依�?    - [x] �?package 测试统一切到 run-scoped 编译目录，而不再复�?root 固定 `dist`
    - [x] 补充约束：package 测试不应再依赖已移除�?root compat 假设
  - [x] �?app integration tests 更明确只验证壳层行为
    - [x] OpenClaw plugin app：只验证 manifest、依赖、默认装配点�?thin shell `dist`
    - [x] control-plane app：只验证 CLI / client / shell 组合关系�?thin shell `dist`
    - [x] 避免�?app 测试里重复验�?core/runtime 细节
  - [x] �?root 级测试只保留�?workspace 的整体验收，而不再承担过多细粒度验证
    - [x] root smoke 只验�?pack/build/output 边界、层间依赖方向和最小运行链
    - [x] debug smoke / evaluation 不再被误用成 package 单测替代�?    - [x] �?root 级测试建立“新增必须说明为什么不能下沉”的规则
  - [x] 继续细化每个 workspace �?`files / exports / prepack / publish` 职责
    - [x] 为每�?workspace 补一版发布清单审计：
      - `files`
      - `exports`
      - `bin`
      - `openclaw.extensions`
      - `prepack`
    - [x] 建立 pack dry-run 的验收矩阵，明确哪些目录绝不能再次进入产�?    - [x] 把这套发布边界同步到 README 或发布说明，避免只存在于 TODO �?    - [x] 相关文档�?      - [workspace-release-audit-matrix.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-release-audit-matrix.zh-CN.md)

- [x] TODO 7：继续收�?`src/*` 兼容转发�?  - [x] 盘点当前 `src/*` 下仍然属于纯转发的目录与文件
    - [x] `src/openclaw/*`
    - [x] `src/plugin/*`
    - [x] `src/control-plane/*`
    - [x] `src/runtime/*`
    - [x] `src/context-processing/*`
    - [x] `src/governance/*`
    - [x] `src/infrastructure/*`
    - [x] `src/runtime-core/*`
    - [x] `src/adapters/index.ts`
    - [x] `src/bin/*`
  - [x] 区分哪些 compat 入口仍需保留迁移窗口，哪些已经可以继续删�?  - [x] 对仍保留�?compat 层建立统一规则�?    - [x] 只允许转发，不允许新增真实实�?    - [x] README / 设计文档里不再把它们描述为推荐主入口
    - [x] 对新�?compat 入口建立显式审查约束
  - [x] 对已不需要的 compat 层继续删减，并补 smoke 防止旧目录回�?  - [x] 把这�?compat 入口整理成一张“保�?/ 待删 / 已删”清单，避免后续判断反复摇摆
  - 当前落点�?    - [src-compat-inventory.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-compat-inventory.zh-CN.md)
    - [scripts/src-compat-metadata.mjs](/d:/C_Project/openclaw_compact_context/scripts/src-compat-metadata.mjs)
    - [workspace-smoke.test.ts](/d:/C_Project/openclaw_compact_context/tests/workspace-smoke.test.ts)

- [x] TODO 8：明确剩�?`src` 目录的长期归�?  - [x] �?`src` 下剩余目录明确分成两类：
    - [x] repo 内部长期源码�?      - [x] `src/types`
      - [x] `src/contracts`
      - [x] `internal/evaluation`
      - [x] `tests`
    - [x] 迁移窗口 compat �?      - [x] `src/index.ts`
      - [x] `src/openclaw/*`
      - [x] `src/plugin/*`
      - [x] `src/control-plane/*`
      - [x] `src/compact-context-core/*`
      - [x] `src/engine/*`
      - [x] `src/adapters/index.ts`
      - [x] `src/bin/*`
  - [x] �?repo 内部长期源码层补一版边界说明：
    - [x] 为什么它们继续留�?root `src`
    - [x] 什么情况下才值得再拆成独�?package
    - [x] 哪些目录绝不能再回流成“兼容杂物间�?  - [x] 评估 `internal/evaluation` 是否需要后续单�?package 化，还是长期保持 repo-internal
  - [x] 评估 `tests` 是否需要继续按 workspace 拆分测试目录，还是维�?repo-level test harness
  - [x] 在架构文档里明确：后续目标不是“清空整�?src”，而是“只保留有长期价值的 repo 内部源码�?  - 当前落点�?    - [src-ownership-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-ownership-boundary.zh-CN.md)
    - [scripts/src-ownership-metadata.mjs](/d:/C_Project/openclaw_compact_context/scripts/src-ownership-metadata.mjs)
    - [workspace-smoke.test.ts](/d:/C_Project/openclaw_compact_context/tests/workspace-smoke.test.ts)

- [x] TODO 9：为真正独立发布单元 / 多仓准备收尾
  - [x] 为每�?workspace 明确“是否值得独立发布 / 独立仓库化”的判断标准
    - [x] `contracts`
    - [x] `runtime-core`
    - [x] `compact-context-core`
    - [x] `openclaw-adapter`
    - [x] `control-plane-shell`
    - [x] `apps/*`
  - [x] 补一�?workspace 版本联动策略
    - [x] 哪些包应该锁步版�?    - [x] 哪些包可以独立演�?    - [x] 什么时候需�?breaking change migration note
  - [x] 补一版消费者迁移策�?    - [x] �?root 旧入口迁�?workspace 新入�?    - [x] �?compat `src/*` 入口迁到 package 正式入口
  - [x] 评估是否需要引�?release automation / changelog / tag 策略
  - [x] 在真正考虑多仓之前，先达到“workspace 单元可以独立 build / pack / test / explain”的验收基线
  - 当前落点�?    - [workspace-release-readiness.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-release-readiness.zh-CN.md)
    - [workspace-consumer-migration-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-consumer-migration-strategy.zh-CN.md)
    - [scripts/workspace-release-readiness-metadata.mjs](/d:/C_Project/openclaw_compact_context/scripts/workspace-release-readiness-metadata.mjs)
    - [workspace-smoke.test.ts](/d:/C_Project/openclaw_compact_context/tests/workspace-smoke.test.ts)

## 推荐顺序

1. `shared package public API 收窄`
2. `依赖方向再拆薄`
3. `移除 root-compat 并收口命名语义`
4. `构建链和发布边界优化`
5. `src compat 收缩�?repo 内部源码边界澄清`
6. `独立发布单元 / 多仓准备`

## 完成标志

这份 TODO 可以视为完成的条件是�?- shared package �?public API 已经稳定且足够小
- package 之间的依赖方向更接近最终目标，不再保留明显的过渡性装配耦合
- `root-compat` 已经被移除，root 只负�?workspace 编排
- `adapter / shell / core / app` 四层对内对外的命名和导出语义一�?- workspace 构建、pack �?smoke 的成本进一步下�?- `src/*` 中仍保留的目录已经明确区分为“repo 内部长期源码”与“迁�?compat 层�?- 如需继续走向独立发布单元或多仓，已经具备清晰的版本、迁移和验收策略


