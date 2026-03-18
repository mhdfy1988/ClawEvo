export const WORKSPACES = {
  contracts: {
    name: '@openclaw-compact-context/contracts',
    dir: 'packages/contracts',
    deps: []
  },
  llmToolkit: {
    name: '@openclaw-compact-context/llm-toolkit',
    dir: 'packages/llm-toolkit',
    deps: []
  },
  runtimeCore: {
    name: '@openclaw-compact-context/runtime-core',
    dir: 'packages/runtime-core',
    deps: ['@openclaw-compact-context/contracts']
  },
  controlPlaneCore: {
    name: '@openclaw-compact-context/compact-context-core',
    dir: 'packages/compact-context-core',
    deps: ['@openclaw-compact-context/contracts']
  },
  openclawAdapter: {
    name: '@openclaw-compact-context/openclaw-adapter',
    dir: 'packages/openclaw-adapter',
    deps: ['@openclaw-compact-context/contracts', '@openclaw-compact-context/runtime-core']
  },
  controlPlaneShell: {
    name: '@openclaw-compact-context/control-plane-shell',
    dir: 'packages/control-plane-shell',
    deps: ['@openclaw-compact-context/contracts', '@openclaw-compact-context/compact-context-core']
  },
  openclawPlugin: {
    name: '@openclaw-compact-context/compact-context',
    dir: 'apps/openclaw-plugin',
    releaseDirName: 'compact-context',
    deps: [
      '@openclaw-compact-context/compact-context-core',
      '@openclaw-compact-context/openclaw-adapter',
      '@openclaw-compact-context/llm-toolkit'
    ]
  },
  controlPlane: {
    name: '@openclaw-compact-context/control-plane',
    dir: 'apps/control-plane',
    deps: [
      '@openclaw-compact-context/compact-context-core',
      '@openclaw-compact-context/openclaw-adapter',
      '@openclaw-compact-context/control-plane-shell'
    ]
  }
};

const WORKSPACE_BY_NAME = new Map(Object.values(WORKSPACES).map((descriptor) => [descriptor.name, descriptor]));

export const SHARED_WORKSPACES = [
  WORKSPACES.contracts,
  WORKSPACES.llmToolkit,
  WORKSPACES.runtimeCore,
  WORKSPACES.controlPlaneCore
];

export const SHELL_WORKSPACES = [WORKSPACES.openclawAdapter, WORKSPACES.controlPlaneShell];

export const APP_WORKSPACES = [WORKSPACES.openclawPlugin, WORKSPACES.controlPlane];
export const RELEASE_WORKSPACES = [...APP_WORKSPACES];

export const PACKAGE_WORKSPACES = [...SHARED_WORKSPACES, ...SHELL_WORKSPACES];

export const PACK_WORKSPACES = [...PACKAGE_WORKSPACES, ...APP_WORKSPACES];

export const WORKSPACE_GROUPS = {
  shared: SHARED_WORKSPACES,
  shells: SHELL_WORKSPACES,
  apps: APP_WORKSPACES,
  release: RELEASE_WORKSPACES,
  packages: PACKAGE_WORKSPACES,
  pack: PACK_WORKSPACES
};

export const WORKSPACE_DEPENDENCY_GRAPH = Object.fromEntries(
  Object.values(WORKSPACES).map((descriptor) => [descriptor.name, [...descriptor.deps]])
);

function pushPath(target, candidate) {
  if (typeof candidate !== 'string') {
    return;
  }

  const normalized = candidate.replace(/^\.\/+/, '').replace(/\\/g, '/');
  if (!normalized || normalized.includes('*')) {
    return;
  }

  target.add(normalized);
}

function collectExportPaths(value, target) {
  if (typeof value === 'string') {
    pushPath(target, value);
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const nestedValue of Object.values(value)) {
    collectExportPaths(nestedValue, target);
  }
}

export function expandWorkspaceArgs(args) {
  const expanded = [];

  for (const arg of args) {
    const group = WORKSPACE_GROUPS[arg];
    if (group) {
      expanded.push(...group);
      continue;
    }

    const descriptor = Object.values(WORKSPACES).find((candidate) => candidate.name === arg);
    if (descriptor) {
      expanded.push(descriptor);
      continue;
    }

    throw new Error(`[workspace-metadata] unknown workspace or group: ${arg}`);
  }

  return [...new Map(expanded.map((descriptor) => [descriptor.name, descriptor])).values()];
}

export function getWorkspaceByName(name) {
  const descriptor = WORKSPACE_BY_NAME.get(name);
  if (!descriptor) {
    throw new Error(`[workspace-metadata] unknown workspace: ${name}`);
  }

  return descriptor;
}

export function collectWorkspaceClosure(descriptors) {
  const closure = new Map();

  function visit(descriptor) {
    if (closure.has(descriptor.name)) {
      return;
    }

    closure.set(descriptor.name, descriptor);
    for (const dependencyName of descriptor.deps) {
      visit(getWorkspaceByName(dependencyName));
    }
  }

  for (const descriptor of descriptors) {
    visit(descriptor);
  }

  return [...closure.values()];
}

export function topologicallySortWorkspaces(descriptors) {
  const selectedByName = new Map(descriptors.map((descriptor) => [descriptor.name, descriptor]));
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];

  function visit(descriptor) {
    if (visited.has(descriptor.name)) {
      return;
    }

    if (visiting.has(descriptor.name)) {
      throw new Error(`[workspace-metadata] dependency cycle detected at ${descriptor.name}`);
    }

    visiting.add(descriptor.name);
    for (const dependencyName of descriptor.deps) {
      const dependency = selectedByName.get(dependencyName);
      if (dependency) {
        visit(dependency);
      }
    }
    visiting.delete(descriptor.name);
    visited.add(descriptor.name);
    ordered.push(descriptor);
  }

  for (const descriptor of descriptors) {
    visit(descriptor);
  }

  return ordered;
}

export function describeWorkspaceDependencyGraph() {
  return Object.values(WORKSPACES).map((descriptor) => ({
    name: descriptor.name,
    dir: descriptor.dir,
    deps: [...descriptor.deps]
  }));
}

export function collectManifestArtifactPaths(packageJson) {
  const paths = new Set();

  for (const fileEntry of packageJson.files ?? []) {
    pushPath(paths, fileEntry);
  }

  pushPath(paths, packageJson.main);
  pushPath(paths, packageJson.types);

  if (typeof packageJson.bin === 'string') {
    pushPath(paths, packageJson.bin);
  } else if (packageJson.bin && typeof packageJson.bin === 'object') {
    for (const value of Object.values(packageJson.bin)) {
      pushPath(paths, value);
    }
  }

  collectExportPaths(packageJson.exports, paths);

  const openclawExtensions = packageJson.openclaw?.extensions;
  if (Array.isArray(openclawExtensions)) {
    for (const extensionEntry of openclawExtensions) {
      pushPath(paths, extensionEntry);
    }
  }

  return [...paths].sort();
}
