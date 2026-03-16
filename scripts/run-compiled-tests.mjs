import { spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);

const prepareScripts = [];
const groups = [];
let label = 'compiled-tests';

for (let index = 0; index < args.length; index += 1) {
  const value = args[index];
  if (value === '--prepare') {
    prepareScripts.push(args[index + 1] ?? '');
    index += 1;
    continue;
  }

  if (value === '--group') {
    groups.push(args[index + 1] ?? '');
    index += 1;
    continue;
  }

  if (value === '--label') {
    label = args[index + 1] ?? label;
    index += 1;
    continue;
  }
}

if (groups.length === 0) {
  console.error('[run-compiled-tests] expected at least one --group');
  process.exit(1);
}

const runId = `${label.replace(/[^a-zA-Z0-9_-]+/g, '_')}-${Date.now()}-${process.pid}`;
const compiledRoot = resolve(cwd, '.tmp', 'compiled-tests', runId);
const compiledDist = resolve(compiledRoot, 'dist');
const repoTscTask = resolve(cwd, 'scripts', 'repo-tsc-task.mjs');
const runTestGroup = resolve(cwd, 'scripts', 'run-test-group.mjs');

await mkdir(resolve(cwd, '.tmp', 'compiled-tests'), { recursive: true });

let exitCode = 0;

try {
  for (const scriptName of prepareScripts) {
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

    if ((result.status ?? 1) !== 0) {
      exitCode = result.status ?? 1;
      break;
    }
  }

  if (exitCode === 0) {
    const compileResult = spawnSync(
      process.execPath,
      [repoTscTask, 'build', '--out-dir', compiledDist, '--clean-target', compiledDist, '--lock-name', `repo-${runId}`],
      {
        cwd,
        stdio: 'inherit',
        env: process.env
      }
    );

    exitCode = compileResult.status ?? 1;
  }

  if (exitCode === 0) {
    const testResult = spawnSync(
      process.execPath,
      [runTestGroup, ...groups, '--compiled-dir', compiledDist],
      {
        cwd,
        stdio: 'inherit',
        env: {
          ...process.env,
          COMPACT_CONTEXT_REPO_ROOT: cwd
        }
      }
    );

    exitCode = testResult.status ?? 1;
  }
} finally {
  if (process.env.KEEP_COMPILED_TEST_DIR !== '1') {
    await rm(compiledRoot, { recursive: true, force: true });
  }
}

process.exit(exitCode);
