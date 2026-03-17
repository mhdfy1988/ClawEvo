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

async function loadExplainModule() {
  return import(
    pathToFileURL(resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/cli/context-explain.js')).href
  ) as Promise<{
    runExplain(
      input: {
        text: string;
        mode?: 'auto' | 'code' | 'codex' | 'codex-cli' | 'codex-oauth' | 'openai-responses' | 'llm';
        query?: string;
        sessionId?: string;
        tokenBudget?: number;
        workspaceId?: string;
        limit?: number;
        nodeId?: string;
      },
      dependencies?: {
        createCodexRegistry?: (_options?: Record<string, unknown>) => ReturnType<typeof createMockRegistry>;
      }
    ): Promise<{
      sessionId: string;
      query: string;
      inputText: string;
      note: string;
      summary: {
        modeUsed: 'code' | 'codex-cli' | 'codex-oauth' | 'openai-responses';
        provider: 'code' | 'codex-cli' | 'codex-oauth' | 'openai-responses';
        summary: string;
      };
      compile: {
        selectedNodeIds: string[];
        selectedNodeLabels: string[];
      };
      explain: {
        limit: number;
        requestedNodeId?: string;
        explainedNodeIds: string[];
        explanations: Array<{
          node?: {
            id: string;
            label: string;
          };
          summary: string;
          selection?: {
            included: boolean;
            slot?: string;
          };
        }>;
      };
    }>;
  }>;
}

test('openclaw context explain uses selected bundle nodes as default targets', async () => {
  const { runExplain } = await loadExplainModule();
  const result = await runExplain({
    text: '今天先把首页做成控制塔视角，并保留任务总览。',
    mode: 'code',
    sessionId: 'explain-test',
    limit: 2,
    tokenBudget: 900
  });

  assert.equal(result.sessionId, 'explain-test');
  assert.equal(result.summary.modeUsed, 'code');
  assert.equal(result.inputText, '今天先把首页做成控制塔视角，并保留任务总览。');
  assert.ok(result.compile.selectedNodeIds.length > 0);
  assert.ok(result.explain.explainedNodeIds.length > 0);
  assert.ok(result.explain.explanations.length > 0);
  assert.match(result.note, /先 ingest 原文并 compile 当前 bundle/);
});

test('openclaw context explain accepts toolkit registry result and explicit node id', async () => {
  const { runExplain } = await loadExplainModule();
  const firstPass = await runExplain({
    text: '今天先把首页做成控制塔视角，并保留任务总览。',
    mode: 'code',
    limit: 1
  });
  const targetNodeId = firstPass.explain.explainedNodeIds[0];

  assert.ok(targetNodeId);

  const result = await runExplain(
    {
      text: '今天先把首页做成控制塔视角，并保留任务总览。',
      mode: 'codex-oauth',
      nodeId: targetNodeId,
      query: '当前任务是什么？'
    },
    {
      createCodexRegistry: () =>
        createMockRegistry({
          provider: 'codex-oauth',
          summary: '首页改成控制塔视角，并保留任务总览。',
          model: 'gpt-5.4',
          reasoningEffort: 'low'
        })
    }
  );

  assert.equal(result.summary.modeUsed, 'codex-oauth');
  assert.equal(result.summary.provider, 'codex-oauth');
  assert.equal(result.summary.summary, '首页改成控制塔视角，并保留任务总览。');
  assert.equal(result.explain.requestedNodeId, targetNodeId);
  assert.deepEqual(result.explain.explainedNodeIds, [targetNodeId]);
  assert.equal(result.explain.explanations.length, 1);
});

test('openclaw context cli dist bin includes explain command help', async () => {
  const binSource = await readFile(
    resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/bin/openclaw-context-cli.js'),
    'utf8'
  );

  assert.match(binSource, /explain/);
  assert.match(binSource, /对当前 bundle 里的选中节点执行 explain/);
  assert.match(binSource, /openclaw-context-cli explain \[--text <text> \| --file <path>].*--model <provider>\/<model>/);
  assert.match(binSource, /--node-id <id>/);
  assert.match(binSource, /openai-responses/);
  assert.match(binSource, /llm/);
});
