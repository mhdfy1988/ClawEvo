import assert from 'node:assert/strict';
import test from 'node:test';

import type { EvaluationReport } from '../internal/evaluation/evaluation-harness.js';
import {
  buildStageObservabilityReport,
  buildStageObservabilitySnapshot,
  buildStageObservabilityTrend,
  formatStageObservabilityReport
} from '../internal/evaluation/observability-report.js';

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
            pathBudget: 6,
            maxPathsPerTarget: 2,
            candidatePathCount: 4,
            admittedPathCount: 3,
            pathCount: 3,
            prunedPathCount: 1,
            prunedByBudgetCount: 0,
            prunedByTargetCount: 1
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
        },
        promotionQuality: {
          surfacedKnowledgeClasses: ['local_procedure'],
          matchedKnowledgeClasses: ['local_procedure'],
          missingKnowledgeClasses: [],
          knowledgeClassCoverage: 1,
          pollutedNodeIds: [],
          pollutionRate: 0
        },
        scopeReuse: {
          surfacedWorkspaceNodeIds: [],
          surfacedGlobalNodeIds: [],
          learningBoostNodeIds: [],
          matchedWorkspaceNodeIds: [],
          matchedGlobalNodeIds: [],
          missingWorkspaceNodeIds: [],
          missingGlobalNodeIds: [],
          disallowedSurfacedNodeIds: [],
          benefit: 0,
          intrusion: 0
        },
        multiSource: {
          surfacedNodeTypes: [],
          matchedNodeTypes: [],
          missingNodeTypes: [],
          coverage: 0
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
            pathBudget: 6,
            maxPathsPerTarget: 2,
            candidatePathCount: 7,
            admittedPathCount: 5,
            pathCount: 5,
            prunedPathCount: 2,
            prunedByBudgetCount: 1,
            prunedByTargetCount: 1
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
        },
        promotionQuality: {
          surfacedKnowledgeClasses: [],
          matchedKnowledgeClasses: [],
          missingKnowledgeClasses: ['local_procedure'],
          knowledgeClassCoverage: 0,
          pollutedNodeIds: [],
          pollutionRate: 0
        },
        scopeReuse: {
          surfacedWorkspaceNodeIds: [],
          surfacedGlobalNodeIds: [],
          learningBoostNodeIds: [],
          matchedWorkspaceNodeIds: [],
          matchedGlobalNodeIds: [],
          missingWorkspaceNodeIds: [],
          missingGlobalNodeIds: [],
          disallowedSurfacedNodeIds: [],
          benefit: 0,
          intrusion: 0
        },
        multiSource: {
          surfacedNodeTypes: [],
          matchedNodeTypes: [],
          missingNodeTypes: ['Document'],
          coverage: 0
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
  assert.equal(snapshot.averageRecallNoiseRate, 0.5);
  assert.equal(snapshot.averageBundleCoverage, 0.75);
  assert.equal(snapshot.averageExplainCoverage, 0.75);
  assert.equal(snapshot.averageConceptCoverage, 0.5);
  assert.equal(snapshot.averageMemoryUsefulness, 0.625);
  assert.equal(snapshot.averageMemoryIntrusion, 0.5);
  assert.equal(snapshot.averagePromotionQuality, 0.5);
  assert.equal(snapshot.averageKnowledgePollutionRate, 0);
  assert.equal(snapshot.averageHighScopeReuseBenefit, 0);
  assert.equal(snapshot.averageHighScopeReuseIntrusion, 0);
  assert.equal(snapshot.averageMultiSourceCoverage, 0);
  assert.equal(snapshot.averageCandidatePathCount, 5.5);
  assert.equal(snapshot.averageAdmittedPathCount, 4);
  assert.equal(snapshot.averagePathPruneRate, 15 / 56);
  assert.equal(snapshot.totalPathCount, 8);
  assert.equal(snapshot.totalPrunedPathCount, 3);
});

test('buildStageObservabilityTrend and report expose stage-level trend summaries', () => {
  const previous = {
    label: 'stage-5-first-pass',
    snapshot: {
      fixtureCount: 1,
      passCount: 1,
      passRate: 1,
      averageRelationPrecision: 1,
      averageRelationRecall: 1,
      averageRecallNoiseRate: 0,
      averageBundleCoverage: 1,
      averageExplainCoverage: 1,
      averageConceptCoverage: 1,
      averageMemoryUsefulness: 1,
      averageMemoryIntrusion: 0,
      averagePromotionQuality: 1,
      averageKnowledgePollutionRate: 0,
      averageHighScopeReuseBenefit: 1,
      averageHighScopeReuseIntrusion: 0,
      averageMultiSourceCoverage: 1,
      averageCandidatePathCount: 2,
      averageAdmittedPathCount: 2,
      averagePathPruneRate: 0,
      totalPathCount: 2,
      totalPrunedPathCount: 0
    }
  } as const;
  const currentReports = [
    {
      fixtureName: 'fixture-current',
      pass: true,
      failures: [],
      bundle: {
        id: 'bundle-current',
        checkpointId: 'checkpoint-current',
        deltaId: 'delta-current',
        skillCandidateIds: []
      },
      metrics: {
        bundleQuality: {
          selectedNodeIds: ['node-a'],
          requiredSelectedNodeIds: ['node-a'],
          missingRequiredNodeIds: [],
          forbiddenSelectedNodeIds: [],
          requiredCoverage: 1
        },
        relationRecall: {
          selectedNodeIds: ['node-a'],
          matchedExpectedNodeIds: ['node-a'],
          noiseNodeIds: [],
          precision: 1,
          recall: 1
        },
        memoryQuality: {
          usefulSurfacedNodeIds: ['node-a'],
          disallowedSurfacedNodeIds: [],
          usefulness: 1,
          intrusion: 0
        },
        explainCompleteness: {
          completeNodeIds: ['node-a'],
          incompleteNodeIds: [],
          coverage: 1
        },
        retrievalCost: {
          bundleRelation: {
            strategy: 'batch_adjacency',
            sourceCount: 1,
            sourceSlots: ['activeRules'],
            edgeTypes: ['supported_by'],
            edgeLookupCount: 1,
            nodeLookupCount: 1,
            scannedEdgeCount: 1,
            eligibleEdgeCount: 1,
            relatedNodeCount: 1,
            maxHopCount: 2,
            pathBudget: 8,
            maxPathsPerTarget: 3,
            candidatePathCount: 4,
            admittedPathCount: 3,
            pathCount: 3,
            prunedPathCount: 1,
            prunedByBudgetCount: 0,
            prunedByTargetCount: 1
          },
          explainSelectionEdgeLookupsTotal: 1,
          explainSelectionNodeLookupsTotal: 1,
          explainAdjacencyEdgeLookupsTotal: 1,
          explainAdjacencyNodeLookupsTotal: 1,
          persistenceReadCountTotal: 3
        },
        contextProcessing: {
          semanticMaterializedNodeIds: ['node-a'],
          matchedSemanticNodeIds: ['node-a'],
          missingSemanticNodeIds: [],
          semanticNodeCoverage: 1,
          normalizedConceptIds: ['provenance'],
          matchedConceptIds: ['provenance'],
          missingConceptIds: [],
          conceptCoverage: 1,
          clauseSplitCompleteNodeIds: ['node-a'],
          clauseSplitMissingNodeIds: [],
          clauseSplitCoverage: 1,
          anchorCompleteNodeIds: ['node-a'],
          anchorMissingNodeIds: [],
          anchorCompleteness: 1,
          surfacedExperienceNodeTypes: ['Attempt'],
          missingExperienceNodeTypes: [],
          experienceLearningCoverage: 1
        },
        promotionQuality: {
          surfacedKnowledgeClasses: ['local_procedure'],
          matchedKnowledgeClasses: ['local_procedure'],
          missingKnowledgeClasses: [],
          knowledgeClassCoverage: 1,
          pollutedNodeIds: [],
          pollutionRate: 0
        },
        scopeReuse: {
          surfacedWorkspaceNodeIds: ['workspace-procedure-1'],
          surfacedGlobalNodeIds: [],
          learningBoostNodeIds: ['session-step-1'],
          matchedWorkspaceNodeIds: ['workspace-procedure-1'],
          matchedGlobalNodeIds: [],
          missingWorkspaceNodeIds: [],
          missingGlobalNodeIds: [],
          disallowedSurfacedNodeIds: [],
          benefit: 1,
          intrusion: 0
        },
        multiSource: {
          surfacedNodeTypes: ['Document', 'Repo'],
          matchedNodeTypes: ['Document', 'Repo'],
          missingNodeTypes: [],
          coverage: 1
        }
      }
    }
  ] satisfies EvaluationReport[];

  const trend = buildStageObservabilityTrend([previous]);
  const report = buildStageObservabilityReport({
    stage: 'stage-5-second-pass',
    reports: currentReports,
    history: [previous]
  });

  assert.equal(trend.pointCount, 1);
  assert.deepEqual(trend.labels, ['stage-5-first-pass']);
  assert.equal(report.stage, 'stage-5-second-pass');
  assert.equal(report.current.averageCandidatePathCount, 4);
  assert.equal(report.current.averageAdmittedPathCount, 3);
  assert.deepEqual(report.trend.labels, ['stage-5-first-pass', 'stage-5-second-pass']);
  assert.equal(report.trend.latestRecallNoiseRate, 0);
  assert.equal(report.trend.latestPathPruneRate, 0.25);
  assert.equal(report.trend.latestKnowledgePollutionRate, 0);
  assert.equal(report.trend.latestHighScopeReuseBenefit, 1);
  assert.equal(report.trend.latestMultiSourceCoverage, 1);

  const text = formatStageObservabilityReport(report);
  assert.match(text, /^\[Stage Observability\] stage-5-second-pass/m);
  assert.match(text, /relation: precision=1\.00 recall=1\.00 noise=0\.00/i);
  assert.match(text, /governance: promotion=1\.00 pollution=0\.00 scopeReuse=1\.00/i);
  assert.match(text, /multi-source: coverage=1\.00/i);
});


