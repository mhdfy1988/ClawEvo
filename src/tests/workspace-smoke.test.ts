import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));

test('workspace manifests and compiled package entrypoints exist', async () => {
  const rootPackage = JSON.parse(await readFile(resolve(REPO_ROOT, 'package.json'), 'utf8')) as {
    workspaces?: string[];
    exports?: Record<string, unknown>;
    bin?: Record<string, string>;
    openclaw?: Record<string, unknown>;
  };

  assert.deepEqual(rootPackage.workspaces, ['apps/*', 'packages/*']);
  assert.equal(rootPackage.exports, undefined);
  assert.equal(rootPackage.bin, undefined);
  assert.equal(rootPackage.openclaw, undefined);

  const files = [
    'apps/openclaw-plugin/package.json',
    'apps/openclaw-plugin/openclaw.plugin.json',
    'apps/openclaw-plugin/dist/index.js',
    'apps/openclaw-plugin/dist/bin/openclaw-context-plugin.js',
    'apps/control-plane/package.json',
    'apps/control-plane/dist/index.js',
    'apps/control-plane/dist/client.js',
    'apps/control-plane/dist/bin/openclaw-control-plane.js',
    'packages/contracts/package.json',
    'packages/runtime-core/package.json',
    'packages/control-plane-core/package.json'
  ];

  await Promise.all(files.map((file) => access(resolve(REPO_ROOT, file))));
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
