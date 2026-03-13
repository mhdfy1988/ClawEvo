import test from 'node:test';
import assert from 'node:assert/strict';

import { ContextEngine } from '../engine/context-engine.js';
import {
  buildGatewaySuccessPayload,
  buildInspectBundlePayload,
  formatBundle,
  normalizeGatewayPayload
} from '../openclaw/context-engine-adapter.js';
import {
  buildCompressedToolResultMetadata,
  readCompressedToolResultContent,
  summarizeToolResultMessageContent
} from '../openclaw/tool-result-policy.js';
import type { RuntimeContextBundle } from '../types/core.js';
import { createCompressedFailureToolMessage } from './fixtures/tool-result-fixtures.js';

test('formatBundle keeps prompt diagnostics concise', () => {
  const bundle = createBundleFixture();

  const text = formatBundle(bundle, undefined, {
    diagnosticsMode: 'prompt'
  });

  assert.match(text, /Selection note:/);
  assert.match(text, /omitted Step because the current budget was too small/i);
  assert.doesNotMatch(text, /\[Selection Diagnostics\]/);
  assert.doesNotMatch(text, /relevantEvidence: selected/i);
});

test('formatBundle includes category diagnostics in summary mode', () => {
  const bundle = createBundleFixture();

  const text = formatBundle(bundle, undefined, {
    diagnosticsMode: 'summary'
  });

  assert.match(text, /\[Selection Diagnostics\]/);
  assert.match(text, /Fixed context: selected 1 \| skipped 1/);
  assert.match(text, /Fixed skips: Step:/);
  assert.match(text, /openRisks: selected 1\/1, skipped 0, budget 12, refill 0/);
  assert.match(text, /relevantEvidence: selected 1\/4, skipped 3, budget 18, refill 0/);
});

test('normalizeGatewayPayload folds top-level explain selection context into nested payload', () => {
  const payload = normalizeGatewayPayload(
    'explain',
    {
      nodeId: 'risk-1',
      sessionId: 'session-gateway-1',
      query: 'why is the build blocked',
      tokenBudget: 1000
    },
    createPluginConfigFixture()
  );

  assert.deepEqual(payload, {
    nodeId: 'risk-1',
    selectionContext: {
      sessionId: 'session-gateway-1',
      query: 'why is the build blocked',
      tokenBudget: 300
    }
  });
});

test('normalizeGatewayPayload preserves explicit explain selection context over top-level shorthands', () => {
  const payload = normalizeGatewayPayload(
    'explain',
    {
      nodeId: 'step-1',
      sessionId: 'session-top-level',
      query: 'top-level query',
      tokenBudget: 1000,
      compileTokenBudget: 420,
      selectionContext: {
        sessionId: 'session-explicit',
        query: 'explicit query',
        tokenBudget: 128
      }
    },
    createPluginConfigFixture()
  );

  assert.deepEqual(payload, {
    nodeId: 'step-1',
    selectionContext: {
      sessionId: 'session-explicit',
      query: 'explicit query',
      tokenBudget: 128
    }
  });
});

test('buildGatewaySuccessPayload augments query_nodes with explanations and inferred selection context', async () => {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId: 'session-gateway-query-explain',
    records: [
      {
        id: 'risk-gateway-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'build failed and is blocked by a sqlite timeout in migration step 4.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1
        }
      }
    ]
  });

  const nodes = await engine.queryNodes({
    sessionId: 'session-gateway-query-explain',
    types: ['Risk']
  });

  const payload = (await buildGatewaySuccessPayload(
    'query_nodes',
    {
      explain: true,
      filter: {
        sessionId: 'session-gateway-query-explain',
        text: 'why is the build blocked'
      }
    },
    { nodes },
    engine,
    createPluginConfigFixture()
  )) as {
    nodes: unknown[];
    queryMatch: {
      query: string;
      queryTerms: string[];
      matchedNodeCount: number;
      diagnostics: Array<{
        bestField: string;
        matchedTerms: string[];
        coverage: number;
      }>;
    };
    explain: {
      selectionContext?: {
        sessionId: string;
        query?: string;
      };
      explanations: Array<{
        selection?: {
          included: boolean;
          slot?: string;
          query: string;
        };
      }>;
    };
  };

  assert.equal(Array.isArray(payload.nodes), true);
  assert.equal(payload.queryMatch.query, 'why is the build blocked');
  assert.deepEqual(payload.queryMatch.queryTerms, ['build', 'blocked']);
  assert.equal(payload.queryMatch.matchedNodeCount, 1);
  assert.equal(payload.queryMatch.diagnostics[0]?.bestField, 'label');
  assert.deepEqual(payload.queryMatch.diagnostics[0]?.matchedTerms, ['build', 'blocked']);
  assert.equal(payload.queryMatch.diagnostics[0]?.coverage, 1);
  assert.equal(payload.explain.selectionContext?.sessionId, 'session-gateway-query-explain');
  assert.equal(payload.explain.selectionContext?.query, 'why is the build blocked');
  assert.equal(payload.explain.explanations.length, 1);
  assert.equal(payload.explain.explanations[0]?.selection?.included, true);
  assert.equal(payload.explain.explanations[0]?.selection?.slot, 'openRisks');
  assert.equal(payload.explain.explanations[0]?.selection?.query, 'why is the build blocked');

  await engine.close();
});

test('buildGatewaySuccessPayload exposes tool result compression details inside query_nodes explanations', async () => {
  const engine = new ContextEngine();
  const compressedMessage = createCompressedFailureToolMessage();
  const compressedContent = readCompressedToolResultContent(compressedMessage.content);

  assert.ok(compressedContent);

  await engine.ingest({
    sessionId: 'session-gateway-tool-compression',
    records: [
      {
        id: 'tool-gateway-compressed-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: summarizeToolResultMessageContent(compressedMessage.content) ?? 'compressed tool result',
        provenance: compressedContent.provenance,
        metadata: {
          nodeType: 'State',
          ...buildCompressedToolResultMetadata(compressedContent)
        }
      }
    ]
  });

  const nodes = await engine.queryNodes({
    sessionId: 'session-gateway-tool-compression',
    types: ['State']
  });

  const payload = (await buildGatewaySuccessPayload(
    'query_nodes',
    {
      includeExplain: true,
      filter: {
        sessionId: 'session-gateway-tool-compression',
        text: 'pytest failure preview'
      }
    },
    { nodes },
    engine,
    createPluginConfigFixture()
  )) as {
    explain: {
      explanations: Array<{
        toolResultCompression?: {
          policyId: string;
          reason?: string;
          droppedSections: string[];
          lookup: {
            rawSourceId?: string;
            sourcePath?: string;
          };
        };
      }>;
    };
  };

  assert.equal(payload.explain.explanations.length, 1);
  assert.equal(
    payload.explain.explanations[0]?.toolResultCompression?.policyId,
    compressedContent.truncation.policyId
  );
  assert.equal(
    payload.explain.explanations[0]?.toolResultCompression?.reason,
    compressedContent.truncation.reason
  );
  assert.ok(
    payload.explain.explanations[0]?.toolResultCompression?.droppedSections.includes('stderr.middle')
  );
  assert.equal(
    payload.explain.explanations[0]?.toolResultCompression?.lookup.rawSourceId,
    compressedContent.provenance.rawSourceId
  );
  assert.equal(
    payload.explain.explanations[0]?.toolResultCompression?.lookup.sourcePath,
    compressedContent.artifact?.sourcePath
  );

  await engine.close();
});

test('buildGatewaySuccessPayload honors query_nodes explainLimit', async () => {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId: 'session-gateway-query-limit',
    records: [
      {
        id: 'risk-gateway-limit-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'first build failure due to sqlite timeout.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1
        }
      },
      {
        id: 'risk-gateway-limit-2',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'second build failure due to test timeout.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1
        }
      }
    ]
  });

  const nodes = await engine.queryNodes({
    sessionId: 'session-gateway-query-limit',
    types: ['Risk']
  });

  const payload = (await buildGatewaySuccessPayload(
    'query_nodes',
    {
      includeExplain: true,
      explainLimit: 1,
      sessionId: 'session-gateway-query-limit',
      query: 'why are failures happening'
    },
    { nodes },
    engine,
    createPluginConfigFixture()
  )) as {
    explain: {
      explainedCount: number;
      totalNodeCount: number;
      truncated: boolean;
    };
  };

  assert.equal(payload.explain.explainedCount, 1);
  assert.equal(payload.explain.totalNodeCount, nodes.length);
  assert.equal(payload.explain.truncated, nodes.length > 1);

  await engine.close();
});

test('buildGatewaySuccessPayload adds query match diagnostics even without explain', async () => {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId: 'session-gateway-query-match-only',
    records: [
      {
        id: 'goal-query-match-only',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to preserve provenance and explain why the build is blocked.',
        metadata: {
          nodeType: 'Goal'
        }
      }
    ]
  });

  const nodes = await engine.queryNodes({
    sessionId: 'session-gateway-query-match-only',
    types: ['Goal']
  });

  const payload = (await buildGatewaySuccessPayload(
    'query_nodes',
    {
      filter: {
        sessionId: 'session-gateway-query-match-only',
        text: 'build blocked provenance'
      }
    },
    { nodes },
    engine,
    createPluginConfigFixture()
  )) as {
    nodes: unknown[];
    queryMatch: {
      query: string;
      queryTerms: string[];
      matchedNodeCount: number;
      diagnostics: Array<{
        matchedTerms: string[];
        coverage: number;
        bestField: string;
      }>;
    };
    explain?: unknown;
  };

  assert.equal(Array.isArray(payload.nodes), true);
  assert.equal(payload.explain, undefined);
  assert.equal(payload.queryMatch.query, 'build blocked provenance');
  assert.deepEqual(payload.queryMatch.queryTerms, ['build', 'blocked', 'provenance']);
  assert.equal(payload.queryMatch.matchedNodeCount, 1);
  assert.deepEqual(payload.queryMatch.diagnostics[0]?.matchedTerms, ['build', 'blocked', 'provenance']);
  assert.equal(payload.queryMatch.diagnostics[0]?.coverage, 1);
  assert.equal(payload.queryMatch.diagnostics[0]?.bestField, 'label');

  await engine.close();
});

test('buildInspectBundlePayload returns bundle, summary, and explain samples', async () => {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId: 'session-inspect-bundle',
    records: [
      {
        id: 'goal-inspect-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to debug why the build is blocked.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'risk-inspect-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'build failed and is blocked by a sqlite timeout in migration step 4.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1
        }
      }
    ]
  });

  const payload = await buildInspectBundlePayload(
    {
      sessionId: 'session-inspect-bundle',
      query: 'why is the build blocked',
      tokenBudget: 1000,
      explainLimit: 2
    },
    engine,
    createPluginConfigFixture()
  );

  assert.equal(payload.selectionContext.sessionId, 'session-inspect-bundle');
  assert.equal(payload.selectionContext.query, 'why is the build blocked');
  assert.equal(payload.selectionContext.tokenBudget, 300);
  assert.match(payload.summary, /\[Selection Diagnostics\]/);
  assert.doesNotMatch(payload.promptPreview, /\[Selection Diagnostics\]/);
  assert.ok(payload.explain);
  assert.equal(payload.explain?.enabled, true);
  assert.equal(payload.explain?.explainLimit, 2);
  assert.ok((payload.explain?.explainedCount ?? 0) > 0);
  assert.match(payload.explain?.explanations[0]?.summary ?? '', /Selection:/);

  await engine.close();
});

test('buildInspectBundlePayload can skip explain samples', async () => {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId: 'session-inspect-no-explain',
    records: [
      {
        id: 'rule-inspect-1',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when inspecting bundle output.',
        metadata: {
          nodeType: 'Rule'
        }
      }
    ]
  });

  const payload = await buildInspectBundlePayload(
    {
      sessionId: 'session-inspect-no-explain',
      includeExplain: false
    },
    engine,
    createPluginConfigFixture()
  );

  assert.ok(payload.bundle);
  assert.equal(payload.explain, undefined);
  assert.match(payload.summary, /Budget used:/);

  await engine.close();
});

function createBundleFixture(): RuntimeContextBundle {
  return {
    id: 'bundle-format-1',
    sessionId: 'session-format-1',
    query: 'why is the current step missing',
    goal: {
      nodeId: 'goal-1',
      type: 'Goal',
      label: 'goal:keep diagnostics visible',
      scope: 'session',
      kind: 'fact',
      strength: 'hard',
      reason: 'current goal match (raw:transcript_message)',
      estimatedTokens: 12
    },
    activeRules: [],
    activeConstraints: [],
    recentDecisions: [],
    recentStateChanges: [],
    relevantEvidence: [],
    candidateSkills: [],
    openRisks: [
      {
        nodeId: 'risk-1',
        type: 'Risk',
        label: 'risk:build blocked by sqlite timeout',
        scope: 'session',
        kind: 'inference',
        strength: 'soft',
        reason: 'open risk (raw:tool_output_raw)',
        estimatedTokens: 14
      }
    ],
    tokenBudget: {
      total: 120,
      used: 48,
      reserved: 72
    },
    diagnostics: {
      fixed: {
        selected: [
          {
            nodeId: 'goal-1',
            type: 'Goal',
            label: 'goal:keep diagnostics visible',
            estimatedTokens: 12,
            reason: 'selected as fixed goal context'
          }
        ],
        skipped: [
          {
            nodeId: 'step-1',
            type: 'Step',
            label: 'workflow:produce a long current process explanation',
            estimatedTokens: 60,
            reason: 'skipped fixed current process because total budget was exhausted'
          }
        ]
      },
      categoryBudgets: {
        activeRules: 12,
        activeConstraints: 14,
        openRisks: 12,
        recentDecisions: 10,
        recentStateChanges: 10,
        relevantEvidence: 18,
        candidateSkills: 8
      },
      categories: [
        {
          category: 'activeRules',
          allocatedBudget: 12,
          inputCount: 0,
          selectedCount: 0,
          skippedCount: 0,
          selectedTokens: 0,
          refillSelectedCount: 0,
          selected: [],
          skipped: []
        },
        {
          category: 'activeConstraints',
          allocatedBudget: 14,
          inputCount: 0,
          selectedCount: 0,
          skippedCount: 0,
          selectedTokens: 0,
          refillSelectedCount: 0,
          selected: [],
          skipped: []
        },
        {
          category: 'openRisks',
          allocatedBudget: 12,
          inputCount: 1,
          selectedCount: 1,
          skippedCount: 0,
          selectedTokens: 14,
          refillSelectedCount: 0,
          selected: [
            {
              nodeId: 'risk-1',
              type: 'Risk',
              label: 'risk:build blocked by sqlite timeout',
              estimatedTokens: 14,
              reason: 'selected within category budget'
            }
          ],
          skipped: []
        },
        {
          category: 'recentDecisions',
          allocatedBudget: 10,
          inputCount: 0,
          selectedCount: 0,
          skippedCount: 0,
          selectedTokens: 0,
          refillSelectedCount: 0,
          selected: [],
          skipped: []
        },
        {
          category: 'recentStateChanges',
          allocatedBudget: 10,
          inputCount: 0,
          selectedCount: 0,
          skippedCount: 0,
          selectedTokens: 0,
          refillSelectedCount: 0,
          selected: [],
          skipped: []
        },
        {
          category: 'relevantEvidence',
          allocatedBudget: 18,
          inputCount: 4,
          selectedCount: 1,
          skippedCount: 3,
          selectedTokens: 16,
          refillSelectedCount: 0,
          selected: [
            {
              nodeId: 'evidence-1',
              type: 'Evidence',
              label: 'evidence:first compact note',
              estimatedTokens: 16,
              reason: 'selected within category budget'
            }
          ],
          skipped: [
            {
              nodeId: 'evidence-2',
              type: 'Evidence',
              label: 'evidence:second note',
              estimatedTokens: 16,
              reason: 'skipped because total budget was exhausted'
            }
          ]
        },
        {
          category: 'candidateSkills',
          allocatedBudget: 8,
          inputCount: 0,
          selectedCount: 0,
          skippedCount: 0,
          selectedTokens: 0,
          refillSelectedCount: 0,
          selected: [],
          skipped: []
        }
      ]
    },
    createdAt: '2026-03-13T12:00:00.000Z'
  };
}

function createPluginConfigFixture() {
  return {
    defaultTokenBudget: 12000,
    compileBudgetRatio: 0.3,
    enableGatewayMethods: true,
    recentRawMessageCount: 8
  };
}
