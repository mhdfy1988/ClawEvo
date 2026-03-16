import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withLock } from './lock-utils.mjs';

const [, , mode] = process.argv;

if (!mode || !['build', 'check'].includes(mode)) {
  console.error('[workspace-tsc-task] expected mode: build | check');
  process.exit(1);
}

const cwd = process.cwd();
const packageJson = JSON.parse(await readFile(resolve(cwd, 'package.json'), 'utf8'));
const workspaceName = packageJson.name ?? resolve(cwd);
const scriptDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const cleanScript = resolve(scriptDir, 'clean-dist.mjs');
const tscScript = resolve(fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)));

const exitCode = await withLock(
  `workspace-${workspaceName.replace(/[^a-zA-Z0-9_-]+/g, '_')}`,
  async () => {
    if (mode === 'build') {
      const cleanResult = spawnSync(process.execPath, [cleanScript, './dist'], {
        cwd,
        stdio: 'inherit',
        env: process.env
      });

      if ((cleanResult.status ?? 1) !== 0) {
        return cleanResult.status ?? 1;
      }
    }

    const tscArgs = ['-p', 'tsconfig.json'];
    if (mode === 'check') {
      tscArgs.push('--noEmit');
    }

    const tscResult = spawnSync(process.execPath, [tscScript, ...tscArgs], {
      cwd,
      stdio: 'inherit',
      env: process.env
    });

    return tscResult.status ?? 1;
  }
);

process.exit(exitCode);
