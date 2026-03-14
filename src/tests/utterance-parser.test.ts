import assert from 'node:assert/strict';
import test from 'node:test';

import { parseContextRecordUtterance, parseUtterance } from '../core/utterance-parser.js';

test('utterance parser supports Chinese and English sentence splitting', () => {
  const parsed = parseUtterance(
    '先检查构建日志。Then inspect the migration timeout. 最后保留 provenance！',
    'conversation'
  );

  assert.equal(parsed.sentences.length, 3);
  assert.deepEqual(
    parsed.sentences.map((sentence) => sentence.text),
    ['先检查构建日志。', 'Then inspect the migration timeout.', '最后保留 provenance！']
  );
  assert.deepEqual(
    parsed.sentences.map((sentence) => sentence.id),
    ['sentence-1', 'sentence-2', 'sentence-3']
  );
});

test('utterance parser splits mixed-language clauses with stable ids, offsets, and normalized text', () => {
  const text = '先检查日志，然后保留 provenance, but do not summarize too early, and keep the current goal explicit.';
  const parsed = parseUtterance(text, 'conversation');

  assert.equal(parsed.clauseSplitApplied, true);
  assert.deepEqual(
    parsed.clauses.map((clause) => clause.text),
    [
      '先检查日志，',
      '然后保留 provenance,',
      'but do not summarize too early,',
      'and keep the current goal explicit.'
    ]
  );
  assert.deepEqual(
    parsed.clauses.map((clause) => clause.id),
    ['sentence-1-clause-1', 'sentence-1-clause-2', 'sentence-1-clause-3', 'sentence-1-clause-4']
  );
  assert.deepEqual(
    parsed.clauses.map((clause) => clause.startOffset),
    [0, 6, 23, 55]
  );
  assert.deepEqual(
    parsed.clauses.map((clause) => clause.endOffset),
    [6, 22, 54, text.length]
  );
  assert.equal(parsed.clauses[1]?.normalizedText, '然后保留 provenance,');
  assert.equal(parsed.clauses[2]?.boundary, 'punctuation');
});

test('utterance parser falls back to sentence-level clauses when the route does not allow clause splitting', () => {
  const parsed = parseContextRecordUtterance({
    scope: 'session',
    sourceType: 'tool_output',
    role: 'tool',
    content: 'error: build failed, retry with a different cache key.',
    provenance: {
      originKind: 'compressed',
      sourceStage: 'tool_result_persist',
      producer: 'compact-context'
    }
  });

  assert.equal(parsed.route, 'tool_result');
  assert.equal(parsed.clauseSplitApplied, false);
  assert.deepEqual(parsed.appliedFallbacks, ['sentence_split']);
  assert.equal(parsed.clauses.length, 1);
  assert.equal(parsed.clauses[0]?.boundary, 'fallback');
  assert.equal(parsed.clauses[0]?.text, 'error: build failed, retry with a different cache key.');
});

test('utterance parser produces stable results for long contrastive sentences across repeated parses', () => {
  const text =
    'First inspect the build log and preserve provenance before changing anything, however if the migration timeout keeps reproducing then document the failure path and only afterwards continue with the recovery step.';

  const first = parseUtterance(text, 'conversation');
  const second = parseUtterance(text, 'conversation');

  assert.deepEqual(first, second);
  assert.ok(first.clauses.length >= 3);
  assert.equal(first.appliedFallbacks.length, 0);
});
