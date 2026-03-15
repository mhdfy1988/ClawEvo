import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));

test('openclaw-plugin workspace publishes a thin shell with adapter dependency', async () => {
  const manifest = JSON.parse(
    await readFile(resolve(REPO_ROOT, 'apps/openclaw-plugin/package.json'), 'utf8')
  ) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
  };

  assert.equal(manifest.scripts?.test, 'npm --prefix ../.. run test:app:openclaw-plugin');
  assert.equal(manifest.dependencies?.['@openclaw-compact-context/openclaw-adapter'], '0.1.0');
});

test('openclaw-plugin app dist stays as a thin adapter forwarding shell', async () => {
  const indexSource = await readFile(resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/index.js'), 'utf8');
  const binSource = await readFile(resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/bin/openclaw-context-plugin.js'), 'utf8');

  assert.match(indexSource, /export \* from '@openclaw-compact-context\/openclaw-adapter';/);
  assert.match(binSource, /import '@openclaw-compact-context\/openclaw-adapter\/bin';/);
});
