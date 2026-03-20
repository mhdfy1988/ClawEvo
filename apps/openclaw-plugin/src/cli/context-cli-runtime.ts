import { readFile } from 'node:fs/promises';

import {
  runModelsClear,
  runModelsCurrent,
  runModelsDefault,
  runModelsList,
  runModelsReset,
  runModelsUse,
  type ModelsCurrentResult,
  type ModelsListResult,
  type ModelsMutationResult
} from './context-models.js';
import { runAuthLogin, runAuthLogout, runAuthStatus } from './context-auth.js';
import { summarizeText, type SummaryMode } from './context-summary.js';

export interface CliOptions {
  command?: 'summarize' | 'roundtrip' | 'explain' | 'models' | 'auth';
  modelsAction?: 'list' | 'current' | 'use' | 'default' | 'clear' | 'reset';
  authAction?: 'status' | 'login' | 'logout';
  providerId?: string;
  modelRef?: string;
  text?: string;
  filePath?: string;
  configFilePath?: string;
  instruction?: string;
  query?: string;
  sessionId?: string;
  workspaceId?: string;
  tokenBudget?: number;
  limit?: number;
  nodeId?: string;
  timeoutMs?: number;
  mode: SummaryMode;
  json: boolean;
  helpRequested?: boolean;
}

export interface ContextCliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export interface ExecuteContextCliOptions {
  invocationName?: string;
}

export function createProcessCliIo(): ContextCliIo {
  return {
    stdout(text: string) {
      process.stdout.write(text);
    },
    stderr(text: string) {
      process.stderr.write(text);
    }
  };
}

export async function executeContextCli(
  args: string[],
  io: ContextCliIo,
  options: ExecuteContextCliOptions = {}
): Promise<number> {
  const invocationName = options.invocationName || 'openclaw-context-cli';

  try {
    const parsed = parseArgs(args);

    if (parsed.helpRequested || !parsed.command) {
      printHelp(io, invocationName);
      return 0;
    }

    switch (parsed.command) {
      case 'summarize':
        await runSummarize(parsed, io);
        return 0;
      case 'roundtrip':
        await runRoundtripCommand(parsed, io);
        return 0;
      case 'explain':
        await runExplainCommand(parsed, io);
        return 0;
      case 'models':
        runModelsCommand(parsed, io, invocationName);
        return 0;
      case 'auth':
        await runAuthCommand(parsed, io, invocationName);
        return 0;
      default:
        assertNever(parsed.command);
    }
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    io.stderr(`${message}\n`);
    return 1;
  }
}

async function runSummarize(options: CliOptions, io: ContextCliIo): Promise<void> {
  const text = await resolveInputText(options, 'summarize');
  const result = await summarizeText({
    text,
    instruction: options.instruction,
    mode: options.mode,
    ...(options.providerId ? { providerId: options.providerId } : {}),
    ...(options.modelRef ? { modelRef: options.modelRef } : {}),
    ...(options.configFilePath ? { configFilePath: options.configFilePath } : {})
  });

  if (options.json) {
    io.stdout(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  io.stdout(
    [
      '[Summary]',
      `mode requested: ${result.modeRequested}`,
      `mode used: ${result.modeUsed}`,
      `provider: ${result.provider}`,
      `compressed: ${result.compressed ? 'yes' : 'no'}`,
      `fallback used: ${result.fallbackUsed ? 'yes' : 'no'}`,
      `provider available: ${result.providerAvailable ? 'yes' : 'no'}`,
      `reason: ${result.reason}`,
      '',
      'summary:',
      result.summary,
      '',
      '[Diagnostics]',
      `original length: ${result.diagnostics.originalLength}`,
      `summary length: ${result.diagnostics.summaryLength}`,
      ...(result.diagnostics.summaryCandidateCount !== undefined
        ? [`summary candidates: ${result.diagnostics.summaryCandidateCount}`]
        : []),
      ...(result.diagnostics.summarySlots && result.diagnostics.summarySlots.length > 0
        ? [`summary slots: ${result.diagnostics.summarySlots.join(', ')}`]
        : []),
      ...(result.diagnostics.preferredForms && result.diagnostics.preferredForms.length > 0
        ? [`preferred forms: ${result.diagnostics.preferredForms.join(', ')}`]
        : []),
      ...(result.diagnostics.summaryOnlyNodeLabels && result.diagnostics.summaryOnlyNodeLabels.length > 0
        ? [`summary-only nodes: ${result.diagnostics.summaryOnlyNodeLabels.join(' | ')}`]
        : []),
      ...(result.diagnostics.materializeNodeLabels && result.diagnostics.materializeNodeLabels.length > 0
        ? [`materialize nodes: ${result.diagnostics.materializeNodeLabels.join(' | ')}`]
        : []),
      ...(result.diagnostics.providerAttempts && result.diagnostics.providerAttempts.length > 0
        ? [`provider attempts: ${result.diagnostics.providerAttempts.join(' -> ')}`]
        : []),
      ...(result.diagnostics.providerOrder && result.diagnostics.providerOrder.length > 0
        ? [`provider order: ${result.diagnostics.providerOrder.join(' -> ')}`]
        : []),
      ...(result.diagnostics.providerFailures && result.diagnostics.providerFailures.length > 0
        ? [`provider failures: ${result.diagnostics.providerFailures.join(' | ')}`]
        : []),
      ...(result.diagnostics.selectedModelRef ? [`selected model: ${result.diagnostics.selectedModelRef}`] : []),
      ...(result.diagnostics.selectedModelSource ? [`selected model source: ${result.diagnostics.selectedModelSource}`] : []),
      ...(result.diagnostics.configSource ? [`config source: ${result.diagnostics.configSource}`] : []),
      ...(result.diagnostics.providerModel ? [`provider model: ${result.diagnostics.providerModel}`] : []),
      ...(result.diagnostics.providerReasoningEffort
        ? [`provider reasoning effort: ${result.diagnostics.providerReasoningEffort}`]
        : []),
      ...(result.diagnostics.providerBaseUrl ? [`provider base url: ${result.diagnostics.providerBaseUrl}`] : []),
      ...(result.diagnostics.providerAccountId ? [`provider account id: ${result.diagnostics.providerAccountId}`] : []),
      ...(result.diagnostics.providerCommand ? [`provider command: ${result.diagnostics.providerCommand.join(' ')}`] : [])
    ].join('\n') + '\n'
  );
}

async function runRoundtripCommand(options: CliOptions, io: ContextCliIo): Promise<void> {
  const { runRoundtrip } = await import('./context-roundtrip.js');
  const text = await resolveInputText(options, 'roundtrip');
  const result = await runRoundtrip({
    text,
    instruction: options.instruction,
    mode: options.mode,
    ...(options.providerId ? { providerId: options.providerId } : {}),
    ...(options.modelRef ? { modelRef: options.modelRef } : {}),
    ...(options.configFilePath ? { configFilePath: options.configFilePath } : {}),
    query: options.query,
    sessionId: options.sessionId,
    workspaceId: options.workspaceId,
    tokenBudget: options.tokenBudget
  });

  if (options.json) {
    io.stdout(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const ingestPreview = formatPreviewList(result.ingest.candidateNodeLabels, 4);
  const bundlePreview = formatPreviewList(result.compile.selectedNodeLabels, 5);

  io.stdout(
    [
      '[Roundtrip]',
      `session: ${result.sessionId}`,
      ...(result.workspaceId ? [`workspace: ${result.workspaceId}`] : []),
      `query: ${result.query}`,
      `token budget: ${result.tokenBudget}`,
      `note: ${result.note}`,
      '',
      '[Summary Preview]',
      `mode requested: ${result.summary.modeRequested}`,
      `mode used: ${result.summary.modeUsed}`,
      `provider: ${result.summary.provider}`,
      `compressed: ${result.summary.compressed ? 'yes' : 'no'}`,
      `fallback used: ${result.summary.fallbackUsed ? 'yes' : 'no'}`,
      `reason: ${result.summary.reason}`,
      ...(result.summary.diagnostics.selectedModelRef
        ? [`selected model: ${result.summary.diagnostics.selectedModelRef}`]
        : []),
      ...(result.summary.diagnostics.selectedModelSource
        ? [`selected model source: ${result.summary.diagnostics.selectedModelSource}`]
        : []),
      `summary: ${shortenText(result.summary.summary, 180)}`,
      '',
      '[Ingest]',
      `records: ${result.ingest.recordCount}`,
      `candidate nodes: ${result.ingest.candidateNodeCount} | candidate edges: ${result.ingest.candidateEdgeCount}`,
      `persisted nodes: ${result.ingest.persistedNodeCount} | persisted edges: ${result.ingest.persistedEdgeCount}`,
      ...(ingestPreview ? [`candidate preview: ${ingestPreview}`] : []),
      ...(result.ingest.warnings.length > 0
        ? [`warnings: ${result.ingest.warnings.slice(0, 3).join(' | ')}${result.ingest.warnings.length > 3 ? ' | ...' : ''}`]
        : []),
      '',
      '[Compile]',
      `bundle id: ${result.compile.bundle.id}`,
      `token usage: ${result.compile.bundle.tokenBudget.used}/${result.compile.bundle.tokenBudget.total}`,
      `included nodes: ${result.compile.includedNodeIds.length}`,
      ...(result.compile.summaryContract.goal ? [`goal: ${result.compile.summaryContract.goal.label}`] : []),
      ...(result.compile.summaryContract.intent ? [`intent: ${result.compile.summaryContract.intent.label}`] : []),
      ...(result.compile.summaryContract.currentProcess
        ? [`current process: ${result.compile.summaryContract.currentProcess.label}`]
        : []),
      `active rules: ${result.compile.summaryContract.activeRules.length}`,
      `active constraints: ${result.compile.summaryContract.activeConstraints.length}`,
      `open risks: ${result.compile.summaryContract.openRisks.length}`,
      `recent decisions: ${result.compile.summaryContract.recentDecisions.length}`,
      `recent states: ${result.compile.summaryContract.recentStateChanges.length}`,
      `evidence: ${result.compile.summaryContract.relevantEvidence.length}`,
      `candidate skills: ${result.compile.summaryContract.candidateSkills.length}`,
      ...(bundlePreview ? [`bundle preview: ${bundlePreview}`] : [])
    ].join('\n') + '\n'
  );
}

async function runExplainCommand(options: CliOptions, io: ContextCliIo): Promise<void> {
  const { runExplain } = await import('./context-explain.js');
  const text = await resolveInputText(options, 'explain');
  const result = await runExplain({
    text,
    instruction: options.instruction,
    mode: options.mode,
    ...(options.providerId ? { providerId: options.providerId } : {}),
    ...(options.modelRef ? { modelRef: options.modelRef } : {}),
    ...(options.configFilePath ? { configFilePath: options.configFilePath } : {}),
    query: options.query,
    sessionId: options.sessionId,
    workspaceId: options.workspaceId,
    tokenBudget: options.tokenBudget,
    limit: options.limit,
    nodeId: options.nodeId
  });

  if (options.json) {
    io.stdout(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const explanationLines = result.explain.explanations.flatMap((item, index) => {
    const nodeLine = item.node ? `node: ${item.node.type}:${item.node.label} (${item.node.id})` : 'node: <missing>';
    const selectionLine = item.selection
      ? `selection: ${item.selection.included ? 'included' : 'skipped'}${item.selection.slot ? ` in ${item.selection.slot}` : ''}`
      : 'selection: <none>';
    const reasonLine = item.selection ? `reason: ${item.selection.reason}` : undefined;
    const governanceLine = item.governance
      ? `governance: ${item.governance.knowledgeState} / ${item.governance.promptReadiness.preferredForm} / ${item.governance.promptReadiness.budgetClass}`
      : undefined;
    const relatedNodes = item.relatedNodes.slice(0, 3).map((node) => `${node.type}:${node.label}`);
    const relatedNodeLine =
      item.relatedNodes.length > 0
        ? `related nodes (${item.relatedNodes.length}): ${relatedNodes.join(' | ')}${item.relatedNodes.length > relatedNodes.length ? ' | ...' : ''}`
        : 'related nodes: <none>';

    return [
      `[Explain ${index + 1}]`,
      nodeLine,
      selectionLine,
      ...(reasonLine ? [reasonLine] : []),
      ...(governanceLine ? [governanceLine] : []),
      `summary preview: ${shortenText(item.summary, 220)}`,
      relatedNodeLine
    ];
  });

  const bundlePreview = formatPreviewList(result.compile.selectedNodeLabels, 5);
  const recalledPreview = formatPreviewList(result.compile.recalledNodes.map(formatRecalledNodePreview), 5);
  const retainedRawTurnsPreview = result.compile.compaction?.retainedRawTurns
    .map((turn: { turnId: string; messageIds: string[] }) => `${turn.turnId}[${turn.messageIds.join(',')}]`)
    .join(' | ');

  io.stdout(
    [
      '[Explain]',
      `session: ${result.sessionId}`,
      ...(result.workspaceId ? [`workspace: ${result.workspaceId}`] : []),
      `query: ${result.query}`,
      `token budget: ${result.tokenBudget}`,
      `limit: ${result.explain.limit}`,
      ...(result.explain.requestedNodeId ? [`requested node: ${result.explain.requestedNodeId}`] : []),
      `note: ${result.note}`,
      '',
      '[Summary Preview]',
      `mode requested: ${result.summary.modeRequested}`,
      `mode used: ${result.summary.modeUsed}`,
      `provider: ${result.summary.provider}`,
      `compressed: ${result.summary.compressed ? 'yes' : 'no'}`,
      `fallback used: ${result.summary.fallbackUsed ? 'yes' : 'no'}`,
      `reason: ${result.summary.reason}`,
      ...(result.summary.diagnostics.selectedModelRef
        ? [`selected model: ${result.summary.diagnostics.selectedModelRef}`]
        : []),
      ...(result.summary.diagnostics.selectedModelSource
        ? [`selected model source: ${result.summary.diagnostics.selectedModelSource}`]
        : []),
      `summary: ${shortenText(result.summary.summary, 180)}`,
      '',
      '[Compaction]',
      ...(result.compile.compaction
        ? [
            `mode: ${result.compile.compaction.mode}`,
            ...(result.compile.compaction.reason ? [`reason: ${result.compile.compaction.reason}`] : []),
            ...(result.compile.compaction.baselineId ? [`baseline: ${result.compile.compaction.baselineId}`] : []),
            ...(result.compile.compaction.baselineIds && result.compile.compaction.baselineIds.length > 1
              ? [`baseline ids: ${result.compile.compaction.baselineIds.join(', ')}`]
              : []),
            `retained raw turns: ${result.compile.compaction.retainedRawTurnCount}`,
            ...(result.compile.compaction.rawTailStartMessageId
              ? [`raw tail start: ${result.compile.compaction.rawTailStartMessageId}`]
              : []),
            ...(retainedRawTurnsPreview ? [`raw tail windows: ${retainedRawTurnsPreview}`] : []),
            ...formatCompactionDiagnosticsLines(result.compile.compaction.diagnostics)
          ]
        : ['mode: <none>']),
      '',
      '[Bundle]',
      `selected nodes: ${result.compile.selectedNodeIds.length}`,
      `recalled nodes: ${result.compile.recalledNodeIds.length}`,
      ...(result.compile.summaryContract.goal ? [`goal: ${result.compile.summaryContract.goal.label}`] : []),
      ...(result.compile.summaryContract.intent ? [`intent: ${result.compile.summaryContract.intent.label}`] : []),
      ...(result.compile.summaryContract.currentProcess
        ? [`current process: ${result.compile.summaryContract.currentProcess.label}`]
        : []),
      ...(recalledPreview ? [`recalled preview: ${recalledPreview}`] : []),
      ...(bundlePreview ? [`bundle preview: ${bundlePreview}`] : []),
      '',
      '[Explain Targets]',
      `explained nodes: ${result.explain.explainedNodeIds.length}`,
      ...explanationLines
    ].join('\n') + '\n'
  );
}

function formatRecalledNodePreview(item: {
  type: string;
  label: string;
  included: boolean;
  recallKinds?: string[];
}): string {
  const base = `${item.type}:${item.label}`;
  const tags = [...(item.included ? [] : ['omitted']), ...(item.recallKinds ?? [])];
  return tags.length > 0 ? `${base}[${tags.join('+')}]` : base;
}

function formatCompactionDiagnosticsLines(
  diagnostics:
    | {
        trigger?: string;
        occupancyRatioBefore?: number;
        occupancyRatioAfter?: number;
        sealedIncrementalId?: string;
        appendedBaselineId?: string;
        mergedBaselineIds?: string[];
        mergedBaselineResultId?: string;
        rollback?: boolean;
        evictedBaselineId?: string;
        rawTailTokenEstimate?: number;
        incrementalTokenEstimate?: number;
        baselineTokenEstimate?: number;
        baselineCount?: number;
        sidecarReferenceCount?: number;
        fallbackLevel?: string;
      }
    | undefined
): string[] {
  if (!diagnostics) {
    return [];
  }

  return [
    ...(diagnostics.trigger ? [`diagnostics trigger: ${diagnostics.trigger}`] : []),
    ...(typeof diagnostics.occupancyRatioBefore === 'number'
      ? [`occupancy before: ${(diagnostics.occupancyRatioBefore * 100).toFixed(1)}%`]
      : []),
    ...(typeof diagnostics.occupancyRatioAfter === 'number'
      ? [`occupancy after: ${(diagnostics.occupancyRatioAfter * 100).toFixed(1)}%`]
      : []),
    ...(diagnostics.sealedIncrementalId ? [`sealed incremental: ${diagnostics.sealedIncrementalId}`] : []),
    ...(diagnostics.appendedBaselineId ? [`appended baseline: ${diagnostics.appendedBaselineId}`] : []),
    ...(diagnostics.mergedBaselineIds?.length ? [`merged baselines: ${diagnostics.mergedBaselineIds.join(', ')}`] : []),
    ...(diagnostics.mergedBaselineResultId ? [`merged baseline result: ${diagnostics.mergedBaselineResultId}`] : []),
    ...(typeof diagnostics.rollback === 'boolean' ? [`rollback: ${diagnostics.rollback ? 'yes' : 'no'}`] : []),
    ...(diagnostics.evictedBaselineId ? [`evicted baseline: ${diagnostics.evictedBaselineId}`] : []),
    ...(typeof diagnostics.rawTailTokenEstimate === 'number'
      ? [`raw tail tokens: ${diagnostics.rawTailTokenEstimate}`]
      : []),
    ...(typeof diagnostics.incrementalTokenEstimate === 'number'
      ? [`incremental tokens: ${diagnostics.incrementalTokenEstimate}`]
      : []),
    ...(typeof diagnostics.baselineTokenEstimate === 'number'
      ? [`baseline tokens: ${diagnostics.baselineTokenEstimate}`]
      : []),
    ...(typeof diagnostics.baselineCount === 'number' ? [`baseline count: ${diagnostics.baselineCount}`] : []),
    ...(typeof diagnostics.sidecarReferenceCount === 'number'
      ? [`sidecar references: ${diagnostics.sidecarReferenceCount}`]
      : []),
    ...(diagnostics.fallbackLevel ? [`fallback level: ${diagnostics.fallbackLevel}`] : [])
  ];
}

function runModelsCommand(options: CliOptions, io: ContextCliIo, invocationName: string): void {
  const action = options.modelsAction;
  if (!action) {
    printHelp(io, invocationName);
    return;
  }

  switch (action) {
    case 'list': {
      const result = runModelsList({
        ...(options.configFilePath ? { configFilePath: options.configFilePath } : {})
      });
      printModelsList(result, options.json, io);
      return;
    }
    case 'current': {
      const result = runModelsCurrent({
        ...(options.configFilePath ? { configFilePath: options.configFilePath } : {})
      });
      printModelsCurrent(result, options.json, io);
      return;
    }
    case 'clear': {
      const result = runModelsClear({
        ...(options.configFilePath ? { configFilePath: options.configFilePath } : {})
      });
      printModelsMutation(result, options.json, io);
      return;
    }
    case 'reset': {
      const result = runModelsReset({
        ...(options.configFilePath ? { configFilePath: options.configFilePath } : {})
      });
      printModelsMutation(result, options.json, io);
      return;
    }
    case 'use': {
      const result = runModelsUse({
        ...(options.configFilePath ? { configFilePath: options.configFilePath } : {}),
        modelRef: options.modelRef
      });
      printModelsMutation(result, options.json, io);
      return;
    }
    case 'default': {
      const result = runModelsDefault({
        ...(options.configFilePath ? { configFilePath: options.configFilePath } : {}),
        modelRef: options.modelRef
      });
      printModelsMutation(result, options.json, io);
      return;
    }
    default:
      assertNever(action);
  }
}

async function runAuthCommand(options: CliOptions, io: ContextCliIo, invocationName: string): Promise<void> {
  const action = options.authAction;
  if (!action) {
    printHelp(io, invocationName);
    return;
  }

  switch (action) {
    case 'status': {
      const result = await runAuthStatus({
        ...(options.configFilePath ? { configFilePath: options.configFilePath } : {})
      });
      printAuthStatus(result, options.json, io);
      return;
    }
    case 'login': {
      const result = await runAuthLogin({
        ...(options.configFilePath ? { configFilePath: options.configFilePath } : {}),
        ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {})
      });
      printAuthMutation('Codex OAuth Logged In', result, options.json, io);
      return;
    }
    case 'logout': {
      const result = await runAuthLogout({
        ...(options.configFilePath ? { configFilePath: options.configFilePath } : {})
      });
      printAuthMutation('Codex OAuth Logged Out', result, options.json, io);
      return;
    }
    default:
      assertNever(action);
  }
}

function printModelsList(result: ModelsListResult, asJson: boolean, io: ContextCliIo): void {
  if (asJson) {
    io.stdout(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const providerLines = result.providers.flatMap((provider) => {
    const header = `[${provider.id}] ${provider.label || provider.id} (${provider.status}, ${provider.enabled ? 'enabled' : 'disabled'})`;
    const meta = [
      ...(provider.vendor ? [`vendor=${provider.vendor}`] : []),
      ...(provider.auth ? [`auth=${provider.auth}`] : []),
      ...(provider.api ? [`api=${provider.api}`] : [])
    ];
    const modelLines =
      provider.models.length > 0
        ? provider.models.map((model) => {
            const tags = [
              ...(model.isCurrent ? ['current'] : []),
              ...(model.isDefault ? ['default'] : []),
              ...(model.api ? [`api=${model.api}`] : []),
              ...(typeof model.reasoning === 'boolean' ? [`reasoning=${model.reasoning ? 'yes' : 'no'}`] : [])
            ];
            return `  - ${model.ref}${tags.length > 0 ? ` [${tags.join(', ')}]` : ''}`;
          })
        : ['  - <no models>'];

    return [header, ...(meta.length > 0 ? [`  ${meta.join(' | ')}`] : []), ...modelLines];
  });

  io.stdout(
    [
      '[Models]',
      `config source: ${result.configSource}`,
      ...(result.configFilePath ? [`config file: ${result.configFilePath}`] : []),
      `state file: ${result.stateFilePath}`,
      ...(result.currentModelRef ? [`current: ${result.currentModelRef}`] : ['current: <none>']),
      ...(result.defaultModelRef ? [`default: ${result.defaultModelRef}`] : ['default: <none>']),
      ...(result.effectiveModelRef
        ? [`effective: ${result.effectiveModelRef}${result.effectiveSource ? ` (${result.effectiveSource})` : ''}`]
        : ['effective: <none>']),
      '',
      '[Catalog]',
      ...(providerLines.length > 0 ? providerLines : ['<empty catalog>'])
    ].join('\n') + '\n'
  );
}

function printModelsCurrent(result: ModelsCurrentResult, asJson: boolean, io: ContextCliIo): void {
  if (asJson) {
    io.stdout(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  io.stdout(
    [
      '[Current Model]',
      `config source: ${result.configSource}`,
      ...(result.configFilePath ? [`config file: ${result.configFilePath}`] : []),
      `state file: ${result.stateFilePath}`,
      ...(result.currentModelRef ? [`current: ${result.currentModelRef}`] : ['current: <none>']),
      ...(result.defaultModelRef ? [`default: ${result.defaultModelRef}`] : ['default: <none>']),
      ...(result.effectiveModelRef
        ? [`effective: ${result.effectiveModelRef}${result.effectiveSource ? ` (${result.effectiveSource})` : ''}`]
        : ['effective: <none>'])
    ].join('\n') + '\n'
  );
}

function printModelsMutation(result: ModelsMutationResult, asJson: boolean, io: ContextCliIo): void {
  if (asJson) {
    io.stdout(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const labelByAction: Record<ModelsMutationResult['action'], string> = {
    use: 'Current Model Updated',
    default: 'Default Model Updated',
    clear: 'Current Model Cleared',
    reset: 'Model Selection Reset'
  };
  io.stdout(
    [
      `[${labelByAction[result.action]}]`,
      ...(result.targetModelRef ? [`target: ${result.targetModelRef}`] : []),
      `config source: ${result.configSource}`,
      ...(result.configFilePath ? [`config file: ${result.configFilePath}`] : []),
      `state file: ${result.stateFilePath}`,
      ...(result.currentModelRef ? [`current: ${result.currentModelRef}`] : ['current: <none>']),
      ...(result.defaultModelRef ? [`default: ${result.defaultModelRef}`] : ['default: <none>']),
      ...(result.effectiveModelRef
        ? [`effective: ${result.effectiveModelRef}${result.effectiveSource ? ` (${result.effectiveSource})` : ''}`]
        : ['effective: <none>'])
    ].join('\n') + '\n'
  );
}

function printAuthStatus(
  result: Awaited<ReturnType<typeof runAuthStatus>>,
  asJson: boolean,
  io: ContextCliIo
): void {
  if (asJson) {
    io.stdout(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  io.stdout(
    [
      '[Codex OAuth Status]',
      `provider: ${result.provider}`,
      `available: ${result.available ? 'yes' : 'no'}`,
      `configured: ${result.configured ? 'yes' : 'no'}`,
      `reason: ${result.reason}`,
      `config source: ${result.configSource}`,
      ...(result.configFilePath ? [`config file: ${result.configFilePath}`] : []),
      `base url: ${result.baseUrl}`,
      `credential file: ${result.credentialFilePath}`,
      ...(result.credentialSource ? [`credential source: ${result.credentialSource}`] : []),
      `has credential: ${result.hasCredential ? 'yes' : 'no'}`,
      `has refresh token: ${result.hasRefreshToken ? 'yes' : 'no'}`,
      ...(result.accountId ? [`account id: ${result.accountId}`] : []),
      ...(result.expiresAt ? [`expires at: ${result.expiresAt}`] : [])
    ].join('\n') + '\n'
  );
}

function printAuthMutation(
  title: string,
  result: Awaited<ReturnType<typeof runAuthLogin>> | Awaited<ReturnType<typeof runAuthLogout>>,
  asJson: boolean,
  io: ContextCliIo
): void {
  if (asJson) {
    io.stdout(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  io.stdout(
    [
      `[${title}]`,
      `available: ${result.available ? 'yes' : 'no'}`,
      `configured: ${result.configured ? 'yes' : 'no'}`,
      `reason: ${result.reason}`,
      `config source: ${result.configSource}`,
      ...(result.configFilePath ? [`config file: ${result.configFilePath}`] : []),
      `base url: ${result.baseUrl}`,
      `credential file: ${result.credentialFilePath}`,
      ...(result.credentialSource ? [`credential source: ${result.credentialSource}`] : []),
      `has credential: ${result.hasCredential ? 'yes' : 'no'}`,
      `has refresh token: ${result.hasRefreshToken ? 'yes' : 'no'}`,
      ...(result.accountId ? [`account id: ${result.accountId}`] : []),
      ...(result.expiresAt ? [`expires at: ${result.expiresAt}`] : [])
    ].join('\n') + '\n'
  );
}

async function resolveInputText(
  options: CliOptions,
  commandName: 'summarize' | 'roundtrip' | 'explain'
): Promise<string> {
  if (options.text && options.text.trim()) {
    return options.text.trim();
  }

  if (options.filePath) {
    return (await readFile(options.filePath, 'utf8')).trim();
  }

  if (!process.stdin.isTTY) {
    return (await readStdin()).trim();
  }

  throw new Error(`${commandName} 需要通过 --text、--file 或 stdin 提供输入文本。`);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    mode: 'llm',
    json: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.helpRequested = true;
      return options;
    }

    if (!options.command && !arg.startsWith('-')) {
      if (arg !== 'summarize' && arg !== 'roundtrip' && arg !== 'explain' && arg !== 'models' && arg !== 'auth') {
        throw new Error(`未知命令：${arg}`);
      }

      options.command = arg;
      continue;
    }

    if (options.command === 'models' && !options.modelsAction && !arg.startsWith('-')) {
      if (arg !== 'list' && arg !== 'current' && arg !== 'use' && arg !== 'default' && arg !== 'clear' && arg !== 'reset') {
        throw new Error(`未知 models 子命令：${arg}`);
      }
      options.modelsAction = arg;
      continue;
    }

    if (options.command === 'auth' && !options.authAction && !arg.startsWith('-')) {
      if (arg !== 'status' && arg !== 'login' && arg !== 'logout') {
        throw new Error(`未知 auth 子命令：${arg}`);
      }
      options.authAction = arg;
      continue;
    }

    if (
      options.command === 'models' &&
      (options.modelsAction === 'use' || options.modelsAction === 'default') &&
      !options.modelRef &&
      !arg.startsWith('-')
    ) {
      options.modelRef = arg;
      continue;
    }

    if (arg === '--text') {
      options.text = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--file') {
      options.filePath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--instruction') {
      options.instruction = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--config') {
      options.configFilePath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--model') {
      options.modelRef = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--provider') {
      options.providerId = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--query') {
      options.query = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--session') {
      options.sessionId = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--workspace') {
      options.workspaceId = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--mode') {
      const mode = args[index + 1];
      if (
        mode !== 'auto' &&
        mode !== 'code' &&
        mode !== 'codex' &&
        mode !== 'codex-cli' &&
        mode !== 'codex-oauth' &&
        mode !== 'openai-responses' &&
        mode !== 'llm'
      ) {
        throw new Error(`不支持的 mode：${mode ?? 'empty'}`);
      }
      options.mode = mode;
      index += 1;
      continue;
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--token-budget') {
      const value = Number.parseInt(args[index + 1] ?? '', 10);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`不支持的 token budget：${args[index + 1] ?? 'empty'}`);
      }
      options.tokenBudget = value;
      index += 1;
      continue;
    }

    if (arg === '--limit') {
      const value = Number.parseInt(args[index + 1] ?? '', 10);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`不支持的 limit：${args[index + 1] ?? 'empty'}`);
      }
      options.limit = value;
      index += 1;
      continue;
    }

    if (arg === '--timeout-ms') {
      const value = Number.parseInt(args[index + 1] ?? '', 10);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`不支持的 timeoutMs：${args[index + 1] ?? 'empty'}`);
      }
      options.timeoutMs = value;
      index += 1;
      continue;
    }

    if (arg === '--node-id') {
      options.nodeId = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`未知参数：${arg}`);
  }

  return options;
}

export function printHelp(io: ContextCliIo, invocationName = 'openclaw-context-cli'): void {
  io.stdout(getHelpText(invocationName));
}

export function getHelpText(invocationName = 'openclaw-context-cli'): string {
  return (
    [
      'OpenClaw Context CLI',
      '',
      'Usage:',
      `  ${invocationName} summarize [--text <text> | --file <path>] [--mode llm|code|auto] [--provider <provider>] [--model <provider>/<model>] [--instruction <text>] [--config <path>] [--json]`,
      `  ${invocationName} roundtrip [--text <text> | --file <path>] [--query <text>] [--mode llm|code|auto] [--provider <provider>] [--model <provider>/<model>] [--config <path>] [--token-budget <n>] [--session <id>] [--workspace <id>] [--json]`,
      `  ${invocationName} explain [--text <text> | --file <path>] [--query <text>] [--mode llm|code|auto] [--provider <provider>] [--model <provider>/<model>] [--config <path>] [--limit <n>] [--node-id <id>] [--token-budget <n>] [--session <id>] [--workspace <id>] [--json]`,
      `  ${invocationName} models list [--config <path>] [--json]`,
      `  ${invocationName} models current [--config <path>] [--json]`,
      `  ${invocationName} models use <provider>/<model> [--config <path>] [--json]`,
      `  ${invocationName} models default <provider>/<model> [--config <path>] [--json]`,
      `  ${invocationName} models clear [--config <path>] [--json]`,
      `  ${invocationName} models reset [--config <path>] [--json]`,
      `  ${invocationName} auth status [--config <path>] [--json]`,
      `  ${invocationName} auth login [--config <path>] [--timeout-ms <n>] [--json]`,
      `  ${invocationName} auth logout [--config <path>] [--json]`,
      '',
      'Commands:',
      '  summarize     对一段文本做 LLM 摘要；code 只作为显式模式或 auto fallback。',
      '  roundtrip     对一段文本执行 ingest -> compile，并并排展示摘要预览。',
      '  explain       对当前 bundle 里的选中节点执行 explain，输出选择原因和治理信息。',
      '  models        查看、设置当前模型和默认模型。',
      '  auth          查看、登录或清理 Codex OAuth 凭据。',
      '',
      'Options:',
      '  --text <text>         直接传入输入文本。',
      '  --file <path>         从 UTF-8 文件读取输入文本。',
      '  --mode <mode>         llm / code / auto，默认 llm；兼容旧值 codex / codex-cli / codex-oauth / openai-responses。',
      '  --instruction <text>  覆盖默认摘要指令。',
      '  --config <path>       指定 LLM 配置文件；默认会自动查找 compact-context.llm.config.json。',
      '  --provider <id>       可选；为 summarize / roundtrip / explain 显式限制 provider，更多用于调试或高级筛选。',
      '  --model <ref>         主推荐入口；为 summarize / roundtrip / explain 显式覆盖模型，或为 models use/default 指定 <provider>/<model>。',
      '  --query <text>        roundtrip / explain 时指定 compile query，默认使用原文。',
      '  --token-budget <n>    roundtrip / explain 时指定 compile token budget，默认 1200。',
      '  --session <id>        roundtrip / explain 时指定 session id，默认自动生成。',
      '  --workspace <id>      roundtrip / explain 时指定 workspace id。',
      '  --limit <n>           explain 时默认解释多少个选中节点，默认 3，最大 10。',
      '  --node-id <id>        explain 时直接指定一个 nodeId，只解释这个节点。',
      '  --timeout-ms <n>      auth login 时等待浏览器回调的超时时间，默认 120000。',
      '  --json                以 JSON 输出结果。',
      '  -h, --help            显示帮助。',
      '',
      'Examples:',
      `  ${invocationName} summarize --text "今天先把首页做成控制塔视角"`,
      `  ${invocationName} summarize --model codex-oauth/gpt-5.4 --text "请用 ChatGPT OAuth 压缩这段文本"`,
      `  ${invocationName} summarize --mode llm --model bailian/qwen3.5-plus --text "请用百炼千问压缩这段文本"`,
        `  ${invocationName} summarize --mode llm --model volcengine/<your-ark-endpoint-id> --text "请用豆包 Seed 2.0 Pro 压缩这段文本"`,
      `  ${invocationName} summarize --mode auto --text "请在 LLM 不可用时回退到代码摘要"`,
      `  ${invocationName} summarize --text "测试一句话能不能被压缩。" --json`,
      `  ${invocationName} roundtrip --text "今天先把首页做成控制塔视角，并保留任务总览。" --mode llm --model bailian/qwen3.5-plus`,
        `  ${invocationName} explain --text "今天先把首页做成控制塔视角，并保留任务总览。" --mode llm --model volcengine/<your-ark-endpoint-id> --limit 2`,
      `  ${invocationName} models list`,
      `  ${invocationName} models current`,
      `  ${invocationName} models use codex-cli/gpt-5-codex`,
      `  ${invocationName} models default codex-oauth/gpt-5.4`,
      `  ${invocationName} models clear`,
      `  ${invocationName} models reset`,
      `  ${invocationName} auth status`,
      `  ${invocationName} auth login --timeout-ms 180000`,
      `  ${invocationName} auth logout`,
      `  Get-Content notes.txt | ${invocationName} summarize --json`
    ].join('\n') + '\n'
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled command: ${String(value)}`);
}

function shortenText(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, ' ').trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function formatPreviewList(values: string[], limit: number): string | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const preview = values.slice(0, limit).join(' | ');
  return values.length > limit ? `${preview} | ...` : preview;
}
