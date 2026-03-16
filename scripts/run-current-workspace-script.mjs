import { spawnSync } from 'node:child_process';
import { withLock } from './lock-utils.mjs';

const [, , lockName, scriptName] = process.argv;

if (!lockName || !scriptName) {
  console.error('[run-current-workspace-script] usage: <lock-name> <script-name>');
  process.exit(1);
}

const cwd = process.cwd();

const exitCode = await withLock(lockName, async () => {
  const result =
    process.platform === 'win32'
      ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${scriptName}`], {
          cwd,
          stdio: 'inherit',
          env: process.env
        })
      : spawnSync('npm', ['run', scriptName], {
          cwd,
          stdio: 'inherit',
          env: process.env
        });

  return result.status ?? 1;
});

process.exit(exitCode);
