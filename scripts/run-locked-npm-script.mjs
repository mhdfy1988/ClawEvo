import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withLock } from './lock-utils.mjs';

const [, , lockName, scriptName, ...scriptArgs] = process.argv;

if (!lockName || !scriptName) {
  console.error('[run-locked-npm-script] usage: <lock-name> <script-name> [...script-args]');
  process.exit(1);
}

const cwd = resolve(fileURLToPath(new URL('..', import.meta.url)));

const exitCode = await withLock(lockName, async () => {
  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec ?? 'cmd.exe',
          ['/d', '/s', '/c', `npm.cmd run ${scriptName}${scriptArgs.length > 0 ? ` -- ${scriptArgs.join(' ')}` : ''}`],
          {
            cwd,
            stdio: 'inherit',
            env: process.env
          }
        )
      : spawnSync('npm', ['run', scriptName, ...(scriptArgs.length > 0 ? ['--', ...scriptArgs] : [])], {
          cwd,
          stdio: 'inherit',
          env: process.env
        });

  return result.status ?? 1;
});

process.exit(exitCode);
