import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));

test('workspace manifests and compiled package entrypoints exist', async () => {
  const rootPackage = JSON.parse(await readFile(resolve(REPO_ROOT, 'package.json'), 'utf8')) as {
    workspaces?: string[];
  };

  assert.deepEqual(rootPackage.workspaces, ['apps/*', 'packages/*']);

  const files = [
    'apps/openclaw-plugin/package.json',
    'apps/control-plane/package.json',
    'packages/contracts/package.json',
    'packages/runtime-core/package.json',
    'packages/control-plane-core/package.json',
    'dist/contracts/index.js',
    'dist/runtime-core/index.js',
    'dist/control-plane-core/index.js',
    'dist/bin/openclaw-context-plugin.js',
    'dist/bin/openclaw-control-plane.js'
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
