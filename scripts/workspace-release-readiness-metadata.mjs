import { PACK_WORKSPACES } from './workspace-metadata.mjs';

export const WORKSPACE_RELEASE_READINESS = [
  {
    name: '@openclaw-compact-context/contracts',
    dir: 'packages/contracts',
    unitKind: 'shared-package',
    publishRole: 'public-foundation',
    independentPublish: 'candidate-later',
    multiRepoReadiness: 'candidate-later',
    rationale:
      '共享 contracts/types 表面已经很小，未来如果出现外部消费节奏，可以优先成为独立发布候选，但当前仍建议与 monorepo 发布列车保持锁步。'
  },
  {
    name: '@openclaw-compact-context/llm-toolkit',
    dir: 'packages/llm-toolkit',
    unitKind: 'shared-package',
    publishRole: 'llm-foundation',
    independentPublish: 'candidate-later',
    multiRepoReadiness: 'candidate-later',
    rationale:
      'llm-toolkit 宸茬粡鎶?provider catalog / runtime transport / model state 鎶借薄鎴愬崟鐙寘锛屾湭鏉ュ鏋滃嚭鐜板妯″瀷鎴栧椤圭洰澶嶇敤闇€姹傦紝鍙互浼樺厛鎴愪负鐙珛鍙戝竷鍊欓€夈€?'
  },
  {
    name: '@openclaw-compact-context/runtime-core',
    dir: 'packages/runtime-core',
    unitKind: 'shared-package',
    publishRole: 'public-foundation',
    independentPublish: 'candidate-later',
    multiRepoReadiness: 'candidate-later',
    rationale:
      'runtime-core 是共享底座主实现，未来最有机会成为独立发布单元，但在当前阶段仍与 contracts / adapter / apps 强耦合，先维持单仓锁步。'
  },
  {
    name: '@openclaw-compact-context/control-plane-core',
    dir: 'packages/control-plane-core',
    unitKind: 'shared-package',
    publishRole: 'platform-foundation',
    independentPublish: 'monorepo-first',
    multiRepoReadiness: 'not-now',
    rationale:
      'platform core 目前主要服务 control-plane shell 与 apps，外部消费面还不稳定，更适合继续作为 monorepo 内部平台核心。'
  },
  {
    name: '@openclaw-compact-context/openclaw-adapter',
    dir: 'packages/openclaw-adapter',
    unitKind: 'shell-package',
    publishRole: 'host-adapter',
    independentPublish: 'candidate-later',
    multiRepoReadiness: 'candidate-later',
    rationale:
      '宿主适配层已经有清晰包边界，未来如果要支持 OpenClaw 外部安装，可成为独立发布候选；当前仍依赖 runtime-core 的同步演进。'
  },
  {
    name: '@openclaw-compact-context/control-plane-shell',
    dir: 'packages/control-plane-shell',
    unitKind: 'shell-package',
    publishRole: 'platform-shell',
    independentPublish: 'monorepo-first',
    multiRepoReadiness: 'not-now',
    rationale:
      'control-plane shell 目前主要承接 server / console / client 薄壳，不建议单独仓库化，继续作为平台内部壳层更稳。'
  },
  {
    name: '@openclaw-compact-context/compact-context',
    dir: 'apps/openclaw-plugin',
    unitKind: 'app-shell',
    publishRole: 'runtime-app',
    independentPublish: 'app-only',
    multiRepoReadiness: 'not-now',
    rationale:
      '插件 app 是可运行薄壳，不是共享库。它适合作为独立安装/发布单元，但不适合在当前阶段先拆成多仓主包。'
  },
  {
    name: '@openclaw-compact-context/control-plane',
    dir: 'apps/control-plane',
    unitKind: 'app-shell',
    publishRole: 'platform-app',
    independentPublish: 'app-only',
    multiRepoReadiness: 'not-now',
    rationale:
      'control-plane app 是部署壳层，适合独立运行与交付，但底层仍依赖 control-plane-core / shell / adapter 的同仓协同。'
  }
];

export const CURRENT_VERSION_STRATEGY = {
  mode: 'lockstep-release-train',
  lockstepWorkspaces: PACK_WORKSPACES.map((workspace) => workspace.name),
  futureIndependentCandidates: [
    '@openclaw-compact-context/contracts',
    '@openclaw-compact-context/runtime-core',
    '@openclaw-compact-context/openclaw-adapter'
  ],
  keepMonorepoFirst: [
    '@openclaw-compact-context/control-plane-core',
    '@openclaw-compact-context/control-plane-shell',
    '@openclaw-compact-context/compact-context',
    '@openclaw-compact-context/control-plane'
  ],
  requireBreakingChangeMigrationNoteWhen: [
    '公共 package 的 exports/main/types/bin/openclaw.extensions 发生 breaking change',
    '消费者推荐入口从一个 workspace 包迁移到另一个 workspace 包',
    'compat src 入口被删除或停止支持',
    'workspace 发布角色从 monorepo-first 变成独立发布候选'
  ]
};

export const CONSUMER_MIGRATION_PATHS = [
  {
    from: 'root exports / root bin / root openclaw.extensions',
    to: 'workspace packages and apps',
    status: 'completed',
    guidance:
      '消费者应直接使用 apps/* 和 packages/* 的正式入口；root package 只保留 workspace 编排职责。'
  },
  {
    from: 'src/openclaw/*',
    to: '@openclaw-compact-context/openclaw-adapter/openclaw',
    status: 'migration-window',
    guidance: 'OpenClaw 宿主适配入口统一迁到 openclaw-adapter/openclaw。'
  },
  {
    from: 'src/plugin/*',
    to: '@openclaw-compact-context/openclaw-adapter/plugin/*',
    status: 'migration-window',
    guidance: '插件 API / bridge / stdio 统一迁到 openclaw-adapter/plugin/*。'
  },
  {
    from: 'src/control-plane/*',
    to: '@openclaw-compact-context/control-plane-shell/* or @openclaw-compact-context/control-plane-core',
    status: 'migration-window',
    guidance: '平台 shell 入口走 control-plane-shell，平台核心服务走 control-plane-core 聚合入口。'
  },
  {
    from: 'src/control-plane-core/*',
    to: '@openclaw-compact-context/control-plane-core',
    status: 'migration-window',
    guidance: '不再推荐逐文件子路径导入，统一改走 control-plane-core 根入口。'
  },
  {
    from: 'src/engine/*',
    to: '@openclaw-compact-context/runtime-core/engine/context-engine',
    status: 'migration-window',
    guidance: 'engine 真源已迁到 runtime-core，对外只保留稳定 engine 子入口。'
  },
  {
    from: 'src/index.ts',
    to: '@openclaw-compact-context/runtime-core and other workspace package entrypoints',
    status: 'migration-window',
    guidance: '不要再把 root src 聚合入口当正式 API，按能力选择对应 workspace 包。'
  }
];

export const RELEASE_AUTOMATION_STRATEGY = {
  currentMode: 'manual-release-train-with-pack-and-smoke',
  currentControls: [
    'workspace build/check/pack 依赖图编排',
    'pack:workspace dry-run 先校验 manifest 产物',
    'required smoke / release smoke 分层',
    'workspace-artifacts 并发锁'
  ],
  notAdoptingYet: [
    '当前 workspace 版本仍锁步演进，引入复杂 release automation 的收益有限',
    'compat 收尾和 src 边界仍在继续收紧，先稳定发布边界再引入 changelog/tag 体系更稳'
  ],
  adoptWhen: [
    '至少有一个 shared package 开始按独立节奏发布',
    '需要自动生成 breaking change migration note',
    '需要对 apps/* 与 packages/* 分别打 tag 或维护多条发布列车'
  ],
  recommendedNextStep: '后续如要引入自动化，优先评估 changesets 或等价的 monorepo release 工具。'
};

export const MULTI_REPO_ACCEPTANCE_BASELINE = [
  '每个 workspace 都能独立 build / check / explain',
  '所有 publishable workspace 都能通过 pack:workspace dry-run 审计',
  'package / app / root smoke 三层测试责任已固定，不再依赖 root compat 假设',
  '消费者迁移路径和 breaking change note 规则已经文档化',
  'lockstep 与 future-independent 候选已明确，不再靠口头约定'
];
