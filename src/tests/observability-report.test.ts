import assert from 'node:assert/strict';
import test from 'node:test';

import type { EvaluationReport } from '../evaluation/evaluation-harness.js';
import { buildStageObservabilitySnapshot } from '../evaluation/observability-report.js';

test('buildStageObservabilitySnapshot aggregates stage metrics across reports', () => {
  const reports: EvaluationReport[] = [
    {
      fixtureName: 'fixture-a',
      pass: true,
      failures: [],
      bundle: {
        id: 'bundle-a',
        checkpointId: 'checkpoint-a',
        deltaId: 'delta-a',
        skillCandidateIds: ['skill-a']
      },
      metrics: {
        bundleQuality: {
          selectedNodeIds: ['a'],
          requiredSelectedNodeIds: ['a'],
          missingRequiredNodeIds: [],
          forbiddenSelectedNodeIds: [],
          requiredCoverage: 1
        },
        relationRecall: {
          selectedNodeIds: ['a'],
          matchedExpectedNodeIds: ['a'],
          noiseNodeIds: [],
          precision: 1,
          recall: 1
        },
        memoryQuality: {
          usefulSurfacedNodeIds: ['a'],
          disallowedSurfacedNodeIds: [],
          usefulness: 1,
          intrusion: 0
        },
        explainCompleteness: {
          completeNodeIds: ['a'],
          incompleteNodeIds: [],
          coverage: 1
        },
        retrievalCost: {
          bundleRelation: {
            strategy: 'batch_adjacency',
            sourceCount: 2,
            sourceSlots: ['activeRules'],
            edgeTypes: ['supported_by'],
            edgeLookupCount: 1,
            nodeLookupCount: 1,
            scannedEdgeCount: 2,
            eligibleEdgeCount: 1,
            relatedNodeCount: 1,
            maxHopCount: 2,
            pathCount: 3,
            prunedPathCount: 1
          },
          explainSelectionEdgeLookupsTotal: 2,
          explainSelectionNodeLookupsTotal: 2,
          explainAdjacencyEdgeLookupsTotal: 1,
          explainAdjacencyNodeLookupsTotal: 1,
          persistenceReadCountTotal: 3
        },
        contextProcessing: {
          semanticMaterializedNodeIds: ['a'],
          matchedSemanticNodeIds: ['a'],
          missingSemanticNodeIds: [],
          semanticNodeCoverage: 1,
          normalizedConceptIds: ['provenance'],
          matchedConceptIds: ['provenance'],
          missingConceptIds: [],
          conceptCoverage: 1,
          clauseSplitCompleteNodeIds: ['a'],
          clauseSplitMissingNodeIds: [],
          clauseSplitCoverage: 1,
          anchorCompleteNodeIds: ['a'],
          anchorMissingNodeIds: [],
          anchorCompleteness: 1,
          surfacedExperienceNodeTypes: ['Attempt'],
          missingExperienceNodeTypes: [],
          experienceLearningCoverage: 1
        }
      }
    },
    {
      fixtureName: 'fixture-b',
      pass: false,
      failures: ['relation precision low'],
      bundle: {
        id: 'bundle-b',
        checkpointId: 'checkpoint-b',
        deltaId: 'delta-b',
        skillCandidateIds: []
      },
      metrics: {
        bundleQuality: {
          selectedNodeIds: ['b'],
          requiredSelectedNodeIds: [],
          missingRequiredNodeIds: ['required-b'],
          forbiddenSelectedNodeIds: [],
          requiredCoverage: 0.5
        },
        relationRecall: {
          selectedNodeIds: ['b'],
          matchedExpectedNodeIds: [],
          noiseNodeIds: ['noise-b'],
          precision: 0.5,
          recall: 0.25
        },
        memoryQuality: {
          usefulSurfacedNodeIds: [],
          disallowedSurfacedNodeIds: ['b'],
          usefulness: 0.25,
          intrusion: 1
        },
        explainCompleteness: {
          completeNodeIds: [],
          incompleteNodeIds: ['b'],
          coverage: 0.5
        },
        retrievalCost: {
          bundleRelation: {
            strategy: 'batch_adjacency',
            sourceCount: 1,
            sourceSlots: ['currentProcess'],
            edgeTypes: ['requires', 'supported_by'],
            edgeLookupCount: 3,
            nodeLookupCount: 3,
            scannedEdgeCount: 4,
            eligibleEdgeCount: 2,
            relatedNodeCount: 2,
            maxHopCount: 2,
            pathCount: 5,
            prunedPathCount: 2
          },
          explainSelectionEdgeLookupsTotal: 4,
          explainSelectionNodeLookupsTotal: 4,
          explainAdjacencyEdgeLookupsTotal: 2,
          explainAdjacencyNodeLookupsTotal: 2,
          persistenceReadCountTotal: 6
        },
        contextProcessing: {
          semanticMaterializedNodeIds: ['b'],
          matchedSemanticNodeIds: [],
          missingSemanticNodeIds: ['b'],
          semanticNodeCoverage: 0,
          normalizedConceptIds: [],
          matchedConceptIds: [],
          missingConceptIds: ['knowledge_graph'],
          conceptCoverage: 0,
          clauseSplitCompleteNodeIds: [],
          clauseSplitMissingNodeIds: ['b'],
          clauseSplitCoverage: 0,
          anchorCompleteNodeIds: [],
          anchorMissingNodeIds: ['b'],
          anchorCompleteness: 0,
          surfacedExperienceNodeTypes: [],
          missingExperienceNodeTypes: ['Attempt'],
          experienceLearningCoverage: 0
        }
      }
    }
  ];

  const snapshot = buildStageObservabilitySnapshot(reports);

  assert.equal(snapshot.fixtureCount, 2);
  assert.equal(snapshot.passCount, 1);
  assert.equal(snapshot.passRate, 0.5);
  assert.equal(snapshot.averageRelationPrecision, 0.75);
  assert.equal(snapshot.averageRelationRecall, 0.625);
  assert.equal(snapshot.averageBundleCoverage, 0.75);
  assert.equal(snapshot.averageExplainCoverage, 0.75);
  assert.equal(snapshot.averageConceptCoverage, 0.5);
  assert.equal(snapshot.totalPathCount, 8);
  assert.equal(snapshot.totalPrunedPathCount, 3);
});
