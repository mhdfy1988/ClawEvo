export const TEST_GROUPS = {
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
  'smoke:required': ['tests/workspace-smoke.test.js', 'tests/layer-boundaries.test.js'],
  'smoke:release': ['tests/workspace-smoke.test.js', 'tests/layer-boundaries.test.js', 'tests/debug-smoke.test.js'],
  'smoke:root': ['tests/workspace-smoke.test.js', 'tests/layer-boundaries.test.js'],
  evaluation: ['tests/evaluation-harness.test.js']
};

export const TEST_GROUP_CATEGORIES = {
  'package:contracts': 'package',
  'package:runtime-core': 'package',
  'package:control-plane-core': 'package',
  'package:openclaw-adapter': 'package',
  'package:control-plane-shell': 'package',
  'app:openclaw-plugin': 'app',
  'app:control-plane': 'app',
  'smoke:required': 'smoke',
  'smoke:release': 'smoke',
  'smoke:root': 'smoke',
  evaluation: 'evaluation'
};

export function listGroupEntries(category) {
  return Object.entries(TEST_GROUPS)
    .filter(([groupName]) => TEST_GROUP_CATEGORIES[groupName] === category)
    .map(([groupName, files]) => ({ groupName, files: [...files] }));
}
