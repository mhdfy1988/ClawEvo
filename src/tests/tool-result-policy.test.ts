import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyToolResultPolicy,
  buildCompressedToolResultMetadata,
  readCompressedToolResultContent,
  summarizeToolResultMessageContent
} from '../openclaw/tool-result-policy.js';
import { createOversizedFailureToolMessage } from './fixtures/tool-result-fixtures.js';

test('applyToolResultPolicy compresses oversized failure output into structured content', () => {
  const decision = applyToolResultPolicy(createOversizedFailureToolMessage());

  assert.equal(decision.changed, true);
  assert.ok(decision.compressedSize < decision.rawSize);

  const compressed = readCompressedToolResultContent(decision.message.content);

  assert.ok(compressed);
  assert.equal(compressed.status, 'failure');
  assert.equal(compressed.resultKind, 'test_run');
  assert.equal(compressed.provenance.originKind, 'compressed');
  assert.equal(compressed.provenance.sourceStage, 'tool_result_persist');
  assert.ok(compressed.preview?.stdout?.head);
  assert.ok(compressed.preview?.stderr?.tail);
  assert.ok(compressed.truncation.droppedSections.includes('stdout.middle'));
  assert.ok(compressed.truncation.droppedSections.includes('stderr.middle'));
  assert.match(compressed.summary, /pytest/i);

  const metadata = buildCompressedToolResultMetadata(compressed);
  assert.equal(metadata.toolResultCompressed, true);
  assert.equal(metadata.toolStatus, 'failure');
  assert.equal(metadata.toolResultKind, 'test_run');

  const summary = summarizeToolResultMessageContent(decision.message.content);
  assert.ok(summary);
  assert.match(summary, /tool:shell_command/i);
});
