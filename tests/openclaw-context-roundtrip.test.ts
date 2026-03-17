import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveRepoRoot } from './repo-root.js';

const REPO_ROOT = resolveRepoRoot(import.meta.url);

function createMockRegistry(result: {
  provider: 'codex-cli' | 'codex-oauth' | 'openai-responses';
  summary: string;
  model?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
}) {
  return {
    async listAvailability() {
      return [
        {
          availability: {
            available: true,
            configured: true,
            reason: 'mock provider'
          }
        }
      ];
    },
    async generateWithOrder(_input: { prompt: string }, order: readonly string[]) {
      return {
        result: {
          providerId: result.provider,
          providerLabel: result.provider,
          transport: result.provider,
          text: result.summary,
          ...(result.model ? { model: result.model } : {}),
          ...(result.reasoningEffort ? { reasoningEffort: result.reasoningEffort } : {})
        },
        attempts: [...order],
        failures: []
      };
    }
  };
}

async function loadRoundtripModule() {
  return import(
    pathToFileURL(resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/cli/context-roundtrip.js')).href
  ) as Promise<{
    runRoundtrip(
      input: {
        text: string;
        mode?: 'auto' | 'code' | 'codex' | 'codex-cli' | 'codex-oauth' | 'openai-responses' | 'llm';
        query?: string;
        sessionId?: string;
        tokenBudget?: number;
        workspaceId?: string;
      },
      dependencies?: {
        createCodexRegistry?: (_options?: Record<string, unknown>) => ReturnType<typeof createMockRegistry>;
      }
    ): Promise<{
      sessionId: string;
      query: string;
      inputText: string;
      ingestText: string;
      note: string;
      summary: {
        modeUsed: 'code' | 'codex-cli' | 'codex-oauth' | 'openai-responses';
        provider: 'code' | 'codex-cli' | 'codex-oauth' | 'openai-responses';
        summary: string;
      };
      ingest: {
        recordCount: number;
        candidateNodeCount: number;
        persistedNodeCount: number;
      };
      compile: {
        includedNodeIds: string[];
        selectedNodeLabels: string[];
        summaryContract: {
          currentProcess?: { label: string };
        };
        bundle: {
          tokenBudget: {
            total: number;
          };
        };
      };
    }>;
  }>;
}

test('openclaw context roundtrip uses raw text for ingest and returns compile diagnostics', async () => {
  const { runRoundtrip } = await loadRoundtripModule();
  const result = await runRoundtrip({
    text: '今天先把首页做成控制塔视角，并保留任务总览。',
    mode: 'code',
    sessionId: 'roundtrip-test',
    tokenBudget: 900
  });

  assert.equal(result.sessionId, 'roundtrip-test');
  assert.equal(result.summary.modeUsed, 'code');
  assert.equal(result.inputText, '今天先把首页做成控制塔视角，并保留任务总览。');
  assert.equal(result.ingestText, result.inputText);
  assert.equal(result.ingest.recordCount, 1);
  assert.ok(result.ingest.candidateNodeCount > 0);
  assert.ok(result.ingest.persistedNodeCount > 0);
  assert.equal(result.compile.bundle.tokenBudget.total, 900);
  assert.ok(result.compile.includedNodeIds.length > 0);
  assert.match(result.note, /始终 ingest 原文/);
});

test('openclaw context roundtrip accepts toolkit registry result for codex preview', async () => {
  const { runRoundtrip } = await loadRoundtripModule();
  const result = await runRoundtrip(
    {
      text: '请压缩这句话：今天先把首页做成控制塔视角，并保留任务总览。',
      mode: 'codex',
      query: '当前任务是什么？'
    },
    {
      createCodexRegistry: () =>
        createMockRegistry({
          provider: 'codex-cli',
          summary: '首页控制塔视角，保留任务总览',
          model: 'gpt-5.4',
          reasoningEffort: 'low'
        })
    }
  );

  assert.equal(result.query, '当前任务是什么？');
  assert.equal(result.summary.modeUsed, 'codex-cli');
  assert.equal(result.summary.provider, 'codex-cli');
  assert.equal(result.summary.summary, '首页控制塔视角，保留任务总览');
  assert.ok(result.compile.selectedNodeLabels.length > 0);
});

test('openclaw context cli dist bin includes roundtrip command help', async () => {
  const binSource = await readFile(
    resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/bin/openclaw-context-cli.js'),
    'utf8'
  );

  assert.match(binSource, /roundtrip/);
  assert.match(binSource, /ingest -> compile/);
  assert.match(binSource, /roundtrip \[--text <text> \| --file <path>].*--model <provider>\/<model>.*--json/);
  assert.match(binSource, /codex-oauth/);
  assert.match(binSource, /llm/);
});
