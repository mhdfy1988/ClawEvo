#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

import {
  runModelsCurrent,
  runModelsDefault,
  runModelsList,
  runModelsUse,
  type ModelsCurrentResult,
  type ModelsListResult,
  type ModelsMutationResult
} from '../cli/context-models.js';
import { runExplain } from '../cli/context-explain.js';
import { runRoundtrip } from '../cli/context-roundtrip.js';
import { summarizeText, type SummaryMode } from '../cli/context-summary.js';

interface CliOptions {
  command?: 'summarize' | 'roundtrip' | 'explain' | 'models';
  modelsAction?: 'list' | 'current' | 'use' | 'default';
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
  mode: SummaryMode;
  json: boolean;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!options.command) {
    printHelp();
    process.exit(0);
  }

  switch (options.command) {
    case 'summarize':
      await runSummarize(options);
      return;
    case 'roundtrip':
      await runRoundtripCommand(options);
      return;
    case 'explain':
      await runExplainCommand(options);
      return;
    case 'models':
      runModelsCommand(options);
      return;
    default:
      assertNever(options.command);
  }
}

async function runSummarize(options: CliOptions): Promise<void> {
  const text = await resolveInputText(options, 'summarize');
  const result = await summarizeText({
    text,
    instruction: options.instruction,
    mode: options.mode,
    ...(options.modelRef ? { modelRef: options.modelRef } : {}),
    ...(options.configFilePath ? { configFilePath: options.configFilePath } : {})
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(
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

async function runRoundtripCommand(options: CliOptions): Promise<void> {
  const text = await resolveInputText(options, 'roundtrip');
  const result = await runRoundtrip({
    text,
    instruction: options.instruction,
    mode: options.mode,
    ...(options.modelRef ? { modelRef: options.modelRef } : {}),
    ...(options.configFilePath ? { configFilePath: options.configFilePath } : {}),
    query: options.query,
    sessionId: options.sessionId,
    workspaceId: options.workspaceId,
    tokenBudget: options.tokenBudget
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const ingestPreview = formatPreviewList(result.ingest.candidateNodeLabels, 4);
  const bundlePreview = formatPreviewList(result.compile.selectedNodeLabels, 5);

  process.stdout.write(
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

async function runExplainCommand(options: CliOptions): Promise<void> {
  const text = await resolveInputText(options, 'explain');
  const result = await runExplain({
    text,
    instruction: options.instruction,
    mode: options.mode,
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
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
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

  process.stdout.write(
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
      '[Bundle]',
      `selected nodes: ${result.compile.selectedNodeIds.length}`,
      ...(result.compile.summaryContract.goal ? [`goal: ${result.compile.summaryContract.goal.label}`] : []),
      ...(result.compile.summaryContract.intent ? [`intent: ${result.compile.summaryContract.intent.label}`] : []),
      ...(result.compile.summaryContract.currentProcess
        ? [`current process: ${result.compile.summaryContract.currentProcess.label}`]
        : []),
      ...(bundlePreview ? [`bundle preview: ${bundlePreview}`] : []),
      '',
      '[Explain Targets]',
      `explained nodes: ${result.explain.explainedNodeIds.length}`,
      ...explanationLines
    ].join('\n') + '\n'
  );
}

function runModelsCommand(options: CliOptions): void {
  const action = options.modelsAction;
  if (!action) {
    printHelp();
    return;
  }

  switch (action) {
    case 'list': {
      const result = runModelsList({
        ...(options.configFilePath ? { configFilePath: options.configFilePath } : {})
      });
      printModelsList(result, options.json);
      return;
    }
    case 'current': {
      const result = runModelsCurrent({
        ...(options.configFilePath ? { configFilePath: options.configFilePath } : {})
      });
      printModelsCurrent(result, options.json);
      return;
    }
    case 'use': {
      const result = runModelsUse({
        ...(options.configFilePath ? { configFilePath: options.configFilePath } : {}),
        modelRef: options.modelRef
      });
      printModelsMutation('current', result, options.json);
      return;
    }
    case 'default': {
      const result = runModelsDefault({
        ...(options.configFilePath ? { configFilePath: options.configFilePath } : {}),
        modelRef: options.modelRef
      });
      printModelsMutation('default', result, options.json);
      return;
    }
    default:
      assertNever(action);
  }
}

function printModelsList(result: ModelsListResult, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
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

  process.stdout.write(
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

function printModelsCurrent(result: ModelsCurrentResult, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(
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

function printModelsMutation(kind: 'current' | 'default', result: ModelsMutationResult, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const label = kind === 'current' ? 'Current Model Updated' : 'Default Model Updated';
  process.stdout.write(
    [
      `[${label}]`,
      `target: ${result.targetModelRef}`,
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
    mode: 'auto',
    json: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (!options.command && !arg.startsWith('-')) {
      if (arg !== 'summarize' && arg !== 'roundtrip' && arg !== 'explain' && arg !== 'models') {
        throw new Error(`未知命令：${arg}`);
      }

      options.command = arg;
      continue;
    }

    if (options.command === 'models' && !options.modelsAction && !arg.startsWith('-')) {
      if (arg !== 'list' && arg !== 'current' && arg !== 'use' && arg !== 'default') {
        throw new Error(`未知 models 子命令：${arg}`);
      }
      options.modelsAction = arg;
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

    if (arg === '--node-id') {
      options.nodeId = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`未知参数：${arg}`);
  }

  return options;
}

function printHelp(): void {
  process.stdout.write(
    [
      'OpenClaw Context CLI',
      '',
      'Usage:',
      '  openclaw-context-cli summarize [--text <text> | --file <path>] [--mode auto|code|codex|codex-cli|codex-oauth|openai-responses|llm] [--model <provider>/<model>] [--instruction <text>] [--config <path>] [--json]',
      '  openclaw-context-cli roundtrip [--text <text> | --file <path>] [--query <text>] [--mode auto|code|codex|codex-cli|codex-oauth|openai-responses|llm] [--model <provider>/<model>] [--config <path>] [--token-budget <n>] [--session <id>] [--workspace <id>] [--json]',
      '  openclaw-context-cli explain [--text <text> | --file <path>] [--query <text>] [--mode auto|code|codex|codex-cli|codex-oauth|openai-responses|llm] [--model <provider>/<model>] [--config <path>] [--limit <n>] [--node-id <id>] [--token-budget <n>] [--session <id>] [--workspace <id>] [--json]',
      '  openclaw-context-cli models list [--config <path>] [--json]',
      '  openclaw-context-cli models current [--config <path>] [--json]',
      '  openclaw-context-cli models use <provider>/<model> [--config <path>] [--json]',
      '  openclaw-context-cli models default <provider>/<model> [--config <path>] [--json]',
      '',
      'Commands:',
      '  summarize     对一段文本做代码摘要或 Codex 摘要。',
      '  roundtrip     对一段文本执行 ingest -> compile，并并排展示摘要预览。',
      '  explain       对当前 bundle 里的选中节点执行 explain，输出选择原因和治理信息。',
      '  models        查看、设置当前模型和默认模型。',
      '',
      'Options:',
      '  --text <text>         直接传入输入文本。',
      '  --file <path>         从 UTF-8 文件读取输入文本。',
      '  --mode <mode>         auto / code / codex / codex-cli / codex-oauth / openai-responses / llm，默认 auto。',
      '  --instruction <text>  覆盖默认摘要指令。',
      '  --config <path>       指定 LLM 配置文件；默认会自动查找 openclaw.llm.config.json。',
      '  --model <ref>         为 summarize / roundtrip / explain 显式覆盖模型，或为 models use/default 指定 <provider>/<model>。',
      '  --query <text>        roundtrip / explain 时指定 compile query，默认使用原文。',
      '  --token-budget <n>    roundtrip / explain 时指定 compile token budget，默认 1200。',
      '  --session <id>        roundtrip / explain 时指定 session id，默认自动生成。',
      '  --workspace <id>      roundtrip / explain 时指定 workspace id。',
      '  --limit <n>           explain 时默认解释多少个选中节点，默认 3，最大 10。',
      '  --node-id <id>        explain 时直接指定一个 nodeId，只解释这个节点。',
      '  --json                以 JSON 输出结果。',
      '  -h, --help            显示帮助。',
      '',
      'Examples:',
      '  openclaw-context-cli summarize --text "今天先把首页做成控制塔视角"',
      '  openclaw-context-cli summarize --mode codex --model codex-cli/gpt-5-codex --text "请压缩这段文本"',
      '  openclaw-context-cli summarize --mode llm --model qwen-compatible/qwen3.5-plus --text "请用千问兼容层压缩这段文本"',
      '  openclaw-context-cli summarize --mode codex --text "请压缩这段文本"',
      '  openclaw-context-cli summarize --mode auto --text "测试一句话能不能被压缩。" --json',
      '  openclaw-context-cli roundtrip --text "今天先把首页做成控制塔视角，并保留任务总览。" --mode llm --model qwen-compatible/qwen3.5-plus',
      '  openclaw-context-cli explain --text "今天先把首页做成控制塔视角，并保留任务总览。" --mode llm --model qwen-compatible/qwen3.5-plus --limit 2',
      '  openclaw-context-cli models list',
      '  openclaw-context-cli models current',
      '  openclaw-context-cli models use codex-cli/gpt-5-codex',
      '  openclaw-context-cli models default codex-oauth/gpt-5.4',
      '  Get-Content notes.txt | openclaw-context-cli summarize --mode auto --json'
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

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
