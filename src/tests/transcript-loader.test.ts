import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadTranscriptContextInput } from '../openclaw/transcript-loader.js';
import { createCompressedToolTranscript } from './fixtures/tool-result-fixtures.js';

test('loadTranscriptContextInput preserves compressed tool result provenance and metadata', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'compact-context-'));
  const sessionFile = join(dir, 'session.jsonl');

  try {
    await writeFile(sessionFile, createCompressedToolTranscript(), 'utf8');

    const input = await loadTranscriptContextInput({
      sessionId: 'session-tool',
      sessionFile
    });

    assert.equal(input.records.length, 1);
    const [record] = input.records;

    assert.ok(record);
    assert.equal(record.provenance?.originKind, 'compressed');
    assert.equal(record.provenance?.sourceStage, 'tool_result_persist');
    assert.equal(record.metadata?.toolResultCompressed, true);
    assert.equal(record.metadata?.toolResultKind, 'test_run');
    assert.ok(typeof record.metadata?.toolCompressionReason === 'string');
    assert.ok(Array.isArray(record.metadata?.toolDroppedSections));
    assert.match(record.content, /\[tool:shell_command\]/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadTranscriptContextInput maps custom_message and compaction entries to finer semantic hints', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'compact-context-'));
  const sessionFile = join(dir, 'session-structured.jsonl');

  const transcript = [
    JSON.stringify({
      type: 'session',
      id: 'session-structured',
      timestamp: '2026-03-13T11:00:00.000Z'
    }),
    JSON.stringify({
      id: 'custom-constraint-1',
      type: 'custom_message',
      customType: 'constraint_note',
      timestamp: '2026-03-13T11:00:01.000Z',
      content: '',
      display: '必须保留 provenance。',
      details: {
        note: '不能把 compressed 内容当成 raw。'
      }
    }),
    JSON.stringify({
      id: 'compaction-step-1',
      type: 'compaction',
      parentId: 'custom-constraint-1',
      timestamp: '2026-03-13T11:00:02.000Z',
      summary: '下一步：先接入 tool_result_persist，再刷新 checkpoint。',
      firstKeptEntryId: 'message-keep-1',
      details: {
        stage: 'phase-2'
      }
    })
  ].join('\n');

  try {
    await writeFile(sessionFile, transcript, 'utf8');

    const input = await loadTranscriptContextInput({
      sessionId: 'session-structured',
      sessionFile
    });

    assert.equal(input.records.length, 2);

    const constraintRecord = input.records.find((record) => record.id === 'custom-constraint-1');
    const compactionRecord = input.records.find((record) => record.id === 'compaction-step-1');

    assert.ok(constraintRecord);
    assert.equal(constraintRecord.sourceType, 'rule');
    assert.equal(constraintRecord.metadata?.nodeType, 'Constraint');
    assert.match(constraintRecord.content, /provenance/i);
    assert.ok(typeof constraintRecord.metadata?.semanticGroupKey === 'string');

    assert.ok(compactionRecord);
    assert.equal(compactionRecord.sourceType, 'workflow');
    assert.equal(compactionRecord.metadata?.nodeType, 'Step');
    assert.equal(compactionRecord.provenance?.originKind, 'compressed');
    assert.ok(typeof compactionRecord.metadata?.semanticGroupKey === 'string');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
