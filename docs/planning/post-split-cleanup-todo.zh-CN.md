# 拆分后收尾 TODO

这份 TODO 用来跟踪 `workspace-first` 拆分和结构收口完成之后，仍然值得继续推进的第二轮工程收尾工作。

相关文档：
- [multi-project-split-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/multi-project-split-plan.zh-CN.md)
- [project-split-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-todo.zh-CN.md)
- [structure-convergence-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/structure-convergence-todo.zh-CN.md)
- [workspace-test-and-release-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-and-release-boundary.zh-CN.md)

## 当前判断

第一轮和第二轮的结构拆分已经基本完成：
- `apps/*` 不再直接编译宽泛的 root `src`
- `packages/runtime-core`、`packages/control-plane-core`、`packages/openclaw-adapter`、`packages/control-plane-shell` 都已经切到 package-local `src/*`
- root package 已经退化成 `workspace orchestrator`
- package / app / root smoke 的测试分层已经建立

现在更适合做的是：
- 继续收窄 public API 和依赖方向
- 继续缩小兼容层
- 让对外命名、导出语义和发布边界更稳定
- 持续降低构建和 smoke 成本

当前已完成的第一刀：
- `packages/runtime-core` 已经移除 `./runtime/*`、`./context-processing/*`、`./governance/*`、`./infrastructure/*` 这类通配子路径导出。
- 根级兼容壳已经移除，root 不再承接 `exports / bin / openclaw.extensions` 入口。

## TODO

- [x] TODO 1：继续收窄 shared package 的 public API
  - [x] 评估 `packages/runtime-core` 当前子路径导出是否过宽
  - [x] 评估 `packages/control-plane-core` 当前子路径导出是否过宽
  - [x] 先把 `runtime-core` 收敛到稳定聚合入口 + 明确的 engine 入口
  - [x] 再继续收窄 `control-plane-core` 的逐文件子路径导出
  - [x] 为当前稳定入口补齐 smoke 断言，防止导出面回涨

- [x] TODO 2：继续拆薄 package 之间的依赖方向
  - [x] 评估 `control-plane-shell -> openclaw-adapter` 是否还能继续改成只依赖 shared runtime read-model contract
  - [x] 评估 `openclaw-adapter -> control-plane-core` 的默认 bridge 装配是否可以下沉到 app 层或独立 integration 层
  - [x] 记录当前依赖方向中仍然属于“过渡性装配”的部分
  - 当前已完成：
    - OpenClaw 专属 control-plane CLI 装配已回到 `apps/control-plane`
    - OpenClaw 插件默认 facade 装配已回到 `apps/openclaw-plugin`

## 当前仍属于过渡性装配的部分

- app 层默认装配点：
  - `apps/openclaw-plugin/src/index.ts`
    - 负责默认 `ControlPlaneFacade` 装配
  - `apps/control-plane/src/bin/openclaw-control-plane.ts`
    - 负责 OpenClaw runtime read-model + control-plane server 的 CLI 装配
- 兼容转发层：
  - `src/openclaw/*`
  - `src/plugin/*`
  - `src/control-plane/*`
  - `src/adapters/index.ts`

这些路径现在只承担迁移兼容和转发职责，不再承担主实现或默认装配职责。

- [x] TODO 3：彻底移除 `root-compat`
  - [x] 盘点当前 root `exports / bin` 仍承接的入口
    - root `exports`
      - `.`
      - `./contracts`
      - `./runtime-core`
      - `./control-plane-core`
      - `./openclaw`
    - root `bin`
      - `openclaw-context-plugin`
      - `openclaw-control-plane`
  - [x] 确认这些入口都已有明确的 workspace 对应落点
    - `packages/contracts`
    - `packages/runtime-core`
    - `packages/control-plane-core`
    - `packages/openclaw-adapter`
    - `apps/openclaw-plugin`
    - `apps/control-plane`
  - [x] 盘点当前 `root-compat` 实际仍承接的源码壳
    - `root-compat/index.ts`
    - `root-compat/contracts/index.ts`
    - `root-compat/runtime-core/index.ts`
    - `root-compat/control-plane-core/index.ts`
    - `root-compat/openclaw/index.ts`
    - `root-compat/adapters/index.ts`
    - `root-compat/adapters/openclaw/index.ts`
    - `root-compat/bin/openclaw-context-plugin.ts`
    - `root-compat/bin/openclaw-control-plane.ts`
  - [x] 让 root package 退化成纯 orchestrator
    - [x] 移除 root `exports`
    - [x] 移除 root `bin`
    - [x] 移除 root `openclaw.extensions` 的宿主入口声明
    - [x] 移除 root `start / start:plugin / start:control-plane` 对 `./dist/bin/*` 的依赖
  - [x] 删除 `root-compat/` 与 `tsconfig.root-package.json`
  - [x] 删除 root `build:root:compat`、`check:root:compat` 以及对它们的脚本依赖
  - [x] 把 root smoke 从“兼容壳验收”改成“workspace 编排验收”
    - [x] 更新 `test:smoke:root`
    - [x] 更新 `test:smoke:workspace`
    - [x] 更新 `workspace-smoke.test.ts` 中对 root `dist/*` 的存在断言
  - [x] 更新 README / 迁移说明，明确 root 不再是兼容发布单元，只负责 workspace 编排
    - [x] 更新仍引用 root `dist/bin/*` 的命令示例
    - [x] 更新仍描述 root 兼容壳的拆分文档

- [x] TODO 4：再整理一轮命名和导出语义
  - [x] 让 `adapter / shell / core / app` 四层的定位在包名、README 和导出路径上更一致
  - [x] 避免同一能力同时存在“旧别名 + 新包名 + root 兼容名”三种说法
  - [x] 收掉 `packages/openclaw-adapter` 中仅用于兼容的 `./adapters/openclaw` 导出别名
  - [x] 删除 `packages/openclaw-adapter/src/adapters/openclaw` 这类空兼容目录，并补 smoke 防回退
  - [x] 把 `packages/runtime-core/schema/sqlite/001_init.sql` 收成唯一 schema 真源
  - [x] 删除 root `schema/sqlite/001_init.sql` 这类重复副本，并把文档引用统一改到 package 内 schema
  - [x] 为插件侧和平台侧分别补一张“推荐依赖入口表”

- [ ] TODO 5：继续优化 workspace 构建与 smoke 链
  - [ ] 继续减少 `build:workspace` 和 `pack:workspace` 中的重复构建
    - [ ] 把 root `build:workspace` 拆成更明确的分层编排，例如：
      - shared packages：`contracts -> runtime-core -> control-plane-core`
      - adapter / shell：`openclaw-adapter -> control-plane-shell`
      - apps：`openclaw-plugin -> control-plane`
    - [ ] 避免 `test:package:*`、`test:app:*`、`test:smoke:*` 每次都重复触发整条 `build:workspace`
    - [ ] 评估是否为 `pack:workspace` 增加“仅校验现有产物”的模式，避免 pack 再次隐式重编
  - [ ] 评估是否引入 TS project references 或更明确的增量构建缓存
    - [ ] 先盘点每个 workspace 之间当前的编译依赖图
    - [ ] 评估 `tsc -b` 是否能覆盖当前 `contracts / runtime-core / control-plane-core / openclaw-adapter / control-plane-shell / apps` 的构建顺序
    - [ ] 如果暂不引入 project references，则至少补一版 repo 级增量构建缓存策略说明
  - [ ] 继续收轻 root 级编排脚本，减少“所有验证都堆在 root”带来的重链路
    - [ ] 让 package / app 自己承担更多 `build / check / test` 责任
    - [ ] root 只保留 orchestration，而不再夹带过多 workspace 内部细节
    - [ ] 盘点 `package.json` 中仍然过重的 root 脚本，并给出进一步下沉计划
  - [ ] 把最慢的 root smoke 进一步拆成“必要 smoke”和“发布 smoke”
    - [ ] `必要 smoke`：本地开发和日常 CI 必跑，优先覆盖边界回退和最小整体验收
    - [ ] `发布 smoke`：只在 release / pack / prepublish 场景跑，允许更重
    - [ ] 明确两者与 `debug smoke`、`evaluation` 的职责边界
    - [ ] 为 smoke 链补一版耗时基线，避免后续继续无感膨胀

- [ ] TODO 6：继续收紧测试与发布边界
  - [ ] 继续把测试按 `package unit / app integration / root smoke` 三层拆得更独立
    - [ ] 盘点当前 `src/tests` 中哪些仍然混合了 package / app / root 关注点
    - [ ] 把 package 级测试继续往各自 workspace 的职责边界收口
    - [ ] 明确哪些测试必须保留在 root 作为跨 workspace 验收
  - [ ] 让 package unit tests 更少依赖 root 编译产物
    - [ ] 优先减少 package 测试对 repo 级 `tsc -p tsconfig.json` 产物的依赖
    - [ ] 评估是否能让 package 测试直接基于 workspace 自己的 `dist` 或局部编译结果运行
    - [ ] 补充约束：package 测试不应再依赖已移除的 root compat 假设
  - [ ] 让 app integration tests 更明确只验证壳层行为
    - [ ] OpenClaw plugin app：只验证 manifest、依赖、默认装配点和 thin shell `dist`
    - [ ] control-plane app：只验证 CLI / client / shell 组合关系和 thin shell `dist`
    - [ ] 避免在 app 测试里重复验证 core/runtime 细节
  - [ ] 让 root 级测试只保留跨 workspace 的整体验收，而不再承担过多细粒度验证
    - [ ] root smoke 只验证 pack/build/output 边界、层间依赖方向和最小运行链
    - [ ] debug smoke / evaluation 不再被误用成 package 单测替代物
    - [ ] 对 root 级测试建立“新增必须说明为什么不能下沉”的规则
  - [ ] 继续细化每个 workspace 的 `files / exports / prepack / publish` 职责
    - [ ] 为每个 workspace 补一版发布清单审计：
      - `files`
      - `exports`
      - `bin`
      - `openclaw.extensions`
      - `prepack`
    - [ ] 建立 pack dry-run 的验收矩阵，明确哪些目录绝不能再次进入产物
    - [ ] 把这套发布边界同步到 README 或发布说明，避免只存在于 TODO 里

- [ ] TODO 7：继续收缩 `src/*` 兼容转发层
  - [ ] 盘点当前 `src/*` 下仍然属于纯转发的目录与文件
    - [ ] `src/openclaw/*`
    - [ ] `src/plugin/*`
    - [ ] `src/control-plane/*`
    - [ ] `src/runtime/*`
    - [ ] `src/context-processing/*`
    - [ ] `src/governance/*`
    - [ ] `src/infrastructure/*`
    - [ ] `src/runtime-core/*`
    - [ ] `src/adapters/index.ts`
    - [ ] `src/bin/*`
  - [ ] 区分哪些 compat 入口仍需保留迁移窗口，哪些已经可以继续删除
  - [ ] 对仍保留的 compat 层建立统一规则：
    - [ ] 只允许转发，不允许新增真实实现
    - [ ] README / 设计文档里不再把它们描述为推荐主入口
    - [ ] 对新增 compat 入口建立显式审查约束
  - [ ] 对已不需要的 compat 层继续删减，并补 smoke 防止旧目录回流
  - [ ] 把这批 compat 入口整理成一张“保留 / 待删 / 已删”清单，避免后续判断反复摇摆

- [ ] TODO 8：明确剩余 `src` 目录的长期归属
  - [ ] 把 `src` 下剩余目录明确分成两类：
    - [ ] repo 内部长期源码层
      - [ ] `src/types`
      - [ ] `src/contracts`
      - [ ] `src/evaluation`
      - [ ] `src/tests`
    - [ ] 迁移窗口 compat 层
  - [ ] 为 repo 内部长期源码层补一版边界说明：
    - [ ] 为什么它们继续留在 root `src`
    - [ ] 什么情况下才值得再拆成独立 package
    - [ ] 哪些目录绝不能再回流成“兼容杂物间”
  - [ ] 评估 `src/evaluation` 是否需要后续单独 package 化，还是长期保持 repo-internal
  - [ ] 评估 `src/tests` 是否需要继续按 workspace 拆分测试目录，还是维持 repo-level test harness
  - [ ] 在架构文档里明确：后续目标不是“清空整个 src”，而是“只保留有长期价值的 repo 内部源码”

- [ ] TODO 9：为真正独立发布单元 / 多仓准备收尾
  - [ ] 为每个 workspace 明确“是否值得独立发布 / 独立仓库化”的判断标准
    - [ ] `contracts`
    - [ ] `runtime-core`
    - [ ] `control-plane-core`
    - [ ] `openclaw-adapter`
    - [ ] `control-plane-shell`
    - [ ] `apps/*`
  - [ ] 补一版 workspace 版本联动策略
    - [ ] 哪些包应该锁步版本
    - [ ] 哪些包可以独立演进
    - [ ] 什么时候需要 breaking change migration note
  - [ ] 补一版消费者迁移策略
    - [ ] 从 root 旧入口迁到 workspace 新入口
    - [ ] 从 compat `src/*` 入口迁到 package 正式入口
  - [ ] 评估是否需要引入 release automation / changelog / tag 策略
  - [ ] 在真正考虑多仓之前，先达到“workspace 单元可以独立 build / pack / test / explain”的验收基线

## 推荐顺序

1. `shared package public API 收窄`
2. `依赖方向再拆薄`
3. `移除 root-compat 并收口命名语义`
4. `构建链和发布边界优化`
5. `src compat 收缩与 repo 内部源码边界澄清`
6. `独立发布单元 / 多仓准备`

## 完成标志

这份 TODO 可以视为完成的条件是：
- shared package 的 public API 已经稳定且足够小
- package 之间的依赖方向更接近最终目标，不再保留明显的过渡性装配耦合
- `root-compat` 已经被移除，root 只负责 workspace 编排
- `adapter / shell / core / app` 四层对内对外的命名和导出语义一致
- workspace 构建、pack 和 smoke 的成本进一步下降
- `src/*` 中仍保留的目录已经明确区分为“repo 内部长期源码”与“迁移 compat 层”
- 如需继续走向独立发布单元或多仓，已经具备清晰的版本、迁移和验收策略
