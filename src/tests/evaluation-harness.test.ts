import assert from 'node:assert/strict';
import test from 'node:test';

import { formatEvaluationReport, runEvaluationFixture } from '../evaluation/evaluation-harness.js';
import { buildLabelOverrideCorrection } from '@openclaw-compact-context/runtime-core/governance';
import {
  createContextProcessingEvaluationFixture,
  createRepresentativeEvaluationFixture,
  createStageFiveEvaluationFixture
} from './fixtures/evaluation-harness-fixtures.js';

test('evaluation harness passes the representative stage 4 fixture', async () => {
  const fixture = await createRepresentativeEvaluationFixture();

  try {
    const report = await runEvaluationFixture(fixture);

    assert.equal(report.pass, true, formatEvaluationReport(report));
    assert.equal(report.metrics.bundleQuality.requiredCoverage, 1);
    assert.equal(report.metrics.bundleQuality.forbiddenSelectedNodeIds.length, 0);
    assert.equal(report.metrics.relationRecall.precision, 1);
    assert.equal(report.metrics.relationRecall.recall, 1);
    assert.equal(report.metrics.relationRecall.noiseNodeIds.length, 0);
    assert.equal(report.metrics.memoryQuality.usefulness, 1);
    assert.equal(report.metrics.memoryQuality.intrusion, 0);
    assert.equal(report.metrics.explainCompleteness.coverage, 1);
    assert.equal(report.metrics.contextProcessing.semanticNodeCoverage, 1);
    assert.equal(report.metrics.contextProcessing.conceptCoverage, 1);
    assert.equal(report.metrics.contextProcessing.clauseSplitCoverage, 1);
    assert.equal(report.metrics.contextProcessing.anchorCompleteness, 1);
    assert.equal(report.metrics.contextProcessing.experienceLearningCoverage, 1);
    assert.equal(report.metrics.retrievalCost.bundleRelation?.strategy, 'batch_adjacency');
    assert.equal(report.metrics.retrievalCost.bundleRelation?.edgeLookupCount, 1);
    assert.equal(report.metrics.retrievalCost.bundleRelation?.nodeLookupCount, 1);
    assert.equal(report.metrics.retrievalCost.explainSelectionEdgeLookupsTotal, 9);
    assert.equal(report.metrics.retrievalCost.explainSelectionNodeLookupsTotal, 9);
    assert.equal(report.metrics.retrievalCost.explainAdjacencyEdgeLookupsTotal, 9);
    assert.equal(report.metrics.retrievalCost.explainAdjacencyNodeLookupsTotal, 9);
    assert.equal(report.metrics.retrievalCost.persistenceReadCountTotal, 27);
    assert.equal(report.bundle.skillCandidateIds.length, 1);
  } finally {
    await fixture.engine.close();
  }
});

test('evaluation harness formats a readable metrics summary', async () => {
  const fixture = await createRepresentativeEvaluationFixture();

  try {
    const report = await runEvaluationFixture(fixture);
    const text = formatEvaluationReport(report);

    assert.match(text, /^\[Evaluation\] stage-4-representative-evaluation/m);
    assert.match(text, /bundle quality: requiredCoverage=1\.00/i);
    assert.match(text, /relation recall: precision=1\.00 recall=1\.00 noise=0/i);
    assert.match(text, /memory quality: usefulness=1\.00 intrusion=0\.00/i);
    assert.match(text, /explain completeness: coverage=1\.00/i);
    assert.match(text, /retrieval cost: bundle=batch_adjacency\/edge:1\/node:1/i);
    assert.match(text, /context processing: semantic=1\.00 concept=1\.00 clause=1\.00 anchor=1\.00 experience=1\.00/i);
  } finally {
    await fixture.engine.close();
  }
});

test('evaluation harness covers bilingual clause splitting, concept normalization, anchors, and experience nodes', async () => {
  const fixture = await createContextProcessingEvaluationFixture();

  try {
    const report = await runEvaluationFixture(fixture);

    assert.equal(report.pass, true, formatEvaluationReport(report));
    assert.equal(report.metrics.contextProcessing.semanticNodeCoverage, 1);
    assert.equal(report.metrics.contextProcessing.conceptCoverage, 1);
    assert.equal(report.metrics.contextProcessing.clauseSplitCoverage, 1);
    assert.equal(report.metrics.contextProcessing.anchorCompleteness, 1);
    assert.equal(report.metrics.contextProcessing.experienceLearningCoverage, 1);
    assert.deepEqual(
      report.metrics.contextProcessing.missingExperienceNodeTypes,
      []
    );
  } finally {
    await fixture.engine.close();
  }
});

test('evaluation harness covers stage 5 multi-hop recall and workspace memory reuse signals', async () => {
  const fixture = await createStageFiveEvaluationFixture();

  try {
    const report = await runEvaluationFixture(fixture);

    assert.equal(report.pass, true, formatEvaluationReport(report));
    assert.equal(report.metrics.relationRecall.precision, 1);
    assert.equal(report.metrics.relationRecall.recall, 1);
    assert.equal(report.metrics.retrievalCost.bundleRelation?.maxHopCount, 2);
    assert.ok((report.metrics.retrievalCost.bundleRelation?.pathCount ?? 0) >= 1);
    assert.equal(report.metrics.contextProcessing.experienceLearningCoverage, 1);
    assert.equal(report.metrics.promotionQuality.knowledgeClassCoverage, 1);
    assert.equal(report.metrics.promotionQuality.pollutionRate, 0);
    assert.ok(report.metrics.scopeReuse.benefit >= 0.5);
    assert.equal(report.metrics.scopeReuse.intrusion, 0);
    assert.equal(report.metrics.multiSource.coverage, 1);
  } finally {
    await fixture.engine.close();
  }
});

test('evaluation harness applies manual corrections before running a fixture', async () => {
  const fixture = await createRepresentativeEvaluationFixture();
  const ruleNodeId = fixture.requiredBundleNodeIds.find((nodeId) => /:rule$/i.test(nodeId));

  assert.ok(ruleNodeId);
  fixture.compileRequest.tokenBudget = 960;
  fixture.manualCorrections = [
    buildLabelOverrideCorrection({
      id: 'evaluation-label-override-1',
      targetId: ruleNodeId as string,
      action: 'apply',
      author: 'tester',
      reason: 'clarify the representative evaluation rule label',
      createdAt: '2026-03-20T10:30:00.000Z',
      label: 'rule:Always preserve provenance before transcript persistence.'
    })
  ];

  try {
    const report = await runEvaluationFixture(fixture);
    const corrections = await fixture.engine.listManualCorrections();

    assert.equal(report.metrics.bundleQuality.requiredCoverage, 1, formatEvaluationReport(report));
    assert.equal(report.metrics.relationRecall.precision, 1, formatEvaluationReport(report));
    assert.equal(report.metrics.explainCompleteness.coverage, 1, formatEvaluationReport(report));
    assert.equal(corrections.some((correction) => correction.id === 'evaluation-label-override-1'), true);
  } finally {
    await fixture.engine.close();
  }
});

