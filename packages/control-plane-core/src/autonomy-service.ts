import { randomUUID } from 'node:crypto';

import type {
  AutonomyRecommendation,
  AutonomyRecommendationBundle,
  AutonomyServiceContract,
  AutonomySimulationMetricDelta,
  AutonomySimulationResult,
  GovernanceProposal,
  ImportJob,
  ObservabilityDashboardSnapshot,
  ObservabilityThresholdRecord
} from './contracts.js';

export class AutonomyService implements AutonomyServiceContract {
  buildRecommendations(input: {
    stage?: string;
    snapshots: readonly ObservabilityDashboardSnapshot[];
    importJobs: readonly ImportJob[];
    proposals: readonly GovernanceProposal[];
    thresholds?: ObservabilityThresholdRecord;
  }): AutonomyRecommendationBundle {
    const latestSnapshot = [...input.snapshots].sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0];
    const recommendations: AutonomyRecommendation[] = [];
    const failedJobs = input.importJobs.filter((job) => job.status === 'failed' || Boolean(job.deadLetteredAt));
    const pendingProposals = input.proposals.filter((proposal) => proposal.status === 'pending');
    const globalProposals = input.proposals.filter((proposal) => proposal.targetScope === 'global');

    if (latestSnapshot?.dashboard.alerts.some((alert) => alert.key === 'runtime_transcript_fallback_ratio')) {
      recommendations.push(
        buildRecommendation({
          classification: 'threshold_tuning',
          severity: 'warning',
          title: 'Tighten live runtime coverage before relaxing transcript fallback thresholds',
          rationale:
            'Recent snapshots continue to surface transcript fallback alerts, which means the live runtime truth source is still incomplete.',
          proposedChange:
            'Keep the current threshold for now, but add a session-level fallback allowlist and a live snapshot write audit.',
          expectedImpact: 'Reduce false positives while restoring live runtime coverage.',
          requiresHumanReview: true,
          stage: input.stage
        })
      );
    }

    if (failedJobs.length > 0) {
      recommendations.push(
        buildRecommendation({
          classification: 'import_strategy',
          severity: failedJobs.some((job) => job.deadLetteredAt) ? 'critical' : 'warning',
          title: 'Add source-specific normalize and repair strategies for failing importers',
          rationale: `There are currently ${failedJobs.length} failed or dead-letter import jobs.`,
          proposedChange:
            'Prioritize parser and normalizer fixes for the failing source kinds, and reduce retry amplification for noisy jobs.',
          expectedImpact: 'Lower repeated failures and improve multi-source import stability.',
          requiresHumanReview: true,
          stage: input.stage
        })
      );
    }

    if (latestSnapshot?.dashboard.metricCards.some((card) => card.key === 'recall_noise_rate' && card.status !== 'healthy')) {
      recommendations.push(
        buildRecommendation({
          classification: 'recall_strategy',
          severity: 'warning',
          title: 'Tighten recall path and candidate-path admission',
          rationale:
            'Recall noise rate is no longer healthy, which suggests the current recall paths or admissions are expanding too much noise.',
          proposedChange:
            'Increase pruning weight first, then add stricter admission limits for topic-only and low-confidence evidence.',
          expectedImpact: 'Reduce prompt noise and improve explainability.',
          requiresHumanReview: false,
          stage: input.stage
        })
      );
    }

    if (pendingProposals.length > 3 || globalProposals.length > 2) {
      recommendations.push(
        buildRecommendation({
          classification: 'promotion_strategy',
          severity: 'warning',
          title: 'Introduce a stronger review lane for global and workspace promotion',
          rationale: `Current pending proposals=${pendingProposals.length}, global proposals=${globalProposals.length}.`,
          proposedChange:
            'Add a global merge queue and require pollution-recovery simulation before batch approval.',
          expectedImpact: 'Reduce knowledge pollution and cross-workspace blast radius.',
          requiresHumanReview: true,
          stage: input.stage
        })
      );
    }

    if (input.thresholds && latestSnapshot?.dashboard.alerts.length === 0) {
      recommendations.push(
        buildRecommendation({
          classification: 'low_risk_automation',
          severity: 'info',
          title: 'Enable low-risk automation suggestions for threshold tuning',
          rationale:
            'The dashboard is currently healthy, so part of the low-risk threshold tuning can move into auto-suggest mode.',
          proposedChange:
            'Only auto-suggest tuning for warning-or-lower changes and still require explicit human confirmation.',
          expectedImpact: 'Reduce operator burden without breaking governance boundaries.',
          requiresHumanReview: false,
          stage: input.stage
        })
      );
    }

    return {
      generatedAt: new Date().toISOString(),
      recommendationCount: recommendations.length,
      basedOn: {
        snapshotCount: input.snapshots.length,
        importJobCount: input.importJobs.length,
        proposalCount: input.proposals.length
      },
      ...(input.stage ? { stage: input.stage } : {}),
      recommendations
    };
  }

  simulateRecommendations(input: { recommendations: readonly AutonomyRecommendation[] }): AutonomySimulationResult {
    const projectedMetricDeltas: AutonomySimulationMetricDelta[] = [];

    for (const recommendation of input.recommendations) {
      switch (recommendation.classification) {
        case 'threshold_tuning':
          projectedMetricDeltas.push({
            key: 'runtime_transcript_fallback_ratio',
            delta: -0.08,
            direction: 'improve'
          });
          break;
        case 'import_strategy':
          projectedMetricDeltas.push({
            key: 'multi_source_coverage',
            delta: 0.12,
            direction: 'improve'
          });
          break;
        case 'recall_strategy':
          projectedMetricDeltas.push({
            key: 'recall_noise_rate',
            delta: -0.05,
            direction: 'improve'
          });
          break;
        case 'promotion_strategy':
          projectedMetricDeltas.push({
            key: 'promotion_quality',
            delta: 0.07,
            direction: 'improve'
          });
          projectedMetricDeltas.push({
            key: 'knowledge_pollution_rate',
            delta: -0.03,
            direction: 'improve'
          });
          break;
        case 'low_risk_automation':
          projectedMetricDeltas.push({
            key: 'high_scope_reuse_intrusion',
            delta: -0.01,
            direction: 'improve'
          });
          break;
      }
    }

    const requiresHumanReview = input.recommendations.some((item) => item.requiresHumanReview);
    const criticalCount = input.recommendations.filter((item) => item.severity === 'critical').length;
    const riskLevel =
      criticalCount > 0 ? 'high' : requiresHumanReview || input.recommendations.length > 3 ? 'medium' : 'low';

    return {
      generatedAt: new Date().toISOString(),
      recommendationIds: input.recommendations.map((item) => item.id),
      projectedMetricDeltas,
      riskLevel,
      summary: `Simulated ${input.recommendations.length} recommendations with projected improvements across recall, import, and promotion metrics while keeping human governance in the loop.`,
      requiresHumanReview
    };
  }
}

function buildRecommendation(input: Omit<AutonomyRecommendation, 'id'>): AutonomyRecommendation {
  return {
    id: `autonomy_${randomUUID()}`,
    ...input
  };
}
