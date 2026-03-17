import type { ContextProcessingResult, RawContextRecord } from '@openclaw-compact-context/contracts';
import {
  createCatalogProviderRegistry,
  createDefaultCodexProviderRegistry,
  loadLlmToolkitConfig,
  normalizeModelRef,
  parseModelRef,
  resolveCatalogProviderOrder,
  reorderProviderOrderForModelRef,
  resolveCodexProviderOrder,
  resolveModelSelection,
  type CreateCatalogRegistryOptions,
  type CreateCodexRegistryOptions,
  type LlmProviderAvailability,
  type CodexProviderMode,
  type LlmToolkitConfig
} from '@openclaw-compact-context/llm-toolkit';
import { normalizeUtteranceText, processContextRecord } from '@openclaw-compact-context/runtime-core/context-processing';
import { getPluginConfigFallbackDirs } from './config-paths.js';

export type SummaryMode = 'auto' | 'code' | 'codex' | 'codex-cli' | 'codex-oauth' | 'openai-responses' | 'llm';
export type ResolvedSummaryMode = 'code' | string;
export type SummaryProvider = 'code' | string;

export interface SummarizeTextInput {
  text: string;
  instruction?: string;
  mode?: SummaryMode;
  modelRef?: string;
  configFilePath?: string;
  config?: LlmToolkitConfig;
  fallbackDirs?: string[];
}

export interface SummaryResult {
  modeRequested: SummaryMode;
  modeUsed: ResolvedSummaryMode;
  provider: SummaryProvider;
  summary: string;
  compressed: boolean;
  reason: string;
  fallbackUsed: boolean;
  providerAvailable: boolean;
  diagnostics: {
    originalLength: number;
    summaryLength: number;
    summaryCandidateCount?: number;
    summarySlots?: string[];
    preferredForms?: string[];
    summaryOnlyNodeLabels?: string[];
    materializeNodeLabels?: string[];
    providerAttempts?: string[];
    providerFailures?: string[];
    providerOrder?: string[];
    selectedModelRef?: string;
    selectedModelSource?: string;
    configSource?: string;
    providerModel?: string;
    providerReasoningEffort?: string;
    providerBaseUrl?: string;
    providerAccountId?: string;
    providerCommand?: string[];
  };
}

export interface SummaryDependencies {
  createCodexRegistry?: (options?: CreateCodexRegistryOptions) => ReturnType<typeof createDefaultCodexProviderRegistry>;
  createCatalogRegistry?: (options?: CreateCatalogRegistryOptions) => ReturnType<typeof createCatalogProviderRegistry>;
}

export async function summarizeText(
  input: SummarizeTextInput,
  dependencies: SummaryDependencies = {}
): Promise<SummaryResult> {
  const requestedMode = input.mode ?? 'auto';
  const codeResult = summarizeWithCode(input.text);
  const fallbackDirs = input.fallbackDirs ?? getPluginConfigFallbackDirs();

  if (requestedMode === 'code') {
    return {
      ...codeResult,
      modeRequested: requestedMode,
      fallbackUsed: false
    };
  }

  const loadedConfig = loadLlmToolkitConfig({
    config: input.config,
    configFilePath: input.configFilePath,
    fallbackDirs
  });
  const registry = createSummaryRegistry({
    requestedMode,
    input,
    dependencies
  });
  const availabilityEntries = await registry.listAvailability();
  const providerAvailable = availabilityEntries.some(
    (entry: { availability: LlmProviderAvailability }) => entry.availability.available
  );
  const registeredProviderIds =
    typeof registry.listProviders === 'function' ? registry.listProviders().map((provider) => provider.id) : undefined;
  const requestedProviderOrder = resolveSummaryProviderOrder({
    requestedMode,
    input,
    registeredProviderIds
  });
  const modelSelection = resolveModelSelection({
    config: loadedConfig.config,
    ...(isCodexRequestedMode(requestedMode) ? { mode: requestedMode } : {}),
    ...(registeredProviderIds ? { registeredProviderIds } : {})
  });
  const explicitModelRef = normalizeModelRef(input.modelRef);
  const effectiveModelRef = resolveEffectiveModelRef({
    explicitModelRef,
    selectedModelRef: modelSelection.effectiveModelRef,
    requestedMode,
    providerOrder: requestedProviderOrder,
    registeredProviderIds
  });
  const effectiveModelSource = explicitModelRef ? 'cli' : modelSelection.effectiveSource;
  const providerOrder = reorderProviderOrderForModelRef(
    requestedProviderOrder,
    effectiveModelRef
  );

  if (providerOrder.length === 0) {
    if (requestedMode === 'auto') {
      return {
        ...codeResult,
        modeRequested: requestedMode,
        providerAvailable,
        fallbackUsed: true,
        reason: '当前配置未启用任何 Codex transport，已自动回退到代码摘要。'
      };
    }

    throw new Error(`当前配置未启用 ${requestedMode} transport。`);
  }

  try {
    const registryResult = await registry.generateWithOrder(
      {
        prompt: buildSummaryPrompt(input),
        reasoningEffort: 'low',
        ...(effectiveModelRef ? { model: parseModelRef(effectiveModelRef).modelId } : {})
      },
      providerOrder
    );
    const normalizedOriginal = normalizeForComparison(input.text);
    const normalizedSummary = normalizeForComparison(registryResult.result.text);

    return {
      modeRequested: requestedMode,
      modeUsed: registryResult.result.transport as ResolvedSummaryMode,
      provider: registryResult.result.providerId as SummaryProvider,
      summary: registryResult.result.text,
      compressed: normalizedOriginal !== normalizedSummary,
      reason: buildProviderReason(registryResult.result.providerLabel),
      fallbackUsed: false,
      providerAvailable,
      diagnostics: {
        originalLength: input.text.length,
        summaryLength: registryResult.result.text.length,
        providerAttempts: registryResult.attempts,
        providerFailures: registryResult.failures.map(formatProviderFailure),
        providerOrder,
        ...(effectiveModelRef ? { selectedModelRef: effectiveModelRef } : {}),
        ...(effectiveModelSource ? { selectedModelSource: effectiveModelSource } : {}),
        configSource: formatConfigSource(loadedConfig),
        ...(registryResult.result.model ? { providerModel: registryResult.result.model } : {}),
        ...(registryResult.result.reasoningEffort
          ? { providerReasoningEffort: registryResult.result.reasoningEffort }
          : {}),
        ...(typeof registryResult.result.diagnostics?.baseUrl === 'string'
          ? { providerBaseUrl: registryResult.result.diagnostics.baseUrl }
          : {}),
        ...(typeof registryResult.result.diagnostics?.accountId === 'string'
          ? { providerAccountId: registryResult.result.diagnostics.accountId }
          : {}),
        ...(Array.isArray(registryResult.result.diagnostics?.command)
          ? { providerCommand: registryResult.result.diagnostics.command as string[] }
          : {}),
      }
    };
  } catch (error) {
    if (requestedMode !== 'auto') {
      throw error;
    }

    return {
      ...codeResult,
      modeRequested: requestedMode,
      providerAvailable,
      fallbackUsed: true,
      reason: `Codex provider 不可用，已自动回退到代码摘要：${formatErrorMessage(error)}`,
      diagnostics: {
        ...codeResult.diagnostics,
        providerOrder,
        ...(effectiveModelRef ? { selectedModelRef: effectiveModelRef } : {}),
        ...(effectiveModelSource ? { selectedModelSource: effectiveModelSource } : {}),
        configSource: formatConfigSource(loadedConfig)
      }
    };
  }
}

function createSummaryRegistry(input: {
  requestedMode: SummaryMode;
  input: SummarizeTextInput;
  dependencies: SummaryDependencies;
}) {
  if (input.requestedMode === 'llm') {
    const createRegistry = input.dependencies.createCatalogRegistry ?? createCatalogProviderRegistry;
    const registryOptions: CreateCatalogRegistryOptions = {
      ...(input.input.config ? { config: input.input.config } : {}),
      ...(input.input.configFilePath ? { configFilePath: input.input.configFilePath } : {}),
      fallbackDirs: input.input.fallbackDirs ?? getPluginConfigFallbackDirs()
    };
    return createRegistry(registryOptions);
  }

  const createRegistry = input.dependencies.createCodexRegistry ?? createDefaultCodexProviderRegistry;
  const registryOptions: CreateCodexRegistryOptions = {
    ...(input.input.config ? { config: input.input.config } : {}),
    ...(input.input.configFilePath ? { configFilePath: input.input.configFilePath } : {}),
    fallbackDirs: input.input.fallbackDirs ?? getPluginConfigFallbackDirs()
  };
  return createRegistry(registryOptions);
}

function resolveSummaryProviderOrder(input: {
  requestedMode: SummaryMode;
  input: SummarizeTextInput;
  registeredProviderIds?: readonly string[];
}): string[] {
  if (input.requestedMode === 'llm') {
    const configuredOrder = resolveCatalogProviderOrder(
      loadLlmToolkitConfig({
        ...(input.input.config ? { config: input.input.config } : {}),
        ...(input.input.configFilePath ? { configFilePath: input.input.configFilePath } : {}),
        fallbackDirs: input.input.fallbackDirs ?? getPluginConfigFallbackDirs()
      }).config
    );
    const filteredOrder = filterOrderByRegisteredProviders(configuredOrder, input.registeredProviderIds);

    if (filteredOrder.length > 0) {
      return filteredOrder;
    }

    const explicitModelRef = normalizeModelRef(input.input.modelRef);
    if (explicitModelRef) {
      const parsedModel = parseModelRef(explicitModelRef);
      if (!input.registeredProviderIds || input.registeredProviderIds.includes(parsedModel.providerId)) {
        return [parsedModel.providerId];
      }
    }

    if (input.registeredProviderIds && input.registeredProviderIds.length > 0) {
      return [...input.registeredProviderIds];
    }

    return filteredOrder;
  }

  return resolveCodexProviderOrder(input.requestedMode as CodexProviderMode, {
    ...(input.input.config ? { config: input.input.config } : {}),
    ...(input.input.configFilePath ? { configFilePath: input.input.configFilePath } : {}),
    fallbackDirs: input.input.fallbackDirs ?? getPluginConfigFallbackDirs(),
    ...(input.registeredProviderIds ? { registeredProviderIds: input.registeredProviderIds } : {})
  });
}

function resolveEffectiveModelRef(input: {
  explicitModelRef?: string;
  selectedModelRef?: string;
  requestedMode: SummaryMode;
  providerOrder: readonly string[];
  registeredProviderIds?: readonly string[];
}): string | undefined {
  if (!input.explicitModelRef) {
    return input.selectedModelRef;
  }

  const parsed = parseModelRef(input.explicitModelRef);
  if (
    (input.requestedMode === 'codex-cli' || input.requestedMode === 'codex-oauth' || input.requestedMode === 'openai-responses') &&
    parsed.providerId !== input.requestedMode
  ) {
    throw new Error(`--model ${input.explicitModelRef} 与当前 mode=${input.requestedMode} 不匹配。`);
  }

  if (input.registeredProviderIds && !input.registeredProviderIds.includes(parsed.providerId)) {
    throw new Error(`--model ${input.explicitModelRef} 指向的 provider 未注册：${parsed.providerId}`);
  }

  if (input.providerOrder.length > 0 && !input.providerOrder.includes(parsed.providerId)) {
    throw new Error(`--model ${input.explicitModelRef} 指向的 provider 当前未启用。`);
  }

  return parsed.ref;
}

function filterOrderByRegisteredProviders(order: readonly string[], registeredProviderIds: readonly string[] | undefined): string[] {
  if (!registeredProviderIds || registeredProviderIds.length === 0) {
    return [...order];
  }

  const registeredSet = new Set(registeredProviderIds);
  return order.filter((providerId) => registeredSet.has(providerId));
}

function isCodexRequestedMode(mode: SummaryMode): mode is CodexProviderMode {
  return mode === 'auto' || mode === 'codex' || mode === 'codex-cli' || mode === 'codex-oauth' || mode === 'openai-responses';
}

function summarizeWithCode(text: string): SummaryResult {
  const normalizedText = text.trim();
  const record: RawContextRecord = {
    scope: 'session',
    sourceType: 'conversation',
    role: 'user',
    content: normalizedText
  };
  const processing = processContextRecord(record);
  const summaryOnlyNodeLabels = uniqueLabels(
    processing.materializationPlan.summaryOnlyNodeCandidates.map((candidate) => candidate.label)
  );
  const summaryFormCandidates = processing.summaryCandidates.filter((candidate) => candidate.preferredForm === 'summary');
  const summaryCandidateLabels = uniqueLabels(summaryFormCandidates.map((candidate) => candidate.label));
  const candidateSummaryParts = summaryCandidateLabels.length > 0 ? summaryCandidateLabels : summaryOnlyNodeLabels;
  const candidateSummary = candidateSummaryParts.join(' | ').trim();
  const normalizedCandidateSummary = normalizeForComparison(candidateSummary);
  const normalizedOriginal = normalizeForComparison(normalizedText);
  const useCompressedSummary = candidateSummary.length > 0 && normalizedCandidateSummary !== normalizedOriginal;
  const finalSummary = useCompressedSummary ? candidateSummary : normalizedText;

  return {
    modeRequested: 'code',
    modeUsed: 'code',
    provider: 'code',
    summary: finalSummary,
    compressed: useCompressedSummary,
    reason: useCompressedSummary
      ? '代码主链生成了 summary 形态候选，已输出压缩结果。'
      : '当前代码主链判断保留原文。',
    fallbackUsed: false,
    providerAvailable: false,
    diagnostics: buildCodeDiagnostics(processing, normalizedText.length, finalSummary)
  };
}

function buildCodeDiagnostics(
  processing: ContextProcessingResult,
  originalLength: number,
  finalSummary: string
): SummaryResult['diagnostics'] {
  return {
    originalLength,
    summaryLength: finalSummary.length,
    summaryCandidateCount: processing.summaryCandidates.length,
    summarySlots: [...new Set(processing.summaryCandidates.map((candidate) => candidate.slot))],
    preferredForms: [...new Set(processing.summaryCandidates.map((candidate) => candidate.preferredForm))],
    summaryOnlyNodeLabels: uniqueLabels(
      processing.materializationPlan.summaryOnlyNodeCandidates.map((candidate) => candidate.label)
    ),
    materializeNodeLabels: uniqueLabels(
      processing.materializationPlan.materializeNodeCandidates.map((candidate) => candidate.label)
    )
  };
}

function buildSummaryPrompt(input: SummarizeTextInput): string {
  const instruction = input.instruction?.trim() || '请把下面文本压缩成一句更短的中文摘要。';

  return [
    instruction,
    '',
    '要求：',
    '1. 保留原意，不要扩写。',
    '2. 只输出摘要正文。',
    '3. 不要加前缀、解释、引号、列表或 Markdown。',
    '',
    '原文：',
    input.text
  ].join('\n');
}

function buildProviderReason(providerLabel: string): string {
  return `使用 ${providerLabel} 生成摘要。`;
}

function normalizeForComparison(value: string): string {
  return normalizeUtteranceText(value);
}

function uniqueLabels(labels: readonly string[]): string[] {
  return [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
}

function formatProviderFailure(failure: { providerId: string; stage: string; message: string }): string {
  return `${failure.providerId}[${failure.stage}] ${failure.message}`;
}

function formatConfigSource(input: { source: 'defaults' | 'inline' | 'file'; filePath?: string }): string {
  if (input.source === 'file') {
    return input.filePath || 'file';
  }

  return input.source;
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
