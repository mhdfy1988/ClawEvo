export const LONG_LIVED_REPO_SRC_AREAS = [
  {
    path: 'src/types',
    kind: 'dir',
    role: 'repo-internal',
    targetState: 'retain-as-repo-internal',
    reason: '共享纯类型真源，供 contracts 包和 repo 内部源码共同使用。'
  },
  {
    path: 'src/contracts',
    kind: 'dir',
    role: 'repo-internal',
    targetState: 'retain-as-repo-internal',
    reason: 'contracts 包的源码输入层，保留 repo 内部 contracts 聚合真源。'
  },
  {
    path: 'src/evaluation',
    kind: 'dir',
    role: 'repo-internal',
    targetState: 'retain-as-repo-internal',
    reason: 'repo-level evaluation harness，负责跨 workspace 评估输入、输出和报告格式。'
  },
  {
    path: 'src/tests',
    kind: 'dir',
    role: 'repo-internal',
    targetState: 'retain-as-repo-internal',
    reason: 'root smoke、evaluation 与跨 workspace 整体验收测试。'
  }
];

export const ACTIVE_SRC_COMPAT_ENTRIES = [];

export const SRC_OWNERSHIP_RULES = [
  'repo-internal 源码可以承载真实实现，但默认不直接作为公开发布入口。',
  'legacy compat 转发层已经完成退役；后续不允许在 root src 下重新引入未申明的兼容层。',
  '后续新增 src 目录前，必须先判断它属于 repo-internal 长期源码还是短期迁移物，并记录清楚目标状态。',
  '如果某个 repo-internal 目录需要稳定 public API、独立版本节奏或独立发布责任，优先评估提升为 workspace package。'
];
