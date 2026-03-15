import { createHash } from 'node:crypto';

import type {
  Attempt,
  AttemptStatus,
  ContextSelection,
  Episode,
  EpisodeStatus,
  FailureSignal,
  FailurePattern,
  FailureSignalSeverity,
  GraphEdge,
  GraphNode,
  JsonObject,
  KnowledgeKind,
  KnowledgeStrength,
  NodeType,
  Pattern,
  ProvenanceRef,
  ProcedureCandidate,
  Scope,
  SourceRef,
  SuccessfulProcedure,
  RuntimeContextBundle
} from '../types/core.js';
import { buildNodeGovernance } from '../governance/governance.js';
import { assessPromotedKnowledgeGovernance } from '../governance/knowledge-promotion.js';
import { buildEdgeGovernance, getDefaultEdgeConfidence } from '../governance/relation-contract.js';

export interface BundleExperienceLearningView {
  attempt: Attempt;
  episode: Episode;
  failureSignals: FailureSignal[];
  procedureCandidate?: ProcedureCandidate;
  pattern?: Pattern;
  failurePattern?: FailurePattern;
  successfulProcedure?: SuccessfulProcedure;
}

export interface ExperienceLearningGraphArtifacts {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function deriveExperienceLearning(bundle: RuntimeContextBundle): BundleExperienceLearningView {
  const failureSignals = deriveFailureSignals(bundle);
  const successSignals = deriveSuccessSignals(bundle, failureSignals);
  const status = resolveAttemptStatus(bundle, failureSignals);
  const criticalStepNodeIds = bundle.currentProcess ? [bundle.currentProcess.nodeId] : [];
  const criticalStepLabels = bundle.currentProcess ? [bundle.currentProcess.label] : [];
  const procedureCandidate =
    bundle.currentProcess && (status === 'success' || status === 'partial')
      ? buildProcedureCandidate(bundle, failureSignals, successSignals, criticalStepNodeIds)
      : undefined;

  const attempt: Attempt = {
    id: buildStableId('attempt', bundle.sessionId, bundle.id),
    sessionId: bundle.sessionId,
    bundleId: bundle.id,
    ...(readWorkspaceId(bundle) ? { workspaceId: readWorkspaceId(bundle) } : {}),
    ...(bundle.goal?.label ? { goalLabel: bundle.goal.label } : {}),
    query: bundle.query,
    status,
    stepNodeIds: bundle.currentProcess ? [bundle.currentProcess.nodeId] : [],
    decisionNodeIds: bundle.recentDecisions.map((item) => item.nodeId),
    stateNodeIds: bundle.recentStateChanges.map((item) => item.nodeId),
    outcomeNodeIds: bundle.recentStateChanges.filter((item) => item.type === 'Outcome').map((item) => item.nodeId),
    riskNodeIds: bundle.openRisks.map((item) => item.nodeId),
    evidenceNodeIds: bundle.relevantEvidence.map((item) => item.nodeId),
    failureSignals,
    successSignals,
    criticalStepNodeIds,
    criticalStepLabels,
    ...(procedureCandidate ? { procedureCandidate } : {}),
    provenance: {
      originKind: 'derived',
      sourceStage: 'runtime_bundle',
      producer: 'compact-context',
      sourceBundleId: bundle.id,
      derivedFromNodeIds: collectDerivedNodeIds(bundle)
    },
    createdAt: bundle.createdAt
  };

  const episode: Episode = {
    id: buildStableId(
      'episode',
      bundle.sessionId,
      bundle.goal?.label ?? 'goal:unspecified',
      bundle.query
    ),
    sessionId: bundle.sessionId,
    ...(readWorkspaceId(bundle) ? { workspaceId: readWorkspaceId(bundle) } : {}),
    ...(bundle.goal?.label ? { goalLabel: bundle.goal.label } : {}),
    query: bundle.query,
    attemptIds: [attempt.id],
    ...(status === 'success' ? { winningAttemptId: attempt.id } : {}),
    status: resolveEpisodeStatus(status),
    successPathStepNodeIds: procedureCandidate?.stepNodeIds ?? [],
    failedAttemptIds: status === 'failure' ? [attempt.id] : [],
    keyFailureSignalIds: failureSignals.map((signal) => signal.id),
    keySuccessSignals: successSignals,
    criticalStepNodeIds,
    provenance: {
      originKind: 'derived',
      sourceStage: 'runtime_bundle',
      producer: 'compact-context',
      sourceBundleId: bundle.id,
      derivedFromNodeIds: collectDerivedNodeIds(bundle)
    },
    createdAt: bundle.createdAt
  };

  const finalizedProcedureCandidate = procedureCandidate
    ? {
        ...procedureCandidate,
        episodeId: episode.id
      }
    : undefined;
  const pattern = buildPattern(bundle, attempt, episode, failureSignals, successSignals);
  const failurePattern =
    failureSignals.length > 0 ? buildFailurePattern(bundle, attempt, episode, failureSignals) : undefined;
  const successfulProcedure =
    finalizedProcedureCandidate && (attempt.status === 'success' || attempt.status === 'partial')
      ? buildSuccessfulProcedure(bundle, attempt, episode, finalizedProcedureCandidate)
      : undefined;

  return {
    attempt: {
      ...attempt,
      ...(finalizedProcedureCandidate ? { procedureCandidate: finalizedProcedureCandidate } : {})
    },
    episode,
    failureSignals,
    ...(finalizedProcedureCandidate ? { procedureCandidate: finalizedProcedureCandidate } : {}),
    pattern,
    ...(failurePattern ? { failurePattern } : {}),
    ...(successfulProcedure ? { successfulProcedure } : {})
  };
}

export function describeExperienceLearningSummary(view: BundleExperienceLearningView | undefined): string {
  if (!view) {
    return '';
  }

  const failureText =
    view.failureSignals.length > 0
      ? ` Failure signals: ${view.failureSignals.map((signal) => signal.label).join(' | ')}.`
      : '';
  const procedureText = view.procedureCandidate
    ? ` Procedure candidate: steps=${view.procedureCandidate.stepLabels.join(' -> ')}, prerequisites=${
        view.procedureCandidate.prerequisiteLabels.join(' | ') || 'none'
      }.`
    : '';
  const patternText = view.pattern
    ? ` Pattern: ${view.pattern.patternType}/${view.pattern.promotionState}.`
    : '';
  const failurePatternText = view.failurePattern
    ? ` Failure pattern: ${buildFailurePatternLabel(view.failurePattern)}.`
    : '';
  const successPatternText = view.successfulProcedure
    ? ` Successful procedure: ${view.successfulProcedure.stepLabels.join(' -> ')}.`
    : '';
  const criticalStepText =
    view.attempt.criticalStepLabels.length > 0
      ? ` Critical steps: ${view.attempt.criticalStepLabels.join(' | ')}.`
      : '';

  return (
    ` Experience: attempt=${view.attempt.status}, episode=${view.episode.status}.` +
    `${failureText}${procedureText}${patternText}${failurePatternText}${successPatternText}${criticalStepText}`
  );
}

export function describeNodeExperienceRoles(
  nodeId: string,
  view: BundleExperienceLearningView | undefined
): string[] {
  if (!view) {
    return [];
  }

  const roles = new Set<string>();

  if (view.attempt.stepNodeIds.includes(nodeId)) {
    roles.add('attempt_step');
  }

  if (view.attempt.criticalStepNodeIds.includes(nodeId)) {
    roles.add('critical_step');
  }

  if (view.attempt.evidenceNodeIds.includes(nodeId)) {
    roles.add('attempt_evidence');
  }

  if (view.failureSignals.some((signal) => signal.sourceNodeIds.includes(nodeId))) {
    roles.add('failure_signal_source');
  }

  if (view.procedureCandidate?.stepNodeIds.includes(nodeId)) {
    roles.add('procedure_step');
  }

  if (view.procedureCandidate?.prerequisiteNodeIds.includes(nodeId)) {
    roles.add('procedure_prerequisite');
  }

  if (view.failurePattern?.sourceNodeIds.includes(nodeId) || view.failurePattern?.blockedStepNodeIds.includes(nodeId)) {
    roles.add('failure_pattern_source');
  }

  if (view.successfulProcedure?.stepNodeIds.includes(nodeId)) {
    roles.add('successful_procedure_step');
  }

  if (view.successfulProcedure?.prerequisiteNodeIds.includes(nodeId)) {
    roles.add('successful_procedure_prerequisite');
  }

  return [...roles];
}

export function materializeExperienceLearningGraph(
  bundle: RuntimeContextBundle,
  view: BundleExperienceLearningView
): ExperienceLearningGraphArtifacts {
  const workspaceId = readWorkspaceId(bundle);
  const now = bundle.createdAt;
  const sourceRef = buildExperienceSourceRef(bundle);
  const baseProvenance = buildExperienceProvenance(bundle);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const attemptNode = createExperienceNode({
    id: view.attempt.id,
    type: 'Attempt',
    scope: 'session',
    kind: 'process',
    label: buildAttemptLabel(view.attempt, bundle),
    payload: {
      sessionId: bundle.sessionId,
      workspaceId: workspaceId ?? null,
      bundleId: bundle.id,
      query: bundle.query,
      status: view.attempt.status,
      goalLabel: view.attempt.goalLabel ?? null,
      stepNodeIds: view.attempt.stepNodeIds,
      decisionNodeIds: view.attempt.decisionNodeIds,
      stateNodeIds: view.attempt.stateNodeIds,
      outcomeNodeIds: view.attempt.outcomeNodeIds,
      riskNodeIds: view.attempt.riskNodeIds,
      evidenceNodeIds: view.attempt.evidenceNodeIds,
      criticalStepNodeIds: view.attempt.criticalStepNodeIds,
      criticalStepLabels: view.attempt.criticalStepLabels,
      failureSignalIds: view.failureSignals.map((signal) => signal.id),
      successSignals: view.attempt.successSignals
    },
    strength: 'soft',
    confidence: confidenceForAttemptStatus(view.attempt.status),
    freshness: 'active',
    validFrom: now,
    sourceRef,
    provenance: {
      ...baseProvenance,
      derivedFromNodeIds: dedupeStrings([
        ...(baseProvenance.derivedFromNodeIds ?? []),
        ...view.attempt.stepNodeIds,
        ...view.attempt.decisionNodeIds,
        ...view.attempt.stateNodeIds,
        ...view.attempt.riskNodeIds,
        ...view.attempt.evidenceNodeIds
      ])
    }
  });
  nodes.push(attemptNode);

  const episodeNode = createExperienceNode({
    id: view.episode.id,
    type: 'Episode',
    scope: 'session',
    kind: 'process',
    label: buildEpisodeLabel(view.episode, bundle),
    payload: {
      sessionId: bundle.sessionId,
      workspaceId: workspaceId ?? null,
      bundleId: bundle.id,
      query: bundle.query,
      status: view.episode.status,
      goalLabel: view.episode.goalLabel ?? null,
      attemptIds: view.episode.attemptIds,
      winningAttemptId: view.episode.winningAttemptId ?? null,
      successPathStepNodeIds: view.episode.successPathStepNodeIds,
      failedAttemptIds: view.episode.failedAttemptIds,
      keyFailureSignalIds: view.episode.keyFailureSignalIds,
      keySuccessSignals: view.episode.keySuccessSignals,
      criticalStepNodeIds: view.episode.criticalStepNodeIds
    },
    strength: 'soft',
    confidence: confidenceForEpisodeStatus(view.episode.status),
    freshness: 'active',
    validFrom: now,
    sourceRef,
    provenance: {
      ...baseProvenance,
      derivedFromNodeIds: dedupeStrings([
        ...(baseProvenance.derivedFromNodeIds ?? []),
        view.attempt.id,
        ...view.episode.successPathStepNodeIds
      ])
    }
  });
  nodes.push(episodeNode);

  for (const signal of view.failureSignals) {
    nodes.push(
      createExperienceNode({
        id: signal.id,
        type: 'FailureSignal',
        scope: 'session',
        kind: 'inference',
        label: `failure_signal:${signal.label}`,
        payload: {
          sessionId: bundle.sessionId,
          workspaceId: workspaceId ?? null,
          bundleId: bundle.id,
          signalType: signal.signalType,
          severity: signal.severity,
          reason: signal.reason,
          sourceNodeIds: signal.sourceNodeIds,
          label: signal.label
        },
        strength: 'heuristic',
        confidence: confidenceForFailureSignalSeverity(signal.severity),
        freshness: 'active',
        validFrom: now,
        sourceRef,
        provenance: {
          ...baseProvenance,
          derivedFromNodeIds: dedupeStrings([
            ...(baseProvenance.derivedFromNodeIds ?? []),
            ...signal.sourceNodeIds
          ])
        }
      })
    );
  }

  if (view.procedureCandidate) {
    nodes.push(
      createExperienceNode({
        id: view.procedureCandidate.id,
        type: 'ProcedureCandidate',
        scope: 'session',
        kind: 'process',
        label: buildProcedureCandidateLabel(view.procedureCandidate),
        payload: {
          sessionId: bundle.sessionId,
          workspaceId: workspaceId ?? null,
          bundleId: bundle.id,
          attemptId: view.procedureCandidate.attemptId,
          episodeId: view.procedureCandidate.episodeId ?? null,
          stepNodeIds: view.procedureCandidate.stepNodeIds,
          stepLabels: view.procedureCandidate.stepLabels,
          prerequisiteNodeIds: view.procedureCandidate.prerequisiteNodeIds,
          prerequisiteLabels: view.procedureCandidate.prerequisiteLabels,
          failureSignalIds: view.procedureCandidate.failureSignalIds,
          successSignals: view.procedureCandidate.successSignals,
          criticalStepNodeIds: view.procedureCandidate.criticalStepNodeIds,
          status: view.procedureCandidate.status
        },
        strength: 'soft',
        confidence: view.procedureCandidate.confidence,
        freshness: 'active',
        validFrom: now,
        sourceRef,
        provenance: {
          ...baseProvenance,
          derivedFromNodeIds: dedupeStrings([
            ...(baseProvenance.derivedFromNodeIds ?? []),
            ...view.procedureCandidate.stepNodeIds,
            ...view.procedureCandidate.prerequisiteNodeIds,
            ...view.procedureCandidate.failureSignalIds
          ])
        }
      })
    );
  }

  if (view.pattern) {
    const patternScope = resolvePromotedKnowledgeScope(
      createExperienceNode({
        id: view.pattern.id,
        type: 'Pattern',
        scope: workspaceId ? 'workspace' : 'session',
        kind: 'inference',
        label: buildPatternLabel(view.pattern),
        payload: {
          sessionId: bundle.sessionId,
          workspaceId: workspaceId ?? null,
          bundleId: bundle.id,
          sourceAttemptId: view.pattern.sourceAttemptId,
          sourceEpisodeId: view.pattern.sourceEpisodeId,
          goalLabel: view.pattern.goalLabel ?? null,
          query: view.pattern.query,
          sourceNodeIds: view.pattern.sourceNodeIds,
          evidenceNodeIds: view.pattern.evidenceNodeIds,
          observationCount: 1,
          downgradeCount: 0,
          decayState: 'fresh',
          patternTags: ['pattern', view.pattern.patternType],
          lastSourceBundleId: bundle.id,
          promotionState: view.pattern.promotionState,
          patternType: view.pattern.patternType,
          failureSignalIds: view.pattern.failureSignalIds,
          successSignals: view.pattern.successSignals
        },
        strength: 'soft',
        confidence: view.pattern.confidence,
        freshness: 'active',
        validFrom: now,
        sourceRef,
        provenance: view.pattern.provenance
      }),
      workspaceId
    );
    nodes.push(patternScope);
  }

  if (view.failurePattern) {
    const failurePatternNode = resolvePromotedKnowledgeScope(
      createExperienceNode({
        id: view.failurePattern.id,
        type: 'FailurePattern',
        scope: workspaceId ? 'workspace' : 'session',
        kind: 'inference',
        label: buildFailurePatternLabel(view.failurePattern),
        payload: {
          sessionId: bundle.sessionId,
          workspaceId: workspaceId ?? null,
          bundleId: bundle.id,
          sourceAttemptId: view.failurePattern.sourceAttemptId,
          sourceEpisodeId: view.failurePattern.sourceEpisodeId,
          goalLabel: view.failurePattern.goalLabel ?? null,
          query: view.failurePattern.query,
          sourceNodeIds: view.failurePattern.sourceNodeIds,
          evidenceNodeIds: view.failurePattern.evidenceNodeIds,
          observationCount: 1,
          downgradeCount: 0,
          decayState: 'fresh',
          patternTags: ['failure_pattern', 'failure'],
          lastSourceBundleId: bundle.id,
          promotionState: view.failurePattern.promotionState,
          failureSignalIds: view.failurePattern.failureSignalIds,
          riskNodeIds: view.failurePattern.riskNodeIds,
          riskLabels: bundle.openRisks.map((item) => item.label),
          blockedStepNodeIds: view.failurePattern.blockedStepNodeIds,
          blockedStepLabels: bundle.currentProcess ? [bundle.currentProcess.label] : []
        },
        strength: 'soft',
        confidence: view.failurePattern.confidence,
        freshness: 'active',
        validFrom: now,
        sourceRef,
        provenance: view.failurePattern.provenance
      }),
      workspaceId
    );
    nodes.push(failurePatternNode);
  }

  if (view.successfulProcedure) {
    const successfulProcedureNode = resolvePromotedKnowledgeScope(
      createExperienceNode({
        id: view.successfulProcedure.id,
        type: 'SuccessfulProcedure',
        scope: workspaceId ? 'workspace' : 'session',
        kind: 'process',
        label: buildSuccessfulProcedureLabel(view.successfulProcedure),
        payload: {
          sessionId: bundle.sessionId,
          workspaceId: workspaceId ?? null,
          bundleId: bundle.id,
          sourceAttemptId: view.successfulProcedure.sourceAttemptId,
          sourceEpisodeId: view.successfulProcedure.sourceEpisodeId,
          goalLabel: view.successfulProcedure.goalLabel ?? null,
          query: view.successfulProcedure.query,
          sourceNodeIds: view.successfulProcedure.sourceNodeIds,
          evidenceNodeIds: view.successfulProcedure.evidenceNodeIds,
          observationCount: 1,
          downgradeCount: 0,
          decayState: 'fresh',
          patternTags: ['successful_procedure', 'success'],
          lastSourceBundleId: bundle.id,
          promotionState: view.successfulProcedure.promotionState,
          stepNodeIds: view.successfulProcedure.stepNodeIds,
          stepLabels: view.successfulProcedure.stepLabels,
          prerequisiteNodeIds: view.successfulProcedure.prerequisiteNodeIds,
          prerequisiteLabels: view.successfulProcedure.prerequisiteLabels,
          criticalStepNodeIds: view.successfulProcedure.criticalStepNodeIds
        },
        strength: 'soft',
        confidence: view.successfulProcedure.confidence,
        freshness: 'active',
        validFrom: now,
        sourceRef,
        provenance: view.successfulProcedure.provenance
      }),
      workspaceId
    );
    nodes.push(successfulProcedureNode);
  }

  edges.push(createExperienceEdge(episodeNode.id, attemptNode.id, 'derived_from', bundle, sourceRef, now));

  for (const sourceNodeId of dedupeStrings([
    ...view.attempt.stepNodeIds,
    ...view.attempt.decisionNodeIds,
    ...view.attempt.stateNodeIds,
    ...view.attempt.outcomeNodeIds,
    ...view.attempt.riskNodeIds,
    ...view.attempt.evidenceNodeIds
  ])) {
    edges.push(createExperienceEdge(attemptNode.id, sourceNodeId, 'derived_from', bundle, sourceRef, now));
  }

  for (const signal of view.failureSignals) {
    edges.push(createExperienceEdge(attemptNode.id, signal.id, 'produces', bundle, sourceRef, now));

    for (const sourceNodeId of signal.sourceNodeIds) {
      edges.push(createExperienceEdge(signal.id, sourceNodeId, 'derived_from', bundle, sourceRef, now));
    }
  }

  if (view.procedureCandidate) {
    edges.push(createExperienceEdge(attemptNode.id, view.procedureCandidate.id, 'produces', bundle, sourceRef, now));

    for (const stepNodeId of view.procedureCandidate.stepNodeIds) {
      edges.push(createExperienceEdge(view.procedureCandidate.id, stepNodeId, 'derived_from', bundle, sourceRef, now));
    }

    for (const prerequisiteNodeId of view.procedureCandidate.prerequisiteNodeIds) {
      edges.push(createExperienceEdge(view.procedureCandidate.id, prerequisiteNodeId, 'requires', bundle, sourceRef, now));
    }
  }

  if (view.pattern) {
    const patternNode = nodes.find((node) => node.id === view.pattern?.id);
    const patternScope = patternNode?.scope ?? 'session';
    edges.push(createExperienceEdge(view.pattern.id, attemptNode.id, 'derived_from', bundle, sourceRef, now, patternScope));
    edges.push(createExperienceEdge(view.pattern.id, episodeNode.id, 'derived_from', bundle, sourceRef, now, patternScope));
  }

  if (view.failurePattern) {
    const failurePatternNode = nodes.find((node) => node.id === view.failurePattern?.id);
    const failurePatternScope = failurePatternNode?.scope ?? 'session';
    edges.push(createExperienceEdge(view.failurePattern.id, attemptNode.id, 'derived_from', bundle, sourceRef, now, failurePatternScope));
    for (const sourceNodeId of dedupeStrings(view.failurePattern.sourceNodeIds.concat(view.failurePattern.blockedStepNodeIds))) {
      edges.push(createExperienceEdge(view.failurePattern.id, sourceNodeId, 'derived_from', bundle, sourceRef, now, failurePatternScope));
    }
  }

  if (view.successfulProcedure) {
    const successfulProcedureNode = nodes.find((node) => node.id === view.successfulProcedure?.id);
    const successfulProcedureScope = successfulProcedureNode?.scope ?? 'session';
    edges.push(
      createExperienceEdge(view.successfulProcedure.id, attemptNode.id, 'derived_from', bundle, sourceRef, now, successfulProcedureScope)
    );
    for (const stepNodeId of view.successfulProcedure.stepNodeIds) {
      edges.push(createExperienceEdge(view.successfulProcedure.id, stepNodeId, 'derived_from', bundle, sourceRef, now, successfulProcedureScope));
    }
    for (const prerequisiteNodeId of view.successfulProcedure.prerequisiteNodeIds) {
      edges.push(createExperienceEdge(view.successfulProcedure.id, prerequisiteNodeId, 'requires', bundle, sourceRef, now, successfulProcedureScope));
    }
  }

  return {
    nodes,
    edges: dedupeGraphEdges(edges)
  };
}

function buildProcedureCandidate(
  bundle: RuntimeContextBundle,
  failureSignals: FailureSignal[],
  successSignals: string[],
  criticalStepNodeIds: string[]
): ProcedureCandidate {
  const currentStepId = bundle.currentProcess?.nodeId ?? 'unspecified-step';

  return {
    id: buildStableId('procedure-candidate', bundle.id, currentStepId),
    attemptId: buildStableId('attempt', bundle.sessionId, bundle.id),
    stepNodeIds: [currentStepId],
    stepLabels: bundle.currentProcess ? [bundle.currentProcess.label] : [],
    prerequisiteNodeIds: [
      ...bundle.activeRules.map((item) => item.nodeId),
      ...bundle.activeConstraints.map((item) => item.nodeId)
    ],
    prerequisiteLabels: [
      ...bundle.activeRules.map((item) => item.label),
      ...bundle.activeConstraints.map((item) => item.label)
    ],
    failureSignalIds: failureSignals.map((signal) => signal.id),
    successSignals,
    criticalStepNodeIds,
    confidence: resolveProcedureConfidence(bundle, failureSignals),
    status: failureSignals.length === 0 ? 'validated' : 'candidate'
  };
}

function deriveFailureSignals(bundle: RuntimeContextBundle): FailureSignal[] {
  const derived: FailureSignal[] = [];

  for (const risk of bundle.openRisks) {
    derived.push(
      createFailureSignal(
        risk,
        'risk',
        'high',
        `open risk remained active while compiling bundle "${bundle.id}"`
      )
    );
  }

  for (const state of bundle.recentStateChanges) {
    if (!looksLikeFailureState(state.label)) {
      continue;
    }

    derived.push(
      createFailureSignal(
        state,
        'state',
        'medium',
        `recent state change suggests the current task path is still unstable for bundle "${bundle.id}"`
      )
    );
  }

  for (const decision of bundle.recentDecisions) {
    if (!looksLikeFailureState(decision.label)) {
      continue;
    }

    derived.push(
      createFailureSignal(
        decision,
        'decision',
        'medium',
        `recent decision suggests the current path was rejected or rolled back in bundle "${bundle.id}"`
      )
    );
  }

  return dedupeFailureSignals(derived);
}

function deriveSuccessSignals(bundle: RuntimeContextBundle, failureSignals: readonly FailureSignal[]): string[] {
  const signals: string[] = [];

  if (bundle.currentProcess) {
    signals.push(`current_process:${bundle.currentProcess.nodeId}`);
  }

  if (bundle.goal) {
    signals.push(`goal:${bundle.goal.nodeId}`);
  }

  if (bundle.openRisks.length === 0 && bundle.currentProcess) {
    signals.push('bundle:no_open_risks');
    signals.push(`procedure_ready:${bundle.currentProcess.nodeId}`);
  }

  if (failureSignals.length === 0 && bundle.recentStateChanges.length > 0) {
    signals.push('bundle:state_progress_visible');
  }

  return [...new Set(signals)];
}

function resolveAttemptStatus(bundle: RuntimeContextBundle, failureSignals: readonly FailureSignal[]): AttemptStatus {
  if (failureSignals.length === 0 && bundle.currentProcess) {
    return 'success';
  }

  if (failureSignals.length > 0 && bundle.currentProcess) {
    return 'partial';
  }

  if (failureSignals.length > 0) {
    return 'failure';
  }

  return 'running';
}

function resolveEpisodeStatus(attemptStatus: AttemptStatus): EpisodeStatus {
  switch (attemptStatus) {
    case 'success':
      return 'resolved';
    case 'failure':
      return 'abandoned';
    case 'partial':
    case 'running':
    default:
      return 'open';
  }
}

function resolveProcedureConfidence(
  bundle: RuntimeContextBundle,
  failureSignals: readonly FailureSignal[]
): number {
  const confidence = 0.55 + (bundle.activeRules.length > 0 ? 0.15 : 0) + (bundle.activeConstraints.length > 0 ? 0.1 : 0);
  const penalty = Math.min(0.3, failureSignals.length * 0.08);
  return clamp01(confidence - penalty);
}

function collectDerivedNodeIds(bundle: RuntimeContextBundle): string[] {
  return [
    bundle.goal?.nodeId,
    bundle.intent?.nodeId,
    bundle.currentProcess?.nodeId,
    ...bundle.activeRules.map((item) => item.nodeId),
    ...bundle.activeConstraints.map((item) => item.nodeId),
    ...bundle.openRisks.map((item) => item.nodeId),
    ...bundle.recentDecisions.map((item) => item.nodeId),
    ...bundle.recentStateChanges.map((item) => item.nodeId),
    ...bundle.relevantEvidence.map((item) => item.nodeId)
  ].filter((value): value is string => Boolean(value));
}

function createFailureSignal(
  selection: ContextSelection,
  signalType: FailureSignal['signalType'],
  severity: FailureSignalSeverity,
  reason: string
): FailureSignal {
  return {
    id: buildStableId('failure-signal', selection.nodeId, signalType),
    label: selection.label,
    sourceNodeIds: [selection.nodeId],
    severity,
    reason,
    signalType
  };
}

function looksLikeFailureState(label: string): boolean {
  return /\b(fail|failure|blocked|timeout|error|exception|rollback|conflict)\b|失败|阻塞|超时|错误|异常|回滚|冲突/u.test(
    label.toLowerCase()
  );
}

function dedupeFailureSignals(signals: FailureSignal[]): FailureSignal[] {
  const byId = new Map<string, FailureSignal>();

  for (const signal of signals) {
    byId.set(signal.id, signal);
  }

  return [...byId.values()];
}

function buildPattern(
  bundle: RuntimeContextBundle,
  attempt: Attempt,
  episode: Episode,
  failureSignals: readonly FailureSignal[],
  successSignals: readonly string[]
): Pattern {
  const patternType: Pattern['patternType'] =
    failureSignals.length > 0 && successSignals.length > 0
      ? 'mixed'
      : failureSignals.length > 0
        ? 'failure'
        : 'success';

  return {
    id: buildStableId(
      'pattern',
      readWorkspaceId(bundle) ?? bundle.sessionId,
      bundle.goal?.label ?? bundle.query,
      bundle.currentProcess?.label ?? 'no-process',
      patternType
    ),
    sourceAttemptId: attempt.id,
    sourceEpisodeId: episode.id,
    ...(bundle.goal?.label ? { goalLabel: bundle.goal.label } : {}),
    query: bundle.query,
    sourceNodeIds: dedupeStrings(collectDerivedNodeIds(bundle)),
    evidenceNodeIds: bundle.relevantEvidence.map((item) => item.nodeId),
    promotionState: 'candidate',
    confidence: clamp01(0.62 + successSignals.length * 0.04 - failureSignals.length * 0.03),
    provenance: {
      originKind: 'derived',
      sourceStage: 'runtime_bundle',
      producer: 'compact-context',
      sourceBundleId: bundle.id,
      derivedFromNodeIds: collectDerivedNodeIds(bundle)
    },
    createdAt: bundle.createdAt,
    kind: 'pattern',
    patternType,
    failureSignalIds: failureSignals.map((signal) => signal.id),
    successSignals: [...successSignals]
  };
}

function buildFailurePattern(
  bundle: RuntimeContextBundle,
  attempt: Attempt,
  episode: Episode,
  failureSignals: readonly FailureSignal[]
): FailurePattern {
  const blockedStepNodeIds = bundle.currentProcess ? [bundle.currentProcess.nodeId] : [];

  return {
    id: buildStableId(
      'failure-pattern',
      readWorkspaceId(bundle) ?? bundle.sessionId,
      bundle.goal?.label ?? bundle.query,
      blockedStepNodeIds[0] ?? 'no-step',
      ...failureSignals.map((signal) => signal.id)
    ),
    sourceAttemptId: attempt.id,
    sourceEpisodeId: episode.id,
    ...(bundle.goal?.label ? { goalLabel: bundle.goal.label } : {}),
    query: bundle.query,
    sourceNodeIds: dedupeStrings(
      failureSignals.flatMap((signal) => signal.sourceNodeIds).concat(blockedStepNodeIds, collectDerivedNodeIds(bundle))
    ),
    evidenceNodeIds: bundle.relevantEvidence.map((item) => item.nodeId),
    promotionState: 'candidate',
    confidence: clamp01(0.68 + failureSignals.length * 0.05),
    provenance: {
      originKind: 'derived',
      sourceStage: 'runtime_bundle',
      producer: 'compact-context',
      sourceBundleId: bundle.id,
      derivedFromNodeIds: collectDerivedNodeIds(bundle)
    },
    createdAt: bundle.createdAt,
    kind: 'failure_pattern',
    failureSignalIds: failureSignals.map((signal) => signal.id),
    riskNodeIds: bundle.openRisks.map((item) => item.nodeId),
    blockedStepNodeIds
  };
}

function buildSuccessfulProcedure(
  bundle: RuntimeContextBundle,
  attempt: Attempt,
  episode: Episode,
  procedureCandidate: ProcedureCandidate
): SuccessfulProcedure {
  return {
    id: buildStableId(
      'successful-procedure',
      readWorkspaceId(bundle) ?? bundle.sessionId,
      bundle.goal?.label ?? bundle.query,
      ...procedureCandidate.stepNodeIds,
      ...procedureCandidate.prerequisiteNodeIds
    ),
    sourceAttemptId: attempt.id,
    sourceEpisodeId: episode.id,
    ...(bundle.goal?.label ? { goalLabel: bundle.goal.label } : {}),
    query: bundle.query,
    sourceNodeIds: dedupeStrings(
      procedureCandidate.stepNodeIds.concat(procedureCandidate.prerequisiteNodeIds, collectDerivedNodeIds(bundle))
    ),
    evidenceNodeIds: bundle.relevantEvidence.map((item) => item.nodeId),
    promotionState: procedureCandidate.status === 'validated' ? 'reinforced' : 'candidate',
    confidence: clamp01(Math.max(0.72, procedureCandidate.confidence)),
    provenance: {
      originKind: 'derived',
      sourceStage: 'runtime_bundle',
      producer: 'compact-context',
      sourceBundleId: bundle.id,
      derivedFromNodeIds: collectDerivedNodeIds(bundle)
    },
    createdAt: bundle.createdAt,
    kind: 'successful_procedure',
    stepNodeIds: procedureCandidate.stepNodeIds,
    stepLabels: procedureCandidate.stepLabels,
    prerequisiteNodeIds: procedureCandidate.prerequisiteNodeIds,
    prerequisiteLabels: procedureCandidate.prerequisiteLabels,
    criticalStepNodeIds: procedureCandidate.criticalStepNodeIds
  };
}

function readWorkspaceId(bundle: RuntimeContextBundle): string | undefined {
  return bundle.workspaceId;
}

function buildStableId(prefix: string, ...parts: string[]): string {
  return `${prefix}:${createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16)}`;
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function createExperienceNode(input: {
  id: string;
  type: NodeType;
  scope: Scope;
  kind: KnowledgeKind;
  label: string;
  payload: JsonObject;
  strength: KnowledgeStrength;
  confidence: number;
  freshness: 'active';
  validFrom: string;
  sourceRef?: SourceRef;
  provenance: ProvenanceRef;
}): GraphNode {
  const governance = buildNodeGovernance({
    type: input.type,
    scope: input.scope,
    strength: input.strength,
    confidence: input.confidence,
    freshness: input.freshness,
    validFrom: input.validFrom,
    provenance: input.provenance,
    sourceType: 'experience_trace',
    workspaceId: typeof input.payload.workspaceId === 'string' ? input.payload.workspaceId : undefined
  });

  return {
    id: input.id,
    type: input.type,
    scope: input.scope,
    kind: input.kind,
    label: input.label,
    payload: input.payload,
    strength: input.strength,
    confidence: input.confidence,
    sourceRef: input.sourceRef,
    provenance: input.provenance,
    governance,
    version: 'v1',
    freshness: input.freshness,
    validFrom: input.validFrom,
    updatedAt: input.validFrom
  };
}

function resolvePromotedKnowledgeScope(node: GraphNode, workspaceId: string | undefined): GraphNode {
  if (!workspaceId || (node.type !== 'Pattern' && node.type !== 'FailurePattern' && node.type !== 'SuccessfulProcedure')) {
    return node;
  }

  const governance = assessPromotedKnowledgeGovernance(node);

  if (governance?.workspaceEligible) {
    return node;
  }

  return {
    ...node,
    scope: 'session',
    governance: undefined
  };
}

function createExperienceEdge(
  fromId: string,
  toId: string,
  type: GraphEdge['type'],
  bundle: RuntimeContextBundle,
  sourceRef: SourceRef | undefined,
  now: string,
  scope: Scope = 'session'
): GraphEdge {
  return {
    id: buildEdgeId(type, fromId, toId),
    fromId,
    toId,
    type,
    scope,
    strength: 'soft',
    confidence: getDefaultEdgeConfidence(type),
    payload: {
      sessionId: bundle.sessionId,
      workspaceId: bundle.workspaceId ?? null,
      bundleId: bundle.id
    },
    sourceRef,
    governance: buildEdgeGovernance(type),
    version: 'v1',
    validFrom: now,
    updatedAt: now
  };
}

function buildExperienceSourceRef(bundle: RuntimeContextBundle): SourceRef {
  return {
    sourceType: 'experience_trace',
    sourceSpan: bundle.id,
    contentHash: createHash('sha256').update(bundle.id).digest('hex'),
    extractor: 'experience-learning'
  };
}

function buildExperienceProvenance(bundle: RuntimeContextBundle): ProvenanceRef {
  return {
    originKind: 'derived',
    sourceStage: 'runtime_bundle',
    producer: 'compact-context',
    sourceBundleId: bundle.id,
    derivedFromNodeIds: collectDerivedNodeIds(bundle)
  };
}

function buildAttemptLabel(attempt: Attempt, bundle: RuntimeContextBundle): string {
  return `attempt:${attempt.status}:${buildExperienceLabelSuffix(attempt.goalLabel ?? bundle.query)}`;
}

function buildEpisodeLabel(episode: Episode, bundle: RuntimeContextBundle): string {
  return `episode:${episode.status}:${buildExperienceLabelSuffix(episode.goalLabel ?? bundle.query)}`;
}

function buildProcedureCandidateLabel(candidate: ProcedureCandidate): string {
  return `procedure_candidate:${buildExperienceLabelSuffix(candidate.stepLabels[0] ?? candidate.stepNodeIds[0] ?? 'candidate')}`;
}

function buildPatternLabel(pattern: Pattern): string {
  return `pattern:${pattern.patternType}:${buildExperienceLabelSuffix(pattern.goalLabel ?? pattern.query)}`;
}

function buildFailurePatternLabel(pattern: FailurePattern): string {
  return `failure_pattern:${buildExperienceLabelSuffix(pattern.goalLabel ?? pattern.query)}`;
}

function buildSuccessfulProcedureLabel(pattern: SuccessfulProcedure): string {
  return `successful_procedure:${buildExperienceLabelSuffix(pattern.stepLabels[0] ?? pattern.query)}`;
}

function buildExperienceLabelSuffix(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().slice(0, 96) || 'empty';
}

function buildEdgeId(type: GraphEdge['type'], fromId: string, toId: string): string {
  return `edge:${createHash('sha256').update([type, fromId, toId].join('|')).digest('hex').slice(0, 24)}`;
}

function confidenceForAttemptStatus(status: AttemptStatus): number {
  switch (status) {
    case 'success':
      return 0.9;
    case 'partial':
      return 0.76;
    case 'failure':
      return 0.82;
    case 'running':
    default:
      return 0.68;
  }
}

function confidenceForEpisodeStatus(status: EpisodeStatus): number {
  switch (status) {
    case 'resolved':
      return 0.88;
    case 'abandoned':
      return 0.74;
    case 'open':
    default:
      return 0.7;
  }
}

function confidenceForFailureSignalSeverity(severity: FailureSignalSeverity): number {
  switch (severity) {
    case 'high':
      return 0.9;
    case 'medium':
      return 0.82;
    case 'low':
    default:
      return 0.7;
  }
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function dedupeGraphEdges(edges: GraphEdge[]): GraphEdge[] {
  const byId = new Map<string, GraphEdge>();

  for (const edge of edges) {
    byId.set(edge.id, edge);
  }

  return [...byId.values()];
}
