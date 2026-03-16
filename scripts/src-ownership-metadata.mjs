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

export const ACTIVE_SRC_COMPAT_ENTRIES = [
  {
    path: 'src/index.ts',
    kind: 'file',
    role: 'compat',
    targetState: 'retire-after-root-src-aggregate-window',
    reason: 'root 级历史聚合入口，仅保留顶层 src 导入兼容。'
  },
  {
    path: 'src/openclaw',
    kind: 'dir',
    role: 'compat',
    targetState: 'retire-after-host-migration-window',
    reason: 'OpenClaw 宿主适配的历史 src 入口。'
  },
  {
    path: 'src/plugin',
    kind: 'dir',
    role: 'compat',
    targetState: 'retire-after-plugin-migration-window',
    reason: '插件 API / bridge / stdio 的历史 src 入口。'
  },
  {
    path: 'src/control-plane',
    kind: 'dir',
    role: 'compat',
    targetState: 'retire-after-platform-migration-window',
    reason: 'control-plane shell 的历史 src 聚合入口。'
  },
  {
    path: 'src/control-plane-core',
    kind: 'dir',
    role: 'compat',
    targetState: 'retire-after-platform-migration-window',
    reason: 'control-plane-core 的历史 src 聚合入口，当前只保留 package 根入口别名。'
  }
];

export const SRC_OWNERSHIP_RULES = [
  'repo-internal 源码可以承载真实实现，但默认不直接作为公开发布入口。',
  'compat 源码只允许做单跳转发，不允许新增真实实现、状态或业务逻辑。',
  '后续新增 src 目录前，必须先判断它属于 repo-internal 长期源码还是迁移 compat，不允许创建语义不清的中间层。',
  '如果某个 repo-internal 目录需要稳定 public API、独立版本节奏或独立发布责任，优先评估提升为 workspace package。'
];
