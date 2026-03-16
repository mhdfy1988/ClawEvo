export const ACTIVE_SRC_COMPAT_ENTRIES = [
  {
    path: 'src/index.ts',
    kind: 'file',
    status: 'keep',
    reason: 'root 源码聚合入口，仅保留历史 src 级导入兼容。'
  },
  {
    path: 'src/openclaw',
    kind: 'dir',
    status: 'keep',
    reason: 'OpenClaw 宿主适配的历史 src 入口，仍承接迁移窗口内的宿主侧导入。'
  },
  {
    path: 'src/plugin',
    kind: 'dir',
    status: 'keep',
    reason: '插件 API、bridge 和 stdio 的历史 src 入口，仍承接迁移窗口内的插件侧导入。'
  },
  {
    path: 'src/control-plane',
    kind: 'dir',
    status: 'keep',
    reason: 'control-plane shell/core 的历史 src 入口，仍承接迁移窗口内的平台侧导入。'
  },
  {
    path: 'src/control-plane-core',
    kind: 'dir',
    status: 'keep',
    reason: 'control-plane-core 的历史 src 聚合入口，目前只做 compat 聚合转发。'
  },
  {
    path: 'src/engine',
    kind: 'dir',
    status: 'keep',
    reason: 'runtime-core engine 的历史 src 入口，目前只做单跳转发。'
  },
  {
    path: 'src/adapters/index.ts',
    kind: 'file',
    status: 'keep',
    reason: '最小 compat 聚合入口，保留给旧的 adapters 顶层导入。'
  },
  {
    path: 'src/bin',
    kind: 'dir',
    status: 'keep',
    reason: '历史 CLI 壳入口，当前只做单跳转发。'
  }
];

export const REMOVED_SRC_COMPAT_PATHS = [
  'root-compat',
  'src/core',
  'src/adapters/openclaw',
  'packages/openclaw-adapter/src/adapters/openclaw',
  'src/runtime',
  'src/context-processing',
  'src/governance',
  'src/infrastructure',
  'src/runtime-core/index.ts'
];

export const SRC_COMPAT_RULES = [
  'compat 入口只允许做单跳转发，不允许新增真实实现、状态或业务逻辑。',
  'README / 设计文档不再把 compat 入口描述为推荐主入口；推荐入口应指向 apps/* 或 packages/*。',
  '新增 compat 入口前，必须先说明为什么现有 package/app 入口不足，并同步补 smoke 审查。'
];

export function listCompatEntriesByStatus(status) {
  return ACTIVE_SRC_COMPAT_ENTRIES.filter((entry) => entry.status === status);
}
