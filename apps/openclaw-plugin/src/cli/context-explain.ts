import { randomUUID } from 'node:crypto';

import {
  type BundleRecalledNodeView,
  collectBundleRecalledNodes,
  ContextEngine,
  buildBundleContractSnapshot,
  buildContextSummaryContract,
  type CompressionDiagnostics,
  type ContextCompressionMode,
  ExplainResult,
  RawContextInput,
  RawContextRecord,
  RuntimeContextBundle,
  type SessionCompressionRawTailTurn,
  type SessionCompressionState
} from '@openclaw-compact-context/compact-context-core';

import {
  summarizeText,
  type SummaryDependencies,
  type SummaryMode,
  type SummaryResult
} from './context-summary.js';

export interface ExplainInput {
  text: string;
  query?: string;
  instruction?: string;
  mode?: SummaryMode;
  providerId?: string;
  modelRef?: string;
  configFilePath?: string;
  sessionId?: string;
  workspaceId?: string;
  tokenBudget?: number;
  limit?: number;
  nodeId?: string;
}

export interface ExplainDependencies extends SummaryDependencies {
  createEngine?: () => ContextEngine;
}

export interface ExplainCommandResult {
  sessionId: string;
  workspaceId?: string;
  query: string;
  tokenBudget: number;
  inputText: string;
  note: string;
  summary: SummaryResult;
  compile: {
    bundle: RuntimeContextBundle;
    summaryContract: ReturnType<typeof buildContextSummaryContract>;
    bundleContract: ReturnType<typeof buildBundleContractSnapshot>;
    selectedNodeIds: string[];
    selectedNodeLabels: string[];
    recalledNodes: BundleRecalledNodeView[];
    recalledNodeIds: string[];
    recalledNodeLabels: string[];
    compaction?: {
      mode: ContextCompressionMode;
      reason?: string;
      baselineId?: string;
      baselineIds?: string[];
      rawTailStartMessageId?: string;
      retainedRawTurnCount: number;
      retainedRawTurns: Array<{
        turnId: string;
        messageIds: string[];
      }>;
      diagnostics?: CompressionDiagnostics;
    };
  };
  explain: {
    requestedNodeId?: string;
    limit: number;
    explainedNodeIds: string[];
    explanations: ExplainResult[];
  };
}

export async function runExplain(
  input: ExplainInput,
  dependencies: ExplainDependencies = {}
): Promise<ExplainCommandResult> {
  const sessionId = input.sessionId?.trim() || `cli-${randomUUID()}`;
  const query = input.query?.trim() || input.text.trim();
  const tokenBudget = input.tokenBudget ?? 1200;
  const limit = normalizeExplainLimit(input.limit);
  const summary = await summarizeText(
    {
      text: input.text,
      instruction: input.instruction,
      mode: input.mode,
      ...(input.providerId ? { providerId: input.providerId } : {}),
      ...(input.modelRef ? { modelRef: input.modelRef } : {}),
      ...(input.configFilePath ? { configFilePath: input.configFilePath } : {})
    },
    dependencies
  );
  const engine = dependencies.createEngine?.() ?? new ContextEngine();
  const shouldCloseEngine = !dependencies.createEngine;
  const rawInput = buildExplainInput({
    sessionId,
    workspaceId: input.workspaceId,
    text: input.text
  });

  try {
    await engine.ingest(rawInput);
    const bundle = await engine.compileContext({
      sessionId,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      query,
      tokenBudget
    });
    const summaryContract = buildContextSummaryContract(bundle);
    const bundleContract = buildBundleContractSnapshot(bundle);
    const selectedNodeIds = collectBundleNodeIds(bundle);
    const selectedNodeLabels = collectBundleSelections(bundle).map((item) => `${item.type}:${item.label}`);
    const recalledNodes = collectBundleRecalledNodes(bundle);
    const compressionState = await engine.getCompressionState(sessionId);
    const targetNodeIds = resolveExplainTargetNodeIds({
      requestedNodeId: input.nodeId?.trim(),
      selectedNodeIds,
      limit
    });
    const explanations = await Promise.all(
      targetNodeIds.map((nodeId) =>
        engine.explain({
          nodeId,
          selectionContext: {
            sessionId,
            ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
            query,
            tokenBudget
          }
        })
      )
    );

    return {
      sessionId,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      query,
      tokenBudget,
      inputText: input.text,
      note: '当前 explain 会先 ingest 原文并 compile 当前 bundle，再对选中的节点执行 engine.explain；summary 结果仅用于并排观察 code / codex 的摘要差异。',
      summary,
      compile: {
        bundle,
        summaryContract,
        bundleContract,
        selectedNodeIds,
        selectedNodeLabels,
        recalledNodes,
        recalledNodeIds: recalledNodes.map((item) => item.nodeId),
        recalledNodeLabels: recalledNodes.map((item) => `${item.type}:${item.label}`),
        ...(compressionState
          ? {
              compaction: buildExplainCompactionPayload(compressionState)
            }
          : {})
      },
      explain: {
        ...(input.nodeId?.trim() ? { requestedNodeId: input.nodeId.trim() } : {}),
        limit,
        explainedNodeIds: targetNodeIds,
        explanations
      }
    };
  } finally {
    if (shouldCloseEngine) {
      await engine.close();
    }
  }
}

function buildExplainCompactionPayload(state: SessionCompressionState): {
  mode: ContextCompressionMode;
  reason?: string;
  baselineId?: string;
  baselineIds?: string[];
  rawTailStartMessageId?: string;
  retainedRawTurnCount: number;
  retainedRawTurns: Array<{
    turnId: string;
    messageIds: string[];
  }>;
  diagnostics?: CompressionDiagnostics;
} {
  const baselineIds = getCompressionBaselineIds(state);
  const latestBaselineId = baselineIds.length ? baselineIds[baselineIds.length - 1] : undefined;

  return {
    mode: state.compressionMode,
    ...(resolveExplainCompressionReason(state.compressionMode)
      ? { reason: resolveExplainCompressionReason(state.compressionMode) }
      : {}),
    ...(latestBaselineId ? { baselineId: latestBaselineId } : {}),
    ...(baselineIds.length > 0 ? { baselineIds } : {}),
    ...(state.rawTailStartMessageId ? { rawTailStartMessageId: state.rawTailStartMessageId } : {}),
    retainedRawTurnCount: state.rawTail.turnCount,
    retainedRawTurns: state.rawTail.turns.map((turn: SessionCompressionRawTailTurn) => ({
      turnId: turn.turnId,
      messageIds: [...turn.messageIds]
    })),
    ...(state.compressionDiagnostics
      ? {
          diagnostics: cloneCompressionDiagnostics(state.compressionDiagnostics)
        }
      : {})
  };
}

function resolveExplainCompressionReason(mode: ContextCompressionMode): string | undefined {
  if (mode === 'full') {
    return 'budget_over_50_percent';
  }

  if (mode === 'incremental') {
    return 'history_before_recent_raw_tail';
  }

  return 'within_recent_raw_tail_window';
}

function getCompressionBaselineIds(state: SessionCompressionState): string[] {
  const legacyBaseline = readLegacyCompressionBaseline(state);
  const baselines = state.baselines?.length
    ? state.baselines
    : legacyBaseline
      ? [legacyBaseline]
      : [];
  return baselines.map((baseline) => baseline.baselineId);
}

function cloneCompressionDiagnostics(
  diagnostics: CompressionDiagnostics
): CompressionDiagnostics {
  return {
    ...diagnostics,
    ...(diagnostics.mergedBaselineIds ? { mergedBaselineIds: [...diagnostics.mergedBaselineIds] } : {})
  };
}

function readLegacyCompressionBaseline(state: SessionCompressionState) {
  const legacyState = state as SessionCompressionState & {
    baseline?: {
      baselineId: string;
    };
  };
  return legacyState.baseline;
}

function buildExplainInput(input: {
  sessionId: string;
  workspaceId?: string;
  text: string;
}): RawContextInput {
  const record: RawContextRecord = {
    scope: 'session',
    sourceType: 'conversation',
    role: 'user',
    content: input.text.trim(),
    metadata: {
      route: 'openclaw-context-cli:explain'
    }
  };

  return {
    sessionId: input.sessionId,
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    records: [record]
  };
}

function resolveExplainTargetNodeIds(input: {
  requestedNodeId?: string;
  selectedNodeIds: string[];
  limit: number;
}): string[] {
  if (input.requestedNodeId) {
    return [input.requestedNodeId];
  }

  return input.selectedNodeIds.slice(0, input.limit);
}

function normalizeExplainLimit(value: number | undefined): number {
  if (!value || !Number.isInteger(value) || value <= 0) {
    return 3;
  }

  return Math.min(value, 10);
}

function collectBundleSelections(bundle: RuntimeContextBundle) {
  return [
    ...(bundle.goal ? [bundle.goal] : []),
    ...(bundle.intent ? [bundle.intent] : []),
    ...bundle.activeRules,
    ...bundle.activeConstraints,
    ...(bundle.currentProcess ? [bundle.currentProcess] : []),
    ...bundle.recentDecisions,
    ...bundle.recentStateChanges,
    ...bundle.relevantEvidence,
    ...bundle.candidateSkills,
    ...bundle.openRisks
  ];
}

function collectBundleNodeIds(bundle: RuntimeContextBundle): string[] {
  return [...new Set(collectBundleSelections(bundle).map((item) => item.nodeId))];
}
