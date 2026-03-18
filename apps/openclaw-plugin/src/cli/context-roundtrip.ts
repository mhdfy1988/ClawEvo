import { randomUUID } from 'node:crypto';

import {
  ContextEngine,
  buildBundleContractSnapshot,
  buildContextSummaryContract,
  BundleContractSnapshot,
  ContextSelection,
  ContextSummaryContract,
  RawContextInput,
  RawContextRecord,
  RuntimeContextBundle
} from '@openclaw-compact-context/compact-context-core';

import {
  summarizeText,
  type SummaryDependencies,
  type SummarizeTextInput,
  type SummaryMode,
  type SummaryResult
} from './context-summary.js';

export interface RoundtripInput {
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
}

export interface RoundtripDependencies extends SummaryDependencies {
  createEngine?: () => ContextEngine;
}

export interface RoundtripResult {
  sessionId: string;
  workspaceId?: string;
  query: string;
  tokenBudget: number;
  inputText: string;
  ingestText: string;
  note: string;
  summary: SummaryResult;
  ingest: {
    recordCount: number;
    candidateNodeCount: number;
    candidateEdgeCount: number;
    persistedNodeCount: number;
    persistedEdgeCount: number;
    warnings: string[];
    candidateNodeLabels: string[];
  };
  compile: {
    bundle: RuntimeContextBundle;
    summaryContract: ContextSummaryContract;
    bundleContract: BundleContractSnapshot;
    includedNodeIds: string[];
    selectedNodeLabels: string[];
  };
}

export async function runRoundtrip(
  input: RoundtripInput,
  dependencies: RoundtripDependencies = {}
): Promise<RoundtripResult> {
  const sessionId = input.sessionId?.trim() || `cli-${randomUUID()}`;
  const query = input.query?.trim() || input.text.trim();
  const tokenBudget = input.tokenBudget ?? 1200;
  const summaryInput: SummarizeTextInput = {
    text: input.text,
    instruction: input.instruction,
    mode: input.mode,
    ...(input.providerId ? { providerId: input.providerId } : {}),
    ...(input.modelRef ? { modelRef: input.modelRef } : {}),
    ...(input.configFilePath ? { configFilePath: input.configFilePath } : {})
  };
  const summary = await summarizeText(summaryInput, dependencies);
  const engine = dependencies.createEngine?.() ?? new ContextEngine();
  const rawInput = buildRoundtripInput({
    sessionId,
    workspaceId: input.workspaceId,
    text: input.text
  });

  try {
    const ingestResult = await engine.ingest(rawInput);
    const bundle = await engine.compileContext({
      sessionId,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      query,
      tokenBudget
    });
    const summaryContract = buildContextSummaryContract(bundle);
    const bundleContract = buildBundleContractSnapshot(bundle);

    return {
      sessionId,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      query,
      tokenBudget,
      inputText: input.text,
      ingestText: input.text,
      note: '当前 roundtrip 始终 ingest 原文；summary 结果仅用于并排观察 code / codex 的摘要差异。',
      summary,
      ingest: {
        recordCount: rawInput.records.length,
        candidateNodeCount: ingestResult.candidateNodes.length,
        candidateEdgeCount: ingestResult.candidateEdges.length,
        persistedNodeCount: ingestResult.persistedNodeIds.length,
        persistedEdgeCount: ingestResult.persistedEdgeIds.length,
        warnings: [...ingestResult.warnings],
        candidateNodeLabels: dedupeStrings(ingestResult.candidateNodes.map((node) => node.label)).slice(0, 12)
      },
      compile: {
        bundle,
        summaryContract,
        bundleContract,
        includedNodeIds: collectBundleNodeIds(bundle),
        selectedNodeLabels: collectBundleSelections(bundle).map((item) => `${item.type}:${item.label}`)
      }
    };
  } finally {
    await engine.close();
  }
}

function buildRoundtripInput(input: {
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
      route: 'openclaw-context-cli:roundtrip'
    }
  };

  return {
    sessionId: input.sessionId,
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    records: [record]
  };
}

function collectBundleSelections(bundle: RuntimeContextBundle): ContextSelection[] {
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
  return dedupeStrings(collectBundleSelections(bundle).map((item) => item.nodeId));
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
