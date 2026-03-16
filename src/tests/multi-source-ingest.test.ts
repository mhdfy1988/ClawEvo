import test from 'node:test';
import assert from 'node:assert/strict';

import { AuditExplainer } from '@openclaw-compact-context/runtime-core/runtime';
import { InMemoryGraphStore } from '@openclaw-compact-context/runtime-core/infrastructure';
import { IngestPipeline } from '@openclaw-compact-context/runtime-core/runtime';

test('ingest materializes document, repo structure, and structured input source entities', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const sessionId = 'session-multi-source-ingest';

  await ingestPipeline.ingest({
    sessionId,
    records: [
      {
        id: 'multi-source-readme-1',
        scope: 'session',
        sourceType: 'document',
        role: 'system',
        content: '# Compact Context README\nExplains ContextCompiler.compile and npm test.',
        sourceRef: {
          sourceType: 'document',
          sourcePath: 'README.md',
          contentHash: 'hash-readme'
        },
        metadata: {
          nodeType: 'Rule',
          documentKind: 'readme',
          documentTitle: 'Compact Context README',
          repoName: 'openclaw_compact_context',
          repoPath: 'openclaw_compact_context',
          modulePath: 'src/core',
          filePath: 'packages/runtime-core/src/runtime/context-compiler.ts',
          apiName: 'ContextCompiler.compile',
          apiSignature: 'compile(request: CompileContextRequest)',
          command: 'npm test',
          structuredInputKind: 'ci_report',
          structuredInputFormat: 'json',
          curatedBy: 'Codex',
          curatedReason: 'seeded from repository documentation'
        }
      }
    ]
  });

  const [documentNode] = await graphStore.queryNodes({
    sessionId,
    types: ['Document']
  });
  const [repoNode] = await graphStore.queryNodes({
    sessionId,
    types: ['Repo']
  });
  const [moduleNode] = await graphStore.queryNodes({
    sessionId,
    types: ['Module']
  });
  const [fileNode] = await graphStore.queryNodes({
    sessionId,
    types: ['File']
  });
  const [apiNode] = await graphStore.queryNodes({
    sessionId,
    types: ['API']
  });
  const [commandNode] = await graphStore.queryNodes({
    sessionId,
    types: ['Command']
  });
  const [evidenceNode] = await graphStore.queryNodes({
    sessionId,
    types: ['Evidence']
  });

  assert.ok(documentNode);
  assert.ok(repoNode);
  assert.ok(moduleNode);
  assert.ok(fileNode);
  assert.ok(apiNode);
  assert.ok(commandNode);
  assert.ok(evidenceNode);
  assert.equal(documentNode.payload.admissionKind, 'manual_curation');

  const metadata =
    documentNode.payload.metadata &&
    typeof documentNode.payload.metadata === 'object' &&
    !Array.isArray(documentNode.payload.metadata)
      ? documentNode.payload.metadata
      : undefined;
  assert.equal(metadata?.documentKind, 'readme');
  assert.equal(metadata?.structuredInputKind, 'ci_report');
  assert.equal(metadata?.structuredInputFormat, 'json');
  assert.equal(metadata?.curatedBy, 'Codex');

  const sourceEdges = await graphStore.queryEdges({
    sessionId,
    types: ['documents', 'contains', 'defines']
  });

  assert.ok(sourceEdges.some((edge) => edge.type === 'documents' && edge.fromId === documentNode.id && edge.toId === evidenceNode.id));
  assert.ok(sourceEdges.some((edge) => edge.type === 'contains' && edge.fromId === repoNode.id && edge.toId === moduleNode.id));
  assert.ok(sourceEdges.some((edge) => edge.type === 'contains' && edge.fromId === moduleNode.id && edge.toId === fileNode.id));
  assert.ok(sourceEdges.some((edge) => edge.type === 'defines' && edge.fromId === fileNode.id && edge.toId === apiNode.id));
  assert.ok(sourceEdges.some((edge) => edge.type === 'defines' && edge.fromId === fileNode.id && edge.toId === commandNode.id));
});

test('audit explainer surfaces explicit multi-source adjacency for repository entities', async () => {
  const graphStore = new InMemoryGraphStore();
  const ingestPipeline = new IngestPipeline(graphStore);
  const explainer = new AuditExplainer(graphStore);
  const sessionId = 'session-multi-source-explain';

  await ingestPipeline.ingest({
    sessionId,
    records: [
      {
        id: 'multi-source-graph-1',
        scope: 'session',
        sourceType: 'document',
        role: 'system',
        content: 'Repository conventions for running checks and preserving provenance.',
        sourceRef: {
          sourceType: 'document',
          sourcePath: 'docs/conventions.md',
          contentHash: 'hash-conventions'
        },
        metadata: {
          nodeType: 'Rule',
          graphSourceEntities: [
            {
              kind: 'Document',
              key: 'doc:conventions',
              label: 'document:Repository conventions',
              payload: {
                documentKind: 'design'
              }
            },
            {
              kind: 'Repo',
              key: 'repo:openclaw',
              label: 'repo:openclaw_compact_context'
            },
            {
              kind: 'Command',
              key: 'command:npm run check',
              label: 'command:npm run check',
              parentKey: 'repo:openclaw',
              relation: 'defines'
            }
          ]
        }
      }
    ]
  });

  const [repoNode] = await graphStore.queryNodes({
    sessionId,
    types: ['Repo']
  });

  assert.ok(repoNode);
  const result = await explainer.explain({
    nodeId: repoNode.id
  });

  assert.ok(
    result.relatedNodes.some(
      (node) => node.type === 'Command' && node.relation?.edgeType === 'defines'
    )
  );
  assert.ok(
    result.relatedNodes.some(
      (node) => node.type === 'Document' && node.relation?.edgeType === 'documents'
    )
  );
});


