import test from 'node:test';
import assert from 'node:assert/strict';

import { ContextEngine } from '../engine/context-engine.js';
import {
  buildCompressedToolResultMetadata,
  readCompressedToolResultContent,
  summarizeToolResultMessageContent
} from '../openclaw/tool-result-policy.js';
import { createCompressedFailureToolMessage } from './fixtures/tool-result-fixtures.js';

test('engine explain reports bundle selection details for included nodes', async () => {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId: 'session-explain-selected',
    records: [
      {
        id: 'goal-explain-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to understand why the build is blocked.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'risk-explain-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'build failed and is blocked by a sqlite timeout during migration step 4.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1
        }
      }
    ]
  });

  const [riskNode] = await engine.queryNodes({
    sessionId: 'session-explain-selected',
    types: ['Risk']
  });

  assert.ok(riskNode);

  const result = await engine.explain({
    nodeId: riskNode.id,
    selectionContext: {
      sessionId: 'session-explain-selected',
      query: 'why is the build blocked by timeout',
      tokenBudget: 220
    }
  });

  assert.equal(result.selection?.included, true);
  assert.equal(result.selection?.slot, 'openRisks');
  assert.match(result.selection?.reason ?? '', /open risk/i);
  assert.equal(typeof result.selection?.categoryBudget, 'number');
  assert.equal(result.governance?.knowledgeState, 'raw');
  assert.equal(result.governance?.promptReadiness.selectionPriority, 'high');
  assert.equal(result.governance?.promptReadiness.budgetClass, 'reserved');
  assert.equal(result.trace?.source.sourceStage, 'tool_output_raw');
  assert.equal(result.trace?.transformation.semanticNodeId, riskNode.id);
  assert.equal(result.trace?.selection.evaluated, true);
  assert.equal(result.trace?.selection.included, true);
  assert.equal(result.trace?.output.promptReady, true);
  assert.equal(result.trace?.output.assembledIntoPrompt, true);
  assert.match(result.summary, /Governance:/i);
  assert.match(result.summary, /Selection: included in openRisks/i);

  await engine.close();
});

test('engine explain reports bundle selection details for skipped nodes', async () => {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId: 'session-explain-skipped',
    records: [
      {
        id: 'step-explain-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content:
          'Step 4: produce a long current process explanation with enough detail to overflow the tiny debug budget for this explain test.'
      }
    ]
  });

  const [stepNode] = await engine.queryNodes({
    sessionId: 'session-explain-skipped',
    types: ['Step']
  });

  assert.ok(stepNode);

  const result = await engine.explain({
    nodeId: stepNode.id,
    selectionContext: {
      sessionId: 'session-explain-skipped',
      query: 'why is the current step missing',
      tokenBudget: 24
    }
  });

  assert.equal(result.selection?.included, false);
  assert.equal(result.selection?.slot, 'currentProcess');
  assert.match(result.selection?.reason ?? '', /budget/i);
  assert.equal(result.governance?.promptReadiness.budgetClass, 'fixed');
  assert.equal(result.trace?.selection.evaluated, true);
  assert.equal(result.trace?.selection.included, false);
  assert.equal(result.trace?.output.assembledIntoPrompt, false);
  assert.match(result.summary, /Governance:/i);
  assert.match(result.summary, /Selection: skipped from currentProcess/i);

  await engine.close();
});

test('engine explain surfaces tool result compression policy, truncation, and lookup details', async () => {
  const engine = new ContextEngine();
  const compressedMessage = createCompressedFailureToolMessage();
  const compressedContent = readCompressedToolResultContent(compressedMessage.content);

  assert.ok(compressedContent);

  await engine.ingest({
    sessionId: 'session-explain-tool-result',
    records: [
      {
        id: 'tool-explain-compressed-1',
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

  const [stateNode] = await engine.queryNodes({
    sessionId: 'session-explain-tool-result',
    types: ['State']
  });

  assert.ok(stateNode);

  const result = await engine.explain({
    nodeId: stateNode.id
  });

  assert.equal(result.toolResultCompression?.policyId, compressedContent.truncation.policyId);
  assert.equal(result.toolResultCompression?.reason, compressedContent.truncation.reason);
  assert.ok(result.toolResultCompression?.droppedSections.includes('stdout.middle'));
  assert.equal(result.toolResultCompression?.lookup.rawSourceId, compressedContent.provenance.rawSourceId);
  assert.equal(result.toolResultCompression?.lookup.contentHash, compressedContent.artifact?.contentHash);
  assert.equal(result.toolResultCompression?.lookup.sourcePath, compressedContent.artifact?.sourcePath);
  assert.equal(result.governance?.knowledgeState, 'compressed');
  assert.equal(result.governance?.promptReadiness.preferredForm, 'summary');
  assert.equal(result.trace?.source.sourceStage, 'tool_result_persist');
  assert.equal(result.trace?.source.artifactPath, compressedContent.artifact?.path);
  assert.equal(result.trace?.output.preferredForm, 'summary');
  assert.match(result.trace?.output.summaryOnlyReason ?? '', /exceeded|summary|compression/i);
  assert.match(result.summary, /Tool result compression:/i);
  assert.match(result.summary, /Governance:/i);
  assert.match(result.summary, /used policy/i);
  assert.match(result.summary, /Dropped sections:/i);
  assert.match(result.summary, /Lookup:/i);

  await engine.close();
});

test('engine explain reports conflict suppression details for overridden nodes', async () => {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId: 'session-explain-conflict',
    records: [
      {
        id: 'rule-conflict-low',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when selecting context.',
        createdAt: '2026-03-13T10:00:00.000Z',
        metadata: {
          nodeType: 'Rule',
          conflictSetKey: 'policy|preserve_provenance',
          overridePriority: 10
        }
      },
      {
        id: 'rule-conflict-high',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Never preserve provenance when selecting context.',
        createdAt: '2026-03-13T10:02:00.000Z',
        metadata: {
          nodeType: 'Rule',
          conflictSetKey: 'policy|preserve_provenance',
          overridePriority: 90
        }
      }
    ]
  });

  const rules = await engine.queryNodes({
    sessionId: 'session-explain-conflict',
    types: ['Rule']
  });
  const suppressedRule = rules.find((node) => /^rule:always preserve provenance/i.test(node.label));
  const selectedRule = rules.find((node) => /^rule:never preserve provenance/i.test(node.label));

  assert.ok(suppressedRule);
  assert.ok(selectedRule);

  const result = await engine.explain({
    nodeId: suppressedRule.id,
    selectionContext: {
      sessionId: 'session-explain-conflict',
      query: 'preserve provenance when selecting context',
      tokenBudget: 320
    }
  });

  assert.equal(result.conflict?.conflictStatus, 'confirmed');
  assert.equal(result.conflict?.resolutionState, 'suppressed');
  assert.equal(result.conflict?.conflictSetKey, 'policy|preserve_provenance');
  assert.equal(result.conflict?.overridePriority, 10);
  assert.ok(result.conflict?.conflictingNodeIds.includes(selectedRule.id));
  assert.match(result.conflict?.resolutionReason ?? '', /suppressed/i);
  assert.equal(result.selection?.included, false);
  assert.match(result.selection?.reason ?? '', /suppressed/i);
  assert.equal(result.trace?.selection.evaluated, true);
  assert.equal(result.trace?.selection.included, false);
  assert.equal(result.trace?.output.promptReady, false);
  assert.match(result.trace?.selection.reason ?? '', /suppressed/i);
  assert.match(result.summary, /Conflict:/i);
  assert.match(result.summary, /Selection: skipped/i);

  await engine.close();
});

test('engine explain reports checkpoint, delta, and skill candidate persistence trace', async () => {
  const engine = new ContextEngine();
  const sessionId = 'session-explain-persistence';

  await engine.ingest({
    sessionId,
    records: [
      {
        id: 'goal-persistence-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to unblock the migration pipeline and preserve provenance.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'rule-persistence-1',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when unblocking the migration pipeline.',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: 'step-persistence-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 1: inspect the migration timeout and compare the latest build trace with prior successful runs.'
      },
      {
        id: 'evidence-persistence-1',
        scope: 'session',
        sourceType: 'document',
        role: 'system',
        content:
          'Evidence: the build trace shows migration step 4 timing out while the provenance chain still points to the sqlite migration runner.',
        metadata: {
          nodeType: 'Evidence'
        }
      },
      {
        id: 'evidence-persistence-2',
        scope: 'session',
        sourceType: 'document',
        role: 'system',
        content:
          'Evidence: the previous successful run completed the same migration in under 2 seconds, so the current blocked build is abnormal.',
        metadata: {
          nodeType: 'Evidence'
        }
      }
    ]
  });

  const bundle = await engine.compileContext({
    sessionId,
    query: 'why is the migration pipeline blocked and how do we preserve provenance',
    tokenBudget: 480
  });
  const { checkpoint, delta } = await engine.createCheckpoint({
    sessionId,
    bundle
  });
  const { candidates } = await engine.crystallizeSkills({
    sessionId,
    bundle,
    checkpointId: checkpoint.id,
    minEvidenceCount: 1
  });
  const [ruleNode] = await engine.queryNodes({
    sessionId,
    types: ['Rule']
  });

  assert.ok(ruleNode);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.sourceBundleId, bundle.id);
  assert.equal(candidates[0]?.sourceCheckpointId, checkpoint.id);
  assert.ok(candidates[0]?.sourceNodeIds?.includes(ruleNode.id));
  assert.ok((candidates[0]?.sourceNodeIds?.length ?? 0) >= 3);

  const result = await engine.explain({
    nodeId: ruleNode.id,
    selectionContext: {
      sessionId,
      query: 'why is the migration pipeline blocked and how do we preserve provenance',
      tokenBudget: 480
    }
  });

  assert.equal(result.selection?.included, true);
  assert.equal(result.trace?.persistence.persistedInCheckpoint, true);
  assert.equal(result.trace?.persistence.surfacedInDelta, true);
  assert.equal(result.trace?.persistence.surfacedInSkillCandidate, true);
  assert.equal(result.trace?.persistence.checkpointId, checkpoint.id);
  assert.equal(result.trace?.persistence.deltaId, delta.id);
  assert.equal(result.trace?.persistence.skillCandidateId, candidates[0]?.id);
  assert.equal(result.trace?.persistence.checkpointSourceBundleId, bundle.id);
  assert.equal(result.trace?.persistence.deltaSourceBundleId, bundle.id);
  assert.equal(result.trace?.persistence.skillCandidateSourceBundleId, bundle.id);
  assert.equal(result.memoryLifecycle?.checkpoints[0]?.lifecycle?.retentionClass, 'sticky');
  assert.equal(result.memoryLifecycle?.checkpoints[0]?.lifecycle?.decayState, 'fresh');
  assert.equal(result.memoryLifecycle?.skillCandidates[0]?.lifecycle?.stage, 'candidate');
  assert.equal(result.memoryLifecycle?.skillCandidates[0]?.lifecycle?.promotion.ready, true);
  assert.equal(result.memoryLifecycle?.skillCandidates[0]?.lifecycle?.merge.eligible, true);
  assert.equal(result.memoryLifecycle?.skillCandidates[0]?.lifecycle?.retirement.status, 'keep');
  assert.match(result.trace?.persistence.retentionReason ?? '', /selected into the current runtime bundle/i);
  assert.match(result.summary, /Persistence: retained in checkpoint/i);
  assert.match(result.summary, /skill candidate/i);
  assert.match(result.summary, /Bundles:/i);
  assert.match(result.summary, /Memory lifecycle:/i);

  await engine.close();
});

test('engine explain reports scope governance and higher-scope fallback decisions', async () => {
  const engine = new ContextEngine();
  const sessionId = 'session-explain-scope-governance';
  const workspaceId = 'workspace-scope-alpha';

  await engine.ingest({
    sessionId,
    workspaceId,
    records: [
      {
        id: 'goal-explain-scope-session',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'Keep the current session build investigation focused on provenance.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'goal-explain-scope-workspace',
        scope: 'workspace',
        sourceType: 'conversation',
        role: 'user',
        content: 'Keep workspace build investigations focused on provenance.',
        metadata: {
          nodeType: 'Goal'
        }
      }
    ]
  });

  const [workspaceRule] = await engine.queryNodes({
    scopes: ['workspace'],
    workspaceId,
    types: ['Goal']
  });

  assert.ok(workspaceRule);

  const result = await engine.explain({
    nodeId: workspaceRule.id,
    selectionContext: {
      sessionId,
      workspaceId,
      query: 'preserve provenance for the current build investigation',
      tokenBudget: 320
    }
  });

  assert.equal(result.governance?.scopePolicy.currentScope, 'workspace');
  assert.equal(result.governance?.scopePolicy.writeAuthority, 'workspace_guarded');
  assert.equal(result.governance?.scopePolicy.recallTier, 'workspace_fallback');
  assert.equal(result.governance?.scopePolicy.promotion.eligible, false);
  assert.equal(result.selection?.included, false);
  assert.match(result.selection?.reason ?? '', /workspace-scoped recall|session candidates/i);
  assert.match(result.selection?.scopeReason ?? '', /workspace scope/i);
  assert.equal(result.trace?.source.scope, 'workspace');
  assert.equal(result.trace?.selection.scopeReason, result.selection?.scopeReason);
  assert.match(result.summary, /scope=current=workspace/i);

  await engine.close();
});

test('engine explain reports retained-in-history reason for nodes skipped from the current bundle', async () => {
  const engine = new ContextEngine();
  const sessionId = 'session-explain-retained-history';

  await engine.ingest({
    sessionId,
    records: [
      {
        id: 'step-retained-history-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content:
          'Step 4: produce a long current process explanation with enough detail to be checkpointed, but too verbose to fit inside a tiny explain budget later.'
      }
    ]
  });

  const initialBundle = await engine.compileContext({
    sessionId,
    query: 'what is the current step',
    tokenBudget: 220
  });
  await engine.createCheckpoint({
    sessionId,
    bundle: initialBundle
  });
  const [stepNode] = await engine.queryNodes({
    sessionId,
    types: ['Step']
  });

  assert.ok(stepNode);

  const result = await engine.explain({
    nodeId: stepNode.id,
    selectionContext: {
      sessionId,
      query: 'why is the current step missing',
      tokenBudget: 24
    }
  });

  assert.equal(result.selection?.included, false);
  assert.equal(result.trace?.persistence.persistedInCheckpoint, true);
  assert.equal(result.trace?.persistence.surfacedInDelta, false);
  assert.equal(result.trace?.persistence.surfacedInSkillCandidate, false);
  assert.match(result.trace?.persistence.retentionReason ?? '', /retained in checkpoint history/i);
  assert.match(result.trace?.persistence.retentionReason ?? '', /not selected into the current runtime bundle/i);
  assert.match(result.summary, /Retention:/i);

  await engine.close();
});

test('engine explain surfaces supported_by relation contribution for relation-aware evidence recall', async () => {
  const engine = new ContextEngine();
  const sessionId = 'session-explain-relation-aware';

  await engine.ingest({
    sessionId,
    records: [
      {
        id: 'goal-explain-relation-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to understand why the build is blocked and keep provenance intact.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'rule-explain-relation-1',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when selecting context.',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: 'step-explain-relation-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content:
          'Step 4: produce a long current process explanation with enough detail to overflow the tiny debug budget while still being semantically recognizable as the current step.'
      },
      {
        id: 'risk-explain-relation-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'build failed and is blocked by a sqlite timeout during migration step 4.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1
        }
      },
      {
        id: 'document-explain-relation-1',
        scope: 'session',
        sourceType: 'document',
        role: 'system',
        content:
          'supporting evidence: the current build log points to a migration timeout, but this note is lower priority than the explicit open risk.',
        metadata: {
          nodeType: 'Evidence'
        }
      }
    ]
  });

  const result = await engine.explain({
    nodeId: 'rule-explain-relation-1',
    selectionContext: {
      sessionId,
      query: 'why is the build blocked provenance',
      tokenBudget: 720
    }
  });

  assert.equal(result.node?.type, 'Evidence');
  assert.equal(result.selection?.included, true);
  assert.equal(result.selection?.slot, 'relevantEvidence');
  assert.match(result.selection?.reason ?? '', /via supported_by from activeRules/i);
  assert.match(result.summary, /via supported_by from activeRules/i);
  assert.equal(result.retrieval?.adjacency.strategy, 'single_node_adjacency');
  assert.equal(result.retrieval?.adjacency.edgeLookupCount, 1);
  assert.equal(result.retrieval?.adjacency.nodeLookupCount, 1);
  assert.equal(result.retrieval?.selectionCompile?.strategy, 'batch_adjacency');
  assert.equal(result.retrieval?.selectionCompile?.edgeLookupCount, 1);
  assert.ok(
    result.relatedNodes.some(
      (node) => node.relation?.edgeType === 'supported_by' && node.relation.governance?.usage === 'recall_eligible'
    )
  );
  assert.equal(result.trace?.selection.evaluated, true);
  assert.equal(result.trace?.selection.included, true);

  await engine.close();
});
