import { spawnSync } from 'node:child_process';
import { TEST_GROUPS } from './test-group-metadata.mjs';

const args = process.argv.slice(2);
let compiledDir = 'dist';
const groups = [];

for (let index = 0; index < args.length; index += 1) {
  const value = args[index];
  if (value === '--compiled-dir') {
    compiledDir = args[index + 1] ?? '';
    index += 1;
    continue;
  }

  groups.push(value);
}

if (!compiledDir) {
  console.error('[run-test-group] --compiled-dir requires a value');
  process.exit(1);
}

if (groups.length === 0) {
  console.error('[run-test-group] expected at least one test group');
  process.exit(1);
}

const testFiles = [];
for (const group of groups) {
  const entries = TEST_GROUPS[group];
  if (!entries) {
    console.error(`[run-test-group] unknown group: ${group}`);
    process.exit(1);
  }

  for (const entry of entries) {
    if (!testFiles.includes(entry)) {
      testFiles.push(entry);
    }
  }
}

const resolvedFiles = testFiles.map((entry) => `${compiledDir}/${entry}`);
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...resolvedFiles], {
  stdio: 'inherit',
  env: process.env
});

process.exit(result.status ?? 1);
