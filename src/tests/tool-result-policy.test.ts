import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyToolResultPolicy,
  buildCompressedToolResultMetadata,
  readCompressedToolResultMetadata,
  readCompressedToolResultContent,
  summarizeToolResultMessageContent
} from '@openclaw-compact-context/openclaw-adapter/openclaw/tool-result-policy';
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
  assert.equal(metadata.toolCompressionReason, compressed.truncation.reason);
  assert.deepEqual(metadata.toolDroppedSections, compressed.truncation.droppedSections);
  assert.equal(metadata.toolArtifactContentHash, compressed.artifact?.contentHash ?? null);

  const metadataView = readCompressedToolResultMetadata(metadata);
  assert.ok(metadataView);
  assert.equal(metadataView.policyId, compressed.truncation.policyId);
  assert.equal(metadataView.reason, compressed.truncation.reason);
  assert.ok(metadataView.droppedSections.includes('stdout.middle'));
  assert.equal(metadataView.lookup.contentHash, compressed.artifact?.contentHash);

  const summary = summarizeToolResultMessageContent(decision.message.content);
  assert.ok(summary);
  assert.match(summary, /tool:shell_command/i);
});
