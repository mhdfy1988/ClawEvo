import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = resolve(fileURLToPath(new URL('..', import.meta.url)));
const startedAt = new Date().toISOString();
const benchmarksRoot = resolve(cwd, '.tmp', 'benchmarks');

const steps = [
  { name: 'required', script: 'test:smoke:required' },
  { name: 'release', script: 'test:smoke:release' }
];

const results = [];

for (const step of steps) {
  const started = process.hrtime.bigint();
  const runResult =
    process.platform === 'win32'
      ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${step.script}`], {
          cwd,
          stdio: 'inherit',
          env: process.env
        })
      : spawnSync('npm', ['run', step.script], {
          cwd,
          stdio: 'inherit',
          env: process.env
        });
  const finished = process.hrtime.bigint();
  const durationMs = Number(finished - started) / 1_000_000;

  if ((runResult.status ?? 1) !== 0) {
    process.exit(runResult.status ?? 1);
  }

  results.push({
    name: step.name,
    script: step.script,
    durationMs: Number(durationMs.toFixed(1))
  });
}

await mkdir(benchmarksRoot, { recursive: true });
const stamp = startedAt.replace(/[:.]/g, '-');
const outputPath = resolve(benchmarksRoot, `smoke-baseline-${stamp}.json`);
const payload = {
  measuredAt: startedAt,
  cwd,
  node: process.version,
  platform: process.platform,
  results
};

await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`\n[measure-smoke-baseline] wrote ${outputPath}`);
console.log(JSON.stringify(payload, null, 2));
