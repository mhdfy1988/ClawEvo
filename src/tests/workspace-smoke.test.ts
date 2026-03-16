import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, relative } from 'node:path';
import { resolveRepoRoot } from './repo-root.js';
import * as ts from 'typescript';

const REPO_ROOT = resolveRepoRoot(import.meta.url);

async function collectTypeScriptFiles(targetPath: string): Promise<string[]> {
  const absoluteTargetPath = resolve(REPO_ROOT, targetPath);
  const entries = await readdir(absoluteTargetPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absoluteEntryPath = resolve(absoluteTargetPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(relative(REPO_ROOT, absoluteEntryPath))));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(absoluteEntryPath);
    }
  }

  return files;
}

test('publishable workspaces expose materialized manifests and entrypoints', async () => {
  const rootPackage = JSON.parse(await readFile(resolve(REPO_ROOT, 'package.json'), 'utf8')) as {
    workspaces?: string[];
    exports?: Record<string, unknown>;
    bin?: Record<string, string>;
    openclaw?: Record<string, unknown>;
  };
  const workspaceMetadata = (await import(
    pathToFileURL(resolve(REPO_ROOT, 'scripts/workspace-metadata.mjs')).href
  )) as {
    PACK_WORKSPACES: Array<{ name: string; dir: string }>;
    WORKSPACE_DEPENDENCY_GRAPH: Record<string, string[]>;
    collectManifestArtifactPaths: (packageJson: {
      files?: string[];
      exports?: Record<string, unknown>;
      bin?: string | Record<string, string>;
      main?: string;
      openclaw?: { extensions?: string[] };
      types?: string;
    }) => string[];
  };

  assert.deepEqual(rootPackage.workspaces, ['apps/*', 'packages/*']);
  assert.equal(rootPackage.exports, undefined);
  assert.equal(rootPackage.bin, undefined);
  assert.equal(rootPackage.openclaw, undefined);
  assert.deepEqual(
    workspaceMetadata.PACK_WORKSPACES.map((workspace) => workspace.name),
    [
      '@openclaw-compact-context/contracts',
      '@openclaw-compact-context/runtime-core',
      '@openclaw-compact-context/control-plane-core',
      '@openclaw-compact-context/openclaw-adapter',
      '@openclaw-compact-context/control-plane-shell',
      '@openclaw-compact-context/openclaw-plugin',
      '@openclaw-compact-context/control-plane'
    ]
  );
  assert.deepEqual(workspaceMetadata.WORKSPACE_DEPENDENCY_GRAPH, {
    '@openclaw-compact-context/contracts': [],
    '@openclaw-compact-context/runtime-core': ['@openclaw-compact-context/contracts'],
    '@openclaw-compact-context/control-plane-core': ['@openclaw-compact-context/contracts'],
    '@openclaw-compact-context/openclaw-adapter': [
      '@openclaw-compact-context/contracts',
      '@openclaw-compact-context/runtime-core'
    ],
    '@openclaw-compact-context/control-plane-shell': [
      '@openclaw-compact-context/contracts',
      '@openclaw-compact-context/control-plane-core'
    ],
    '@openclaw-compact-context/openclaw-plugin': [
      '@openclaw-compact-context/control-plane-core',
      '@openclaw-compact-context/openclaw-adapter'
    ],
    '@openclaw-compact-context/control-plane': [
      '@openclaw-compact-context/control-plane-core',
      '@openclaw-compact-context/openclaw-adapter',
      '@openclaw-compact-context/control-plane-shell'
    ]
  });

  for (const workspace of workspaceMetadata.PACK_WORKSPACES) {
    const packageJsonPath = resolve(REPO_ROOT, workspace.dir, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as Parameters<
      typeof workspaceMetadata.collectManifestArtifactPaths
    >[0];

    await access(packageJsonPath);

    const artifactPaths = workspaceMetadata.collectManifestArtifactPaths(packageJson);
    await Promise.all(
      artifactPaths.map((artifactPath) => access(resolve(REPO_ROOT, workspace.dir, artifactPath)))
    );
  }
});

test('workspace manifests delegate dependency-aware build/check to the shared plan helper', async () => {
  const workspaceMetadata = (await import(
    pathToFileURL(resolve(REPO_ROOT, 'scripts/workspace-metadata.mjs')).href
  )) as {
    PACK_WORKSPACES: Array<{ dir: string }>;
  };

  for (const workspace of workspaceMetadata.PACK_WORKSPACES) {
    const packageJson = JSON.parse(
      await readFile(resolve(REPO_ROOT, workspace.dir, 'package.json'), 'utf8')
    ) as {
      scripts?: Record<string, string>;
    };

    const scripts = packageJson.scripts ?? {};
    assert.match(scripts['build'] ?? '', /run-current-workspace-plan\.mjs build$/);
    assert.match(scripts['check'] ?? '', /run-current-workspace-plan\.mjs check$/);
  }
});

test('workspace manifests keep package and app tests on compiled temp outputs instead of root dist', async () => {
  const packageWorkspaces = [
    'packages/contracts',
    'packages/runtime-core',
    'packages/control-plane-core',
    'packages/openclaw-adapter',
    'packages/control-plane-shell'
  ];
  const appWorkspaces = ['apps/openclaw-plugin', 'apps/control-plane'];

  for (const workspaceDir of packageWorkspaces) {
    const packageJson = JSON.parse(await readFile(resolve(REPO_ROOT, workspaceDir, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = packageJson.scripts ?? {};

    assert.equal(scripts['test'], 'node ../../scripts/run-current-workspace-script.mjs workspace-artifacts test:local');
    assert.match(scripts['test:local'] ?? '', /run-compiled-tests\.mjs/);
    assert.doesNotMatch(scripts['test:local'] ?? '', /--compiled-dir \.\.\/\.\.\/dist/);
  }

  for (const workspaceDir of appWorkspaces) {
    const packageJson = JSON.parse(await readFile(resolve(REPO_ROOT, workspaceDir, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = packageJson.scripts ?? {};

    assert.equal(scripts['test'], 'node ../../scripts/run-current-workspace-script.mjs workspace-artifacts test:local');
    assert.match(scripts['test:local'] ?? '', /run-compiled-tests\.mjs/);
    assert.match(scripts['test:local'] ?? '', /--group app:/);
  }
});

test('runtime-core workspace build output stays off the openclaw adapter surface', async () => {
  const entries = await readdir(resolve(REPO_ROOT, 'packages/runtime-core/dist'), {
    withFileTypes: true
  });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.equal(directories.includes('openclaw'), false);
  assert.equal(directories.includes('plugin'), false);
  assert.equal(directories.includes('types'), false);
  assert.equal(directories.includes('runtime-core'), false);
});

test('shared core package exports stay narrowed to stable public entrypoints', async () => {
  const runtimeCorePackage = JSON.parse(
    await readFile(resolve(REPO_ROOT, 'packages/runtime-core/package.json'), 'utf8')
  ) as {
    exports?: Record<string, unknown>;
  };
  const controlPlaneCorePackage = JSON.parse(
    await readFile(resolve(REPO_ROOT, 'packages/control-plane-core/package.json'), 'utf8')
  ) as {
    exports?: Record<string, unknown>;
  };

  assert.deepEqual(Object.keys(runtimeCorePackage.exports ?? {}), [
    '.',
    './runtime',
    './context-processing',
    './governance',
    './infrastructure',
    './engine/context-engine'
  ]);
  assert.deepEqual(Object.keys(controlPlaneCorePackage.exports ?? {}), ['.']);
});

test('control-plane compatibility shims forward from the aggregate control-plane-core entrypoint', async () => {
  const controlPlaneShimRoot = resolve(REPO_ROOT, 'src/control-plane');
  const shimFiles = (await readdir(controlPlaneShimRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => resolve(controlPlaneShimRoot, entry.name));

  const offenders: string[] = [];

  for (const shimFile of shimFiles) {
    const source = await readFile(shimFile, 'utf8');
    if (source.includes('@openclaw-compact-context/control-plane-core/')) {
      offenders.push(shimFile.replace(`${REPO_ROOT}\\`, '').replace(/\\/g, '/'));
    }
  }

  assert.deepEqual(offenders, []);
});

test('control-plane compat aggregate entrypoints stay on stable package roots', async () => {
  const controlPlaneIndexSource = await readFile(resolve(REPO_ROOT, 'src/control-plane/index.ts'), 'utf8');
  const controlPlaneContractsSource = await readFile(
    resolve(REPO_ROOT, 'src/control-plane/contracts.ts'),
    'utf8'
  );
  const controlPlaneCoreIndexSource = await readFile(
    resolve(REPO_ROOT, 'src/control-plane-core/index.ts'),
    'utf8'
  );

  assert.match(
    controlPlaneIndexSource,
    /@openclaw-compact-context\/control-plane-core/
  );
  assert.match(
    controlPlaneIndexSource,
    /@openclaw-compact-context\/control-plane-shell/
  );
  assert.doesNotMatch(controlPlaneIndexSource, /\.\//);
  assert.doesNotMatch(controlPlaneIndexSource, /\.\.\/control-plane\//);

  assert.match(controlPlaneContractsSource, /@openclaw-compact-context\/contracts/);
  assert.doesNotMatch(controlPlaneContractsSource, /\.\.\/types\/control-plane\.js/);
  assert.doesNotMatch(controlPlaneContractsSource, /@openclaw-compact-context\/control-plane-core/);

  assert.match(
    controlPlaneCoreIndexSource,
    /@openclaw-compact-context\/control-plane-core/
  );
  assert.doesNotMatch(controlPlaneCoreIndexSource, /\.\.\/control-plane\//);
  assert.doesNotMatch(controlPlaneCoreIndexSource, /@openclaw-compact-context\/control-plane-shell/);
});

test('control-plane shell stays off the openclaw adapter surface', async () => {
  const controlPlaneShellPackage = JSON.parse(
    await readFile(resolve(REPO_ROOT, 'packages/control-plane-shell/package.json'), 'utf8')
  ) as {
    exports?: Record<string, unknown>;
    dependencies?: Record<string, string>;
  };

  assert.equal(Object.keys(controlPlaneShellPackage.exports ?? {}).includes('./bin'), false);
  assert.equal(
    Object.keys(controlPlaneShellPackage.dependencies ?? {}).includes('@openclaw-compact-context/openclaw-adapter'),
    false
  );
});

test('openclaw adapter stays off the control-plane-core surface', async () => {
  const openclawAdapterPackage = JSON.parse(
    await readFile(resolve(REPO_ROOT, 'packages/openclaw-adapter/package.json'), 'utf8')
  ) as {
    exports?: Record<string, unknown>;
    dependencies?: Record<string, string>;
  };

  assert.equal(
    Object.keys(openclawAdapterPackage.dependencies ?? {}).includes('@openclaw-compact-context/control-plane-core'),
    false
  );
  assert.equal(Object.keys(openclawAdapterPackage.exports ?? {}).includes('./adapters/openclaw'), false);
});

test('compat cleanup removes empty adapter aliases, duplicate root schema, and empty core shim', async () => {
  await assert.rejects(() => access(resolve(REPO_ROOT, 'packages/openclaw-adapter/src/adapters/openclaw')));
  await assert.rejects(() => access(resolve(REPO_ROOT, 'src/adapters/openclaw')));
  await assert.rejects(() => access(resolve(REPO_ROOT, 'schema/sqlite/001_init.sql')));
  await assert.rejects(() => access(resolve(REPO_ROOT, 'src/core')));

  await access(resolve(REPO_ROOT, 'packages/runtime-core/schema/sqlite/001_init.sql'));
});

test('test-group boundaries keep package, app, smoke, and evaluation scopes separated', async () => {
  const testMetadata = (await import(pathToFileURL(resolve(REPO_ROOT, 'scripts/test-group-metadata.mjs')).href)) as {
    TEST_GROUPS: Record<string, string[]>;
    TEST_GROUP_CATEGORIES: Record<string, string>;
  };

  const { TEST_GROUPS, TEST_GROUP_CATEGORIES } = testMetadata;

  for (const [groupName, files] of Object.entries(TEST_GROUPS)) {
    const category = TEST_GROUP_CATEGORIES[groupName];
    assert.ok(category);

    if (category === 'package') {
      assert.equal(files.some((file) => file.includes('app.test') || file.includes('debug-smoke') || file.includes('evaluation')), false);
    }

    if (category === 'app') {
      assert.equal(files.every((file) => file.endsWith('-app.test.js')), true);
    }
  }

  assert.deepEqual(TEST_GROUPS['smoke:required'], ['tests/workspace-smoke.test.js', 'tests/layer-boundaries.test.js']);
  assert.deepEqual(TEST_GROUPS['smoke:release'], [
    'tests/workspace-smoke.test.js',
    'tests/layer-boundaries.test.js',
    'tests/debug-smoke.test.js'
  ]);
  assert.deepEqual(TEST_GROUPS['evaluation'], ['tests/evaluation-harness.test.js']);
});

test('src compat entrypoints stay as thin forwarding layers only', async () => {
  const compatMetadata = (await import(pathToFileURL(resolve(REPO_ROOT, 'scripts/src-compat-metadata.mjs')).href)) as {
    ACTIVE_SRC_COMPAT_ENTRIES: Array<{ path: string; kind: 'dir' | 'file'; status: string }>;
    SRC_COMPAT_RULES: string[];
  };

  assert.ok(compatMetadata.SRC_COMPAT_RULES.length >= 3);

  const compatFiles: string[] = [];
  for (const entry of compatMetadata.ACTIVE_SRC_COMPAT_ENTRIES) {
    if (entry.kind === 'dir') {
      compatFiles.push(...(await collectTypeScriptFiles(entry.path)));
      continue;
    }
    compatFiles.push(resolve(REPO_ROOT, entry.path));
  }

  const invalidCompatFiles: string[] = [];

  for (const compatFile of compatFiles) {
    const source = await readFile(compatFile, 'utf8');
    const sourceFile = ts.createSourceFile(compatFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const unsupportedStatements = sourceFile.statements.filter(
      (statement) =>
        !ts.isExportDeclaration(statement) &&
        !ts.isImportDeclaration(statement) &&
        !ts.isExportAssignment(statement)
    );

    if (unsupportedStatements.length > 0) {
      invalidCompatFiles.push(relative(REPO_ROOT, compatFile).replace(/\\/g, '/'));
    }
  }

  assert.deepEqual(invalidCompatFiles, []);
});

test('src compat inventory keeps keep/removed boundaries explicit', async () => {
  const compatMetadata = (await import(pathToFileURL(resolve(REPO_ROOT, 'scripts/src-compat-metadata.mjs')).href)) as {
    ACTIVE_SRC_COMPAT_ENTRIES: Array<{ path: string; status: string }>;
    REMOVED_SRC_COMPAT_PATHS: string[];
  };

  const activeStatuses = new Set(compatMetadata.ACTIVE_SRC_COMPAT_ENTRIES.map((entry) => entry.status));
  assert.deepEqual([...activeStatuses].sort(), ['keep']);

  for (const removedPath of compatMetadata.REMOVED_SRC_COMPAT_PATHS) {
    await assert.rejects(() => access(resolve(REPO_ROOT, removedPath)));
  }
});

test('repo-internal source no longer imports the removed src engine compat path', async () => {
  const sourceFiles = await collectTypeScriptFiles('src');
  const offenders: string[] = [];

  for (const file of sourceFiles) {
    const relativePath = relative(REPO_ROOT, file).replace(/\\/g, '/');
    if (relativePath === 'src/tests/workspace-smoke.test.ts') {
      continue;
    }
    const source = await readFile(file, 'utf8');
    if (
      source.includes('../engine/context-engine.js') ||
      source.includes('../../engine/context-engine.js') ||
      source.includes('src/engine/context-engine.ts')
    ) {
      offenders.push(relativePath);
    }
  }

  assert.deepEqual(offenders, []);
});

test('repo-internal source no longer imports src/openclaw or src/plugin compat paths', async () => {
  const sourceFiles = await collectTypeScriptFiles('src');
  const offenders: string[] = [];

  for (const file of sourceFiles) {
    const relativePath = relative(REPO_ROOT, file).replace(/\\/g, '/');
    if (
      relativePath === 'src/tests/workspace-smoke.test.ts' ||
      relativePath.startsWith('src/openclaw/') ||
      relativePath.startsWith('src/plugin/')
    ) {
      continue;
    }

    const source = await readFile(file, 'utf8');
    if (
      source.includes('../openclaw/') ||
      source.includes('../../openclaw/') ||
      source.includes('../plugin/') ||
      source.includes('../../plugin/') ||
      /['"`]src\/openclaw\//.test(source) ||
      /['"`]src\/plugin\//.test(source)
    ) {
      offenders.push(relativePath);
    }
  }

  assert.deepEqual(offenders, []);
});

test('compat docs point readers to package/app entrypoints instead of src compat paths', async () => {
  const compatibilityNote = await readFile(
    resolve(REPO_ROOT, 'docs/planning/project-split-compatibility-note.zh-CN.md'),
    'utf8'
  );
  const documentationIndex = await readFile(
    resolve(REPO_ROOT, 'docs/documentation-index.zh-CN.md'),
    'utf8'
  );

  assert.match(compatibilityNote, /`src\/\*` 兼容层不再是推荐主入口/);
  assert.match(compatibilityNote, /@openclaw-compact-context\/runtime-core/);
  assert.match(compatibilityNote, /@openclaw-compact-context\/control-plane-core/);
  assert.doesNotMatch(compatibilityNote, /- 上下文处理：`src\/context-processing\/\*`/);
  assert.doesNotMatch(compatibilityNote, /- OpenClaw 宿主适配：`src\/openclaw\/\*`/);

  assert.match(
    documentationIndex,
    /\[context-engine-adapter\.ts\]\(\/d:\/C_Project\/openclaw_compact_context\/packages\/openclaw-adapter\/src\/openclaw\/context-engine-adapter\.ts\)/
  );
  assert.doesNotMatch(
    documentationIndex,
    /\[control-plane-facade\.ts\]\(\/d:\/C_Project\/openclaw_compact_context\/src\/control-plane\/control-plane-facade\.ts\)/
  );
});

test('main docs keep package and app entrypoints off src compat paths', async () => {
  const mainDocsToKeepOffCompat = [
    'README.md',
    'docs/integrations/openclaw-native-plugin.zh-CN.md',
    'docs/integrations/openclaw-hook-findings.zh-CN.md',
    'docs/integrations/stdio-integration.zh-CN.md',
    'docs/context-processing/runtime-context-window-contract.zh-CN.md',
    'docs/context-processing/prompt-assembly-contract.zh-CN.md',
    'docs/context-processing/runtime-snapshot-persistence.zh-CN.md',
    'docs/context-processing/openclaw-runtime-context-strategy.zh-CN.md',
    'docs/context-processing/context-processing-contracts.zh-CN.md',
    'docs/context-processing/context-processing-code-flow.zh-CN.md',
    'docs/control-plane/control-plane-service-contracts.zh-CN.md',
    'docs/control-plane/control-plane-api-matrix.zh-CN.md',
    'docs/control-plane/dashboard-observability-contracts.zh-CN.md',
    'docs/control-plane/open-platform-first-pass.zh-CN.md',
    'docs/control-plane/control-plane-server-first-pass.zh-CN.md',
    'docs/control-plane/control-plane-second-pass.zh-CN.md',
    'docs/control-plane/import-source-spec.zh-CN.md',
    'docs/control-plane/observability-metrics-dictionary.zh-CN.md',
    'docs/control-plane/multi-source-import-platform-first-pass.zh-CN.md',
    'docs/architecture/plugin-api-contract.zh-CN.md',
    'docs/architecture/context-engine-design-v2.zh-CN.md',
    'docs/architecture/prompt-compression.zh-CN.md',
    'docs/architecture/layered-knowledge-graph-architecture.zh-CN.md',
    'docs/architecture/provenance-schema-plan.zh-CN.md',
    'docs/architecture/schema-governance-plan.zh-CN.md',
    'docs/architecture/conflict-resolution-plan.zh-CN.md',
    'docs/architecture/tool-result-policy.zh-CN.md',
    'docs/architecture/traceability-plan.zh-CN.md',
    'docs/architecture/hook-to-graph-pipeline.zh-CN.md',
    'docs/operations/fault-injection-smoke-checklist.zh-CN.md'
  ];
  const prohibitedCompatPatterns = [
    /\/d:\/C_Project\/openclaw_compact_context\/src\/openclaw\//,
    /\/d:\/C_Project\/openclaw_compact_context\/src\/plugin\//,
    /\/d:\/C_Project\/openclaw_compact_context\/src\/control-plane\//,
    /\/d:\/C_Project\/openclaw_compact_context\/src\/control-plane-core\//,
    /\/d:\/C_Project\/openclaw_compact_context\/src\/engine\//,
    /\/d:\/C_Project\/openclaw_compact_context\/src\/bin\//,
    /\/d:\/C_Project\/openclaw_compact_context\/src\/adapters\/index\.ts/,
    /`src\/openclaw\/[^`]+`/,
    /`src\/plugin\/[^`]+`/,
    /`src\/control-plane\/[^`]+`/,
    /`src\/control-plane-core\/[^`]+`/,
    /`src\/engine\/[^`]+`/,
    /`src\/bin\/[^`]+`/,
    /`src\/adapters\/index\.ts`/
  ];

  for (const docPath of mainDocsToKeepOffCompat) {
    const source = await readFile(resolve(REPO_ROOT, docPath), 'utf8');
    for (const pattern of prohibitedCompatPatterns) {
      assert.doesNotMatch(source, pattern, `${docPath} should not point readers to src/* compat entrypoints`);
    }
  }
});

test('src ownership metadata keeps repo-internal source and compat layers explicitly separated', async () => {
  const ownershipMetadata = (await import(
    pathToFileURL(resolve(REPO_ROOT, 'scripts/src-ownership-metadata.mjs')).href
  )) as {
    LONG_LIVED_REPO_SRC_AREAS: Array<{ path: string; role: string }>;
    ACTIVE_SRC_COMPAT_ENTRIES: Array<{ path: string; role: string }>;
    SRC_OWNERSHIP_RULES: string[];
  };

  assert.ok(ownershipMetadata.SRC_OWNERSHIP_RULES.length >= 4);
  assert.deepEqual(
    ownershipMetadata.LONG_LIVED_REPO_SRC_AREAS.map((entry) => entry.path),
    ['src/types', 'src/contracts', 'src/evaluation', 'src/tests']
  );
  assert.deepEqual(
    ownershipMetadata.ACTIVE_SRC_COMPAT_ENTRIES.map((entry) => entry.path),
    [
      'src/index.ts',
      'src/openclaw',
      'src/plugin',
      'src/control-plane',
      'src/control-plane-core'
    ]
  );

  const overlaps = ownershipMetadata.LONG_LIVED_REPO_SRC_AREAS
    .map((entry) => entry.path)
    .filter((path) => ownershipMetadata.ACTIVE_SRC_COMPAT_ENTRIES.some((entry) => entry.path === path));

  assert.deepEqual(overlaps, []);
});

test('src openclaw/plugin compat metadata records keep reasons and deletion conditions', async () => {
  const compatMetadata = (await import(pathToFileURL(resolve(REPO_ROOT, 'scripts/src-compat-metadata.mjs')).href)) as {
    ACTIVE_SRC_COMPAT_ENTRIES: Array<{
      path: string;
      keepReason?: string;
      internalRepoUsage?: string;
      preferredTarget?: string;
      deleteWhen?: string[];
    }>;
  };

  const openclawEntry = compatMetadata.ACTIVE_SRC_COMPAT_ENTRIES.find((entry) => entry.path === 'src/openclaw');
  const pluginEntry = compatMetadata.ACTIVE_SRC_COMPAT_ENTRIES.find((entry) => entry.path === 'src/plugin');

  assert.ok(openclawEntry);
  assert.ok(pluginEntry);
  assert.equal(openclawEntry?.internalRepoUsage, 'none');
  assert.equal(pluginEntry?.internalRepoUsage, 'none');
  assert.match(openclawEntry?.preferredTarget ?? '', /openclaw-adapter\/openclaw/);
  assert.match(pluginEntry?.preferredTarget ?? '', /openclaw-adapter\/plugin/);
  assert.ok((openclawEntry?.deleteWhen?.length ?? 0) >= 2);
  assert.ok((pluginEntry?.deleteWhen?.length ?? 0) >= 2);
});

test('src convergence dashboard stays in sync with current tree and metadata baseline', async () => {
  const dashboard = (await import(
    pathToFileURL(resolve(REPO_ROOT, 'scripts/src-convergence-dashboard.mjs')).href
  )) as {
    SRC_CONVERGENCE_DASHBOARD: {
      baselineRecordedAt: string;
      currentTree: {
        topLevelEntryCount: number;
        dirs: number;
        files: number;
        tsFiles: number;
        topLevelEntries: Array<{ name: string; kind: string }>;
      };
      areaStats: {
        repoInternal: { files: number; dirs: number; tsFiles: number };
        compat: { files: number; dirs: number; tsFiles: number };
      };
      metadataSummary: {
        longLivedRepoAreaCount: number;
        activeCompatEntryCount: number;
        removedCompatEntryCount: number;
        ownershipCompatEntryCount: number;
      };
      targetStateSummary: {
        repoInternal: Record<string, number>;
        compat: Record<string, number>;
      };
    };
  };

  const baselineDoc = await readFile(
    resolve(REPO_ROOT, 'docs/planning/src-convergence-dashboard.zh-CN.md'),
    'utf8'
  );

  assert.equal(dashboard.SRC_CONVERGENCE_DASHBOARD.baselineRecordedAt, '2026-03-16');
  assert.equal(dashboard.SRC_CONVERGENCE_DASHBOARD.currentTree.topLevelEntryCount, 9);
  assert.equal(dashboard.SRC_CONVERGENCE_DASHBOARD.currentTree.dirs, 9);
  assert.equal(dashboard.SRC_CONVERGENCE_DASHBOARD.currentTree.files, 91);
  assert.equal(dashboard.SRC_CONVERGENCE_DASHBOARD.currentTree.tsFiles, 83);
  assert.equal(dashboard.SRC_CONVERGENCE_DASHBOARD.areaStats.repoInternal.files, 61);
  assert.equal(dashboard.SRC_CONVERGENCE_DASHBOARD.areaStats.compat.files, 30);
  assert.equal(dashboard.SRC_CONVERGENCE_DASHBOARD.metadataSummary.longLivedRepoAreaCount, 4);
  assert.equal(dashboard.SRC_CONVERGENCE_DASHBOARD.metadataSummary.activeCompatEntryCount, 5);
  assert.equal(dashboard.SRC_CONVERGENCE_DASHBOARD.metadataSummary.removedCompatEntryCount, 11);
  assert.equal(
    dashboard.SRC_CONVERGENCE_DASHBOARD.targetStateSummary.repoInternal['retain-as-repo-internal'],
    4
  );
  assert.equal(
    dashboard.SRC_CONVERGENCE_DASHBOARD.targetStateSummary.compat['retire-after-root-src-aggregate-window'],
    1
  );
  assert.equal(
    dashboard.SRC_CONVERGENCE_DASHBOARD.targetStateSummary.compat['retire-after-host-migration-window'],
    1
  );
  assert.equal(
    dashboard.SRC_CONVERGENCE_DASHBOARD.targetStateSummary.compat['retire-after-plugin-migration-window'],
    1
  );
  assert.equal(
    dashboard.SRC_CONVERGENCE_DASHBOARD.targetStateSummary.compat['retire-after-platform-migration-window'],
    2
  );

  assert.match(baselineDoc, /记录日期：`2026-03-16`/);
  assert.match(baselineDoc, /`src` 顶层条目数：`9`/);
  assert.match(baselineDoc, /`src` 递归目录数：`9`/);
  assert.match(baselineDoc, /`src` 递归文件数：`91`/);
  assert.match(baselineDoc, /`src` 递归 TypeScript 文件数：`83`/);
  assert.match(baselineDoc, /长期保留的 repo-internal 区域/);
  assert.match(baselineDoc, /当前仍保留的 compat 区域/);
});

test('src compat inventory doc stays synchronized with compat metadata', async () => {
  const compatMetadata = (await import(pathToFileURL(resolve(REPO_ROOT, 'scripts/src-compat-metadata.mjs')).href)) as {
    ACTIVE_SRC_COMPAT_ENTRIES: Array<{ path: string; targetState: string }>;
    REMOVED_SRC_COMPAT_PATHS: string[];
  };
  const inventoryDoc = await readFile(
    resolve(REPO_ROOT, 'docs/planning/src-compat-inventory.zh-CN.md'),
    'utf8'
  );

  for (const entry of compatMetadata.ACTIVE_SRC_COMPAT_ENTRIES) {
    assert.match(inventoryDoc, new RegExp(escapeForRegex(entry.path)));
    assert.match(inventoryDoc, new RegExp(escapeForRegex(entry.targetState)));
  }

  for (const removedPath of compatMetadata.REMOVED_SRC_COMPAT_PATHS) {
    assert.match(inventoryDoc, new RegExp(escapeForRegex(removedPath)));
  }
});

test('src ownership boundary doc stays synchronized with ownership metadata', async () => {
  const ownershipMetadata = (await import(
    pathToFileURL(resolve(REPO_ROOT, 'scripts/src-ownership-metadata.mjs')).href
  )) as {
    LONG_LIVED_REPO_SRC_AREAS: Array<{ path: string; targetState: string }>;
    ACTIVE_SRC_COMPAT_ENTRIES: Array<{ path: string; targetState: string }>;
  };
  const ownershipDoc = await readFile(
    resolve(REPO_ROOT, 'docs/planning/src-ownership-boundary.zh-CN.md'),
    'utf8'
  );

  for (const entry of ownershipMetadata.LONG_LIVED_REPO_SRC_AREAS) {
    assert.match(ownershipDoc, new RegExp(escapeForRegex(entry.path)));
    assert.match(ownershipDoc, new RegExp(escapeForRegex(entry.targetState)));
  }

  for (const entry of ownershipMetadata.ACTIVE_SRC_COMPAT_ENTRIES) {
    assert.match(ownershipDoc, new RegExp(escapeForRegex(entry.path)));
    assert.match(ownershipDoc, new RegExp(escapeForRegex(entry.targetState)));
  }
});

test('workspace release readiness metadata covers all publishable workspaces and release-train rules', async () => {
  const workspaceMetadata = (await import(
    pathToFileURL(resolve(REPO_ROOT, 'scripts/workspace-metadata.mjs')).href
  )) as {
    PACK_WORKSPACES: Array<{ name: string; dir: string }>;
  };
  const releaseReadinessMetadata = (await import(
    pathToFileURL(resolve(REPO_ROOT, 'scripts/workspace-release-readiness-metadata.mjs')).href
  )) as {
    WORKSPACE_RELEASE_READINESS: Array<{
      name: string;
      dir: string;
      independentPublish: string;
      multiRepoReadiness: string;
    }>;
    CURRENT_VERSION_STRATEGY: {
      mode: string;
      lockstepWorkspaces: string[];
      futureIndependentCandidates: string[];
      requireBreakingChangeMigrationNoteWhen: string[];
    };
    CONSUMER_MIGRATION_PATHS: Array<{ from: string; to: string; status: string }>;
    RELEASE_AUTOMATION_STRATEGY: {
      currentMode: string;
      adoptWhen: string[];
    };
    MULTI_REPO_ACCEPTANCE_BASELINE: string[];
  };

  assert.deepEqual(
    releaseReadinessMetadata.WORKSPACE_RELEASE_READINESS.map((entry) => entry.name).sort(),
    workspaceMetadata.PACK_WORKSPACES.map((workspace) => workspace.name).sort()
  );
  assert.deepEqual(
    releaseReadinessMetadata.WORKSPACE_RELEASE_READINESS.map((entry) => entry.dir).sort(),
    workspaceMetadata.PACK_WORKSPACES.map((workspace) => workspace.dir).sort()
  );
  assert.equal(releaseReadinessMetadata.CURRENT_VERSION_STRATEGY.mode, 'lockstep-release-train');
  assert.deepEqual(
    [...releaseReadinessMetadata.CURRENT_VERSION_STRATEGY.lockstepWorkspaces].sort(),
    workspaceMetadata.PACK_WORKSPACES.map((workspace) => workspace.name).sort()
  );
  assert.ok(
    releaseReadinessMetadata.WORKSPACE_RELEASE_READINESS.some(
      (entry) => entry.independentPublish === 'candidate-later' && entry.multiRepoReadiness === 'candidate-later'
    )
  );
  assert.ok(
    releaseReadinessMetadata.CONSUMER_MIGRATION_PATHS.some(
      (entry) => entry.from === 'root exports / root bin / root openclaw.extensions' && entry.status === 'completed'
    )
  );
  assert.ok(
    releaseReadinessMetadata.CONSUMER_MIGRATION_PATHS.some(
      (entry) => entry.from === 'src/openclaw/*' && entry.to.includes('@openclaw-compact-context/openclaw-adapter/openclaw')
    )
  );
  assert.ok(releaseReadinessMetadata.CURRENT_VERSION_STRATEGY.requireBreakingChangeMigrationNoteWhen.length >= 4);
  assert.equal(
    releaseReadinessMetadata.RELEASE_AUTOMATION_STRATEGY.currentMode,
    'manual-release-train-with-pack-and-smoke'
  );
  assert.ok(releaseReadinessMetadata.RELEASE_AUTOMATION_STRATEGY.adoptWhen.length >= 3);
  assert.ok(releaseReadinessMetadata.MULTI_REPO_ACCEPTANCE_BASELINE.length >= 5);
});

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
