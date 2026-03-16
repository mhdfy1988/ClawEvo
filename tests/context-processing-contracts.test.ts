import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONTEXT_PROCESSING_CONTRACT_VERSION,
  annotateContextInputRoute,
  buildBundleContractSnapshot,
  buildContextSummaryContract,
  getSemanticExtractionContract,
  resolveContextInputRoute
} from '@openclaw-compact-context/runtime-core/context-processing';
import type { RuntimeContextBundle } from '@openclaw-compact-context/contracts';
import type { RawContextRecord } from '@openclaw-compact-context/contracts';

test('resolveContextInputRoute classifies conversation, tool, transcript, document, experience, and system records', () => {
  const cases: Array<{ record: RawContextRecord; expected: ReturnType<typeof resolveContextInputRoute> }> = [
    {
      expected: 'conversation',
      record: {
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'Explain why the build is blocked.'
      }
    },
    {
      expected: 'tool_result',
      record: {
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'pytest failed with a timeout.',
        provenance: {
          originKind: 'raw',
          sourceStage: 'tool_output_raw',
          producer: 'openclaw'
        }
      }
    },
    {
      expected: 'transcript',
      record: {
        scope: 'session',
        sourceType: 'conversation',
        role: 'assistant',
        content: 'Transcript record.',
        metadata: {
          transcriptType: 'message'
        }
      }
    },
    {
      expected: 'document',
      record: {
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 2: preserve provenance.'
      }
    },
    {
      expected: 'experience_trace',
      record: {
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Checkpoint summary.',
        provenance: {
          originKind: 'derived',
          sourceStage: 'checkpoint',
          producer: 'compact-context'
        }
      }
    },
    {
      expected: 'system',
      record: {
        scope: 'session',
        sourceType: 'system',
        role: 'system',
        content: 'Always preserve provenance.'
      }
    }
  ];

  for (const testCase of cases) {
    assert.equal(resolveContextInputRoute(testCase.record), testCase.expected);
  }
});

test('annotateContextInputRoute stamps the resolved route and contract version into metadata', () => {
  const annotated = annotateContextInputRoute({
    scope: 'session',
    sourceType: 'tool_output',
    role: 'tool',
    content: 'build failed with a timeout',
    provenance: {
      originKind: 'compressed',
      sourceStage: 'tool_result_persist',
      producer: 'compact-context'
    }
  });

  assert.equal(annotated.metadata?.contextRoute, 'tool_result');
  assert.equal(annotated.metadata?.contextContractVersion, CONTEXT_PROCESSING_CONTRACT_VERSION);
});

test('semantic extraction contracts stay route-specific but preserve shared contract guarantees', () => {
  const conversationContract = getSemanticExtractionContract('conversation');
  const toolContract = getSemanticExtractionContract('tool_result');

  assert.equal(conversationContract.version, CONTEXT_PROCESSING_CONTRACT_VERSION);
  assert.equal(conversationContract.preserveRawEvidence, true);
  assert.equal(conversationContract.clauseSplit, true);
  assert.equal(conversationContract.evidenceAnchorRequired, true);
  assert.equal(conversationContract.conceptNormalization, true);
  assert.equal(conversationContract.multiNodeMaterialization, true);
  assert.ok(conversationContract.supportedNodeTypes.includes('Intent'));
  assert.ok(conversationContract.supportedNodeTypes.includes('Topic'));

  assert.equal(toolContract.route, 'tool_result');
  assert.equal(toolContract.clauseSplit, false);
  assert.ok(toolContract.fallbackOrder.includes('supported_by_only'));
  assert.ok(toolContract.supportedNodeTypes.includes('Risk'));
  assert.ok(toolContract.supportedNodeTypes.includes('Outcome'));
});

test('buildContextSummaryContract and buildBundleContractSnapshot preserve the required bundle contract shape', () => {
  const bundle: RuntimeContextBundle = {
    id: 'bundle-contract-1',
    sessionId: 'session-contract',
    query: 'why is the build blocked',
    goal: {
      nodeId: 'goal-1',
      type: 'Goal',
      label: 'Goal: explain the blocked build',
      scope: 'session',
      kind: 'state',
      strength: 'heuristic',
      reason: 'current goal',
      estimatedTokens: 12,
      governance: {
        knowledgeState: 'raw',
        validity: {
          confidence: 1,
          freshness: 'active',
          validFrom: '2026-03-14T00:00:00.000Z'
        },
        promptReadiness: {
          eligible: true,
          preferredForm: 'raw',
          requiresEvidence: true,
          requiresCompression: false,
          selectionPriority: 'must',
          budgetClass: 'fixed'
        },
        scopePolicy: {
          currentScope: 'session',
          writeAuthority: 'session_open',
          recallTier: 'session_primary',
          recallPrecedence: 100,
          higherScopeFallbackAllowed: true,
          promotion: {
            eligible: false,
            requiresManualReview: false,
            reason: 'session only'
          }
        },
        traceability: {}
      }
    },
    intent: undefined,
    activeRules: [],
    activeConstraints: [],
    currentProcess: undefined,
    recentDecisions: [],
    recentStateChanges: [],
    relevantEvidence: [],
    candidateSkills: [],
    openRisks: [],
    tokenBudget: {
      total: 1000,
      used: 120,
      reserved: 180
    },
    diagnostics: {
      fixed: {
        selected: [],
        skipped: []
      },
      categoryBudgets: {
        activeRules: 200,
        activeConstraints: 150,
        openRisks: 120,
        recentDecisions: 120,
        recentStateChanges: 120,
        relevantEvidence: 160,
        candidateSkills: 130
      },
      categories: [],
      topicHints: [
        {
          nodeId: 'topic-1',
          type: 'Topic',
          label: 'Topic: provenance',
          estimatedTokens: 9,
          reason: 'topic-aware recall hint'
        }
      ],
      relationRetrieval: {
        strategy: 'batch_adjacency',
        sourceCount: 1,
        sourceSlots: ['goal'],
        edgeTypes: ['supported_by'],
        edgeLookupCount: 1,
        nodeLookupCount: 1,
        scannedEdgeCount: 1,
        eligibleEdgeCount: 1,
        relatedNodeCount: 1
      }
    },
    createdAt: '2026-03-14T00:00:00.000Z'
  };

  const summaryContract = buildContextSummaryContract(bundle);
  const bundleContract = buildBundleContractSnapshot(bundle);

  assert.equal(summaryContract.version, CONTEXT_PROCESSING_CONTRACT_VERSION);
  assert.equal(summaryContract.requiredSlots.includes('goal'), true);
  assert.equal(summaryContract.requiredSlots.includes('relevantEvidence'), true);
  assert.equal(summaryContract.goal?.nodeId, 'goal-1');
  assert.equal(summaryContract.goal?.preferredForm, 'raw');
  assert.equal(summaryContract.tokenBudget.total, 1000);

  assert.equal(bundleContract.version, CONTEXT_PROCESSING_CONTRACT_VERSION);
  assert.equal(bundleContract.fixedSlotCoverage.goal, true);
  assert.equal(bundleContract.fixedSlotCoverage.intent, false);
  assert.equal(bundleContract.categoryCounts.relevantEvidence, 0);
  assert.equal(bundleContract.topicHintCount, 1);
  assert.equal(bundleContract.relationRetrievalEnabled, true);
});



