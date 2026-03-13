import test from 'node:test';
import assert from 'node:assert/strict';

import { ContextEngine } from '../engine/context-engine.js';
import { ContextCompiler } from '../core/context-compiler.js';
import { InMemoryGraphStore } from '../core/graph-store.js';
import { IngestPipeline } from '../core/ingest-pipeline.js';
import type { RawContextInput } from '../types/io.js';

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
