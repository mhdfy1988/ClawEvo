import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatContextProcessingHarnessReport,
  runContextProcessingHarness
} from '../internal/evaluation/context-processing-harness.js';
import { buildNoisePolicyCorrection } from '@openclaw-compact-context/runtime-core/governance';

test('context processing harness aggregates parse, concept, noise, and experience metrics', () => {
  const report = runContextProcessingHarness({
    name: 'bilingual-context-processing',
    records: [
      {
        id: 'record-harness-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to preserve provenance, and the next step is to rebuild the checkpoint bundle.'
      },
      {
        id: 'record-harness-2',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: '好的'
      }
    ],
    manualCorrections: [
      buildNoisePolicyCorrection({
        id: 'noise-override-harness-1',
        targetId: '好的',
        action: 'apply',
        author: 'tester',
        reason: 'keep the acknowledgement as a hint for inspection',
        createdAt: '2026-03-15T10:00:00.000Z',
        disposition: 'hint_only'
      })
    ]
  });

  assert.equal(report.fixtureName, 'bilingual-context-processing');
  assert.equal(report.metrics.recordCount, 2);
  assert.ok(report.metrics.clauseCount >= 2);
  assert.ok(report.metrics.semanticSpanCount >= 2);
  assert.ok(report.metrics.conceptMatchCount >= 1);
  assert.ok(report.metrics.noiseCounts.hint_only >= 1);
  assert.ok(report.metrics.experienceHintCount >= 1);
});

test('context processing harness formats a readable report', () => {
  const report = runContextProcessingHarness({
    name: 'single-record',
    records: [
      {
        id: 'record-harness-format-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'Please keep the knowledge graph traceable.'
      }
    ]
  });
  const text = formatContextProcessingHarnessReport(report);

  assert.match(text, /^\[ContextProcessing\] single-record/m);
  assert.match(text, /records=1/);
  assert.match(text, /semanticSpans=/);
  assert.match(text, /noise: drop=/);
});




