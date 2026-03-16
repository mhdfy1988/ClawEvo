export const ACTIVE_SRC_COMPAT_ENTRIES = [
  {
    path: 'src/index.ts',
    kind: 'file',
    status: 'keep',
    targetState: 'retire-after-root-src-aggregate-window',
    keepReason: 'root 级历史聚合入口，当前只保留顶层 src 导入兼容。',
    internalRepoUsage: 'minimal',
    preferredTarget: '按能力直接迁移到对应的 apps/* 或 packages/* 正式入口。',
    deleteWhen: [
      '确认外部消费者不再依赖 root 级 src 聚合导入。',
      'root 级聚合入口完成最终退役方案。'
    ]
  },
  {
    path: 'src/openclaw',
    kind: 'dir',
    status: 'keep',
    targetState: 'retire-after-host-migration-window',
    keepReason: 'OpenClaw 宿主适配的历史 src 入口，仍承接宿主侧旧导入。',
    internalRepoUsage: 'none',
    preferredTarget: '@openclaw-compact-context/openclaw-adapter/openclaw/*',
    deleteWhen: [
      'repo 内部源码与测试持续保持零引用。',
      '迁移文档和外部集成说明不再把它列为仍在窗口内的旧入口。'
    ]
  },
  {
    path: 'src/plugin',
    kind: 'dir',
    status: 'keep',
    targetState: 'retire-after-plugin-migration-window',
    keepReason: '插件 API / bridge / stdio 的历史 src 入口，保留给旧插件侧导入窗口。',
    internalRepoUsage: 'none',
    preferredTarget: '@openclaw-compact-context/openclaw-adapter/plugin/*',
    deleteWhen: [
      'repo 内部源码与测试持续保持零引用。',
      '确认旧 plugin / stdio 消费面已可接受 breaking removal。'
    ]
  },
  {
    path: 'src/control-plane',
    kind: 'dir',
    status: 'keep',
    targetState: 'retire-after-platform-migration-window',
    keepReason: 'control-plane 的历史 src 聚合入口，当前直接转发到 control-plane-core 与 control-plane-shell。',
    internalRepoUsage: 'minimal',
    preferredTarget: '@openclaw-compact-context/control-plane-core 或 @openclaw-compact-context/control-plane-shell/*',
    deleteWhen: [
      'repo 内部源码不再需要任何 src/control-plane compat 跳转。',
      '外部迁移说明已统一切到 package/app 入口。'
    ]
  },
  {
    path: 'src/control-plane-core',
    kind: 'dir',
    status: 'keep',
    targetState: 'retire-after-platform-migration-window',
    keepReason: 'control-plane-core 的历史 src 聚合入口，当前只做 package 根入口别名。',
    internalRepoUsage: 'minimal',
    preferredTarget: '@openclaw-compact-context/control-plane-core',
    deleteWhen: [
      'repo 内部源码与文档不再需要 src/control-plane-core compat 说明。',
      'control-plane-core 的正式包入口稳定替代所有旧导入。'
    ]
  }
];

export const REMOVED_SRC_COMPAT_PATHS = [
  'root-compat',
  'src/core',
  'src/adapters',
  'src/runtime',
  'src/context-processing',
  'src/governance',
  'src/infrastructure',
  'src/runtime-core/index.ts',
  'src/engine',
  'src/bin',
  'packages/openclaw-adapter/src/adapters/openclaw'
];

export const SRC_COMPAT_RULES = [
  'compat 入口只允许做单跳转发，不允许新增真实实现、状态或业务逻辑。',
  'README 和设计文档不再把 compat 入口描述为推荐主入口；推荐入口应指向 apps/* 或 packages/*。',
  '新增 compat 入口前，必须先说明为什么现有 package/app 入口不足，并同步补 smoke 审查。'
];

export function listCompatEntriesByStatus(status) {
  return ACTIVE_SRC_COMPAT_ENTRIES.filter((entry) => entry.status === status);
}
