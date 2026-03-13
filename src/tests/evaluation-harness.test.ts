import assert from 'node:assert/strict';
import test from 'node:test';

import { formatEvaluationReport, runEvaluationFixture } from '../evaluation/evaluation-harness.js';
import { createRepresentativeEvaluationFixture } from './fixtures/evaluation-harness-fixtures.js';

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
    assert.equal(report.metrics.retrievalCost.bundleRelation?.strategy, 'batch_adjacency');
    assert.equal(report.metrics.retrievalCost.bundleRelation?.edgeLookupCount, 1);
    assert.equal(report.metrics.retrievalCost.bundleRelation?.nodeLookupCount, 1);
    assert.equal(report.metrics.retrievalCost.explainSelectionEdgeLookupsTotal, 8);
    assert.equal(report.metrics.retrievalCost.explainSelectionNodeLookupsTotal, 8);
    assert.equal(report.metrics.retrievalCost.explainAdjacencyEdgeLookupsTotal, 8);
    assert.equal(report.metrics.retrievalCost.explainAdjacencyNodeLookupsTotal, 8);
    assert.equal(report.metrics.retrievalCost.persistenceReadCountTotal, 24);
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
  } finally {
    await fixture.engine.close();
  }
});
