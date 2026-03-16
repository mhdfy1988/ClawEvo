export const LONG_LIVED_REPO_SRC_AREAS = [
  {
    path: 'src/types',
    kind: 'dir',
    role: 'repo-internal',
    reason: '共享纯类型真源，供 contracts 包和 repo 内部源码共同使用。'
  },
  {
    path: 'src/contracts',
    kind: 'dir',
    role: 'repo-internal',
    reason: 'contracts 包的源码输入层，保持 repo 内部 contracts 聚合真源。'
  },
  {
    path: 'src/evaluation',
    kind: 'dir',
    role: 'repo-internal',
    reason: '跨 workspace 的评估链路与报告格式仍以 repo-level harness 组织。'
  },
  {
    path: 'src/tests',
    kind: 'dir',
    role: 'repo-internal',
    reason: 'root smoke、evaluation 和跨 workspace 验收仍依赖统一测试源码层。'
  }
];

export const ACTIVE_SRC_COMPAT_ENTRIES = [
  {
    path: 'src/index.ts',
    kind: 'file',
    role: 'compat',
    reason: 'root 源码聚合入口，仅保留历史 src 级导入兼容。'
  },
  {
    path: 'src/openclaw',
    kind: 'dir',
    role: 'compat',
    reason: 'OpenClaw 宿主适配的历史 src 入口，仍承接迁移窗口内的宿主侧导入。'
  },
  {
    path: 'src/plugin',
    kind: 'dir',
    role: 'compat',
    reason: '插件 API、bridge 和 stdio 的历史 src 入口，仍承接迁移窗口内的插件侧导入。'
  },
  {
    path: 'src/control-plane',
    kind: 'dir',
    role: 'compat',
    reason: 'control-plane shell 的历史 src 入口，仍承接迁移窗口内的平台侧导入。'
  },
  {
    path: 'src/control-plane-core',
    kind: 'dir',
    role: 'compat',
    reason: 'control-plane-core 的历史 src 聚合入口，目前只做向 compat shell 的转发。'
  },
  {
    path: 'src/engine',
    kind: 'dir',
    role: 'compat',
    reason: 'runtime-core engine 的历史 src 入口，目前只做单跳转发。'
  },
  {
    path: 'src/adapters/index.ts',
    kind: 'file',
    role: 'compat',
    reason: '最小 compat adapters 聚合入口，保留给旧的 adapters 顶层导入。'
  },
  {
    path: 'src/bin',
    kind: 'dir',
    role: 'compat',
    reason: '历史 CLI 壳入口，当前只做单跳转发。'
  }
];

export const SRC_OWNERSHIP_RULES = [
  'repo-internal 源码可以承载真实实现，但默认不直接作为公开发布入口。',
  'compat 源码只允许做单跳转发，不允许新增真实实现、状态或业务逻辑。',
  '后续新增 src 目录前，必须先判断它属于 repo-internal 长期源码还是迁移 compat；不能创建语义不清的中间层。',
  '若某个 repo-internal 目录需要稳定 public API、独立版本节奏或独立发布责任，优先评估提升为 workspace package，而不是继续扩张 root src。'
];
