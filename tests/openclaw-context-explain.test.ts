import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ContextEngine } from '@openclaw-compact-context/compact-context-core';
import {
  buildCompressedToolResultMetadata,
  readCompressedToolResultContent,
  summarizeToolResultMessageContent
} from '@openclaw-compact-context/openclaw-adapter/openclaw/tool-result-policy';

import { resolveRepoRoot } from './repo-root.js';
import { createCompressedFailureToolMessage } from './fixtures/tool-result-fixtures.js';

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
        createEngine?: () => ContextEngine;
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
        recalledNodes: Array<{
          nodeId: string;
          type: string;
          label: string;
          included: boolean;
          reasons: string[];
          primaryRecallKind?: 'direct_text' | 'relation_graph' | 'learning_graph';
          recallKinds?: Array<'direct_text' | 'relation_graph' | 'learning_graph'>;
        }>;
        recalledNodeIds: string[];
        recalledNodeLabels: string[];
        compaction?: {
          mode: 'none' | 'incremental' | 'full';
          reason?: string;
          baselineId?: string;
          baselineIds?: string[];
          rawTailStartMessageId?: string;
          retainedRawTurnCount: number;
          retainedRawTurns: Array<{
            turnId: string;
            messageIds: string[];
          }>;
          diagnostics?: {
            trigger?: 'occupancy' | 'baseline_rollup' | 'manual_rebuild';
            occupancyRatioBefore?: number;
            occupancyRatioAfter?: number;
            sealedIncrementalId?: string;
            appendedBaselineId?: string;
            mergedBaselineIds?: string[];
            mergedBaselineResultId?: string;
            rollback?: boolean;
            evictedBaselineId?: string;
            rawTailTokenEstimate?: number;
            incrementalTokenEstimate?: number;
            baselineTokenEstimate?: number;
            baselineCount?: number;
            sidecarReferenceCount?: number;
            fallbackLevel?: 'none' | 'live_recent_messages';
          };
        };
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
          toolResultCompression?: {
            policyId: string;
            reason?: string;
            droppedSections: string[];
            lookup: {
              rawSourceId?: string;
              artifactPath?: string;
              sourcePath?: string;
            };
          };
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

test('openclaw context explain surfaces compaction, recalled nodes, and retained raw turns', async () => {
  const { runExplain } = await loadExplainModule();
  const engine = new ContextEngine();
  const sessionId = 'explain-compaction-session';

  try {
    await engine.saveCompressionState({
      id: 'compression-state-explain',
      sessionId,
      compressionMode: 'incremental',
      incremental: {
        summary: {
          summaryText: 'Earlier history is summarized.',
          tokenEstimate: 24
        },
        derivedFrom: ['msg-1'],
        createdAt: '2026-03-19T00:00:00.000Z'
      },
      rawTail: {
        turnCount: 2,
        turns: [
          {
            turnId: 'turn-2',
            messageIds: ['user-2', 'assistant-2']
          },
          {
            turnId: 'turn-3',
            messageIds: ['user-3', 'assistant-3']
          }
        ],
        derivedFrom: ['user-2', 'assistant-2', 'user-3', 'assistant-3'],
        createdAt: '2026-03-19T00:00:00.000Z'
      },
      rawTailStartMessageId: 'user-2',
      baselineVersion: 0,
      derivedFrom: ['msg-1', 'user-2', 'assistant-2', 'user-3', 'assistant-3'],
      createdAt: '2026-03-19T00:00:00.000Z',
      updatedAt: '2026-03-19T00:00:00.000Z'
    });

    const result = await runExplain(
      {
        text: '第三轮开始应该进入增量压缩。',
        mode: 'code',
        sessionId,
        limit: 2
      },
      {
        createEngine: () => engine
      }
    );

    assert.ok(result.compile.recalledNodes.length > 0);
    assert.deepEqual(
      result.compile.recalledNodeIds,
      result.compile.recalledNodes.map((item) => item.nodeId)
    );
    assert.deepEqual(
      result.compile.recalledNodeLabels,
      result.compile.recalledNodes.map((item) => `${item.type}:${item.label}`)
    );
    assert.equal(
      result.compile.recalledNodes.some((item) => item.recallKinds?.includes('direct_text') === true),
      true
    );
    assert.equal(result.compile.recalledNodes.some((item) => item.included === true), true);
    assert.equal(result.compile.recalledNodes.every((item) => item.reasons.length > 0), true);
    assert.equal(result.compile.compaction?.mode, 'incremental');
    assert.equal(result.compile.compaction?.reason, 'history_before_recent_raw_tail');
    assert.equal(result.compile.compaction?.retainedRawTurnCount, 2);
    assert.equal(result.compile.compaction?.retainedRawTurns.length, 2);
    assert.equal(result.compile.compaction?.rawTailStartMessageId, result.compile.compaction?.retainedRawTurns[0]?.messageIds[0]);
  } finally {
    await engine.close();
  }
});

test('openclaw context explain keeps legacy single-baseline state compatible', async () => {
  const { runExplain } = await loadExplainModule();
  const engine = new ContextEngine();
  const sessionId = 'explain-legacy-baseline-session';

  try {
    await engine.saveCompressionState({
      id: 'compression-state-legacy-explain',
      sessionId,
      compressionMode: 'full',
      baseline: {
        baselineId: 'legacy-baseline-1',
        baselineVersion: 1,
        summary: {
          summaryText: '旧版单 baseline 状态。',
          tokenEstimate: 16
        },
        derivedFrom: ['msg-1', 'msg-2'],
        createdAt: '2026-03-19T00:00:00.000Z'
      },
      rawTail: {
        turnCount: 2,
        turns: [
          {
            turnId: 'turn-2',
            messageIds: ['user-2', 'assistant-2']
          },
          {
            turnId: 'turn-3',
            messageIds: ['user-3', 'assistant-3']
          }
        ],
        derivedFrom: ['user-2', 'assistant-2', 'user-3', 'assistant-3'],
        createdAt: '2026-03-19T00:00:00.000Z'
      },
      rawTailStartMessageId: 'user-2',
      baselineCoveredUntilMessageId: 'msg-2',
      baselineVersion: 1,
      derivedFrom: ['msg-1', 'msg-2', 'user-2', 'assistant-2', 'user-3', 'assistant-3'],
      createdAt: '2026-03-19T00:00:00.000Z',
      updatedAt: '2026-03-19T00:00:00.000Z'
    } as Awaited<ReturnType<ContextEngine['getCompressionState']>> & {
      baseline: {
        baselineId: string;
        baselineVersion: number;
        summary: {
          summaryText: string;
          tokenEstimate: number;
        };
        derivedFrom: string[];
        createdAt: string;
      };
    });

    const result = await runExplain(
      {
        text: '旧状态兼容也要能看到 baseline。',
        mode: 'code',
        sessionId,
        limit: 1
      },
      {
        createEngine: () => engine
      }
    );

    assert.equal(result.compile.compaction?.mode, 'full');
    assert.equal(result.compile.compaction?.reason, 'budget_over_50_percent');
    assert.equal(result.compile.compaction?.baselineId, 'legacy-baseline-1');
  } finally {
    await engine.close();
  }
});

test('openclaw context explain surfaces compression diagnostics and baseline ids', async () => {
  const { runExplain } = await loadExplainModule();
  const engine = new ContextEngine();
  const sessionId = 'explain-compaction-diagnostics-session';

  try {
    await engine.saveCompressionState({
      id: 'compression-state-explain-diagnostics',
      sessionId,
      compressionMode: 'full',
      baselines: [
        {
          baselineId: 'baseline-explain-1',
          baselineVersion: 1,
          generation: 0,
          summary: {
            summaryText: '历史基线 1',
            tokenEstimate: 24
          },
          derivedFrom: ['msg-1'],
          createdAt: '2026-03-19T00:00:00.000Z'
        },
        {
          baselineId: 'baseline-explain-2',
          baselineVersion: 2,
          generation: 0,
          summary: {
            summaryText: '历史基线 2',
            tokenEstimate: 26
          },
          derivedFrom: ['msg-2'],
          createdAt: '2026-03-19T00:00:00.000Z'
        }
      ],
      rawTail: {
        turnCount: 2,
        turns: [
          {
            turnId: 'turn-6',
            messageIds: ['user-6', 'assistant-6']
          },
          {
            turnId: 'turn-7',
            messageIds: ['user-7', 'assistant-7']
          }
        ],
        derivedFrom: ['user-6', 'assistant-6', 'user-7', 'assistant-7'],
        createdAt: '2026-03-19T00:00:00.000Z'
      },
      rawTailStartMessageId: 'user-6',
      baselineCoveredUntilMessageId: 'msg-2',
      baselineVersion: 2,
      compressionDiagnostics: {
        trigger: 'baseline_rollup',
        occupancyRatioBefore: 0.62,
        occupancyRatioAfter: 0.34,
        sealedIncrementalId: 'incremental-explain-1',
        appendedBaselineId: 'baseline-explain-2',
        mergedBaselineIds: ['baseline-explain-legacy-1', 'baseline-explain-legacy-2'],
        mergedBaselineResultId: 'baseline-explain-rollup-1',
        rawTailTokenEstimate: 44,
        incrementalTokenEstimate: 20,
        baselineTokenEstimate: 50,
        baselineCount: 2,
        sidecarReferenceCount: 1,
        fallbackLevel: 'none'
      },
      derivedFrom: ['msg-1', 'msg-2', 'user-6', 'assistant-6', 'user-7', 'assistant-7'],
      createdAt: '2026-03-19T00:00:00.000Z',
      updatedAt: '2026-03-19T00:00:00.000Z'
    });

    const result = await runExplain(
      {
        text: '请解释当前历史压缩层和诊断信息。',
        mode: 'code',
        sessionId,
        limit: 1
      },
      {
        createEngine: () => engine
      }
    );

    assert.equal(result.compile.compaction?.mode, 'full');
    assert.deepEqual(result.compile.compaction?.baselineIds, ['baseline-explain-1', 'baseline-explain-2']);
    assert.equal(result.compile.compaction?.baselineId, 'baseline-explain-2');
    assert.equal(result.compile.compaction?.diagnostics?.trigger, 'baseline_rollup');
    assert.equal(result.compile.compaction?.diagnostics?.sealedIncrementalId, 'incremental-explain-1');
    assert.equal(result.compile.compaction?.diagnostics?.occupancyRatioBefore, 0.62);
    assert.equal(result.compile.compaction?.diagnostics?.occupancyRatioAfter, 0.34);
    assert.equal(result.compile.compaction?.diagnostics?.baselineCount, 2);
    assert.equal(result.compile.compaction?.diagnostics?.sidecarReferenceCount, 1);
  } finally {
    await engine.close();
  }
});

test('openclaw context explain surfaces tool result sidecar lookup details in explanations', async () => {
  const { runExplain } = await loadExplainModule();
  const engine = new ContextEngine();
  const sessionId = 'explain-tool-result-sidecar-session';
  const compressedMessage = createCompressedFailureToolMessage();
  const compressedContent = readCompressedToolResultContent(compressedMessage.content);

  assert.ok(compressedContent);
  assert.ok(compressedContent.artifact);

  try {
    await engine.ingest({
      sessionId,
      records: [
        {
          id: 'tool-explain-sidecar-1',
          scope: 'session',
          sourceType: 'tool_output',
          role: 'tool',
          content: summarizeToolResultMessageContent(compressedMessage.content) ?? 'compressed tool result',
          provenance: compressedContent.provenance,
          metadata: {
            nodeType: 'State',
            ...buildCompressedToolResultMetadata({
              ...compressedContent,
              artifact: {
                ...compressedContent.artifact!,
                path: 'D:/tmp/tool-artifacts/explain-tool-result.json'
              }
            })
          }
        }
      ]
    });

    const nodes = await engine.queryNodes({
      sessionId,
      types: ['State']
    });
    const targetNodeId = nodes.find((node) => node.provenance?.sourceStage === 'tool_result_persist')?.id;

    assert.ok(targetNodeId);

    const result = await runExplain(
      {
        text: '请解释最近一次 pytest 失败为什么被压缩保存。',
        mode: 'code',
        sessionId,
        nodeId: targetNodeId,
        query: 'why was the pytest failure compressed into a sidecar-backed tool result'
      },
      {
        createEngine: () => engine
      }
    );

    assert.equal(result.explain.explanations.length, 1);
    assert.equal(
      result.explain.explanations[0]?.toolResultCompression?.lookup.artifactPath,
      'D:/tmp/tool-artifacts/explain-tool-result.json'
    );
    assert.equal(
      result.explain.explanations[0]?.toolResultCompression?.lookup.sourcePath,
      compressedContent.artifact?.sourcePath
    );
    assert.equal(
      result.explain.explanations[0]?.toolResultCompression?.lookup.rawSourceId,
      compressedContent.provenance.rawSourceId
    );
  } finally {
    await engine.close();
  }
});

test('openclaw context cli dist bin includes explain command help', async () => {
  const runtimeSource = await readFile(
    resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/cli/context-cli-runtime.js'),
    'utf8'
  );

  assert.match(runtimeSource, /explain/);
  assert.match(runtimeSource, /对当前 bundle 里的选中节点执行 explain/);
  assert.match(runtimeSource, /explain \[--text <text> \| --file <path>]/);
  assert.match(runtimeSource, /--model <provider>\/<model>/);
  assert.match(runtimeSource, /--node-id <id>/);
  assert.match(runtimeSource, /openai-responses/);
  assert.match(runtimeSource, /llm/);
});
