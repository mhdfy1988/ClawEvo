import test from 'node:test';
import assert from 'node:assert/strict';

import { ContextEngine } from '@openclaw-compact-context/runtime-core/engine/context-engine';
import {
  buildGatewaySuccessPayload,
  buildInspectBundlePayload,
  OpenClawContextEngineAdapter
} from '@openclaw-compact-context/openclaw-adapter/openclaw/context-engine-adapter';
import { readCompressedToolResultContent } from '@openclaw-compact-context/openclaw-adapter/openclaw/tool-result-policy';
import type { ExplainResult } from '@openclaw-compact-context/contracts';
import {
  createCompressedToolSmokeFixture,
  createDebugSmokeFixture,
  createDebugSmokePluginConfig
} from './fixtures/debug-smoke-fixtures.js';
import { createOversizedFailureToolMessage } from './fixtures/tool-result-fixtures.js';
import {
  EXPECTED_INSPECT_BUNDLE_PROMPT_PREVIEW,
  EXPECTED_INSPECT_BUNDLE_SUMMARY,
  EXPECTED_QUERY_EXPLAIN_SNAPSHOT
} from './fixtures/debug-smoke-snapshots.js';

test('debug smoke keeps inspect_bundle operational for a representative session', async () => {
  const fixture = await createDebugSmokeFixture();

  const payload = await buildInspectBundlePayload(
    {
      sessionId: fixture.sessionId,
      query: fixture.defaultQuery,
      tokenBudget: fixture.totalTokenBudget,
      explainLimit: 3
    },
    fixture.engine,
    createDebugSmokePluginConfig()
  );

  assert.equal(payload.selectionContext.sessionId, fixture.sessionId);
  assert.equal(payload.selectionContext.query, fixture.defaultQuery);
  assert.equal(payload.selectionContext.tokenBudget, fixture.compileTokenBudget);
  assert.ok(payload.bundle.openRisks.length > 0);
  assert.match(payload.summary, /\[Selection Diagnostics\]/);
  assert.match(payload.summary, /openRisks:/);
  assert.doesNotMatch(payload.promptPreview, /\[Selection Diagnostics\]/);
  assert.ok(payload.explain);
  assert.ok((payload.explain?.explainedCount ?? 0) > 0);
  assert.ok((payload.explain?.totalCandidateCount ?? 0) >= (payload.explain?.explainedCount ?? 0));

  await fixture.engine.close();
});

test('debug smoke keeps query_nodes plus explain aggregation operational', async () => {
  const fixture = await createDebugSmokeFixture('session-debug-smoke-query');
  const nodes = await fixture.engine.queryNodes({
    sessionId: fixture.sessionId,
    types: ['Risk', 'Rule']
  });

  const payload = (await buildGatewaySuccessPayload(
    'query_nodes',
    {
      explain: true,
      explainLimit: 2,
      filter: {
        sessionId: fixture.sessionId,
        text: fixture.defaultQuery
      }
    },
    { nodes },
    fixture.engine,
    createDebugSmokePluginConfig()
  )) as {
    nodes: unknown[];
    queryMatch: {
      query: string;
      queryTerms: string[];
      matchedNodeCount: number;
      diagnostics: Array<{
        matchedTerms: string[];
        coverage: number;
      }>;
    };
    explain: {
      enabled: boolean;
      explainedCount: number;
      totalNodeCount: number;
      truncated: boolean;
      selectionContext?: {
        sessionId: string;
        query?: string;
      };
      explanations: Array<{
        trace?: {
          selection: {
            evaluated: boolean;
            included?: boolean;
          };
        };
        selection?: {
          included: boolean;
          slot?: string;
        };
      }>;
    };
  };

  assert.equal(Array.isArray(payload.nodes), true);
  assert.equal(payload.queryMatch.query, fixture.defaultQuery);
  assert.ok(payload.queryMatch.queryTerms.length > 0);
  assert.ok(payload.queryMatch.matchedNodeCount > 0);
  assert.equal(payload.queryMatch.diagnostics.length, nodes.length);
  assert.ok(payload.queryMatch.diagnostics.some((item) => item.matchedTerms.length > 0));
  assert.ok(payload.queryMatch.diagnostics.some((item) => item.coverage > 0));
  assert.equal(payload.explain.enabled, true);
  assert.equal(payload.explain.selectionContext?.sessionId, fixture.sessionId);
  assert.equal(payload.explain.selectionContext?.query, fixture.defaultQuery);
  assert.equal(payload.explain.explainedCount, Math.min(2, nodes.length));
  assert.equal(payload.explain.totalNodeCount, nodes.length);
  assert.ok(payload.explain.explanations.some((item) => item.selection?.included === true));
  assert.ok(payload.explain.explanations.some((item) => item.trace?.selection.evaluated === true));

  await fixture.engine.close();
});

test('debug smoke keeps explain selection details for included and skipped nodes', async () => {
  const fixture = await createDebugSmokeFixture('session-debug-smoke-explain');

  const included = await fixture.engine.explain({
    nodeId: fixture.selectedRiskNodeId,
    selectionContext: {
      sessionId: fixture.sessionId,
      query: fixture.defaultQuery,
      tokenBudget: fixture.compileTokenBudget
    }
  });

  const skipped = await fixture.engine.explain({
    nodeId: fixture.skippedStepNodeId,
    selectionContext: {
      sessionId: fixture.sessionId,
      query: 'why is the current step missing',
      tokenBudget: 24
    }
  });

  assert.equal(included.selection?.included, true);
  assert.equal(included.selection?.slot, 'openRisks');
  assert.equal(included.trace?.selection.evaluated, true);
  assert.equal(included.trace?.selection.included, true);
  assert.match(included.summary, /Selection: included in openRisks/i);
  assert.equal(skipped.selection?.included, false);
  assert.equal(skipped.selection?.slot, 'currentProcess');
  assert.match(skipped.selection?.reason ?? '', /budget/i);
  assert.equal(skipped.trace?.selection.evaluated, true);
  assert.equal(skipped.trace?.selection.included, false);
  assert.match(skipped.summary, /Selection: skipped from currentProcess/i);

  await fixture.engine.close();
});

test('debug smoke keeps compressed tool provenance explainable', async () => {
  const fixture = await createCompressedToolSmokeFixture();

  const result = await fixture.engine.explain({
    nodeId: fixture.compressedNodeId,
    selectionContext: {
      sessionId: fixture.sessionId,
      query: 'sqlite timeout compressed tool result',
      tokenBudget: 220
    }
  });

  assert.equal(result.provenance?.originKind, 'compressed');
  assert.equal(result.provenance?.sourceStage, 'tool_result_persist');
  assert.match(result.summary, /compressed \/ tool_result_persist/i);

  await fixture.engine.close();
});

test('debug smoke keeps representative compression path operational for a long sidecar-backed session', async () => {
  const engine = new ContextEngine();
  const adapter = new OpenClawContextEngineAdapter(
    {
      get: async () => engine,
      recordRuntimeWindowSnapshot: async () => undefined
    } as never,
    createDebugSmokePluginConfig(),
    {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined
    } as never
  );
  const oversizedToolResult = createOversizedFailureToolMessage();
  const sessionId = 'session-debug-smoke-compression';
  const messages = [
    ...createDebugTurnMessages(1, 24),
    ...createDebugTurnMessages(2, 24),
    {
      ...oversizedToolResult,
      id: 'tool-2',
      role: 'toolResult',
      toolCallId: 'call_debug_smoke_1'
    },
    ...createDebugTurnMessages(3, 24)
  ];

  const result = await adapter.assemble({
    sessionId,
    messages,
    tokenBudget: 560
  });

  const state = await engine.getCompressionState(sessionId);
  assert.ok(state);
  assert.equal(state.compressionMode, 'full');
  assert.equal(state.baselines?.length, 1);
  assert.equal(state.compressionDiagnostics?.sidecarReferenceCount, 1);
  assert.equal(state.rawTail.turnCount, 2);
  assert.deepEqual(state.rawTail.turns.map((turn: { messageIds: string[] }) => turn.messageIds), [
    ['user-2', 'assistant-2', 'tool-2'],
    ['user-3', 'assistant-3']
  ]);
  const toolMessage = result.messages.find((message) => message.id === 'tool-2');
  const compressedTool = readCompressedToolResultContent(toolMessage?.content);
  assert.ok(compressedTool);
  assert.equal(compressedTool?.provenance.sourceStage, 'tool_result_persist');
  assert.ok((compressedTool?.artifact?.contentHash?.length ?? 0) > 0);

  await engine.close();
});

test('debug smoke keeps memory lineage trace operational across checkpoint, delta, and skill candidates', async () => {
  const fixture = await createDebugSmokeFixture('session-debug-smoke-memory');

  const bundle = await fixture.engine.compileContext({
    sessionId: fixture.sessionId,
    query: fixture.defaultQuery,
    tokenBudget: fixture.compileTokenBudget
  });
  const { checkpoint, delta } = await fixture.engine.createCheckpoint({
    sessionId: fixture.sessionId,
    bundle
  });
  const { candidates } = await fixture.engine.crystallizeSkills({
    sessionId: fixture.sessionId,
    bundle,
    checkpointId: checkpoint.id,
    minEvidenceCount: 1
  });
  const result = await fixture.engine.explain({
    nodeId: fixture.selectedRiskNodeId,
    selectionContext: {
      sessionId: fixture.sessionId,
      query: fixture.defaultQuery,
      tokenBudget: fixture.compileTokenBudget
    }
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.sourceBundleId, bundle.id);
  assert.equal(candidates[0]?.sourceCheckpointId, checkpoint.id);
  assert.ok(candidates[0]?.sourceNodeIds?.includes(fixture.selectedRiskNodeId));
  assert.equal(result.trace?.persistence.persistedInCheckpoint, true);
  assert.equal(result.trace?.persistence.surfacedInDelta, true);
  assert.equal(result.trace?.persistence.surfacedInSkillCandidate, true);
  assert.equal(result.trace?.persistence.checkpointId, checkpoint.id);
  assert.equal(result.trace?.persistence.deltaId, delta.id);
  assert.equal(result.trace?.persistence.skillCandidateId, candidates[0]?.id);
  assert.equal(result.trace?.persistence.checkpointSourceBundleId, bundle.id);
  assert.equal(result.trace?.persistence.deltaSourceBundleId, bundle.id);
  assert.equal(result.trace?.persistence.skillCandidateSourceBundleId, bundle.id);

  await fixture.engine.close();
});

test('debug smoke snapshot keeps inspect_bundle text outputs stable', async () => {
  const fixture = await createDebugSmokeFixture('session-debug-snapshot');

  const payload = await buildInspectBundlePayload(
    {
      sessionId: fixture.sessionId,
      query: fixture.defaultQuery,
      tokenBudget: fixture.totalTokenBudget,
      explainLimit: 2
    },
    fixture.engine,
    createDebugSmokePluginConfig()
  );

  assert.equal(payload.summary, EXPECTED_INSPECT_BUNDLE_SUMMARY);
  assert.equal(payload.promptPreview, EXPECTED_INSPECT_BUNDLE_PROMPT_PREVIEW);

  await fixture.engine.close();
});

test('debug smoke snapshot keeps query_nodes explain view stable', async () => {
  const fixture = await createDebugSmokeFixture('session-debug-snapshot');
  const nodes = await fixture.engine.queryNodes({
    sessionId: fixture.sessionId,
    types: ['Risk', 'Rule']
  });

  const payload = (await buildGatewaySuccessPayload(
    'query_nodes',
    {
      explain: true,
      explainLimit: 2,
      filter: {
        sessionId: fixture.sessionId,
        text: fixture.defaultQuery
      }
    },
    { nodes },
    fixture.engine,
    createDebugSmokePluginConfig()
  )) as {
    explain: QueryExplainBlock;
  };

  assert.deepEqual(normalizeQueryExplainSnapshot(payload.explain), EXPECTED_QUERY_EXPLAIN_SNAPSHOT);

  await fixture.engine.close();
});

interface QueryExplainBlock {
  selectionContext?: {
    sessionId: string;
    query?: string;
  };
  explainedCount: number;
  totalNodeCount: number;
  truncated: boolean;
  explanations: ExplainResult[];
}

function normalizeQueryExplainSnapshot(block: QueryExplainBlock) {
  return {
    selectionContext: block.selectionContext,
    explainedCount: block.explainedCount,
    totalNodeCount: block.totalNodeCount,
    truncated: block.truncated,
    explanations: [...block.explanations]
      .map((item) => ({
        type: item.node?.type,
        label: item.node?.label,
        provenance: summarizeProvenance(item.provenance),
      summary: item.summary,
        trace: item.trace
          ? {
              source: {
                sourceStage: item.trace.source.sourceStage,
                rawSourceId: item.trace.source.rawSourceId
              },
              transformation: {
                evidenceNodeId: item.trace.transformation.evidenceNodeId,
                semanticNodeIdPresent: Boolean(item.trace.transformation.semanticNodeId)
              },
              selection: item.trace.selection,
              output: {
                promptReady: item.trace.output.promptReady,
                preferredForm: item.trace.output.preferredForm,
                assembledIntoPrompt: item.trace.output.assembledIntoPrompt,
                summarizedIntoCompactView: item.trace.output.summarizedIntoCompactView,
                ...(item.trace.output.summaryOnlyReason
                  ? { summaryOnlyReason: item.trace.output.summaryOnlyReason }
                  : {})
              }
            }
          : undefined,
        selection: item.selection,
        relatedNodes: [...item.relatedNodes]
          .map((node) => ({
            type: node.type,
            label: node.label,
            provenance: summarizeProvenance(node.provenance)
          }))
          .sort(compareExplainSnapshotItems)
      }))
      .sort(compareExplainSnapshotItems)
  };
}

function summarizeProvenance(provenance: ExplainResult['provenance']): string | undefined {
  if (!provenance) {
    return undefined;
  }

  return `${provenance.originKind}/${provenance.sourceStage}`;
}

function compareExplainSnapshotItems(
  left: { type?: string; label?: string },
  right: { type?: string; label?: string }
): number {
  return `${left.type ?? ''}:${left.label ?? ''}`.localeCompare(`${right.type ?? ''}:${right.label ?? ''}`);
}

function createDebugTurnMessages(turn: number, repeatCount: number) {
  return [
    {
      id: `user-${turn}`,
      role: 'user',
      content: [{ type: 'text', text: `turn ${turn} user detail `.repeat(repeatCount) }]
    },
    {
      id: `assistant-${turn}`,
      role: 'assistant',
      content: [{ type: 'text', text: `turn ${turn} assistant detail `.repeat(repeatCount) }]
    }
  ];
}


