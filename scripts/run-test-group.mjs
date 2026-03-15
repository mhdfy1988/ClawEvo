import { spawnSync } from 'node:child_process';

const GROUPS = {
  'package:contracts': ['tests/context-processing-contracts.test.js'],
  'package:runtime-core': [
    'tests/audit-explainer.test.js',
    'tests/concept-normalizer.test.js',
    'tests/context-processing-experience.test.js',
    'tests/context-processing-harness.test.js',
    'tests/context-processing-pipeline.test.js',
    'tests/experience-learning.test.js',
    'tests/ingest-and-compiler.test.js',
    'tests/knowledge-promotion.test.js',
    'tests/manual-corrections.test.js',
    'tests/multi-source-ingest.test.js',
    'tests/noise-policy.test.js',
    'tests/semantic-spans.test.js',
    'tests/summary-planner.test.js',
    'tests/utterance-parser.test.js'
  ],
  'package:control-plane-core': ['tests/control-plane-services.test.js', 'tests/observability-report.test.js'],
  'package:openclaw-adapter': [
    'tests/context-engine-adapter.test.js',
    'tests/hook-coordinator.test.js',
    'tests/tool-result-artifact-store.test.js',
    'tests/tool-result-policy.test.js',
    'tests/transcript-loader.test.js'
  ],
  'package:control-plane-shell': ['tests/control-plane-server.test.js'],
  'app:openclaw-plugin': ['tests/openclaw-plugin-app.test.js'],
  'app:control-plane': ['tests/control-plane-app.test.js'],
  'smoke:root': ['tests/workspace-smoke.test.js', 'tests/layer-boundaries.test.js', 'tests/debug-smoke.test.js'],
  evaluation: ['tests/evaluation-harness.test.js']
};

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
  const entries = GROUPS[group];
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
