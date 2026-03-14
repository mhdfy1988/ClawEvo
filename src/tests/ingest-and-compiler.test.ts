import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNodeGovernance } from '../core/governance.js';
import { ContextEngine } from '../engine/context-engine.js';
import { ContextCompiler } from '../core/context-compiler.js';
import { InMemoryGraphStore } from '../core/graph-store.js';
import { IngestPipeline } from '../core/ingest-pipeline.js';
import {
  buildLabelOverrideCorrection,
  buildNodeSuppressionCorrection
} from '../core/manual-corrections.js';
import type { RawContextInput } from '../types/io.js';

class TrackingGraphStore extends InMemoryGraphStore {
  readonly metrics = {
    getNodeCalls: 0,
    getNodesByIdsCalls: 0,
    getEdgesForNodeCalls: 0,
    getEdgesForNodesCalls: 0
  };

  override async getNode(id: string) {
    this.metrics.getNodeCalls += 1;
    return super.getNode(id);
  }

  override async getNodesByIds(ids: string[]) {
    this.metrics.getNodesByIdsCalls += 1;
    return super.getNodesByIds(ids);
  }

  override async getEdgesForNode(nodeId: string) {
    this.metrics.getEdgesForNodeCalls += 1;
    return super.getEdgesForNode(nodeId);
  }

  override async getEdgesForNodes(nodeIds: string[]) {
    this.metrics.getEdgesForNodesCalls += 1;
    return super.getEdgesForNodes(nodeIds);
  }
}

test('ingest identifies constraint, process, step, risk, mode, outcome, and tool nodes', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const input: RawContextInput = {
    sessionId: 'session-structure',
    records: [
      {
        id: 'constraint-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: '必须保留 provenance，不能把 compressed 内容当成 raw 使用。'
      },
      {
        id: 'process-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: '阶段 2 流程：先分类 tool result，再裁剪，再落 transcript。'
      },
      {
        id: 'step-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 2: register tool_result_persist before transcript write.'
      },
      {
        id: 'risk-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'pytest failed with 2 assertion errors and a timeout warning.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1,
          toolResultKind: 'test_run'
        }
      },
      {
        id: 'mode-1',
        scope: 'session',
        sourceType: 'system',
        role: 'system',
        content: '当前运行模式：strict mode，优先保证 provenance 正确性。'
      },
      {
        id: 'outcome-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: '预期结果：tool_result_persist 生效后，transcript 体积明显下降。'
      },
      {
        id: 'tool-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'assistant',
        content: '推荐工具：优先使用 rg 做搜索，再用 apply_patch 做修改。'
      }
    ]
  };

  const result = await ingestPipeline.ingest(input);
  const semanticTypes = result.candidateNodes
    .filter((node) => node.type !== 'Evidence')
    .map((node) => node.type);

  assert.ok(semanticTypes.includes('Constraint'));
  assert.ok(semanticTypes.includes('Process'));
  assert.ok(semanticTypes.includes('Step'));
  assert.ok(semanticTypes.includes('Risk'));
  assert.ok(semanticTypes.includes('Mode'));
  assert.ok(semanticTypes.includes('Outcome'));
  assert.ok(semanticTypes.includes('Tool'));
});

test('ingest materializes multiple semantic nodes from a single conversation record via semantic spans', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const sessionId = 'session-multi-node-materialization';

  await ingestPipeline.ingest({
    sessionId,
    records: [
      {
        id: 'conversation-multi-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content:
          'We need to preserve provenance, understand how context compression works, and keep the knowledge graph traceable.',
        metadata: {
          nodeType: 'Intent'
        }
      }
    ]
  });

  const goals = await graphStore.queryNodes({
    sessionId,
    types: ['Goal']
  });
  const intents = await graphStore.queryNodes({
    sessionId,
    types: ['Intent']
  });
  const topics = await graphStore.queryNodes({
    sessionId,
    types: ['Topic']
  });
  const concepts = await graphStore.queryNodes({
    sessionId,
    types: ['Concept']
  });

  assert.equal(intents.length, 1);
  assert.ok(goals.length >= 1);
  assert.ok(topics.length >= 1);
  assert.ok(concepts.length >= 2);
  assert.ok(concepts.some((node) => /concept:provenance/i.test(node.label)));
  assert.ok(concepts.some((node) => /concept:knowledge graph/i.test(node.label)));
  assert.ok(
    goals.some((node) => {
      const metadata =
        node.payload.metadata && typeof node.payload.metadata === 'object' && !Array.isArray(node.payload.metadata)
          ? node.payload.metadata
          : undefined;
      return metadata?.semanticSpanId === 'conversation-multi-1:sentence-1-clause-1';
    })
  );
});

test('ingest dedupes bilingual concept aliases into a single canonical concept node', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const sessionId = 'session-concept-alias-dedupe';

  await ingestPipeline.ingest({
    sessionId,
    records: [
      {
        id: 'concept-alias-en',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We should keep the knowledge graph explainable.'
      },
      {
        id: 'concept-alias-zh',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: '我们还要保证知识图谱是可解释的。'
      }
    ]
  });

  const concepts = await graphStore.queryNodes({
    sessionId,
    types: ['Concept']
  });
  const knowledgeGraphConcepts = concepts.filter((node) => /concept:knowledge graph/i.test(node.label));

  assert.equal(knowledgeGraphConcepts.length, 1);
  const metadata =
    knowledgeGraphConcepts[0]?.payload.metadata &&
    typeof knowledgeGraphConcepts[0].payload.metadata === 'object' &&
    !Array.isArray(knowledgeGraphConcepts[0].payload.metadata)
      ? knowledgeGraphConcepts[0].payload.metadata
      : undefined;
  assert.equal(metadata?.semanticGroupKey, 'span|session|conversation|Concept|knowledge_graph');
});

test('ingest assigns governance defaults to evidence and semantic nodes', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-governance-defaults',
    records: [
      {
        id: 'goal-governance-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to preserve provenance while keeping the current goal explicit.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'risk-governance-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'build failed with a timeout while migrating sqlite metadata.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1
        }
      }
    ]
  });

  const [goalNode] = await graphStore.queryNodes({
    sessionId: 'session-governance-defaults',
    types: ['Goal']
  });
  const [riskNode] = await graphStore.queryNodes({
    sessionId: 'session-governance-defaults',
    types: ['Risk']
  });
  const [evidenceNode] = await graphStore.queryNodes({
    sessionId: 'session-governance-defaults',
    types: ['Evidence']
  });

  assert.ok(goalNode?.governance);
  assert.equal(goalNode?.governance?.knowledgeState, 'raw');
  assert.equal(goalNode?.governance?.promptReadiness.budgetClass, 'fixed');
  assert.equal(goalNode?.governance?.promptReadiness.selectionPriority, 'must');

  assert.ok(riskNode?.governance);
  assert.equal(riskNode?.governance?.promptReadiness.selectionPriority, 'high');
  assert.equal(riskNode?.governance?.promptReadiness.requiresEvidence, true);

  assert.ok(evidenceNode?.governance);
  assert.equal(evidenceNode?.governance?.promptReadiness.preferredForm, 'citation_only');
});

test('context compiler includes explicit risk nodes in openRisks', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const compiler = new ContextCompiler(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-risks',
    records: [
      {
        id: 'goal-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: '我们需要先把 tool result 压缩再落 transcript。',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'risk-compile-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'build failed and is currently blocked by a timeout in sqlite migration.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1
        }
      }
    ]
  });

  const bundle = await compiler.compile({
    sessionId: 'session-risks',
    query: 'Why is the build blocked?',
    tokenBudget: 1200
  });

  assert.ok(bundle.openRisks.length > 0);
  assert.equal(bundle.openRisks[0]?.type, 'Risk');
  assert.match(bundle.openRisks[0]?.reason ?? '', /open risk/);
});

test('ingest dedupes stable semantic nodes and updates version when content changes', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-dedupe',
    records: [
      {
        id: 'custom-constraint-a',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: '必须保留 provenance，不要把 compressed 内容当成 raw。',
        metadata: {
          transcriptType: 'custom_message',
          customType: 'constraint_note',
          nodeType: 'Constraint',
          semanticGroupKey: 'custom|constraint|constraint_note|必须保留 provenance'
        }
      }
    ]
  });

  const firstPassNodes = await graphStore.queryNodes({
    types: ['Constraint'],
    sessionId: 'session-dedupe'
  });

  assert.equal(firstPassNodes.length, 1);
  const firstNode = firstPassNodes[0];
  assert.ok(firstNode);
  const firstVersion = firstNode.version;

  await ingestPipeline.ingest({
    sessionId: 'session-dedupe',
    records: [
      {
        id: 'custom-constraint-b',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: '必须保留 provenance，禁止把 compressed 摘要内容当作 raw 使用。',
        metadata: {
          transcriptType: 'custom_message',
          customType: 'constraint_note',
          nodeType: 'Constraint',
          semanticGroupKey: 'custom|constraint|constraint_note|必须保留 provenance'
        }
      }
    ]
  });

  const secondPassNodes = await graphStore.queryNodes({
    types: ['Constraint'],
    sessionId: 'session-dedupe'
  });

  assert.equal(secondPassNodes.length, 1);
  const secondNode = secondPassNodes[0];
  assert.ok(secondNode);
  const metadata =
    secondNode.payload.metadata && typeof secondNode.payload.metadata === 'object' && !Array.isArray(secondNode.payload.metadata)
      ? secondNode.payload.metadata
      : undefined;
  assert.notEqual(secondNode.version, firstVersion);
  assert.equal(metadata?.semanticGroupKey, 'custom|constraint|constraint_note|必须保留 provenance');
  assert.match(secondNode.label, /rule:/i);
});

test('context compiler surfaces mode, outcome, and tool through bundle categories', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const compiler = new ContextCompiler(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-secondary-types',
    records: [
      {
        id: 'mode-secondary-1',
        scope: 'session',
        sourceType: 'system',
        role: 'system',
        content: '当前 operating mode 是 strict mode，优先保留关键规则。'
      },
      {
        id: 'outcome-secondary-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'expected outcome: prompt budget drops after tool_result_persist compaction.'
      },
      {
        id: 'tool-secondary-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'assistant',
        content: 'preferred tool choice: use rg for search and apply_patch for edits.'
      }
    ]
  });

  const bundle = await compiler.compile({
    sessionId: 'session-secondary-types',
    query: 'strict mode expected outcome preferred tool choice',
    tokenBudget: 1600
  });

  assert.ok(bundle.activeConstraints.some((item) => item.type === 'Mode'));
  assert.ok(bundle.recentStateChanges.some((item) => item.type === 'Outcome'));
  assert.ok(bundle.relevantEvidence.some((item) => item.type === 'Tool'));
});

test('context compiler reserves budget for open risks before lower-priority evidence', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const compiler = new ContextCompiler(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-budget-pools',
    records: [
      {
        id: 'goal-budget-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: '我们要解释为什么当前构建被阻塞。',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'rule-budget-1',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: '规则：active rule 和风险优先于证据噪音。',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: 'risk-budget-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'build failed and is blocked by a sqlite timeout conflict in migration step 4.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1
        }
      },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `evidence-budget-${index}`,
        scope: 'session' as const,
        sourceType: 'document' as const,
        role: 'system' as const,
        content:
          `supporting evidence ${index}: ` +
          'this is a long explanatory note about unrelated context and repeated background details '.repeat(6),
        metadata: {
          nodeType: 'Evidence'
        }
      }))
    ]
  });

  const bundle = await compiler.compile({
    sessionId: 'session-budget-pools',
    query: 'why is the build blocked by timeout',
    tokenBudget: 280
  });

  assert.ok(bundle.activeRules.length > 0);
  assert.ok(bundle.openRisks.length > 0);
  assert.equal(bundle.openRisks[0]?.type, 'Risk');
  assert.ok(bundle.relevantEvidence.length < 8);
  assert.ok(bundle.tokenBudget.used <= bundle.tokenBudget.total);
  assert.ok(bundle.diagnostics);
  assert.equal(bundle.diagnostics?.categoryBudgets.openRisks > 0, true);
  const riskDiagnostics = bundle.diagnostics?.categories.find((item) => item.category === 'openRisks');
  const evidenceDiagnostics = bundle.diagnostics?.categories.find((item) => item.category === 'relevantEvidence');
  assert.ok(riskDiagnostics);
  assert.ok(evidenceDiagnostics);
  assert.equal(riskDiagnostics?.selectedCount, bundle.openRisks.length);
  assert.ok((evidenceDiagnostics?.skippedCount ?? 0) > 0);
  assert.match(evidenceDiagnostics?.skipped[0]?.reason ?? '', /budget/i);
});

test('context compiler records fixed-item skips in bundle diagnostics', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const compiler = new ContextCompiler(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-fixed-diagnostics',
    records: [
      {
        id: 'goal-fixed-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'Keep the current bundle explainable.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'step-fixed-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content:
          'Step 4: produce a long current process explanation with enough detail to exceed the tiny budget that is reserved for this test case.'
      }
    ]
  });

  const bundle = await compiler.compile({
    sessionId: 'session-fixed-diagnostics',
    query: 'why is the current step missing',
    goalLabel: 'Keep the current bundle explainable.',
    tokenBudget: 24
  });

  assert.equal(bundle.currentProcess, undefined);
  assert.ok(bundle.diagnostics);
  assert.ok(bundle.diagnostics?.fixed.selected.some((item) => item.type === 'Goal'));
  assert.ok(bundle.diagnostics?.fixed.skipped.some((item) => item.type === 'Step'));
  assert.match(bundle.diagnostics?.fixed.skipped[0]?.reason ?? '', /current process|budget/i);
});

test('context compiler keeps goal and intent through fallback queries when the wording differs', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const compiler = new ContextCompiler(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-goal-intent-fallback',
    records: [
      {
        id: 'goal-fallback-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to understand why the build is blocked and keep provenance intact.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'intent-fallback-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'Figure out the blocking cause first, then explain which evidence was preserved.',
        metadata: {
          nodeType: 'Intent'
        }
      }
    ]
  });

  const bundle = await compiler.compile({
    sessionId: 'session-goal-intent-fallback',
    query: 'why is the build blocked',
    tokenBudget: 720
  });

  assert.equal(bundle.goal?.type, 'Goal');
  assert.match(bundle.goal?.label ?? '', /understand why the build is blocked/i);
  assert.equal(bundle.intent?.type, 'Intent');
  assert.match(bundle.intent?.label ?? '', /blocking cause/i);
  assert.ok(bundle.diagnostics?.fixed.selected.some((item) => item.type === 'Goal'));
  assert.ok(bundle.diagnostics?.fixed.selected.some((item) => item.type === 'Intent'));
});

test('in-memory queryNodes matches token-overlap text queries without exact phrase matches', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-memory-text-match',
    records: [
      {
        id: 'goal-memory-zeta',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'Zeta preserve provenance and explain why the build is blocked.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'goal-memory-alpha',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'Alpha prepare unrelated release notes and polish the landing page.',
        metadata: {
          nodeType: 'Goal'
        }
      }
    ]
  });

  const matches = await graphStore.queryNodes({
    sessionId: 'session-memory-text-match',
    types: ['Goal'],
    text: 'why is build blocked provenance',
    limit: 1
  });

  assert.equal(matches.length, 1);
  assert.match(matches[0]?.label ?? '', /zeta preserve provenance/i);
});

test('sqlite queryNodes matches token-overlap text queries without exact phrase matches', async () => {
  const engine = await ContextEngine.openSqlite({
    dbPath: ':memory:'
  });

  await engine.ingest({
    sessionId: 'session-sqlite-text-match',
    records: [
      {
        id: 'goal-sqlite-zeta',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'Zeta preserve provenance and explain why the build is blocked.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'goal-sqlite-alpha',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'Alpha prepare unrelated release notes and polish the landing page.',
        metadata: {
          nodeType: 'Goal'
        }
      }
    ]
  });

  const matches = await engine.queryNodes({
    sessionId: 'session-sqlite-text-match',
    types: ['Goal'],
    text: 'why is build blocked provenance',
    limit: 1
  });

  assert.equal(matches.length, 1);
  assert.match(matches[0]?.label ?? '', /zeta preserve provenance/i);

  await engine.close();
});

test('sqlite queryNodes round-trip governance data for ingested nodes', async () => {
  const engine = await ContextEngine.openSqlite({
    dbPath: ':memory:'
  });

  await engine.ingest({
    sessionId: 'session-sqlite-governance',
    records: [
      {
        id: 'goal-sqlite-governance-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'Keep the current goal explicit and preserve provenance.',
        metadata: {
          nodeType: 'Goal'
        }
      }
    ]
  });

  const [goalNode] = await engine.queryNodes({
    sessionId: 'session-sqlite-governance',
    types: ['Goal']
  });

  assert.ok(goalNode?.governance);
  assert.equal(goalNode?.governance?.knowledgeState, 'raw');
  assert.equal(goalNode?.governance?.promptReadiness.selectionPriority, 'must');
  assert.equal(goalNode?.governance?.promptReadiness.budgetClass, 'fixed');

  await engine.close();
});

test('sqlite queryEdges derives relation contract governance for supported_by edges', async () => {
  const engine = await ContextEngine.openSqlite({
    dbPath: ':memory:'
  });

  await engine.ingest({
    sessionId: 'session-sqlite-edge-governance',
    records: [
      {
        id: 'rule-sqlite-edge-governance-1',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when selecting runtime context.',
        metadata: {
          nodeType: 'Rule'
        }
      }
    ]
  });

  const supportedByEdges = await engine.queryEdges({
    sessionId: 'session-sqlite-edge-governance',
    types: ['supported_by']
  });

  assert.ok(supportedByEdges.length > 0);
  assert.equal(supportedByEdges[0]?.governance?.stableProduction, true);
  assert.equal(supportedByEdges[0]?.governance?.usage, 'recall_eligible');
  assert.equal(supportedByEdges[0]?.governance?.recallEligible, true);
  assert.equal(supportedByEdges[0]?.governance?.recallPriority, 2.5);
  assert.equal(supportedByEdges[0]?.confidence, 1);

  await engine.close();
});

test('sqlite round-trips checkpoint, delta, and skill candidate memory lineage fields', async () => {
  const engine = await ContextEngine.openSqlite({
    dbPath: ':memory:'
  });
  const sessionId = 'session-sqlite-memory-lineage';

  await engine.ingest({
    sessionId,
    records: [
      {
        id: 'goal-sqlite-memory-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to preserve provenance while explaining the blocked migration build.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'rule-sqlite-memory-1',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when selecting runtime context.',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: 'step-sqlite-memory-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 1: inspect the blocked migration timeout before changing recall rules.'
      },
      {
        id: 'evidence-sqlite-memory-1',
        scope: 'session',
        sourceType: 'document',
        role: 'system',
        content: 'Evidence: the blocked build log shows sqlite migration step 4 timing out.',
        metadata: {
          nodeType: 'Evidence'
        }
      }
    ]
  });

  const bundle = await engine.compileContext({
    sessionId,
    query: 'why is the migration build blocked and how do we preserve provenance',
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
  const latestCheckpoint = await engine.getLatestCheckpoint(sessionId);
  const deltas = await engine.persistenceStore.listDeltas(sessionId, 5);
  const storedCandidates = await engine.listSkillCandidates(sessionId, 5);

  assert.equal(latestCheckpoint?.sourceBundleId, bundle.id);
  assert.equal(latestCheckpoint?.provenance?.sourceBundleId, bundle.id);
  assert.equal(latestCheckpoint?.lifecycle?.retentionClass, 'sticky');
  assert.equal(latestCheckpoint?.lifecycle?.decayState, 'fresh');
  assert.equal(deltas[0]?.sourceBundleId, bundle.id);
  assert.equal(deltas[0]?.provenance?.sourceBundleId, bundle.id);
  assert.equal(storedCandidates[0]?.sourceBundleId, bundle.id);
  assert.equal(storedCandidates[0]?.sourceCheckpointId, checkpoint.id);
  assert.ok(storedCandidates[0]?.sourceNodeIds?.includes(bundle.currentProcess?.nodeId ?? ''));
  assert.ok(storedCandidates[0]?.sourceNodeIds?.includes(bundle.activeRules[0]?.nodeId ?? ''));
  assert.equal(storedCandidates[0]?.id, candidates[0]?.id);
  assert.equal(storedCandidates[0]?.provenance?.sourceBundleId, bundle.id);
  assert.equal(storedCandidates[0]?.provenance?.derivedFromCheckpointId, checkpoint.id);
  assert.equal(storedCandidates[0]?.lifecycle?.stage, 'candidate');
  assert.equal(storedCandidates[0]?.lifecycle?.promotion.ready, true);
  assert.equal(storedCandidates[0]?.lifecycle?.promotion.target, 'Skill');
  assert.equal(storedCandidates[0]?.lifecycle?.merge.eligible, true);
  assert.equal(storedCandidates[0]?.lifecycle?.retirement.status, 'keep');
  assert.equal(delta.id, deltas[0]?.id);

  await engine.close();
});

test('checkpoint persistence materializes attempt, episode, failure signal, and procedure candidate graph nodes', async () => {
  const engine = await ContextEngine.openSqlite({
    dbPath: ':memory:'
  });
  const sessionId = 'session-experience-graph-materialization';

  await engine.ingest({
    sessionId,
    records: [
      {
        id: 'goal-experience-graph-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to preserve provenance while fixing the blocked migration build.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'rule-experience-graph-1',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when selecting runtime context.',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: 'step-experience-graph-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 1: inspect the blocked migration timeout before changing recall rules.'
      },
      {
        id: 'risk-experience-graph-1',
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

  const bundle = await engine.compileContext({
    sessionId,
    query: 'why is the build blocked and how do we preserve provenance',
    tokenBudget: 480
  });

  await engine.createCheckpoint({
    sessionId,
    bundle
  });

  const attempts = await engine.queryNodes({
    sessionId,
    types: ['Attempt']
  });
  const episodes = await engine.queryNodes({
    sessionId,
    types: ['Episode']
  });
  const failureSignals = await engine.queryNodes({
    sessionId,
    types: ['FailureSignal']
  });
  const procedureCandidates = await engine.queryNodes({
    sessionId,
    types: ['ProcedureCandidate']
  });
  const producedEdges = await engine.queryEdges({
    sessionId,
    types: ['produces']
  });
  const derivedEdges = await engine.queryEdges({
    sessionId,
    types: ['derived_from']
  });
  const requiresEdges = await engine.queryEdges({
    sessionId,
    types: ['requires']
  });

  assert.equal(attempts.length, 1);
  assert.equal(episodes.length, 1);
  assert.ok(failureSignals.length >= 1);
  assert.equal(procedureCandidates.length, 1);
  assert.equal(attempts[0]?.governance?.promptReadiness.eligible, false);
  assert.equal(episodes[0]?.provenance?.sourceBundleId, bundle.id);
  assert.ok(producedEdges.some((edge) => edge.fromId === attempts[0]?.id && edge.toId === failureSignals[0]?.id));
  assert.ok(derivedEdges.some((edge) => edge.fromId === episodes[0]?.id && edge.toId === attempts[0]?.id));
  assert.ok(
    requiresEdges.some(
      (edge) =>
        edge.fromId === procedureCandidates[0]?.id && edge.toId === bundle.activeRules[0]?.nodeId
    )
  );

  await engine.close();
});

test('context compiler boosts risk and process selections from persisted experience learning signals', async () => {
  const engine = await ContextEngine.openSqlite({
    dbPath: ':memory:'
  });
  const sessionId = 'session-experience-learning-recall';
  const query = 'why is the build blocked and which step should we inspect first';

  await engine.ingest({
    sessionId,
    records: [
      {
        id: 'goal-experience-learning-recall-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to unblock the build and preserve provenance.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'rule-experience-learning-recall-1',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when selecting runtime context.',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: 'step-experience-learning-recall-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 1: inspect the blocked sqlite timeout before changing recall rules.'
      },
      {
        id: 'risk-experience-learning-recall-1',
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

  const firstBundle = await engine.compileContext({
    sessionId,
    query,
    tokenBudget: 560
  });

  await engine.createCheckpoint({
    sessionId,
    bundle: firstBundle
  });

  const secondBundle = await engine.compileContext({
    sessionId,
    query,
    tokenBudget: 560
  });

  assert.ok(secondBundle.openRisks.some((item) => /via learning:failure_signal/i.test(item.reason)));
  assert.ok(secondBundle.currentProcess);
  assert.match(secondBundle.currentProcess?.reason ?? '', /via learning:(critical_step|procedure_step)/i);
  assert.equal(secondBundle.diagnostics?.learning?.failureSignals.length, 1);
  assert.equal(secondBundle.diagnostics?.learning?.procedureCandidates.length, 1);
  assert.equal(secondBundle.diagnostics?.learning?.criticalStepNodeIds.length, 1);

  await engine.close();
});

test('context compiler ranks token-overlap rules ahead of alphabetical noise', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const compiler = new ContextCompiler(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-rule-ranking',
    records: [
      {
        id: 'rule-ranking-alpha',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Alpha keep release notes tidy and polish the landing page.',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: 'rule-ranking-zeta',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Zeta preserve provenance and explain why the build is blocked.',
        metadata: {
          nodeType: 'Rule'
        }
      }
    ]
  });

  const bundle = await compiler.compile({
    sessionId: 'session-rule-ranking',
    query: 'build blocked provenance',
    tokenBudget: 720
  });

  assert.equal(bundle.activeRules[0]?.type, 'Rule');
  assert.match(bundle.activeRules[0]?.label ?? '', /zeta preserve provenance/i);
});

test('context compiler uses governance prompt readiness priority when ranking similar nodes', async () => {
  const graphStore = new InMemoryGraphStore();
  const compiler = new ContextCompiler(graphStore);
  const now = new Date().toISOString();

  const alphaGovernance = buildNodeGovernance({
    type: 'Rule',
    strength: 'hard',
    confidence: 0.95,
    freshness: 'active',
    validFrom: now,
    provenance: {
      originKind: 'raw',
      sourceStage: 'document_raw',
      producer: 'test',
      rawSourceId: 'rule-alpha'
    },
    sourceType: 'rule'
  });
  const zetaGovernance = buildNodeGovernance({
    type: 'Rule',
    strength: 'hard',
    confidence: 0.95,
    freshness: 'active',
    validFrom: now,
    provenance: {
      originKind: 'raw',
      sourceStage: 'document_raw',
      producer: 'test',
      rawSourceId: 'rule-zeta'
    },
    sourceType: 'rule'
  });

  await graphStore.upsertNodes([
    {
      id: 'rule-governance-alpha',
      type: 'Rule',
      scope: 'session',
      kind: 'norm',
      label: 'Alpha build blocked provenance policy',
      payload: {
        sessionId: 'session-governance-ranking',
        sourceType: 'rule',
        contentPreview: 'Alpha build blocked provenance policy'
      },
      strength: 'hard',
      confidence: 0.95,
      provenance: alphaGovernance.provenance,
      governance: alphaGovernance,
      version: 'v1',
      freshness: 'active',
      validFrom: now,
      updatedAt: now
    },
    {
      id: 'rule-governance-zeta',
      type: 'Rule',
      scope: 'session',
      kind: 'norm',
      label: 'Zeta build blocked provenance policy',
      payload: {
        sessionId: 'session-governance-ranking',
        sourceType: 'rule',
        contentPreview: 'Zeta build blocked provenance policy'
      },
      strength: 'hard',
      confidence: 0.95,
      provenance: zetaGovernance.provenance,
      governance: {
        ...zetaGovernance,
        promptReadiness: {
          ...zetaGovernance.promptReadiness,
          selectionPriority: 'must'
        }
      },
      version: 'v1',
      freshness: 'active',
      validFrom: now,
      updatedAt: now
    }
  ]);

  const bundle = await compiler.compile({
    sessionId: 'session-governance-ranking',
    query: 'build blocked provenance policy',
    tokenBudget: 480
  });

  assert.equal(bundle.activeRules[0]?.nodeId, 'rule-governance-zeta');
  assert.match(bundle.activeRules[0]?.reason ?? '', /readiness:raw\/must\/reserved/i);
});

test('context compiler keeps session scope ahead of workspace and global candidates', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const compiler = new ContextCompiler(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-scope-session-first',
    workspaceId: 'workspace-alpha',
    records: [
      {
        id: 'rule-scope-session',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance for the current session build investigation.',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: 'rule-scope-workspace',
        scope: 'workspace',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance for workspace build investigations.',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: 'rule-scope-global',
        scope: 'global',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance for all build investigations.',
        metadata: {
          nodeType: 'Rule'
        }
      }
    ]
  });

  const bundle = await compiler.compile({
    sessionId: 'session-scope-session-first',
    workspaceId: 'workspace-alpha',
    query: 'preserve provenance for the current build investigation',
    tokenBudget: 640
  });

  assert.equal(bundle.activeRules[0]?.scope, 'session');
  assert.match(bundle.activeRules[0]?.reason ?? '', /session scope precedence/i);
});

test('context compiler uses workspace scope as fallback before global scope', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const compiler = new ContextCompiler(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-scope-workspace-fallback',
    workspaceId: 'workspace-beta',
    records: [
      {
        id: 'rule-workspace-fallback',
        scope: 'workspace',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance for workspace-level migration failures.',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: 'rule-global-fallback',
        scope: 'global',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance for migration failures everywhere.',
        metadata: {
          nodeType: 'Rule'
        }
      }
    ]
  });

  const bundle = await compiler.compile({
    sessionId: 'session-scope-workspace-fallback',
    workspaceId: 'workspace-beta',
    query: 'preserve provenance for migration failures',
    tokenBudget: 640
  });

  assert.equal(bundle.activeRules[0]?.scope, 'workspace');
  assert.match(bundle.activeRules[0]?.reason ?? '', /workspace fallback/i);
});

test('ingest preserves structured compressed tool result payloads and infers risk from metadata even with neutral text', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-structured-compressed-tool',
    records: [
      {
        id: 'compressed-tool-neutral-1',
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: '[tool:shell_command] output compacted for transcript persistence.',
        metadata: {
          toolResultCompressed: true,
          toolName: 'shell_command',
          toolStatus: 'failure',
          toolExitCode: 1,
          toolResultKind: 'test_run',
          toolSummary: 'pytest execution was compacted before transcript persistence',
          toolPolicyId: 'test_run.failure.v1',
          toolCompressionReason: 'serialized output exceeded 1800 chars',
          toolDroppedSections: ['stdout.middle', 'stderr.middle'],
          toolAffectedPaths: ['src/core/context-compiler.ts', 'src/tests/context-compiler.test.ts'],
          toolKeySignals: ['exitCode=1', 'errorCode=EXIT_NON_ZERO'],
          toolArtifactPath: 'D:/tmp/tool-artifacts/abc123.json',
          toolArtifactSourcePath: 'src/core/context-compiler.ts',
          toolArtifactContentHash: 'abc123def456',
          toolByteLength: 3200,
          toolLineCount: 120
        }
      }
    ]
  });

  const [riskNode] = await graphStore.queryNodes({
    sessionId: 'session-structured-compressed-tool',
    types: ['Risk']
  });
  const [evidenceNode] = await graphStore.queryNodes({
    sessionId: 'session-structured-compressed-tool',
    types: ['Evidence']
  });

  assert.ok(riskNode);
  assert.ok(evidenceNode);
  assert.equal(riskNode.sourceRef?.sourcePath, 'D:/tmp/tool-artifacts/abc123.json');
  assert.equal(riskNode.sourceRef?.contentHash, 'abc123def456');

  const riskToolResult =
    riskNode.payload.toolResult && typeof riskNode.payload.toolResult === 'object' && !Array.isArray(riskNode.payload.toolResult)
      ? riskNode.payload.toolResult
      : undefined;
  const evidenceToolResult =
    evidenceNode.payload.toolResult &&
    typeof evidenceNode.payload.toolResult === 'object' &&
    !Array.isArray(evidenceNode.payload.toolResult)
      ? evidenceNode.payload.toolResult
      : undefined;

  assert.ok(riskToolResult);
  assert.ok(evidenceToolResult);
  assert.equal(riskToolResult.status, 'failure');
  assert.equal(riskToolResult.resultKind, 'test_run');
  assert.deepEqual(riskToolResult.keySignals, ['exitCode=1', 'errorCode=EXIT_NON_ZERO']);
  assert.deepEqual(riskToolResult.affectedPaths, ['src/core/context-compiler.ts', 'src/tests/context-compiler.test.ts']);
  assert.equal(
    (riskToolResult.truncation as { policyId?: string }).policyId,
    'test_run.failure.v1'
  );
  assert.deepEqual(
    (riskToolResult.truncation as { droppedSections?: string[] }).droppedSections,
    ['stdout.middle', 'stderr.middle']
  );
  assert.equal((evidenceToolResult.error as { exitCode?: number }).exitCode, 1);
  assert.equal(
    (evidenceToolResult.artifact as { path?: string }).path,
    'D:/tmp/tool-artifacts/abc123.json'
  );
});

test('ingest marks earlier same-policy rules as superseded and emits supersedes edges', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-conflict-supersede',
    records: [
      {
        id: 'rule-supersede-old',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance during bundle selection.',
        createdAt: '2026-03-13T08:00:00.000Z',
        metadata: {
          nodeType: 'Rule',
          conflictSetKey: 'policy|preserve_provenance'
        }
      }
    ]
  });

  await ingestPipeline.ingest({
    sessionId: 'session-conflict-supersede',
    records: [
      {
        id: 'rule-supersede-new',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when selecting runtime context.',
        createdAt: '2026-03-13T08:05:00.000Z',
        metadata: {
          nodeType: 'Rule',
          conflictSetKey: 'policy|preserve_provenance'
        }
      }
    ]
  });

  const rules = await graphStore.queryNodes({
    sessionId: 'session-conflict-supersede',
    types: ['Rule']
  });
  const supersedeEdges = await graphStore.queryEdges({
    sessionId: 'session-conflict-supersede',
    types: ['supersedes']
  });

  const olderRule = rules.find((node) => /bundle selection/i.test(node.label));
  const newerRule = rules.find((node) => /runtime context/i.test(node.label));

  assert.equal(rules.length, 2);
  assert.ok(olderRule);
  assert.ok(newerRule);
  assert.equal(supersedeEdges.length, 1);
  assert.equal(supersedeEdges[0]?.fromId, newerRule?.id);
  assert.equal(supersedeEdges[0]?.toId, olderRule?.id);
  assert.equal(olderRule?.freshness, 'superseded');
  assert.equal(olderRule?.governance?.conflict?.conflictStatus, 'superseded');
  assert.equal(olderRule?.governance?.conflict?.resolutionState, 'suppressed');
  assert.equal(olderRule?.governance?.conflict?.supersededByNodeId, newerRule?.id);
  assert.equal(newerRule?.governance?.conflict?.conflictStatus, 'confirmed');
  assert.equal(newerRule?.governance?.conflict?.resolutionState, 'selected');
});

test('context compiler suppresses lower-priority conflicting rules after override resolution', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const compiler = new ContextCompiler(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-conflict-override',
    records: [
      {
        id: 'rule-override-low',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when selecting context.',
        createdAt: '2026-03-13T09:00:00.000Z',
        metadata: {
          nodeType: 'Rule',
          conflictSetKey: 'policy|preserve_provenance',
          overridePriority: 10
        }
      },
      {
        id: 'rule-override-high',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Never preserve provenance when selecting context.',
        createdAt: '2026-03-13T09:02:00.000Z',
        metadata: {
          nodeType: 'Rule',
          conflictSetKey: 'policy|preserve_provenance',
          overridePriority: 80
        }
      }
    ]
  });

  const rules = await graphStore.queryNodes({
    sessionId: 'session-conflict-override',
    types: ['Rule']
  });
  const conflictEdges = await graphStore.queryEdges({
    sessionId: 'session-conflict-override',
    types: ['conflicts_with', 'overrides']
  });
  const selectedRule = rules.find((node) => /^rule:never preserve provenance/i.test(node.label));
  const suppressedRule = rules.find((node) => /^rule:always preserve provenance/i.test(node.label));

  assert.ok(selectedRule);
  assert.ok(suppressedRule);
  assert.equal(selectedRule?.governance?.conflict?.resolutionState, 'selected');
  assert.equal(suppressedRule?.governance?.conflict?.conflictStatus, 'confirmed');
  assert.equal(suppressedRule?.governance?.conflict?.resolutionState, 'suppressed');
  assert.equal(suppressedRule?.governance?.conflict?.overridePriority, 10);
  assert.ok(
    conflictEdges.some((edge) => edge.type === 'overrides' && edge.fromId === selectedRule?.id && edge.toId === suppressedRule?.id)
  );
  assert.ok(
    conflictEdges.filter((edge) => edge.type === 'conflicts_with').length >= 2
  );
  assert.ok(
    conflictEdges
      .filter((edge) => edge.type === 'conflicts_with')
      .every((edge) => edge.governance?.usage === 'governance_only' && edge.governance?.recallEligible === false)
  );
  assert.ok(
    conflictEdges
      .filter((edge) => edge.type === 'overrides')
      .every((edge) => edge.governance?.usage === 'recall_eligible' && edge.governance?.recallEligible === true)
  );

  const bundle = await compiler.compile({
    sessionId: 'session-conflict-override',
    query: 'preserve provenance when selecting context',
    tokenBudget: 640
  });

  assert.ok(bundle.activeRules.some((item) => item.nodeId === selectedRule?.id));
  assert.ok(bundle.activeRules.every((item) => item.nodeId !== suppressedRule?.id));
});

test('context compiler uses supported_by edges for relation-aware evidence recall', async () => {
  const graphStore = new TrackingGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const compiler = new ContextCompiler(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-relation-aware-recall',
    records: [
      {
        id: 'goal-relation-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to understand why the build is blocked and keep provenance intact.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'rule-relation-1',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when selecting context.',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: 'step-relation-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content:
          'Step 4: produce a long current process explanation with enough detail to overflow the tiny debug budget while still being semantically recognizable as the current step.'
      },
      {
        id: 'risk-relation-1',
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
        id: 'document-relation-1',
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

  const relationEdges = await graphStore.queryEdges({
    sessionId: 'session-relation-aware-recall',
    types: ['supported_by']
  });

  assert.ok(relationEdges.length > 0);
  assert.ok(relationEdges.every((edge) => edge.governance?.usage === 'recall_eligible'));
  assert.ok(relationEdges.every((edge) => edge.governance?.stableProduction === true));
  assert.ok(relationEdges.every((edge) => edge.governance?.recallPriority === 2.5));

  const bundle = await compiler.compile({
    sessionId: 'session-relation-aware-recall',
    query: 'why is the build blocked provenance',
    tokenBudget: 720
  });

  const relationEvidence = bundle.relevantEvidence.find((item) => /via supported_by from/i.test(item.reason));
  const evidenceDiagnostics = bundle.diagnostics?.categories.find((item) => item.category === 'relevantEvidence');

  assert.ok(relationEvidence);
  assert.ok(['rule-relation-1', 'risk-relation-1', 'step-relation-1'].includes(relationEvidence?.nodeId ?? ''));
  assert.match(relationEvidence?.reason ?? '', /supported_by/i);
  assert.match(relationEvidence?.reason ?? '', /activeRules|openRisks|currentProcess/i);
  assert.ok(
    evidenceDiagnostics?.selected.some((item) => /supported_by/i.test(item.reason))
  );
  assert.equal(bundle.diagnostics?.relationRetrieval?.strategy, 'batch_adjacency');
  assert.ok((bundle.diagnostics?.relationRetrieval?.edgeLookupCount ?? 0) >= 1);
  assert.ok((bundle.diagnostics?.relationRetrieval?.nodeLookupCount ?? 0) >= 1);
  assert.ok((bundle.diagnostics?.relationRetrieval?.eligibleEdgeCount ?? 0) > 0);
  assert.equal(graphStore.metrics.getEdgesForNodesCalls, 1);
  assert.ok(graphStore.metrics.getEdgesForNodeCalls >= 1);
  assert.ok(graphStore.metrics.getNodesByIdsCalls >= 1);
  assert.equal(graphStore.metrics.getNodeCalls, 0);
});

test('context compiler records single-source relation retrieval fallback when only one source is available', async () => {
  const graphStore = new TrackingGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const compiler = new ContextCompiler(graphStore);

  await ingestPipeline.ingest({
    sessionId: 'session-relation-single-source',
    records: [
      {
        id: 'rule-single-source-1',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when selecting runtime context.',
        metadata: {
          nodeType: 'Rule'
        }
      }
    ]
  });

  const bundle = await compiler.compile({
    sessionId: 'session-relation-single-source',
    query: 'preserve provenance',
    tokenBudget: 320
  });

  assert.equal(bundle.diagnostics?.relationRetrieval?.strategy, 'single_source_fallback');
  assert.match(bundle.diagnostics?.relationRetrieval?.fallbackReason ?? '', /single-node adjacency fallback/i);
  assert.ok((bundle.diagnostics?.relationRetrieval?.edgeLookupCount ?? 0) >= 1);
  assert.ok((bundle.diagnostics?.relationRetrieval?.nodeLookupCount ?? 0) >= 1);
  assert.equal(graphStore.metrics.getEdgesForNodesCalls, 0);
  assert.ok(graphStore.metrics.getEdgesForNodeCalls >= 1);
  assert.equal(graphStore.metrics.getNodesByIdsCalls, 0);
  assert.equal(graphStore.metrics.getNodeCalls, 1);
});

test('ingest builds requires and next_step edges and compiler uses them for relation-aware process recall', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const compiler = new ContextCompiler(graphStore);
  const sessionId = 'session-relation-next-step-requires';

  await ingestPipeline.ingest({
    sessionId,
    records: [
      {
        id: 'goal-relation-next-step',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'What step should we take after inspecting the migration timeout so provenance stays intact?',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'step-relation-source',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 1: inspect the migration timeout before moving to the follow-up provenance step.',
        metadata: {
          nodeType: 'Step',
          nextStepNodeIds: ['step-relation-next-step']
        }
      },
      {
        id: 'step-relation-next-step',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 2: preserve provenance by registering the artifact sidecar before transcript persistence.',
        metadata: {
          nodeType: 'Step',
          requiresNodeIds: ['rule-relation-next-step']
        }
      },
      {
        id: 'rule-relation-next-step',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always register the artifact sidecar before transcript persistence when preserving provenance.',
        metadata: {
          nodeType: 'Rule'
        }
      }
    ]
  });

  const relationEdges = await graphStore.queryEdges({
    sessionId,
    types: ['next_step', 'requires']
  });
  const bundle = await compiler.compile({
    sessionId,
    query: 'after inspecting the migration timeout which step preserves provenance with an artifact sidecar',
    tokenBudget: 720
  });

  assert.equal(relationEdges.length, 2);
  assert.ok(
    relationEdges.some(
      (edge) =>
        edge.type === 'next_step' &&
        edge.governance?.usage === 'recall_eligible' &&
        edge.governance?.recallPriority === 1.5
    )
  );
  assert.ok(
    relationEdges.some(
      (edge) =>
        edge.type === 'requires' &&
        edge.governance?.usage === 'recall_eligible' &&
        edge.governance?.recallPriority === 1.75
    )
  );
  assert.equal(bundle.currentProcess?.type, 'Step');
  assert.match(bundle.currentProcess?.label ?? '', /step 2: preserve provenance/i);
  assert.ok(bundle.activeRules.some((item) => /artifact sidecar/i.test(item.label)));
  assert.match(
    bundle.activeRules.find((item) => /artifact sidecar/i.test(item.label))?.reason ?? '',
    /via requires from currentProcess/i
  );
  assert.ok(bundle.diagnostics?.relationRetrieval?.edgeTypes.includes('next_step'));
  assert.ok(bundle.diagnostics?.relationRetrieval?.edgeTypes.includes('requires'));
  assert.ok(bundle.diagnostics?.relationRetrieval?.sourceSlots.includes('currentProcess'));
});

test('sqlite skill crystallization merges repeated candidates and retires the replaced lineage', async () => {
  const engine = await ContextEngine.openSqlite({
    dbPath: ':memory:'
  });
  const sessionId = 'session-sqlite-skill-merge';

  await engine.ingest({
    sessionId,
    records: [
      {
        id: 'goal-skill-merge-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to unblock the migration pipeline while preserving provenance.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'rule-skill-merge-1',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when unblocking the migration pipeline.',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: 'step-skill-merge-1',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 1: inspect the migration timeout before changing any context assembly rule.'
      },
      {
        id: 'evidence-skill-merge-1',
        scope: 'session',
        sourceType: 'document',
        role: 'system',
        content: 'Evidence: the build trace shows migration step 4 timing out while provenance still points to sqlite.',
        metadata: {
          nodeType: 'Evidence'
        }
      }
    ]
  });

  const firstBundle = await engine.compileContext({
    sessionId,
    query: 'why is the migration pipeline blocked and how do we preserve provenance',
    tokenBudget: 420
  });
  const { checkpoint: firstCheckpoint } = await engine.createCheckpoint({
    sessionId,
    bundle: firstBundle
  });
  const firstResult = await engine.crystallizeSkills({
    sessionId,
    bundle: firstBundle,
    checkpointId: firstCheckpoint.id,
    minEvidenceCount: 1
  });
  const firstCandidate = firstResult.candidates[0];

  assert.ok(firstCandidate);

  const secondBundle = await engine.compileContext({
    sessionId,
    query: 'why is the migration pipeline blocked and how do we preserve provenance',
    tokenBudget: 420
  });
  const { checkpoint: secondCheckpoint } = await engine.createCheckpoint({
    sessionId,
    bundle: secondBundle
  });
  const secondResult = await engine.crystallizeSkills({
    sessionId,
    bundle: secondBundle,
    checkpointId: secondCheckpoint.id,
    minEvidenceCount: 1
  });
  const mergedCandidate = secondResult.candidates.find(
    (candidate) => candidate.lifecycle?.retirement.status === 'keep'
  );
  const retiredCandidate = secondResult.candidates.find(
    (candidate) => candidate.lifecycle?.retirement.status === 'retire_candidate'
  );
  const storedCandidates = await engine.listSkillCandidates(sessionId, 10);
  const storedMergedCandidate = storedCandidates.find((candidate) => candidate.id === mergedCandidate?.id);
  const storedRetiredCandidate = storedCandidates.find((candidate) => candidate.id === firstCandidate.id);

  assert.equal(firstResult.candidates.length, 1);
  assert.equal(secondResult.candidates.length, 2);
  assert.ok(mergedCandidate);
  assert.ok(retiredCandidate);
  assert.equal(retiredCandidate?.id, firstCandidate.id);
  assert.equal(mergedCandidate?.sourceBundleId, secondBundle.id);
  assert.equal(mergedCandidate?.sourceCheckpointId, secondCheckpoint.id);
  assert.ok(mergedCandidate?.lifecycle?.merge.mergedFromCandidateIds?.includes(firstCandidate.id));
  assert.equal(retiredCandidate?.lifecycle?.retirement.replacedByCandidateId, mergedCandidate?.id);
  assert.equal(retiredCandidate?.lifecycle?.decay.state, 'stale');
  assert.ok(storedMergedCandidate);
  assert.ok(storedRetiredCandidate);
  assert.ok(storedMergedCandidate?.lifecycle?.merge.mergedFromCandidateIds?.includes(firstCandidate.id));
  assert.equal(storedRetiredCandidate?.lifecycle?.retirement.status, 'retire_candidate');
  assert.equal(storedRetiredCandidate?.lifecycle?.retirement.replacedByCandidateId, mergedCandidate?.id);
  assert.equal(storedMergedCandidate?.provenance?.derivedFromCheckpointId, secondCheckpoint.id);

  await engine.close();
});

test('context compiler keeps topic nodes as hints while admitting at most one summary-only topic or concept', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const compiler = new ContextCompiler(graphStore);
  const sessionId = 'session-topic-hints';

  await ingestPipeline.ingest({
    sessionId,
    records: [
      {
        id: 'goal-topic-hints-1',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to preserve provenance while debugging the blocked build.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'rule-topic-hints-1',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when selecting runtime context.',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: 'topic-topic-hints-1',
        scope: 'session',
        sourceType: 'document',
        role: 'system',
        content: 'Topic: provenance governance for blocked build investigations.',
        metadata: {
          nodeType: 'Topic'
        }
      },
      {
        id: 'concept-topic-hints-1',
        scope: 'session',
        sourceType: 'document',
        role: 'system',
        content: 'Concept: runtime context bundle diagnostics and traceability.',
        metadata: {
          nodeType: 'Concept'
        }
      }
    ]
  });

  const [topicNode] = await graphStore.queryNodes({
    sessionId,
    types: ['Topic']
  });
  const conceptNodes = await graphStore.queryNodes({
    sessionId,
    types: ['Concept']
  });
  const conceptNode = conceptNodes.find((node) => /runtime context bundle diagnostics and traceability/i.test(node.label));
  const bundle = await compiler.compile({
    sessionId,
    query: 'provenance governance and runtime context traceability',
    tokenBudget: 640
  });
  const selectedNodeIds = new Set([
    bundle.goal?.nodeId,
    bundle.intent?.nodeId,
    bundle.currentProcess?.nodeId,
    ...bundle.activeRules.map((item) => item.nodeId),
    ...bundle.activeConstraints.map((item) => item.nodeId),
    ...bundle.openRisks.map((item) => item.nodeId),
    ...bundle.recentDecisions.map((item) => item.nodeId),
    ...bundle.recentStateChanges.map((item) => item.nodeId),
    ...bundle.relevantEvidence.map((item) => item.nodeId),
    ...bundle.candidateSkills.map((item) => item.nodeId)
  ].filter((value): value is string => Boolean(value)));

  assert.ok(topicNode);
  assert.ok(conceptNode);
  assert.ok(bundle.diagnostics?.topicHints?.some((item) => item.nodeId === topicNode.id));
  assert.ok(bundle.diagnostics?.topicAdmissions?.some((item) => item.nodeId === conceptNode.id));
  assert.match(bundle.diagnostics?.topicHints?.[0]?.reason ?? '', /topic-aware recall hint/i);
  assert.equal(selectedNodeIds.has(topicNode.id), false);
  assert.equal(selectedNodeIds.has(conceptNode.id), true);
  assert.match(
    bundle.relevantEvidence.find((item) => item.nodeId === conceptNode.id)?.reason ?? '',
    /admitted topic-aware context/i
  );
});

test('context compiler expands controlled two-hop relation paths for supporting evidence', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const compiler = new ContextCompiler(graphStore);
  const sessionId = 'session-stage5-two-hop';

  await ingestPipeline.ingest({
    sessionId,
    records: [
      {
        id: 'goal-stage5-two-hop',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to preserve provenance while fixing the blocked migration pipeline.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'step-stage5-two-hop',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 2: register the artifact sidecar before transcript persistence.',
        metadata: {
          nodeType: 'Step',
          requiresNodeIds: ['rule-stage5-two-hop']
        }
      },
      {
        id: 'rule-stage5-two-hop',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always register the artifact sidecar before transcript persistence when preserving provenance.',
        metadata: {
          nodeType: 'Rule'
        }
      }
    ]
  });

  const bundle = await compiler.compile({
    sessionId,
    query: 'which evidence explains why the artifact sidecar must be registered before transcript persistence',
    tokenBudget: 720
  });
  const recalledEvidence = bundle.relevantEvidence.find((item) => item.nodeId === 'rule-stage5-two-hop');

  assert.ok(recalledEvidence);
  assert.match(recalledEvidence.reason, /supported_by/i);
  assert.ok(recalledEvidence.relationPaths?.some((path) => path.hopCount === 2));
  assert.ok(
    recalledEvidence.relationPaths?.some((path) => path.hops.map((hop) => hop.edgeType).join('->') === 'requires->supported_by')
  );
  assert.equal(bundle.diagnostics?.relationRetrieval?.maxHopCount, 2);
  assert.ok((bundle.diagnostics?.relationRetrieval?.pathCount ?? 0) >= 1);
});

test('context compiler reuses workspace-scoped successful procedures across sessions in the same workspace', async () => {
  const engine = new ContextEngine();
  const workspaceId = 'workspace-stage5-reuse';
  const sessionA = 'session-stage5-reuse-a';
  const sessionB = 'session-stage5-reuse-b';

  await engine.ingest({
    sessionId: sessionA,
    workspaceId,
    records: [
      {
        id: 'goal-stage5-reuse-a',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to preserve provenance while unblocking the migration pipeline.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'rule-stage5-reuse-a',
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance before transcript persistence.',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: 'step-stage5-reuse-a',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 2: register the artifact sidecar before transcript persistence.',
        metadata: {
          nodeType: 'Step'
        }
      },
      {
        id: 'evidence-stage5-reuse-a',
        scope: 'session',
        sourceType: 'document',
        role: 'system',
        content: 'Evidence: artifact sidecar registration keeps provenance stable during migration recovery.',
        metadata: {
          nodeType: 'Evidence'
        }
      }
    ]
  });

  const bundleA = await engine.compileContext({
    sessionId: sessionA,
    workspaceId,
    query: 'how do we preserve provenance while unblocking the migration pipeline',
    tokenBudget: 420
  });
  await engine.createCheckpoint({
    sessionId: sessionA,
    bundle: bundleA
  });

  const promotedProcedureNodes = await engine.queryNodes({
    workspaceId,
    scopes: ['workspace'],
    types: ['SuccessfulProcedure']
  });

  assert.ok(promotedProcedureNodes.length >= 1);

  await engine.ingest({
    sessionId: sessionB,
    workspaceId,
    records: [
      {
        id: 'goal-stage5-reuse-b',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to preserve provenance while unblocking the migration pipeline again.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'step-stage5-reuse-b',
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content: 'Step 2: register the artifact sidecar before transcript persistence.',
        metadata: {
          nodeType: 'Step'
        }
      }
    ]
  });

  const bundleB = await engine.compileContext({
    sessionId: sessionB,
    workspaceId,
    query: 'which step preserves provenance before transcript persistence',
    tokenBudget: 420
  });

  assert.match(bundleB.currentProcess?.reason ?? '', /learning:successful_procedure/i);

  await engine.close();
});

test('context compiler admits a high-confidence topic hint into summary-only evidence context', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const compiler = new ContextCompiler(graphStore);
  const sessionId = 'session-stage5-topic-admission';

  await ingestPipeline.ingest({
    sessionId,
    records: [
      {
        id: 'goal-stage5-topic-admission',
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to explain provenance and traceability.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: 'topic-stage5-topic-admission',
        scope: 'session',
        sourceType: 'document',
        role: 'system',
        content: 'Topic: provenance and traceability guidance for runtime context bundles.',
        metadata: {
          nodeType: 'Topic'
        }
      }
    ]
  });

  const [topicNode] = await graphStore.queryNodes({
    sessionId,
    types: ['Topic']
  });
  const bundle = await compiler.compile({
    sessionId,
    query: 'explain provenance and traceability for runtime context bundles',
    tokenBudget: 320
  });

  assert.ok(topicNode);
  assert.ok(bundle.diagnostics?.topicAdmissions?.some((item) => item.nodeId === topicNode.id));
  assert.ok(bundle.relevantEvidence.some((item) => item.nodeId === topicNode.id));
  assert.match(
    bundle.relevantEvidence.find((item) => item.nodeId === topicNode.id)?.reason ?? '',
    /admitted topic-aware context/i
  );
});

test('context engine applies manual node suppression and label overrides during runtime compilation', async () => {
  const engine = new ContextEngine();
  const sessionId = 'session-manual-runtime-corrections';

  try {
    await engine.ingest({
      sessionId,
      records: [
        {
          id: `${sessionId}:goal`,
          scope: 'session',
          sourceType: 'conversation',
          role: 'user',
          content: 'We need to preserve provenance before transcript persistence.',
          metadata: {
            nodeType: 'Goal'
          }
        },
        {
          id: `${sessionId}:rule`,
          scope: 'session',
          sourceType: 'rule',
          role: 'system',
          content: 'Always keep provenance when assembling the runtime bundle.',
          metadata: {
            nodeType: 'Rule'
          }
        }
      ]
    });

    const [ruleNode] = await engine.queryNodes({
      sessionId,
      types: ['Rule']
    });

    assert.ok(ruleNode);

    await engine.applyManualCorrections([
      buildLabelOverrideCorrection({
        id: 'runtime-label-override-1',
        targetId: ruleNode.id,
        action: 'apply',
        author: 'tester',
        reason: 'clarify the rule wording for runtime selection',
        createdAt: '2026-03-20T09:00:00.000Z',
        label: 'Rule: preserve provenance before transcript persistence.'
      }),
      buildNodeSuppressionCorrection({
        id: 'runtime-node-suppression-1',
        targetId: ruleNode.id,
        action: 'apply',
        author: 'tester',
        reason: 'temporarily keep this rule out of the primary runtime bundle',
        createdAt: '2026-03-20T09:01:00.000Z',
        suppressed: true
      })
    ]);

    const suppressedBundle = await engine.compileContext({
      sessionId,
      query: 'preserve provenance before transcript persistence',
      tokenBudget: 480
    });
    const suppressedExplanation = await engine.explain({
      nodeId: ruleNode.id,
      selectionContext: {
        sessionId,
        query: 'preserve provenance before transcript persistence',
        tokenBudget: 320
      }
    });

    assert.equal(suppressedBundle.activeRules.some((item) => item.nodeId === ruleNode.id), false);
    assert.equal(suppressedExplanation.node?.label, 'Rule: preserve provenance before transcript persistence.');
    assert.equal(suppressedExplanation.selection?.included, false);
    assert.match(suppressedExplanation.selection?.reason ?? '', /manual correction/i);

    await engine.applyManualCorrections([
      buildNodeSuppressionCorrection({
        id: 'runtime-node-suppression-rollback-1',
        targetId: ruleNode.id,
        action: 'rollback',
        author: 'tester',
        reason: 'allow the rule back into runtime selection',
        createdAt: '2026-03-20T09:02:00.000Z',
        suppressed: true
      })
    ]);

    const releasedBundle = await engine.compileContext({
      sessionId,
      query: 'preserve provenance before transcript persistence',
      tokenBudget: 480
    });

    assert.equal(releasedBundle.activeRules.some((item) => item.nodeId === ruleNode.id), true);
    assert.equal(
      releasedBundle.activeRules.find((item) => item.nodeId === ruleNode.id)?.label,
      'Rule: preserve provenance before transcript persistence.'
    );
  } finally {
    await engine.close();
  }
});

test('context compiler applies per-target pruning to multi-hop relation paths and records path budget diagnostics', async () => {
  const graphStore = new InMemoryGraphStore();
  const compiler = new ContextCompiler(graphStore);
  const sessionId = 'session-stage5-path-budget';
  const now = '2026-03-14T16:00:00.000Z';

  const stepNode = {
    id: 'step-stage5-path-budget',
    type: 'Step',
    scope: 'session',
    kind: 'process',
    label: 'Step 2: register the artifact sidecar before transcript persistence.',
    payload: {
      sessionId,
      sourceType: 'workflow'
    },
    strength: 'soft',
    confidence: 0.82,
    provenance: {
      originKind: 'raw',
      sourceStage: 'document_extract',
      producer: 'test',
      rawSourceId: 'step-stage5-path-budget'
    },
    governance: buildNodeGovernance({
      type: 'Step',
      scope: 'session',
      strength: 'soft',
      confidence: 0.82,
      freshness: 'active',
      validFrom: now,
      provenance: {
        originKind: 'raw',
        sourceStage: 'document_extract',
        producer: 'test',
        rawSourceId: 'step-stage5-path-budget'
      },
      sourceType: 'workflow'
    }),
    version: 'v1',
    freshness: 'active',
    validFrom: now,
    updatedAt: now
  } as const;
  const evidenceNode = {
    id: 'evidence-stage5-path-budget',
    type: 'Evidence',
    scope: 'session',
    kind: 'fact',
    label: 'Evidence: artifact sidecar registration preserves provenance before transcript persistence.',
    payload: {
      sessionId,
      sourceType: 'document'
    },
    strength: 'soft',
    confidence: 0.86,
    provenance: {
      originKind: 'raw',
      sourceStage: 'document_raw',
      producer: 'test',
      rawSourceId: 'evidence-stage5-path-budget'
    },
    governance: buildNodeGovernance({
      type: 'Evidence',
      scope: 'session',
      strength: 'soft',
      confidence: 0.86,
      freshness: 'active',
      validFrom: now,
      provenance: {
        originKind: 'raw',
        sourceStage: 'document_raw',
        producer: 'test',
        rawSourceId: 'evidence-stage5-path-budget'
      },
      sourceType: 'document'
    }),
    version: 'v1',
    freshness: 'active',
    validFrom: now,
    updatedAt: now
  } as const;
  const ruleNodes = Array.from({ length: 5 }, (_, index) => ({
    id: `rule-stage5-path-budget-${index + 1}`,
    type: 'Rule' as const,
    scope: 'session' as const,
    kind: 'norm' as const,
    label: `Rule ${index + 1}: preserve provenance before transcript persistence via artifact sidecar.`,
    payload: {
      sessionId,
      sourceType: 'rule'
    },
    strength: 'soft' as const,
    confidence: 0.8 + index * 0.01,
    provenance: {
      originKind: 'raw' as const,
      sourceStage: 'document_extract' as const,
      producer: 'test',
      rawSourceId: `rule-stage5-path-budget-${index + 1}`
    },
    governance: buildNodeGovernance({
      type: 'Rule',
      scope: 'session',
      strength: 'soft',
      confidence: 0.8 + index * 0.01,
      freshness: 'active',
      validFrom: now,
      provenance: {
        originKind: 'raw',
        sourceStage: 'document_extract',
        producer: 'test',
        rawSourceId: `rule-stage5-path-budget-${index + 1}`
      },
      sourceType: 'rule'
    }),
    version: 'v1',
    freshness: 'active' as const,
    validFrom: now,
    updatedAt: now
  }));

  await graphStore.upsertNodes([stepNode, evidenceNode, ...ruleNodes]);
  await graphStore.upsertEdges(
    ruleNodes.flatMap((ruleNode) => [
      {
        id: `edge:requires:${stepNode.id}:${ruleNode.id}`,
        fromId: stepNode.id,
        toId: ruleNode.id,
        type: 'requires' as const,
        scope: 'session' as const,
        strength: 'soft' as const,
        confidence: 0.88,
        payload: {
          sessionId
        },
        version: 'v1',
        validFrom: now,
        updatedAt: now
      },
      {
        id: `edge:supported_by:${ruleNode.id}:${evidenceNode.id}`,
        fromId: ruleNode.id,
        toId: evidenceNode.id,
        type: 'supported_by' as const,
        scope: 'session' as const,
        strength: 'soft' as const,
        confidence: 0.91,
        payload: {
          sessionId
        },
        version: 'v1',
        validFrom: now,
        updatedAt: now
      }
    ])
  );

  const bundle = await compiler.compile({
    sessionId,
    query: 'which evidence explains the artifact sidecar step before transcript persistence',
    tokenBudget: 720
  });
  const evidenceSelection = bundle.relevantEvidence.find((item) => item.nodeId === evidenceNode.id);

  assert.ok(evidenceSelection);
  assert.ok((bundle.diagnostics?.relationRetrieval?.candidatePathCount ?? 0) >= 5);
  assert.ok((bundle.diagnostics?.relationRetrieval?.admittedPathCount ?? 0) >= 3);
  assert.equal(bundle.diagnostics?.relationRetrieval?.maxPathsPerTarget, 3);
  assert.ok((bundle.diagnostics?.relationRetrieval?.prunedByTargetCount ?? 0) >= 1);
  assert.equal(bundle.diagnostics?.relationRetrieval?.prunedByBudgetCount, 0);
  assert.ok((evidenceSelection?.relationPaths?.length ?? 0) <= 4);
});

test('context compiler applies relation recall policy floors and per-source pruning to multi-hop paths', async () => {
  const graphStore = new InMemoryGraphStore();
  const compiler = new ContextCompiler(graphStore);
  const sessionId = 'session-stage5-path-policy';
  const now = '2026-03-14T17:00:00.000Z';

  const stepNode = {
    id: 'step-stage5-path-policy',
    type: 'Step',
    scope: 'session',
    kind: 'process',
    label: 'Step 2: register the artifact sidecar before transcript persistence.',
    payload: {
      sessionId,
      sourceType: 'workflow'
    },
    strength: 'soft',
    confidence: 0.92,
    provenance: {
      originKind: 'raw',
      sourceStage: 'document_extract',
      producer: 'test',
      rawSourceId: 'step-stage5-path-policy'
    },
    governance: buildNodeGovernance({
      type: 'Step',
      scope: 'session',
      strength: 'soft',
      confidence: 0.92,
      freshness: 'active',
      validFrom: now,
      provenance: {
        originKind: 'raw',
        sourceStage: 'document_extract',
        producer: 'test',
        rawSourceId: 'step-stage5-path-policy'
      },
      sourceType: 'workflow'
    }),
    version: 'v1',
    freshness: 'active',
    validFrom: now,
    updatedAt: now
  } as const;
  const evidenceNode = {
    id: 'evidence-stage5-path-policy',
    type: 'Evidence',
    scope: 'session',
    kind: 'fact',
    label: 'Evidence: artifact sidecar registration preserves provenance before transcript persistence.',
    payload: {
      sessionId,
      sourceType: 'document'
    },
    strength: 'soft',
    confidence: 0.94,
    provenance: {
      originKind: 'raw',
      sourceStage: 'document_raw',
      producer: 'test',
      rawSourceId: 'evidence-stage5-path-policy'
    },
    governance: buildNodeGovernance({
      type: 'Evidence',
      scope: 'session',
      strength: 'soft',
      confidence: 0.94,
      freshness: 'active',
      validFrom: now,
      provenance: {
        originKind: 'raw',
        sourceStage: 'document_raw',
        producer: 'test',
        rawSourceId: 'evidence-stage5-path-policy'
      },
      sourceType: 'document'
    }),
    version: 'v1',
    freshness: 'active',
    validFrom: now,
    updatedAt: now
  } as const;
  const ruleBlueprints = [
    { suffix: 'high', confidence: 0.92, requiresConfidence: 0.95, supportedByConfidence: 0.97 },
    { suffix: 'medium', confidence: 0.83, requiresConfidence: 0.88, supportedByConfidence: 0.9 },
    { suffix: 'low', confidence: 0.35, requiresConfidence: 0.25, supportedByConfidence: 0.3 }
  ] as const;
  const ruleNodes = ruleBlueprints.map((rule) => ({
    id: `rule-stage5-path-policy-${rule.suffix}`,
    type: 'Rule' as const,
    scope: 'session' as const,
    kind: 'norm' as const,
    label: `Rule ${rule.suffix}: preserve provenance via artifact sidecar registration.`,
    payload: {
      sessionId,
      sourceType: 'rule'
    },
    strength: 'soft' as const,
    confidence: rule.confidence,
    provenance: {
      originKind: 'raw' as const,
      sourceStage: 'document_extract' as const,
      producer: 'test',
      rawSourceId: `rule-stage5-path-policy-${rule.suffix}`
    },
    governance: buildNodeGovernance({
      type: 'Rule',
      scope: 'session',
      strength: 'soft',
      confidence: rule.confidence,
      freshness: 'active',
      validFrom: now,
      provenance: {
        originKind: 'raw',
        sourceStage: 'document_extract',
        producer: 'test',
        rawSourceId: `rule-stage5-path-policy-${rule.suffix}`
      },
      sourceType: 'rule'
    }),
    version: 'v1',
    freshness: 'active' as const,
    validFrom: now,
    updatedAt: now
  }));

  await graphStore.upsertNodes([stepNode, evidenceNode, ...ruleNodes]);
  await graphStore.upsertEdges(
    ruleBlueprints.flatMap((rule) => [
      {
        id: `edge:requires:${stepNode.id}:${`rule-stage5-path-policy-${rule.suffix}`}`,
        fromId: stepNode.id,
        toId: `rule-stage5-path-policy-${rule.suffix}`,
        type: 'requires' as const,
        scope: 'session' as const,
        strength: 'soft' as const,
        confidence: rule.requiresConfidence,
        payload: {
          sessionId
        },
        version: 'v1',
        validFrom: now,
        updatedAt: now
      },
      {
        id: `edge:supported_by:${`rule-stage5-path-policy-${rule.suffix}`}:${evidenceNode.id}`,
        fromId: `rule-stage5-path-policy-${rule.suffix}`,
        toId: evidenceNode.id,
        type: 'supported_by' as const,
        scope: 'session' as const,
        strength: 'soft' as const,
        confidence: rule.supportedByConfidence,
        payload: {
          sessionId
        },
        version: 'v1',
        validFrom: now,
        updatedAt: now
      }
    ])
  );

  const bundle = await compiler.compile({
    sessionId,
    query: 'which evidence explains the artifact sidecar step before transcript persistence',
    tokenBudget: 720,
    relationRecallPolicy: {
      maxHops: 2,
      pathBudget: 5,
      maxPathsPerTarget: 5,
      maxPathsPerSource: 1,
      maxExpandedTargets: 2,
      minPathBonus: 6.6,
      rankingMode: 'bonus_then_hops',
      secondHopEdgeTypes: ['supported_by']
    }
  });
  const evidenceSelection = bundle.relevantEvidence.find((item) => item.nodeId === evidenceNode.id);

  assert.ok(evidenceSelection);
  assert.equal(bundle.diagnostics?.relationRetrieval?.maxPathsPerSource, 1);
  assert.equal(bundle.diagnostics?.relationRetrieval?.maxExpandedTargets, 2);
  assert.equal(bundle.diagnostics?.relationRetrieval?.minPathBonus, 6.6);
  assert.equal(bundle.diagnostics?.relationRetrieval?.rankingMode, 'bonus_then_hops');
  assert.ok((bundle.diagnostics?.relationRetrieval?.prunedBySourceCount ?? 0) >= 1);
  assert.ok((bundle.diagnostics?.relationRetrieval?.prunedByScoreCount ?? 0) >= 1);
  assert.ok((bundle.diagnostics?.relationRetrieval?.admittedPathCount ?? 0) >= 1);
  assert.ok(bundle.diagnostics?.relationRetrieval?.selectedPathSamples?.some((value) => /selected requires->supported_by/i.test(value)));
  assert.ok(bundle.diagnostics?.relationRetrieval?.prunedPathSamples?.some((value) => /score .*< floor/i.test(value)));
  assert.ok(bundle.diagnostics?.relationRetrieval?.prunedPathSamples?.some((value) => /source already used/i.test(value)));
  assert.ok((evidenceSelection?.relationPaths?.length ?? 0) >= 1);
});

test('context engine promotes stable workspace procedures to global scope and reuses them as a global fallback', async () => {
  const engine = new ContextEngine();
  const workspaceId = 'workspace-stage5-global-promotion';
  const sourceSessionId = 'session-stage5-global-source';
  const targetSessionId = 'session-stage5-global-target';

  try {
    await engine.ingest({
      sessionId: sourceSessionId,
      workspaceId,
      records: [
        {
          id: 'goal-stage5-global-source',
          scope: 'session',
          sourceType: 'conversation',
          role: 'user',
          content: 'We need to preserve provenance while unblocking the migration pipeline.',
          metadata: {
            nodeType: 'Goal'
          }
        },
        {
          id: 'step-stage5-global-source',
          scope: 'session',
          sourceType: 'workflow',
          role: 'system',
          content: 'Step 2: register the artifact sidecar before transcript persistence.',
          metadata: {
            nodeType: 'Step'
          }
        },
        {
          id: 'evidence-stage5-global-source',
          scope: 'session',
          sourceType: 'document',
          role: 'system',
          content: 'Evidence: artifact sidecar registration keeps provenance stable during migration recovery.',
          metadata: {
            nodeType: 'Evidence'
          }
        }
      ]
    });

    for (let index = 0; index < 3; index += 1) {
      const bundle = await engine.compileContext({
        sessionId: sourceSessionId,
        workspaceId,
        query: 'which step preserves provenance before transcript persistence',
        tokenBudget: 420
      });
      await engine.createCheckpoint({
        sessionId: sourceSessionId,
        bundle
      });
    }

    const globalProcedures = await engine.queryNodes({
      scopes: ['global'],
      types: ['SuccessfulProcedure']
    });

    assert.ok(globalProcedures.length >= 1);

    await engine.ingest({
      sessionId: targetSessionId,
      records: [
        {
          id: 'goal-stage5-global-target',
          scope: 'session',
          sourceType: 'conversation',
          role: 'user',
          content: 'We need to preserve provenance before transcript persistence again.',
          metadata: {
            nodeType: 'Goal'
          }
        },
        {
          id: 'step-stage5-global-target',
          scope: 'session',
          sourceType: 'workflow',
          role: 'system',
          content: 'Step 2: register the artifact sidecar before transcript persistence.',
          metadata: {
            nodeType: 'Step'
          }
        }
      ]
    });

    const bundle = await engine.compileContext({
      sessionId: targetSessionId,
      query: 'which step preserves provenance before transcript persistence',
      tokenBudget: 420
    });
    const [globalProcedure] = globalProcedures;

    assert.ok(globalProcedure);
    assert.match(bundle.currentProcess?.reason ?? '', /learning:successful_procedure/i);

    const explanation = await engine.explain({
      nodeId: globalProcedure.id,
      selectionContext: {
        sessionId: targetSessionId,
        query: 'which step preserves provenance before transcript persistence',
        tokenBudget: 420
      }
    });

    assert.equal(explanation.node?.scope, 'global');
    assert.match(explanation.selection?.scopeReason ?? '', /global scope/i);
    assert.ok(
      explanation.trace?.transformation.derivedFromNodeIds.includes(
        (globalProcedure.payload.sourceScopedNodeId as string | undefined) ?? ''
      )
    );
  } finally {
    await engine.close();
  }
});

test('context engine keeps weak failure patterns session-scoped and out of higher-scope reuse', async () => {
  const engine = new ContextEngine();
  const workspaceId = 'workspace-stage5-no-global-failure';
  const sessionId = 'session-stage5-no-global-failure';
  const followupSessionId = 'session-stage5-no-global-failure-followup';

  try {
    await engine.ingest({
      sessionId,
      workspaceId,
      records: [
        {
          id: 'goal-stage5-no-global-failure',
          scope: 'session',
          sourceType: 'conversation',
          role: 'user',
          content: 'We need to preserve provenance while the migration pipeline is still blocked.',
          metadata: {
            nodeType: 'Goal'
          }
        },
        {
          id: 'step-stage5-no-global-failure',
          scope: 'session',
          sourceType: 'workflow',
          role: 'system',
          content: 'Step 2: register the artifact sidecar before transcript persistence.',
          metadata: {
            nodeType: 'Step'
          }
        },
        {
          id: 'risk-stage5-no-global-failure',
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

    const bundle = await engine.compileContext({
      sessionId,
      workspaceId,
      query: 'why is the migration pipeline blocked while we preserve provenance',
      tokenBudget: 420
    });
    await engine.createCheckpoint({
      sessionId,
      bundle
    });

    await engine.ingest({
      sessionId: followupSessionId,
      workspaceId,
      records: [
        {
          id: 'goal-stage5-no-global-failure-followup',
          scope: 'session',
          sourceType: 'conversation',
          role: 'user',
          content: 'We still need to preserve provenance while the migration pipeline is blocked.',
          metadata: {
            nodeType: 'Goal'
          }
        },
        {
          id: 'step-stage5-no-global-failure-followup',
          scope: 'session',
          sourceType: 'workflow',
          role: 'system',
          content: 'Step 2: register the artifact sidecar before transcript persistence.',
          metadata: {
            nodeType: 'Step'
          }
        }
      ]
    });

    const followupBundle = await engine.compileContext({
      sessionId: followupSessionId,
      workspaceId,
      query: 'why is the migration pipeline blocked while we preserve provenance',
      tokenBudget: 420
    });
    const workspaceFailurePatterns = await engine.queryNodes({
      workspaceId,
      scopes: ['workspace'],
      types: ['FailurePattern']
    });
    const sessionFailurePatterns = await engine.queryNodes({
      sessionId,
      scopes: ['session'],
      types: ['FailurePattern']
    });
    const globalFailurePatterns = await engine.queryNodes({
      scopes: ['global'],
      types: ['FailurePattern']
    });

    assert.ok(sessionFailurePatterns.length >= 1);
    assert.equal(workspaceFailurePatterns.length, 0);
    assert.equal(globalFailurePatterns.length, 0);
    assert.equal(sessionFailurePatterns[0]?.payload.knowledgeClass, 'failure_experience');
    assert.equal(sessionFailurePatterns[0]?.payload.contaminationRisk, 'high');
    assert.equal(sessionFailurePatterns[0]?.payload.workspaceEligible, false);
    assert.ok(
      followupBundle.currentProcess?.reason
        ? !/learning:failure_pattern/i.test(followupBundle.currentProcess.reason)
        : true
    );
  } finally {
    await engine.close();
  }
});
