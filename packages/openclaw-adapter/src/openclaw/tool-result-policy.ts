import { createHash } from 'node:crypto';

import type {
  AgentMessageLike,
  CompressedToolResultMessageContent,
  OpenClawToolResultKind,
  OpenClawToolResultStatus
} from './types.js';
export { readCompressedToolResultMetadata } from '@openclaw-compact-context/runtime-core';
export type { ToolResultCompressionMetadataView } from '@openclaw-compact-context/runtime-core';

const MAX_INLINE_TEXT_CHARS = 900;
const MAX_SERIALIZED_CHARS = 1800;
const MAX_LIST_ITEMS = 20;
const MAX_PATHS = 8;
const MAX_SIGNALS = 6;
const PREVIEW_HEAD_CHARS = 320;
const PREVIEW_TAIL_CHARS = 200;

interface NormalizedToolResult {
  toolName: string;
  toolCallId?: string;
  status: OpenClawToolResultStatus;
  resultKind: OpenClawToolResultKind;
  command?: string;
  summaryBase?: string;
  outputText?: string;
  stdout?: string;
  stderr?: string;
  sourcePath?: string;
  sourceUrl?: string;
  artifactPath?: string;
  itemCount?: number;
  lineCount: number;
  exitCode?: number;
  error?: {
    name?: string;
    code?: string;
    message?: string;
  };
  affectedPaths: string[];
  rawSerialized: string;
  rawSize: number;
  contentHash: string;
}

export interface ToolResultPolicyDecision {
  changed: boolean;
  message: AgentMessageLike;
  rawSize: number;
  compressedSize: number;
  policyId?: string;
  summary?: string;
}

export function applyToolResultPolicy(message: AgentMessageLike): ToolResultPolicyDecision {
  if (!isToolRole(message.role)) {
    return {
      changed: false,
      message,
      rawSize: estimateSize(message.content),
      compressedSize: estimateSize(message.content)
    };
  }

  const existing = readCompressedToolResultContent(message.content);

  if (existing) {
    const size = estimateSize(existing);
    return {
      changed: false,
      message,
      rawSize: size,
      compressedSize: size,
      policyId: existing.truncation.policyId,
      summary: existing.summary
    };
  }

  const normalized = normalizeToolResult(message);

  if (!shouldCompress(normalized)) {
    return {
      changed: false,
      message,
      rawSize: normalized.rawSize,
      compressedSize: normalized.rawSize
    };
  }

  const compressedContent = buildCompressedContent(normalized, message.id);

  return {
    changed: true,
    message: {
      ...message,
      role: 'tool',
      content: compressedContent
    },
    rawSize: normalized.rawSize,
    compressedSize: estimateSize(compressedContent),
    policyId: compressedContent.truncation.policyId,
    summary: compressedContent.summary
  };
}

export function readCompressedToolResultContent(value: unknown): CompressedToolResultMessageContent | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const provenance = asRecord(record.provenance);
  const truncation = asRecord(record.truncation);

  if (
    typeof record.summary !== 'string' ||
    typeof record.toolName !== 'string' ||
    !Array.isArray(record.keySignals) ||
    !provenance ||
    !truncation
  ) {
    return undefined;
  }

  if (provenance.originKind !== 'compressed' || provenance.sourceStage !== 'tool_result_persist') {
    return undefined;
  }

  return value as CompressedToolResultMessageContent;
}

export function summarizeToolResultMessageContent(value: unknown): string | undefined {
  const compressed = readCompressedToolResultContent(value);

  if (compressed) {
    return formatCompressedSummary(compressed);
  }

  const text = flattenText(value);
  return text || undefined;
}

export function buildCompressedToolResultMetadata(
  content: CompressedToolResultMessageContent
): Record<string, string | number | boolean | null | string[]> {
  return {
    toolResultCompressed: true,
    toolName: content.toolName,
    toolCallId: content.toolCallId ?? null,
    toolStatus: content.status,
    toolResultKind: content.resultKind,
    toolPolicyId: content.truncation.policyId,
    toolCompressionReason: content.truncation.reason,
    toolDroppedSections: content.truncation.droppedSections,
    toolSummary: content.summary,
    toolAffectedPaths: content.affectedPaths ?? [],
    toolKeySignals: content.keySignals,
    toolArtifactPath: content.artifact?.path ?? null,
    toolArtifactSourcePath: content.artifact?.sourcePath ?? null,
    toolArtifactSourceUrl: content.artifact?.sourceUrl ?? null,
    toolArtifactContentHash: content.artifact?.contentHash ?? null,
    toolArtifactByteLength: content.artifact?.byteLength ?? null,
    toolByteLength: content.metrics?.byteLength ?? null,
    toolLineCount: content.metrics?.lineCount ?? null,
    toolItemCount: content.metrics?.itemCount ?? null,
    toolExitCode: content.error?.exitCode ?? null,
    toolErrorCode: content.error?.code ?? null
  };
}

function normalizeToolResult(message: AgentMessageLike): NormalizedToolResult {
  const contentRecord = asRecord(message.content);
  const rawSerialized = serializeUnknown(message.content);
  const rawSize = rawSerialized.length;
  const outputText = flattenText(message.content);
  const stdout = readStringFromRecord(contentRecord, ['stdout', 'stdOut']);
  const stderr = readStringFromRecord(contentRecord, ['stderr', 'stdErr']);
  const command = firstDefinedString(
    readStringFromRecord(contentRecord, ['command', 'cmd', 'invocation', 'query']),
    readString(message.command)
  );
  const toolName = firstDefinedString(
    readString(message.toolName),
    readString(message.tool),
    readString(message.name),
    readStringFromRecord(contentRecord, ['toolName', 'tool', 'name', 'tool_name']),
    inferToolNameFromCommand(command),
    'tool_output'
  ) as string;
  const toolCallId = firstDefinedString(
    readString(message.toolCallId),
    readString(message.callId),
    readString(message.id),
    readStringFromRecord(contentRecord, ['toolCallId', 'callId', 'id'])
  );
  const exitCode = readNumberFromRecord(contentRecord, ['exitCode', 'code']);
  const errorRecord = asRecord(contentRecord?.error);
  const error = normalizeError(errorRecord, stderr, exitCode);
  const itemCount = extractItemCount(contentRecord);
  const lineCount = countLines(firstDefinedString(stdout, stderr, outputText, rawSerialized) ?? '');
  const resultKind = classifyResultKind(toolName, command, contentRecord, stdout, stderr, outputText);
  const status = determineStatus(contentRecord, error, exitCode, outputText);
  const affectedPaths = extractAffectedPaths(contentRecord, rawSerialized);
  const sourcePath = firstDefinedString(
    readStringFromRecord(contentRecord, ['sourcePath', 'path', 'filePath', 'file']),
    affectedPaths[0]
  );
  const sourceUrl = readStringFromRecord(contentRecord, ['sourceUrl', 'url', 'href']);
  const artifactPath = readStringFromRecord(contentRecord, ['artifactPath', 'logPath', 'outputPath']);
  const contentHash = createHash('sha256').update(rawSerialized).digest('hex');

  return {
    toolName,
    toolCallId,
    status,
    resultKind,
    command,
    summaryBase: readStringFromRecord(contentRecord, ['summary', 'message']),
    outputText,
    stdout,
    stderr,
    sourcePath,
    sourceUrl,
    artifactPath,
    itemCount,
    lineCount,
    exitCode,
    error,
    affectedPaths,
    rawSerialized,
    rawSize,
    contentHash
  };
}

function shouldCompress(result: NormalizedToolResult): boolean {
  if (result.rawSize > MAX_SERIALIZED_CHARS) {
    return true;
  }

  if ((result.stdout?.length ?? 0) > MAX_INLINE_TEXT_CHARS) {
    return true;
  }

  if ((result.stderr?.length ?? 0) > MAX_INLINE_TEXT_CHARS) {
    return true;
  }

  if ((result.outputText?.length ?? 0) > MAX_INLINE_TEXT_CHARS) {
    return true;
  }

  if ((result.itemCount ?? 0) > MAX_LIST_ITEMS) {
    return true;
  }

  return false;
}

function buildCompressedContent(
  result: NormalizedToolResult,
  messageId: string | undefined
): CompressedToolResultMessageContent {
  const policyId = `${result.resultKind}.${result.status}.v1`;
  const summary = buildSummary(result);
  const keySignals = buildKeySignals(result);
  const preview = buildPreviewSections(result);
  const droppedSections = buildDroppedSections(result);
  const rawSourceId = result.toolCallId ?? messageId ?? createShortId(result.contentHash);

  return {
    toolName: result.toolName,
    ...(result.toolCallId ? { toolCallId: result.toolCallId } : {}),
    status: result.status,
    resultKind: result.resultKind,
    summary,
    keySignals,
    ...(result.command ? { command: trimText(result.command, 240) } : {}),
    ...(preview ? { preview } : {}),
    metrics: {
      byteLength: result.rawSize,
      lineCount: result.lineCount,
      ...(typeof result.itemCount === 'number' ? { itemCount: result.itemCount } : {})
    },
    ...(result.affectedPaths.length > 0 ? { affectedPaths: result.affectedPaths } : {}),
    ...(result.error
      ? {
          error: {
            ...(result.error.name ? { name: result.error.name } : {}),
            ...(result.error.code ? { code: result.error.code } : {}),
            ...(result.error.message ? { message: trimText(result.error.message, 280) } : {}),
            ...(typeof result.exitCode === 'number' ? { exitCode: result.exitCode } : {})
          }
        }
      : typeof result.exitCode === 'number'
        ? {
            error: {
              exitCode: result.exitCode
            }
          }
        : {}),
    artifact: {
      ...(result.artifactPath ? { path: result.artifactPath } : {}),
      ...(result.sourcePath ? { sourcePath: result.sourcePath } : {}),
      ...(result.sourceUrl ? { sourceUrl: result.sourceUrl } : {}),
      contentHash: result.contentHash,
      byteLength: result.rawSize
    },
    truncation: {
      wasCompressed: true,
      policyId,
      reason: buildCompressionReason(result),
      droppedSections
    },
    provenance: {
      originKind: 'compressed',
      sourceStage: 'tool_result_persist',
      producer: 'compact-context',
      rawSourceId,
      rawContentHash: result.contentHash,
      createdByHook: 'tool_result_persist'
    }
  };
}

function buildSummary(result: NormalizedToolResult): string {
  if (result.summaryBase) {
    return trimText(result.summaryBase, 220);
  }

  switch (result.resultKind) {
    case 'test_run':
      return result.status === 'failure'
        ? `${result.toolName} ran ${trimText(result.command ?? 'test command', 120)} and reported test failures`
        : `${result.toolName} completed ${trimText(result.command ?? 'test execution', 120)}`;
    case 'build_run':
      return result.status === 'failure'
        ? `${result.toolName} ran ${trimText(result.command ?? 'build command', 120)} and reported build failures`
        : `${result.toolName} completed ${trimText(result.command ?? 'build execution', 120)}`;
    case 'search_listing':
      return typeof result.itemCount === 'number'
        ? `${result.toolName} returned ${result.itemCount} search hits`
        : `${result.toolName} returned search results`;
    case 'structured_query':
      return typeof result.itemCount === 'number'
        ? `${result.toolName} returned ${result.itemCount} structured items`
        : `${result.toolName} returned structured output`;
    case 'document_fetch':
    case 'file_read':
      return result.sourcePath
        ? `${result.toolName} loaded ${result.sourcePath}`
        : `${result.toolName} loaded source content`;
    case 'patch_apply':
      return result.status === 'failure'
        ? `${result.toolName} failed to apply a patch`
        : `${result.toolName} applied a patch`;
    case 'command_execution':
    case 'unknown':
    default:
      if (result.command) {
        return `${result.toolName} ran ${trimText(result.command, 120)}`;
      }

      return `${result.toolName} produced tool output`;
  }
}

function buildKeySignals(result: NormalizedToolResult): string[] {
  const signals: string[] = [];

  if (typeof result.exitCode === 'number') {
    signals.push(`exitCode=${result.exitCode}`);
  }

  if (typeof result.itemCount === 'number') {
    signals.push(`itemCount=${result.itemCount}`);
  }

  if (result.lineCount > 0) {
    signals.push(`lineCount=${result.lineCount}`);
  }

  if (result.status !== 'success') {
    signals.push(`status=${result.status}`);
  }

  if (result.error?.code) {
    signals.push(`errorCode=${result.error.code}`);
  }

  if (result.command) {
    signals.push(`command=${trimText(result.command, 80)}`);
  }

  if (result.sourcePath) {
    signals.push(`sourcePath=${trimText(result.sourcePath, 80)}`);
  }

  if (result.sourceUrl) {
    signals.push(`sourceUrl=${trimText(result.sourceUrl, 80)}`);
  }

  return dedupeStrings(signals).slice(0, MAX_SIGNALS);
}

function buildPreviewSections(
  result: NormalizedToolResult
): CompressedToolResultMessageContent['preview'] | undefined {
  const preview: NonNullable<CompressedToolResultMessageContent['preview']> = {};

  if (result.stdout) {
    preview.stdout = buildPreviewSection(result.stdout);
  }

  if (result.stderr) {
    preview.stderr = buildPreviewSection(result.stderr);
  }

  if (!result.stdout && !result.stderr && result.outputText) {
    preview.output = buildPreviewSection(result.outputText);
  }

  return Object.keys(preview).length > 0 ? preview : undefined;
}

function buildPreviewSection(text: string): {
  head?: string;
  tail?: string;
  omittedLineCount?: number;
  omittedCharCount?: number;
} {
  const normalized = text.trim();

  if (!normalized) {
    return {};
  }

  if (normalized.length <= PREVIEW_HEAD_CHARS + PREVIEW_TAIL_CHARS) {
    return {
      head: normalized
    };
  }

  return {
    head: normalized.slice(0, PREVIEW_HEAD_CHARS),
    tail: normalized.slice(-PREVIEW_TAIL_CHARS),
    omittedLineCount: Math.max(countLines(normalized) - countLines(normalized.slice(0, PREVIEW_HEAD_CHARS)) - countLines(normalized.slice(-PREVIEW_TAIL_CHARS)), 0),
    omittedCharCount: Math.max(normalized.length - PREVIEW_HEAD_CHARS - PREVIEW_TAIL_CHARS, 0)
  };
}

function buildDroppedSections(result: NormalizedToolResult): string[] {
  const sections: string[] = [];

  if ((result.stdout?.length ?? 0) > PREVIEW_HEAD_CHARS + PREVIEW_TAIL_CHARS) {
    sections.push('stdout.middle');
  }

  if ((result.stderr?.length ?? 0) > PREVIEW_HEAD_CHARS + PREVIEW_TAIL_CHARS) {
    sections.push('stderr.middle');
  }

  if (!result.stdout && !result.stderr && (result.outputText?.length ?? 0) > PREVIEW_HEAD_CHARS + PREVIEW_TAIL_CHARS) {
    sections.push('output.middle');
  }

  if ((result.itemCount ?? 0) > MAX_LIST_ITEMS) {
    sections.push('result.items.tail');
  }

  return sections;
}

function buildCompressionReason(result: NormalizedToolResult): string {
  const reasons: string[] = [];

  if (result.rawSize > MAX_SERIALIZED_CHARS) {
    reasons.push(`serialized output exceeded ${MAX_SERIALIZED_CHARS} chars`);
  }

  if ((result.stdout?.length ?? 0) > MAX_INLINE_TEXT_CHARS) {
    reasons.push('stdout was reduced to head/tail preview');
  }

  if ((result.stderr?.length ?? 0) > MAX_INLINE_TEXT_CHARS) {
    reasons.push('stderr was reduced to head/tail preview');
  }

  if (!result.stdout && !result.stderr && (result.outputText?.length ?? 0) > MAX_INLINE_TEXT_CHARS) {
    reasons.push('generic output was reduced to head/tail preview');
  }

  if ((result.itemCount ?? 0) > MAX_LIST_ITEMS) {
    reasons.push(`result list exceeded ${MAX_LIST_ITEMS} items`);
  }

  return reasons.join('; ') || 'tool output was normalized for transcript persistence';
}

function classifyResultKind(
  toolName: string,
  command: string | undefined,
  contentRecord: Record<string, unknown> | undefined,
  stdout: string | undefined,
  stderr: string | undefined,
  outputText: string | undefined
): OpenClawToolResultKind {
  const name = toolName.toLowerCase();
  const commandText = (command ?? '').toLowerCase();
  const hasQueryArrays =
    Array.isArray(contentRecord?.items) ||
    Array.isArray(contentRecord?.results) ||
    Array.isArray(contentRecord?.nodes) ||
    Array.isArray(contentRecord?.edges);

  if (/patch|apply_patch|edit/i.test(name)) {
    return 'patch_apply';
  }

  if (/pytest|jest|vitest|mocha|test/i.test(name) || /\b(pytest|jest|vitest|mocha|pnpm test|npm test)\b/.test(commandText)) {
    return 'test_run';
  }

  if (/build|tsc|webpack|vite/i.test(name) || /\b(tsc|webpack|vite build|npm run build|pnpm build)\b/.test(commandText)) {
    return 'build_run';
  }

  if (/read|fetch|open/i.test(name) && (readStringFromRecord(contentRecord, ['path', 'sourcePath', 'url', 'sourceUrl']) ?? '')) {
    return readStringFromRecord(contentRecord, ['url', 'sourceUrl']) ? 'document_fetch' : 'file_read';
  }

  if (/search|grep|find|query/i.test(name) && (Array.isArray(contentRecord?.matches) || Array.isArray(contentRecord?.hits))) {
    return 'search_listing';
  }

  if (hasQueryArrays) {
    return Array.isArray(contentRecord?.matches) || Array.isArray(contentRecord?.hits) ? 'search_listing' : 'structured_query';
  }

  if (stdout || stderr || command) {
    return 'command_execution';
  }

  if ((outputText ?? '').startsWith('{') || (outputText ?? '').startsWith('[')) {
    return 'structured_query';
  }

  return 'unknown';
}

function determineStatus(
  contentRecord: Record<string, unknown> | undefined,
  error: NormalizedToolResult['error'],
  exitCode: number | undefined,
  outputText: string | undefined
): OpenClawToolResultStatus {
  const statusValue = readStringFromRecord(contentRecord, ['status', 'state']);
  const normalizedStatus = statusValue?.toLowerCase();

  if (normalizedStatus === 'failure' || normalizedStatus === 'failed' || normalizedStatus === 'error') {
    return 'failure';
  }

  if (normalizedStatus === 'partial' || normalizedStatus === 'warning') {
    return 'partial';
  }

  if (typeof contentRecord?.ok === 'boolean') {
    return contentRecord.ok ? 'success' : 'failure';
  }

  if (error || (typeof exitCode === 'number' && exitCode !== 0)) {
    return 'failure';
  }

  if (!(outputText ?? '').trim()) {
    return 'empty';
  }

  return 'success';
}

function normalizeError(
  errorRecord: Record<string, unknown> | undefined,
  stderr: string | undefined,
  exitCode: number | undefined
): NormalizedToolResult['error'] | undefined {
  const name = readStringFromRecord(errorRecord, ['name', 'type']);
  const code = firstDefinedString(
    readStringFromRecord(errorRecord, ['code']),
    typeof exitCode === 'number' ? String(exitCode) : undefined
  );
  const message = firstDefinedString(
    readStringFromRecord(errorRecord, ['message']),
    stderr ? firstLine(stderr) : undefined
  );

  if (!name && !code && !message) {
    return undefined;
  }

  return {
    ...(name ? { name } : {}),
    ...(code ? { code } : {}),
    ...(message ? { message } : {})
  };
}

function extractItemCount(contentRecord: Record<string, unknown> | undefined): number | undefined {
  const explicitCount = readNumberFromRecord(contentRecord, ['itemCount', 'count', 'total', 'totalHits']);

  if (typeof explicitCount === 'number') {
    return explicitCount;
  }

  for (const key of ['items', 'results', 'nodes', 'edges', 'matches', 'hits', 'files']) {
    const value = contentRecord?.[key];

    if (Array.isArray(value)) {
      return value.length;
    }
  }

  return undefined;
}

function extractAffectedPaths(contentRecord: Record<string, unknown> | undefined, serialized: string): string[] {
  const collected = new Set<string>();
  const seen = new Set<unknown>();

  const visit = (value: unknown, keyHint?: string): void => {
    if (collected.size >= MAX_PATHS || value === undefined || value === null || seen.has(value)) {
      return;
    }

    if (typeof value === 'string') {
      const candidate = value.trim();

      if (isPathLike(keyHint, candidate)) {
        collected.add(trimText(candidate, 160));
      }
      return;
    }

    if (Array.isArray(value)) {
      seen.add(value);
      for (const item of value) {
        visit(item, keyHint);
        if (collected.size >= MAX_PATHS) {
          return;
        }
      }
      return;
    }

    if (value && typeof value === 'object') {
      seen.add(value);
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        visit(nested, key);
        if (collected.size >= MAX_PATHS) {
          return;
        }
      }
    }
  };

  visit(contentRecord);

  if (collected.size === 0) {
    for (const match of serialized.matchAll(/\b(?:[A-Za-z]:)?[\\/][^\s"'`<>|]+/g)) {
      const candidate = match[0];

      if (candidate) {
        collected.add(trimText(candidate, 160));
      }

      if (collected.size >= MAX_PATHS) {
        break;
      }
    }
  }

  return Array.from(collected);
}

function isPathLike(keyHint: string | undefined, value: string): boolean {
  if (!value) {
    return false;
  }

  if (keyHint && /(path|file|files|filepath|sourcepath|changed|affected|match|artifact|log)/i.test(keyHint)) {
    return true;
  }

  return /[\\/]/.test(value) || /\.([cm]?[jt]sx?|json|md|txt|log|yml|yaml|toml|ini|py|rs|go|java|cs)$/i.test(value);
}

function inferToolNameFromCommand(command: string | undefined): string | undefined {
  if (!command) {
    return undefined;
  }

  const firstToken = command.trim().split(/\s+/).find(Boolean);
  return firstToken ? firstToken.toLowerCase() : undefined;
}

function flattenText(content: unknown): string {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => flattenText(item))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  const record = asRecord(content);

  if (!record) {
    return '';
  }

  if (typeof record.text === 'string') {
    return record.text.trim();
  }

  if (typeof record.content === 'string') {
    return record.content.trim();
  }

  if (Array.isArray(record.content)) {
    return record.content
      .map((item) => flattenText(item))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  return '';
}

function serializeUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? '');
  }
}

function formatCompressedSummary(content: CompressedToolResultMessageContent): string {
  const prefix = `[tool:${content.toolName}]`;
  const signals = content.keySignals.slice(0, 3).join(' | ');

  return [prefix, content.summary, signals].filter(Boolean).join(' ');
}

function estimateSize(value: unknown): number {
  return serializeUnknown(value).length;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumberFromRecord(record: Record<string, unknown> | undefined, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = record?.[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function readStringFromRecord(record: Record<string, unknown> | undefined, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record?.[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function readStringArrayFromRecord(record: Record<string, unknown> | undefined, keys: readonly string[]): string[] {
  for (const key of keys) {
    const value = record?.[key];

    if (!Array.isArray(value)) {
      continue;
    }

    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  return [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function firstDefinedString(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.length > 0);
}

function countLines(text: string): number {
  if (!text) {
    return 0;
  }

  return text.split(/\r?\n/).length;
}

function firstLine(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

function trimText(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function createShortId(hash: string): string {
  return hash.slice(0, 16);
}

function isToolRole(role: unknown): boolean {
  return role === 'tool' || role === 'toolResult';
}
