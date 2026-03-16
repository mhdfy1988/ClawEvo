import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withLock } from './lock-utils.mjs';

const [, , mode] = process.argv;

if (!mode || !['build', 'check'].includes(mode)) {
  console.error('[run-current-workspace-plan] usage: <build|check>');
  process.exit(1);
}

const workspaceCwd = process.cwd();
const workspacePackage = JSON.parse(await readFile(resolve(workspaceCwd, 'package.json'), 'utf8'));
const workspaceName = workspacePackage.name;

if (typeof workspaceName !== 'string' || workspaceName.length === 0) {
  console.error('[run-current-workspace-plan] current workspace package.json must contain a name');
  process.exit(1);
}

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const workspacePlanScript = resolve(repoRoot, 'scripts', 'run-workspace-plan.mjs');

const exitCode = await withLock('workspace-artifacts', async () => {
  const result = spawnSync(process.execPath, [workspacePlanScript, mode, workspaceName], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env
  });

  return result.status ?? 1;
});

process.exit(exitCode);
