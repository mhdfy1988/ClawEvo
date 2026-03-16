import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveRepoRoot } from './repo-root.js';

const REPO_ROOT = resolveRepoRoot(import.meta.url);

test('openclaw-plugin workspace publishes a thin shell with adapter dependency', async () => {
  const manifest = JSON.parse(
    await readFile(resolve(REPO_ROOT, 'apps/openclaw-plugin/package.json'), 'utf8')
  ) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    openclaw?: {
      extensions?: string[];
    };
  };
  const pluginManifest = JSON.parse(
    await readFile(resolve(REPO_ROOT, 'apps/openclaw-plugin/openclaw.plugin.json'), 'utf8')
  ) as {
    id?: string;
    kind?: string;
  };

  assert.equal(
    manifest.scripts?.test,
    'node ../../scripts/run-current-workspace-script.mjs workspace-artifacts test:local'
  );
  assert.equal(manifest.dependencies?.['@openclaw-compact-context/openclaw-adapter'], '0.1.0');
  assert.equal(manifest.dependencies?.['@openclaw-compact-context/control-plane-core'], '0.1.0');
  assert.deepEqual(manifest.openclaw?.extensions, ['./src/index.ts']);
  assert.equal(pluginManifest.id, 'compact-context');
  assert.equal(pluginManifest.kind, 'context-engine');
});

test('openclaw-plugin app dist keeps adapter forwarding plus app-local default assembly', async () => {
  const indexSource = await readFile(resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/index.js'), 'utf8');
  const binSource = await readFile(resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/bin/openclaw-context-plugin.js'), 'utf8');

  assert.match(indexSource, /export \* from '@openclaw-compact-context\/openclaw-adapter';/);
  assert.match(indexSource, /createOpenClawPlugin/);
  assert.match(binSource, /import '@openclaw-compact-context\/openclaw-adapter\/bin';/);
});


