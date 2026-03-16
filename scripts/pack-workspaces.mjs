import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withLock } from './lock-utils.mjs';
import { collectManifestArtifactPaths, PACK_WORKSPACES } from './workspace-metadata.mjs';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

async function assertWorkspaceArtifactsExist(workspace) {
  const packageJsonPath = resolve(REPO_ROOT, workspace.dir, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const requiredPaths = collectManifestArtifactPaths(packageJson);

  for (const requiredPath of requiredPaths) {
    const absolutePath = resolve(REPO_ROOT, workspace.dir, requiredPath);

    try {
      await access(absolutePath);
    } catch {
      throw new Error(
        `[pack:workspace] missing required artifact for ${workspace.name}: ${workspace.dir}/${requiredPath}`
      );
    }
  }
}

for (const workspace of PACK_WORKSPACES) {
  const exitCode = await withLock(
    `workspace-${workspace.name.replace(/[^a-zA-Z0-9_-]+/g, '_')}`,
    async () => {
      console.log(`\n[pack:workspace] verify -> ${workspace.name}`);
      await assertWorkspaceArtifactsExist(workspace);

      console.log(`[pack:workspace] dry-run -> ${workspace.name}`);

      const result =
        process.platform === 'win32'
          ? spawnSync(
              process.env.ComSpec ?? 'cmd.exe',
              ['/d', '/s', '/c', `npm.cmd pack --workspace=${workspace.name} --json --dry-run --ignore-scripts`],
              {
                stdio: 'inherit',
                env: process.env
              }
            )
          : spawnSync('npm', ['pack', '--workspace', workspace.name, '--json', '--dry-run', '--ignore-scripts'], {
              stdio: 'inherit',
              env: process.env
            });

      return result.status ?? 1;
    }
  );

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
