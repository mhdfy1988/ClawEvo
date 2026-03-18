export const ACTIVE_SRC_COMPAT_ENTRIES = [];

export const REMOVED_SRC_COMPAT_PATHS = [
  'root-compat',
  'src/core',
  'src/adapters',
  'src/index.ts',
  'src/openclaw',
  'src/plugin',
  'src/control-plane',
  'src/compact-context-core',
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
  'legacy compat 入口已经全部移除；README 和设计文档必须直接指向 apps/* 或 packages/* 正式入口。',
  'root src 下不允许恢复新的 compat 转发层；如果确有迁移窗口需求，必须先完成专项评审并同步 smoke。',
  '新增 repo-internal src 目录前，必须明确它属于长期内部源码，而不是隐式兼容层。'
];

export function listCompatEntriesByStatus(status) {
  return ACTIVE_SRC_COMPAT_ENTRIES.filter((entry) => entry.status === status);
}
