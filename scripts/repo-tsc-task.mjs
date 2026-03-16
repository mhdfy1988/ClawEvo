import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withLock } from './lock-utils.mjs';

const args = process.argv.slice(2);
const mode = args[0];

if (!mode || !['build', 'check'].includes(mode)) {
  console.error('[repo-tsc-task] expected mode: build | check');
  process.exit(1);
}

let outDir = mode === 'build' ? 'dist' : undefined;
let cleanTarget = mode === 'build' ? 'dist' : undefined;
let lockName = mode === 'build' ? 'repo-dist' : 'repo-check';

for (let index = 1; index < args.length; index += 1) {
  const value = args[index];
  if (value === '--out-dir') {
    outDir = args[index + 1];
    index += 1;
    continue;
  }

  if (value === '--clean-target') {
    cleanTarget = args[index + 1];
    index += 1;
    continue;
  }

  if (value === '--lock-name') {
    lockName = args[index + 1];
    index += 1;
    continue;
  }
}

const cwd = resolve(fileURLToPath(new URL('..', import.meta.url)));
const scriptDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const cleanScript = resolve(scriptDir, 'clean-dist.mjs');
const tscScript = resolve(fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)));

const exitCode = await withLock(lockName, async () => {
  if (mode === 'build' && cleanTarget) {
    const cleanResult = spawnSync(process.execPath, [cleanScript, cleanTarget], {
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

  if (mode === 'build' && outDir) {
    tscArgs.push('--outDir', outDir);
  }

  const tscResult = spawnSync(process.execPath, [tscScript, ...tscArgs], {
    cwd,
    stdio: 'inherit',
    env: process.env
  });

  return tscResult.status ?? 1;
});

process.exit(exitCode);
