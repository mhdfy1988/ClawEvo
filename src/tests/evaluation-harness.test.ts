import assert from 'node:assert/strict';
import test from 'node:test';

import { formatEvaluationReport, runEvaluationFixture } from '../evaluation/evaluation-harness.js';
import {
  createContextProcessingEvaluationFixture,
  createRepresentativeEvaluationFixture
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
