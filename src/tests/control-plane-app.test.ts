import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { resolveRepoRoot } from './repo-root.js';

const REPO_ROOT = resolveRepoRoot(import.meta.url);

test('control-plane workspace publishes a thin shell with control-plane-shell dependency', async () => {
  const manifest = JSON.parse(
    await readFile(resolve(REPO_ROOT, 'apps/control-plane/package.json'), 'utf8')
  ) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
  };

  assert.equal(
    manifest.scripts?.test,
    'node ../../scripts/run-current-workspace-script.mjs workspace-artifacts test:local'
  );
  assert.equal(manifest.dependencies?.['@openclaw-compact-context/control-plane-shell'], '0.1.0');
});

test('control-plane app dist re-exports shell server and client entrypoints', async () => {
  const indexModule = (await import(pathToFileURL(resolve(REPO_ROOT, 'apps/control-plane/dist/index.js')).href)) as Record<
    string,
    unknown
  >;
  const clientModule = (await import(pathToFileURL(resolve(REPO_ROOT, 'apps/control-plane/dist/client.js')).href)) as Record<
    string,
    unknown
  >;

  assert.equal(typeof indexModule.ControlPlaneHttpServer, 'function');
  assert.equal(typeof clientModule.ControlPlaneClient, 'function');
});
