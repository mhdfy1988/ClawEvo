import type { ContextEngine } from '../engine/context-engine.js';
import type { ExplainResult, CompileContextRequest } from '../types/io.js';
import type { NodeType, RelationRetrievalDiagnostics, RuntimeContextBundle } from '../types/core.js';
import type { CanonicalConceptId } from '../types/context-processing.js';

export interface EvaluationThresholds {
  relationPrecisionMin: number;
  relationRecallMin: number;
  relationNoiseMax: number;
  memoryUsefulnessMin: number;
  memoryIntrusionMax: number;
  bundleRequiredCoverageMin: number;
  bundleForbiddenIntrusionMax: number;
  explainCompletenessMin: number;
  maxBundleRelationEdgeLookups: number;
  maxBundleRelationNodeLookups: number;
  maxExplainSelectionEdgeLookupsTotal: number;
  maxExplainSelectionNodeLookupsTotal: number;
  maxExplainAdjacencyEdgeLookupsTotal: number;
  maxExplainAdjacencyNodeLookupsTotal: number;
  maxPersistenceReadCountTotal: number;
  semanticNodeCoverageMin: number;
  conceptNormalizationCoverageMin: number;
  clauseSplitCoverageMin: number;
  evidenceAnchorCompletenessMin: number;
  experienceLearningCoverageMin: number;
}

export interface ContextProcessingExpectation {
  semanticNodeIds?: string[];
  conceptIds?: CanonicalConceptId[];
  clauseSplitProbeNodeIds?: string[];
  anchorProbeNodeIds?: string[];
  expectedExperienceNodeTypes?: NodeType[];
}

export interface EvaluationFixture {
  name: string;
  engine: ContextEngine;
  compileRequest: CompileContextRequest;
  requiredBundleNodeIds: string[];
  forbiddenBundleNodeIds?: string[];
  expectedRelationEvidenceNodeIds: string[];
  allowedRelationEvidenceNodeIds?: string[];
  memoryUsefulNodeIds: string[];
  memoryDisallowedNodeIds?: string[];
  explainProbeNodeIds?: string[];
  contextProcessing?: ContextProcessingExpectation;
  thresholds?: Partial<EvaluationThresholds>;
}

export interface BundleQualityMetrics {
  selectedNodeIds: string[];
  requiredSelectedNodeIds: string[];
  missingRequiredNodeIds: string[];
  forbiddenSelectedNodeIds: string[];
  requiredCoverage: number;
}

export interface RelationRecallMetrics {
  selectedNodeIds: string[];
  matchedExpectedNodeIds: string[];
  noiseNodeIds: string[];
  precision: number;
  recall: number;
}

export interface MemoryQualityMetrics {
  usefulSurfacedNodeIds: string[];
  disallowedSurfacedNodeIds: string[];
  usefulness: number;
  intrusion: number;
}

export interface ExplainCompletenessMetrics {
  completeNodeIds: string[];
  incompleteNodeIds: string[];
  coverage: number;
}

export interface RetrievalCostMetrics {
  bundleRelation?: RelationRetrievalDiagnostics;
  explainSelectionEdgeLookupsTotal: number;
  explainSelectionNodeLookupsTotal: number;
  explainAdjacencyEdgeLookupsTotal: number;
  explainAdjacencyNodeLookupsTotal: number;
  persistenceReadCountTotal: number;
}

export interface ContextProcessingMetrics {
  semanticMaterializedNodeIds: string[];
  matchedSemanticNodeIds: string[];
  missingSemanticNodeIds: string[];
  semanticNodeCoverage: number;
  normalizedConceptIds: CanonicalConceptId[];
  matchedConceptIds: CanonicalConceptId[];
  missingConceptIds: CanonicalConceptId[];
  conceptCoverage: number;
  clauseSplitCompleteNodeIds: string[];
  clauseSplitMissingNodeIds: string[];
  clauseSplitCoverage: number;
  anchorCompleteNodeIds: string[];
  anchorMissingNodeIds: string[];
  anchorCompleteness: number;
  surfacedExperienceNodeTypes: NodeType[];
  missingExperienceNodeTypes: NodeType[];
  experienceLearningCoverage: number;
}

export interface EvaluationReport {
  fixtureName: string;
  pass: boolean;
  failures: string[];
  bundle: {
    id: string;
    checkpointId: string;
    deltaId: string;
    skillCandidateIds: string[];
  };
  metrics: {
    bundleQuality: BundleQualityMetrics;
    relationRecall: RelationRecallMetrics;
    memoryQuality: MemoryQualityMetrics;
      explainCompleteness: ExplainCompletenessMetrics;
      retrievalCost: RetrievalCostMetrics;
      contextProcessing: ContextProcessingMetrics;
    };
}

export async function runEvaluationFixture(fixture: EvaluationFixture): Promise<EvaluationReport> {
  const explainProbeNodeIds = dedupeIds(
    (fixture.explainProbeNodeIds ?? [])
      .concat(fixture.memoryUsefulNodeIds)
      .concat(fixture.memoryDisallowedNodeIds ?? [])
  );
  const thresholds = resolveThresholds(fixture, explainProbeNodeIds.length);
  const bundle = await fixture.engine.compileContext(fixture.compileRequest);
  const checkpointResult = await fixture.engine.createCheckpoint({
    sessionId: fixture.compileRequest.sessionId,
    bundle
  });
  const skillResult = await fixture.engine.crystallizeSkills({
    sessionId: fixture.compileRequest.sessionId,
    bundle,
    checkpointId: checkpointResult.checkpoint.id,
    minEvidenceCount: 1
  });
  const explainResults = await Promise.all(
    explainProbeNodeIds.map((nodeId) =>
      fixture.engine.explain({
        nodeId,
        selectionContext: {
          sessionId: fixture.compileRequest.sessionId,
          ...(fixture.compileRequest.workspaceId ? { workspaceId: fixture.compileRequest.workspaceId } : {}),
          query: fixture.compileRequest.query,
          tokenBudget: fixture.compileRequest.tokenBudget
        }
      })
    )
  );
  const explainByNodeId = new Map(explainProbeNodeIds.map((nodeId, index) => [nodeId, explainResults[index] as ExplainResult]));

  const bundleQuality = buildBundleQualityMetrics(bundle, fixture.requiredBundleNodeIds, fixture.forbiddenBundleNodeIds ?? []);
  const relationRecall = buildRelationRecallMetrics(
    bundle,
    fixture.expectedRelationEvidenceNodeIds,
    fixture.allowedRelationEvidenceNodeIds ?? fixture.expectedRelationEvidenceNodeIds
  );
  const memoryQuality = buildMemoryQualityMetrics(
    explainByNodeId,
    fixture.memoryUsefulNodeIds,
    fixture.memoryDisallowedNodeIds ?? []
  );
  const explainCompleteness = buildExplainCompletenessMetrics(explainByNodeId, explainProbeNodeIds);
  const retrievalCost = buildRetrievalCostMetrics(bundle, explainResults);
  const contextProcessing = await buildContextProcessingMetrics(fixture, explainByNodeId);
  const failures = evaluateThresholds(
    {
      bundleQuality,
      relationRecall,
      memoryQuality,
      explainCompleteness,
      retrievalCost,
      contextProcessing
    },
    thresholds
  );

  return {
    fixtureName: fixture.name,
    pass: failures.length === 0,
    failures,
    bundle: {
      id: bundle.id,
      checkpointId: checkpointResult.checkpoint.id,
      deltaId: checkpointResult.delta.id,
      skillCandidateIds: skillResult.candidates.map((candidate) => candidate.id)
    },
    metrics: {
      bundleQuality,
      relationRecall,
      memoryQuality,
      explainCompleteness,
      retrievalCost,
      contextProcessing
    }
  };
}

export function formatEvaluationReport(report: EvaluationReport): string {
  const lines = [
    `[Evaluation] ${report.fixtureName}`,
    `pass: ${report.pass}`,
    `bundle: ${report.bundle.id}`,
    `checkpoint: ${report.bundle.checkpointId}`,
    `delta: ${report.bundle.deltaId}`,
    `skill candidates: ${report.bundle.skillCandidateIds.length}`,
    `bundle quality: requiredCoverage=${formatRatio(report.metrics.bundleQuality.requiredCoverage)} missing=${report.metrics.bundleQuality.missingRequiredNodeIds.length} forbidden=${report.metrics.bundleQuality.forbiddenSelectedNodeIds.length}`,
    `relation recall: precision=${formatRatio(report.metrics.relationRecall.precision)} recall=${formatRatio(report.metrics.relationRecall.recall)} noise=${report.metrics.relationRecall.noiseNodeIds.length}`,
    `memory quality: usefulness=${formatRatio(report.metrics.memoryQuality.usefulness)} intrusion=${formatRatio(report.metrics.memoryQuality.intrusion)}`,
    `explain completeness: coverage=${formatRatio(report.metrics.explainCompleteness.coverage)} incomplete=${report.metrics.explainCompleteness.incompleteNodeIds.length}`,
    `retrieval cost: bundle=${formatRelationRetrieval(report.metrics.retrievalCost.bundleRelation)} explainSelection=edge:${report.metrics.retrievalCost.explainSelectionEdgeLookupsTotal}/node:${report.metrics.retrievalCost.explainSelectionNodeLookupsTotal} explainAdjacency=edge:${report.metrics.retrievalCost.explainAdjacencyEdgeLookupsTotal}/node:${report.metrics.retrievalCost.explainAdjacencyNodeLookupsTotal} persistenceReads=${report.metrics.retrievalCost.persistenceReadCountTotal}`,
    `context processing: semantic=${formatRatio(report.metrics.contextProcessing.semanticNodeCoverage)} concept=${formatRatio(report.metrics.contextProcessing.conceptCoverage)} clause=${formatRatio(report.metrics.contextProcessing.clauseSplitCoverage)} anchor=${formatRatio(report.metrics.contextProcessing.anchorCompleteness)} experience=${formatRatio(report.metrics.contextProcessing.experienceLearningCoverage)}`
  ];

  if (report.failures.length > 0) {
    lines.push('failures:');
    lines.push(...report.failures.map((item) => `- ${item}`));
  }

  return lines.join('\n');
}

function buildBundleQualityMetrics(
  bundle: RuntimeContextBundle,
  requiredNodeIds: string[],
  forbiddenNodeIds: string[]
): BundleQualityMetrics {
  const selectedNodeIds = collectBundleNodeIds(bundle);
  const requiredSelectedNodeIds = requiredNodeIds.filter((nodeId) => selectedNodeIds.includes(nodeId));
  const missingRequiredNodeIds = requiredNodeIds.filter((nodeId) => !selectedNodeIds.includes(nodeId));
  const forbiddenSelectedNodeIds = forbiddenNodeIds.filter((nodeId) => selectedNodeIds.includes(nodeId));

  return {
    selectedNodeIds,
    requiredSelectedNodeIds,
    missingRequiredNodeIds,
    forbiddenSelectedNodeIds,
    requiredCoverage: computeCoverage(requiredSelectedNodeIds.length, requiredNodeIds.length)
  };
}

function buildRelationRecallMetrics(
  bundle: RuntimeContextBundle,
  expectedNodeIds: string[],
  allowedNodeIds: string[]
): RelationRecallMetrics {
  const selectedNodeIds = bundle.relevantEvidence
    .filter((item) => / via [a-z_]+(?:->[a-z_]+)* from /i.test(item.reason))
    .map((item) => item.nodeId);
  const matchedExpectedNodeIds = expectedNodeIds.filter((nodeId) => selectedNodeIds.includes(nodeId));
  const allowedSet = new Set(allowedNodeIds);
  const noiseNodeIds = selectedNodeIds.filter((nodeId) => !allowedSet.has(nodeId));
  const allowedSelectedCount = selectedNodeIds.filter((nodeId) => allowedSet.has(nodeId)).length;

  return {
    selectedNodeIds,
    matchedExpectedNodeIds,
    noiseNodeIds,
    precision: computeCoverage(allowedSelectedCount, selectedNodeIds.length),
    recall: computeCoverage(matchedExpectedNodeIds.length, expectedNodeIds.length)
  };
}

function buildMemoryQualityMetrics(
  explainByNodeId: Map<string, ExplainResult>,
  usefulNodeIds: string[],
  disallowedNodeIds: string[]
): MemoryQualityMetrics {
  const usefulSurfacedNodeIds = usefulNodeIds.filter((nodeId) => hasPersistenceSurface(explainByNodeId.get(nodeId)));
  const disallowedSurfacedNodeIds = disallowedNodeIds.filter((nodeId) => hasPersistenceSurface(explainByNodeId.get(nodeId)));

  return {
    usefulSurfacedNodeIds,
    disallowedSurfacedNodeIds,
    usefulness: computeCoverage(usefulSurfacedNodeIds.length, usefulNodeIds.length),
    intrusion: disallowedNodeIds.length === 0 ? 0 : computeCoverage(disallowedSurfacedNodeIds.length, disallowedNodeIds.length)
  };
}

function buildExplainCompletenessMetrics(
  explainByNodeId: Map<string, ExplainResult>,
  probeNodeIds: string[]
): ExplainCompletenessMetrics {
  const completeNodeIds = probeNodeIds.filter((nodeId) => isCompleteExplainResult(explainByNodeId.get(nodeId)));
  const incompleteNodeIds = probeNodeIds.filter((nodeId) => !completeNodeIds.includes(nodeId));

  return {
    completeNodeIds,
    incompleteNodeIds,
    coverage: computeCoverage(completeNodeIds.length, probeNodeIds.length)
  };
}

function buildRetrievalCostMetrics(bundle: RuntimeContextBundle, explainResults: ExplainResult[]): RetrievalCostMetrics {
  return {
    bundleRelation: bundle.diagnostics?.relationRetrieval,
    explainSelectionEdgeLookupsTotal: sumBy(explainResults, (result) => result.retrieval?.selectionCompile?.edgeLookupCount ?? 0),
    explainSelectionNodeLookupsTotal: sumBy(explainResults, (result) => result.retrieval?.selectionCompile?.nodeLookupCount ?? 0),
    explainAdjacencyEdgeLookupsTotal: sumBy(explainResults, (result) => result.retrieval?.adjacency.edgeLookupCount ?? 0),
    explainAdjacencyNodeLookupsTotal: sumBy(explainResults, (result) => result.retrieval?.adjacency.nodeLookupCount ?? 0),
    persistenceReadCountTotal: sumBy(explainResults, (result) => result.retrieval?.persistenceReadCount ?? 0)
  };
}

async function buildContextProcessingMetrics(
  fixture: EvaluationFixture,
  explainByNodeId: Map<string, ExplainResult>
): Promise<ContextProcessingMetrics> {
  const expected = fixture.contextProcessing;
  const semanticNodeIds = dedupeIds(expected?.semanticNodeIds ?? []);
  const conceptIds = dedupeConceptIds(expected?.conceptIds ?? []);
  const clauseSplitProbeNodeIds = dedupeIds(expected?.clauseSplitProbeNodeIds ?? []);
  const anchorProbeNodeIds = dedupeIds(expected?.anchorProbeNodeIds ?? []);
  const expectedExperienceNodeTypes = dedupeNodeTypes(expected?.expectedExperienceNodeTypes ?? []);
  const surfacedConceptIds = dedupeConceptIds(
    [...explainByNodeId.values()].flatMap((result) =>
      (result.semanticSpans ?? []).flatMap((span) => span.conceptMatches.map((match) => match.conceptId))
    )
  );
  const matchedSemanticNodeIds = semanticNodeIds.filter((nodeId) => explainByNodeId.has(nodeId));
  const matchedConceptIds = conceptIds.filter((conceptId) => surfacedConceptIds.includes(conceptId));
  const clauseSplitCompleteNodeIds = clauseSplitProbeNodeIds.filter(
    (nodeId) => (explainByNodeId.get(nodeId)?.semanticSpans?.length ?? 0) > 1
  );
  const anchorCompleteNodeIds = anchorProbeNodeIds.filter((nodeId) => {
    const anchor = explainByNodeId.get(nodeId)?.evidenceAnchor;
    return Boolean(anchor?.recordId || anchor?.sourcePath || anchor?.sourceSpan);
  });
  const surfacedExperienceNodeTypes = dedupeNodeTypes(
    [
      ...(await fixture.engine.queryNodes({
        sessionId: fixture.compileRequest.sessionId,
        ...(fixture.compileRequest.workspaceId ? { workspaceId: fixture.compileRequest.workspaceId } : {}),
        types: ['Attempt', 'Episode', 'FailureSignal', 'ProcedureCandidate', 'Pattern', 'FailurePattern', 'SuccessfulProcedure'],
        limit: 32
      })).map((node) => node.type)
    ]
  );

  return {
    semanticMaterializedNodeIds: semanticNodeIds,
    matchedSemanticNodeIds,
    missingSemanticNodeIds: semanticNodeIds.filter((nodeId) => !matchedSemanticNodeIds.includes(nodeId)),
    semanticNodeCoverage: computeCoverage(matchedSemanticNodeIds.length, semanticNodeIds.length),
    normalizedConceptIds: surfacedConceptIds,
    matchedConceptIds,
    missingConceptIds: conceptIds.filter((conceptId) => !matchedConceptIds.includes(conceptId)),
    conceptCoverage: computeCoverage(matchedConceptIds.length, conceptIds.length),
    clauseSplitCompleteNodeIds,
    clauseSplitMissingNodeIds: clauseSplitProbeNodeIds.filter((nodeId) => !clauseSplitCompleteNodeIds.includes(nodeId)),
    clauseSplitCoverage: computeCoverage(clauseSplitCompleteNodeIds.length, clauseSplitProbeNodeIds.length),
    anchorCompleteNodeIds,
    anchorMissingNodeIds: anchorProbeNodeIds.filter((nodeId) => !anchorCompleteNodeIds.includes(nodeId)),
    anchorCompleteness: computeCoverage(anchorCompleteNodeIds.length, anchorProbeNodeIds.length),
    surfacedExperienceNodeTypes,
    missingExperienceNodeTypes: expectedExperienceNodeTypes.filter((type) => !surfacedExperienceNodeTypes.includes(type)),
    experienceLearningCoverage: computeCoverage(
      expectedExperienceNodeTypes.filter((type) => surfacedExperienceNodeTypes.includes(type)).length,
      expectedExperienceNodeTypes.length
    )
  };
}

function evaluateThresholds(
  metrics: EvaluationReport['metrics'],
  thresholds: EvaluationThresholds
): string[] {
  const failures: string[] = [];

  if (metrics.bundleQuality.requiredCoverage < thresholds.bundleRequiredCoverageMin) {
    failures.push(
      `bundle required coverage ${formatRatio(metrics.bundleQuality.requiredCoverage)} is below ${formatRatio(thresholds.bundleRequiredCoverageMin)}`
    );
  }

  if (metrics.bundleQuality.forbiddenSelectedNodeIds.length > thresholds.bundleForbiddenIntrusionMax) {
    failures.push(
      `bundle selected ${metrics.bundleQuality.forbiddenSelectedNodeIds.length} forbidden node(s), exceeding ${thresholds.bundleForbiddenIntrusionMax}`
    );
  }

  if (metrics.relationRecall.precision < thresholds.relationPrecisionMin) {
    failures.push(
      `relation precision ${formatRatio(metrics.relationRecall.precision)} is below ${formatRatio(thresholds.relationPrecisionMin)}`
    );
  }

  if (metrics.relationRecall.recall < thresholds.relationRecallMin) {
    failures.push(
      `relation recall ${formatRatio(metrics.relationRecall.recall)} is below ${formatRatio(thresholds.relationRecallMin)}`
    );
  }

  if (metrics.relationRecall.noiseNodeIds.length > thresholds.relationNoiseMax) {
    failures.push(
      `relation noise ${metrics.relationRecall.noiseNodeIds.length} exceeds ${thresholds.relationNoiseMax}`
    );
  }

  if (metrics.memoryQuality.usefulness < thresholds.memoryUsefulnessMin) {
    failures.push(
      `memory usefulness ${formatRatio(metrics.memoryQuality.usefulness)} is below ${formatRatio(thresholds.memoryUsefulnessMin)}`
    );
  }

  if (metrics.memoryQuality.intrusion > thresholds.memoryIntrusionMax) {
    failures.push(
      `memory intrusion ${formatRatio(metrics.memoryQuality.intrusion)} exceeds ${formatRatio(thresholds.memoryIntrusionMax)}`
    );
  }

  if (metrics.explainCompleteness.coverage < thresholds.explainCompletenessMin) {
    failures.push(
      `explain completeness ${formatRatio(metrics.explainCompleteness.coverage)} is below ${formatRatio(thresholds.explainCompletenessMin)}`
    );
  }

  const bundleEdgeLookups = metrics.retrievalCost.bundleRelation?.edgeLookupCount ?? Number.POSITIVE_INFINITY;
  const bundleNodeLookups = metrics.retrievalCost.bundleRelation?.nodeLookupCount ?? Number.POSITIVE_INFINITY;

  if (bundleEdgeLookups > thresholds.maxBundleRelationEdgeLookups) {
    failures.push(
      `bundle relation edge lookups ${bundleEdgeLookups} exceed ${thresholds.maxBundleRelationEdgeLookups}`
    );
  }

  if (bundleNodeLookups > thresholds.maxBundleRelationNodeLookups) {
    failures.push(
      `bundle relation node lookups ${bundleNodeLookups} exceed ${thresholds.maxBundleRelationNodeLookups}`
    );
  }

  if (metrics.retrievalCost.explainSelectionEdgeLookupsTotal > thresholds.maxExplainSelectionEdgeLookupsTotal) {
    failures.push(
      `explain selection edge lookups ${metrics.retrievalCost.explainSelectionEdgeLookupsTotal} exceed ${thresholds.maxExplainSelectionEdgeLookupsTotal}`
    );
  }

  if (metrics.retrievalCost.explainSelectionNodeLookupsTotal > thresholds.maxExplainSelectionNodeLookupsTotal) {
    failures.push(
      `explain selection node lookups ${metrics.retrievalCost.explainSelectionNodeLookupsTotal} exceed ${thresholds.maxExplainSelectionNodeLookupsTotal}`
    );
  }

  if (metrics.retrievalCost.explainAdjacencyEdgeLookupsTotal > thresholds.maxExplainAdjacencyEdgeLookupsTotal) {
    failures.push(
      `explain adjacency edge lookups ${metrics.retrievalCost.explainAdjacencyEdgeLookupsTotal} exceed ${thresholds.maxExplainAdjacencyEdgeLookupsTotal}`
    );
  }

  if (metrics.retrievalCost.explainAdjacencyNodeLookupsTotal > thresholds.maxExplainAdjacencyNodeLookupsTotal) {
    failures.push(
      `explain adjacency node lookups ${metrics.retrievalCost.explainAdjacencyNodeLookupsTotal} exceed ${thresholds.maxExplainAdjacencyNodeLookupsTotal}`
    );
  }

  if (metrics.retrievalCost.persistenceReadCountTotal > thresholds.maxPersistenceReadCountTotal) {
    failures.push(
      `persistence read count ${metrics.retrievalCost.persistenceReadCountTotal} exceeds ${thresholds.maxPersistenceReadCountTotal}`
    );
  }

  if (metrics.contextProcessing.semanticNodeCoverage < thresholds.semanticNodeCoverageMin) {
    failures.push(
      `semantic node coverage ${formatRatio(metrics.contextProcessing.semanticNodeCoverage)} is below ${formatRatio(thresholds.semanticNodeCoverageMin)}`
    );
  }

  if (metrics.contextProcessing.conceptCoverage < thresholds.conceptNormalizationCoverageMin) {
    failures.push(
      `concept normalization coverage ${formatRatio(metrics.contextProcessing.conceptCoverage)} is below ${formatRatio(thresholds.conceptNormalizationCoverageMin)}`
    );
  }

  if (metrics.contextProcessing.clauseSplitCoverage < thresholds.clauseSplitCoverageMin) {
    failures.push(
      `clause split coverage ${formatRatio(metrics.contextProcessing.clauseSplitCoverage)} is below ${formatRatio(thresholds.clauseSplitCoverageMin)}`
    );
  }

  if (metrics.contextProcessing.anchorCompleteness < thresholds.evidenceAnchorCompletenessMin) {
    failures.push(
      `evidence anchor completeness ${formatRatio(metrics.contextProcessing.anchorCompleteness)} is below ${formatRatio(thresholds.evidenceAnchorCompletenessMin)}`
    );
  }

  if (metrics.contextProcessing.experienceLearningCoverage < thresholds.experienceLearningCoverageMin) {
    failures.push(
      `experience learning coverage ${formatRatio(metrics.contextProcessing.experienceLearningCoverage)} is below ${formatRatio(thresholds.experienceLearningCoverageMin)}`
    );
  }

  return failures;
}

function resolveThresholds(fixture: EvaluationFixture, probeCount: number): EvaluationThresholds {
  return {
    relationPrecisionMin: 1,
    relationRecallMin: 1,
    relationNoiseMax: 0,
    memoryUsefulnessMin: 1,
    memoryIntrusionMax: 0,
    bundleRequiredCoverageMin: 1,
    bundleForbiddenIntrusionMax: 0,
    explainCompletenessMin: 1,
    maxBundleRelationEdgeLookups: 1,
    maxBundleRelationNodeLookups: 1,
    maxExplainSelectionEdgeLookupsTotal: probeCount,
    maxExplainSelectionNodeLookupsTotal: probeCount,
    maxExplainAdjacencyEdgeLookupsTotal: probeCount,
    maxExplainAdjacencyNodeLookupsTotal: probeCount,
    maxPersistenceReadCountTotal: probeCount * 3,
    semanticNodeCoverageMin: 1,
    conceptNormalizationCoverageMin: 1,
    clauseSplitCoverageMin: 1,
    evidenceAnchorCompletenessMin: 1,
    experienceLearningCoverageMin: 1,
    ...fixture.thresholds
  };
}

function collectBundleNodeIds(bundle: RuntimeContextBundle): string[] {
  const ids: string[] = [];

  if (bundle.goal) {
    ids.push(bundle.goal.nodeId);
  }

  if (bundle.intent) {
    ids.push(bundle.intent.nodeId);
  }

  if (bundle.currentProcess) {
    ids.push(bundle.currentProcess.nodeId);
  }

  for (const item of [
    ...bundle.activeRules,
    ...bundle.activeConstraints,
    ...bundle.openRisks,
    ...bundle.recentDecisions,
    ...bundle.recentStateChanges,
    ...bundle.relevantEvidence,
    ...bundle.candidateSkills
  ]) {
    ids.push(item.nodeId);
  }

  return dedupeIds(ids);
}

function hasPersistenceSurface(result: ExplainResult | undefined): boolean {
  if (!result?.trace?.persistence) {
    return false;
  }

  return (
    result.trace.persistence.persistedInCheckpoint ||
    result.trace.persistence.surfacedInDelta ||
    result.trace.persistence.surfacedInSkillCandidate
  );
}

function isCompleteExplainResult(result: ExplainResult | undefined): boolean {
  if (!result?.node || !result.governance || !result.trace || !result.retrieval) {
    return false;
  }

  return Boolean(
    result.summary.trim() &&
      result.trace.source.sourceStage &&
      typeof result.trace.selection.evaluated === 'boolean' &&
      typeof result.trace.output.promptReady === 'boolean'
  );
}

function computeCoverage(hitCount: number, totalCount: number): number {
  if (totalCount === 0) {
    return 1;
  }

  return hitCount / totalCount;
}

function sumBy<T>(items: T[], readValue: (item: T) => number): number {
  return items.reduce((total, item) => total + readValue(item), 0);
}

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function dedupeConceptIds(ids: CanonicalConceptId[]): CanonicalConceptId[] {
  return [...new Set(ids)];
}

function dedupeNodeTypes(types: NodeType[]): NodeType[] {
  return [...new Set(types)];
}

function formatRatio(value: number): string {
  return value.toFixed(2);
}

function formatRelationRetrieval(value: RelationRetrievalDiagnostics | undefined): string {
  if (!value) {
    return 'none';
  }

  return `${value.strategy}/edge:${value.edgeLookupCount}/node:${value.nodeLookupCount}/hop:${value.maxHopCount ?? 1}/path:${value.pathCount ?? 0}/candidate:${value.candidatePathCount ?? 0}/admitted:${value.admittedPathCount ?? 0}/pruned:${value.prunedPathCount ?? 0}`;
}
