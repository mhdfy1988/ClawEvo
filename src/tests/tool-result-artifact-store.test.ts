import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ToolResultArtifactStore } from '../openclaw/tool-result-artifact-store.js';
import { applyToolResultPolicy, readCompressedToolResultContent } from '../openclaw/tool-result-policy.js';
import { createOversizedFailureToolMessage } from './fixtures/tool-result-fixtures.js';

test('ToolResultArtifactStore persists content-addressed sidecar artifacts for compressed tool results', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'compact-context-artifact-'));

  try {
    const store = new ToolResultArtifactStore(dir);
    const rawMessage = createOversizedFailureToolMessage();
    const decision = await store.persistDecision(rawMessage, applyToolResultPolicy(rawMessage));
    const compressed = readCompressedToolResultContent(decision.message.content);

    assert.ok(compressed?.artifact?.path);

    const stored = await readFile(compressed.artifact.path as string, 'utf8');

    assert.match(stored, /compact-context\.tool-result-artifact\.v1/);
    assert.match(stored, /pytest -q/);
    assert.match(stored, /call_tool_result_001/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('ToolResultArtifactStore prunes stale artifact files by age threshold', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'compact-context-prune-'));
  const nested = join(dir, 'ab');
  const staleFile = join(nested, 'stale.json');
  const freshFile = join(nested, 'fresh.json');
  const now = new Date('2026-03-13T12:00:00.000Z');

  try {
    await mkdirRecursive(nested);
    await writeFile(staleFile, '{"stale":true}', 'utf8');
    await writeFile(freshFile, '{"fresh":true}', 'utf8');
    await utimes(staleFile, new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000));
    await utimes(freshFile, now, now);

    const store = new ToolResultArtifactStore(dir);
    const result = await store.pruneStaleArtifacts({
      maxAgeMs: 24 * 60 * 60 * 1000,
      nowMs: now.getTime()
    });

    assert.equal(result.scannedFiles, 2);
    assert.equal(result.deletedFiles, 1);
    assert.deepEqual(result.deletedPaths, [staleFile]);

    await assert.rejects(() => readFile(staleFile, 'utf8'));
    assert.equal(await readFile(freshFile, 'utf8'), '{"fresh":true}');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

async function mkdirRecursive(path: string): Promise<void> {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(path, { recursive: true });
}
