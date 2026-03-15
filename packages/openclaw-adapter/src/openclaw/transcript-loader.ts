import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { annotateContextInputRoute } from '@openclaw-compact-context/runtime-core';
import type { RawContextInput, RawContextRecord } from '@openclaw-compact-context/contracts';
import {
  buildCompressedToolResultMetadata,
  readCompressedToolResultContent,
  summarizeToolResultMessageContent
} from './tool-result-policy.js';
import type { AgentMessageLike } from './types.js';

type TranscriptHeader = {
  type: 'session';
  id?: string;
  cwd?: string;
  timestamp?: string;
  parentSession?: string;
};

type TranscriptEntry =
  | TranscriptMessageEntry
  | TranscriptCustomMessageEntry
  | TranscriptCompactionEntry
  | TranscriptOtherEntry;

interface TranscriptEntryBase {
  id?: string;
  parentId?: string;
  timestamp?: string;
  type: string;
  [key: string]: unknown;
}

interface TranscriptMessageEntry extends TranscriptEntryBase {
  type: 'message';
  message: AgentMessageLike;
}

interface TranscriptCustomMessageEntry extends TranscriptEntryBase {
  type: 'custom_message';
  customType?: string;
  content?: unknown;
  display?: unknown;
  details?: unknown;
}

interface TranscriptCompactionEntry extends TranscriptEntryBase {
  type: 'compaction';
  summary?: string;
  firstKeptEntryId?: string;
  tokensBefore?: number;
  details?: unknown;
  fromHook?: boolean;
}

interface TranscriptOtherEntry extends TranscriptEntryBase {}

interface ParsedTranscript {
  header?: TranscriptHeader;
  branch: TranscriptEntry[];
}

export async function loadTranscriptContextInput(params: {
  sessionId: string;
  sessionFile: string;
}): Promise<RawContextInput> {
  const parsed = await parseTranscriptFile(params.sessionFile);

  return {
    sessionId: params.sessionId,
    records: parsed.branch
      .map((entry) => mapTranscriptEntryToRecord(params.sessionId, entry))
      .filter((record): record is RawContextRecord => Boolean(record))
  };
}

export async function loadTranscriptMessages(params: {
  sessionFile: string;
}): Promise<AgentMessageLike[]> {
  const parsed = await parseTranscriptFile(params.sessionFile);

  return parsed.branch
    .filter((entry): entry is TranscriptMessageEntry => isTranscriptMessageEntry(entry))
    .map((entry) => ({
      ...entry.message,
      ...(typeof entry.id === 'string' && entry.id.length > 0 ? { id: entry.id } : {}),
      ...(typeof entry.timestamp === 'string' && entry.timestamp.length > 0 && !entry.message.timestamp
        ? { timestamp: entry.timestamp }
        : {}),
      ...(typeof entry.parentId === 'string' && entry.parentId.length > 0 ? { parentId: entry.parentId } : {})
    }));
}

async function parseTranscriptFile(sessionFile: string): Promise<ParsedTranscript> {
  try {
    const raw = await readFile(sessionFile, 'utf8');
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return { branch: [] };
    }

    const parsedLines = lines
      .map((line, index) => {
        try {
          return { line: JSON.parse(line) as unknown, index };
        } catch {
          return undefined;
        }
      })
      .filter((value): value is { line: unknown; index: number } => Boolean(value));

    let header: TranscriptHeader | undefined;
    const entries: Array<TranscriptEntry & { __order: number }> = [];

    for (const parsed of parsedLines) {
      if (isTranscriptHeader(parsed.line)) {
        header = parsed.line;
        continue;
      }

      if (isTranscriptEntry(parsed.line)) {
        entries.push({ ...parsed.line, __order: parsed.index });
      }
    }

    return {
      header,
      branch: resolveBranch(entries).map((entry) => {
        const { __order: _ignored, ...rest } = entry;
        return rest as TranscriptEntry;
      })
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === 'ENOENT') {
      return { branch: [] };
    }

    throw error;
  }
}

function resolveBranch(entries: Array<TranscriptEntry & { __order: number }>): Array<TranscriptEntry & { __order: number }> {
  if (entries.length === 0) {
    return [];
  }

  const branchableEntries = entries.filter((entry) => typeof entry.id === 'string' && entry.id.length > 0);

  if (branchableEntries.length === 0) {
    return entries;
  }

  const referencedParentIds = new Set(
    branchableEntries
      .map((entry) => entry.parentId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
  );

  const leaf = [...branchableEntries]
    .filter((entry) => !referencedParentIds.has(entry.id as string))
    .sort((left, right) => left.__order - right.__order)
    .at(-1);

  if (!leaf?.id) {
    return entries;
  }

  const entriesById = new Map(branchableEntries.map((entry) => [entry.id as string, entry]));
  const branchIds = new Set<string>();
  let cursor: (TranscriptEntry & { __order: number }) | undefined = leaf;

  while (cursor?.id && !branchIds.has(cursor.id)) {
    branchIds.add(cursor.id);
    cursor =
      typeof cursor.parentId === 'string' && cursor.parentId.length > 0
        ? entriesById.get(cursor.parentId)
        : undefined;
  }

  return entries
    .filter((entry) => {
      if (!entry.id) {
        return false;
      }

      return branchIds.has(entry.id);
    })
    .sort((left, right) => left.__order - right.__order);
}

function mapTranscriptEntryToRecord(sessionId: string, entry: TranscriptEntry): RawContextRecord | undefined {
  if (isTranscriptMessageEntry(entry)) {
    return mapMessageEntry(sessionId, entry);
  }

  if (isTranscriptCustomMessageEntry(entry)) {
    return mapCustomMessageEntry(sessionId, entry);
  }

  if (isTranscriptCompactionEntry(entry)) {
    return mapCompactionEntry(sessionId, entry);
  }

  return undefined;
}

function mapMessageEntry(sessionId: string, entry: TranscriptMessageEntry): RawContextRecord | undefined {
  const role = normalizeRole(entry.message.role);
  const compressedToolResult = role === 'tool' ? readCompressedToolResultContent(entry.message.content) : undefined;
  const content =
    (role === 'tool' ? summarizeToolResultMessageContent(entry.message.content) : undefined) ??
    stringifyMessageContent(entry.message.content);

  if (!content) {
    return undefined;
  }

  const recordId = entry.id ?? hashId(sessionId, entry.type, JSON.stringify(entry.message));

  return annotateContextInputRoute({
    id: recordId,
    scope: 'session',
    sourceType: role === 'system' ? 'system' : role === 'tool' ? 'tool_output' : 'conversation',
    role,
    content,
    createdAt: readOptionalString(entry.timestamp) ?? readOptionalString(entry.message.timestamp),
    provenance: compressedToolResult
      ? {
          ...compressedToolResult.provenance,
          rawSourceId: compressedToolResult.provenance.rawSourceId ?? recordId,
          rawContentHash:
            compressedToolResult.provenance.rawContentHash ??
            createHash('sha256').update(JSON.stringify(entry.message.content)).digest('hex'),
          ...(entry.id ? { transcriptEntryId: entry.id } : {}),
          ...(entry.parentId ? { transcriptParentId: entry.parentId } : {})
        }
      : {
          originKind: 'raw',
          sourceStage: 'transcript_message',
          producer: 'openclaw',
          rawSourceId: recordId,
          rawContentHash: createHash('sha256').update(content).digest('hex'),
          ...(entry.id ? { transcriptEntryId: entry.id } : {}),
          ...(entry.parentId ? { transcriptParentId: entry.parentId } : {})
        },
    metadata: {
      transcriptType: entry.type,
      entryId: entry.id ?? null,
      parentId: entry.parentId ?? null,
      ...(role === 'user' ? { nodeType: 'Intent' } : {}),
      ...(role === 'assistant' ? { nodeType: 'Decision' } : {}),
      ...(role === 'tool' ? { nodeType: 'State' } : {}),
      ...(compressedToolResult ? buildCompressedToolResultMetadata(compressedToolResult) : {})
    }
  });
}

function mapCustomMessageEntry(sessionId: string, entry: TranscriptCustomMessageEntry): RawContextRecord | undefined {
  const content = composeCustomMessageContent(entry);

  if (!content) {
    return undefined;
  }

  const recordId = entry.id ?? hashId(sessionId, entry.type, entry.customType ?? '', content);
  const originKind = isCompressedCustomMessage(entry) ? 'compressed' : 'raw';
  const nodeType = inferNodeTypeFromCustomEntry(entry, content);
  const sourceType = inferSourceTypeFromNodeType(nodeType);

  return annotateContextInputRoute({
    id: recordId,
    scope: 'session',
    sourceType,
    role: 'system',
    content,
    createdAt: readOptionalString(entry.timestamp),
    provenance: {
      originKind,
      sourceStage: 'transcript_custom',
      producer: originKind === 'compressed' ? 'compact-context' : 'openclaw',
      rawSourceId: recordId,
      rawContentHash: createHash('sha256').update(content).digest('hex'),
      ...(entry.id ? { transcriptEntryId: entry.id } : {}),
      ...(entry.parentId ? { transcriptParentId: entry.parentId } : {})
    },
    metadata: {
      transcriptType: entry.type,
      customType: entry.customType ?? null,
      entryId: entry.id ?? null,
      parentId: entry.parentId ?? null,
      nodeType,
      semanticGroupKey: buildTranscriptSemanticGroupKey('custom', nodeType, entry.customType, content),
      displayJson: entry.display === undefined ? null : JSON.stringify(entry.display),
      detailsJson: entry.details === undefined ? null : JSON.stringify(entry.details)
    }
  });
}

function mapCompactionEntry(sessionId: string, entry: TranscriptCompactionEntry): RawContextRecord | undefined {
  const summary = composeCompactionContent(entry);

  if (!summary) {
    return undefined;
  }

  const recordId = entry.id ?? hashId(sessionId, entry.type, summary);
  const nodeType = inferNodeTypeFromCompactionEntry(entry, summary);
  const sourceType = inferCompactionSourceType(nodeType);

  return annotateContextInputRoute({
    id: recordId,
    scope: 'session',
    sourceType,
    role: 'system',
    content: summary,
    createdAt: readOptionalString(entry.timestamp),
    provenance: {
      originKind: 'compressed',
      sourceStage: 'transcript_compaction',
      producer: entry.fromHook ? 'compact-context' : 'openclaw',
      rawSourceId: recordId,
      rawContentHash: createHash('sha256').update(summary).digest('hex'),
      compressionRunId: recordId,
      ...(entry.id ? { transcriptEntryId: entry.id } : {}),
      ...(entry.parentId ? { transcriptParentId: entry.parentId } : {})
    },
    metadata: {
      transcriptType: entry.type,
      entryId: entry.id ?? null,
      parentId: entry.parentId ?? null,
      nodeType,
      semanticGroupKey: buildTranscriptSemanticGroupKey('compaction', nodeType, entry.firstKeptEntryId, summary),
      firstKeptEntryId: entry.firstKeptEntryId ?? null,
      tokensBefore: typeof entry.tokensBefore === 'number' ? entry.tokensBefore : null,
      fromHook: entry.fromHook ?? null,
      detailsJson: entry.details === undefined ? null : JSON.stringify(entry.details)
    }
  });
}

function inferNodeTypeFromCustomType(customType: string | undefined): string {
  const normalized = (customType ?? '').toLowerCase();

  if (normalized.includes('constraint')) {
    return 'Constraint';
  }

  if (normalized.includes('rule')) {
    return 'Rule';
  }

  if (normalized.includes('skill')) {
    return 'Skill';
  }

  if (normalized.includes('mode')) {
    return 'Mode';
  }

  if (normalized.includes('outcome') || normalized.includes('result')) {
    return 'Outcome';
  }

  if (normalized.includes('tool')) {
    return 'Tool';
  }

  if (normalized.includes('step')) {
    return 'Step';
  }

  if (normalized.includes('risk') || normalized.includes('warning')) {
    return 'Risk';
  }

  if (normalized.includes('process') || normalized.includes('workflow')) {
    return 'Process';
  }

  return 'State';
}

function inferNodeTypeFromCustomEntry(entry: TranscriptCustomMessageEntry, content: string): string {
  const byType = inferNodeTypeFromCustomType(entry.customType);

  if (byType !== 'State') {
    return byType;
  }

  return inferNodeTypeFromTranscriptText(content);
}

function inferNodeTypeFromCompactionEntry(entry: TranscriptCompactionEntry, summary: string): string {
  if (entry.firstKeptEntryId) {
    const inferred = inferNodeTypeFromTranscriptText(summary);

    if (inferred !== 'State') {
      return inferred;
    }
  }

  return inferNodeTypeFromTranscriptText(summary);
}

function inferNodeTypeFromTranscriptText(content: string): string {
  const normalized = content.toLowerCase();

  if (/\b(mode|operating mode|debug mode|strict mode)\b/.test(normalized) || /模式|调试模式|严格模式/.test(normalized)) {
    return 'Mode';
  }

  if (
    /\b(expected outcome|outcome|result should be|success means|target result)\b/.test(normalized) ||
    /结果应该|预期结果|产出|目标结果/.test(normalized)
  ) {
    return 'Outcome';
  }

  if (/\b(tooling|tool choice|preferred tool|use tool)\b/.test(normalized) || /工具选择|推荐工具|使用工具/.test(normalized)) {
    return 'Tool';
  }

  if (
    /\b(must|must not|should not|cannot|can't|never|forbid|required|constraint)\b/.test(normalized) ||
    /必须|不能|不可|禁止|约束|要求/.test(normalized)
  ) {
    return 'Constraint';
  }

  if (/(^|\n)\s*(step\s*\d+|next step|\d+[\.\)]|第[一二三四五六七八九十\d]+步|下一步)/m.test(normalized)) {
    return 'Step';
  }

  if (/\b(process|workflow|pipeline|roadmap|phase|stage)\b/.test(normalized) || /流程|工作流|阶段/.test(normalized)) {
    return 'Process';
  }

  if (/\b(risk|warning|blocker|blocked|conflict|failure|issue)\b/.test(normalized) || /风险|警告|阻塞|冲突|失败/.test(normalized)) {
    return 'Risk';
  }

  if (/\b(rule|policy|guideline)\b/.test(normalized) || /规则|规范|准则/.test(normalized)) {
    return 'Rule';
  }

  if (/\b(skill|pattern|playbook)\b/.test(normalized) || /技能|模式|手册/.test(normalized)) {
    return 'Skill';
  }

  return 'State';
}

function inferSourceTypeFromNodeType(nodeType: string): RawContextRecord['sourceType'] {
  if (nodeType === 'Rule' || nodeType === 'Constraint') {
    return 'rule';
  }

  if (nodeType === 'Process' || nodeType === 'Step') {
    return 'workflow';
  }

  if (nodeType === 'Outcome') {
    return 'workflow';
  }

  if (nodeType === 'Skill') {
    return 'skill';
  }

  return 'system';
}

function inferCompactionSourceType(nodeType: string): RawContextRecord['sourceType'] {
  if (nodeType === 'Rule' || nodeType === 'Constraint') {
    return 'rule';
  }

  return 'workflow';
}

function composeCustomMessageContent(entry: TranscriptCustomMessageEntry): string {
  return joinTextParts(
    stringifyMessageContent(entry.content),
    stringifyMessageContent(entry.display),
    stringifyMessageContent(entry.details)
  );
}

function composeCompactionContent(entry: TranscriptCompactionEntry): string | undefined {
  return joinTextParts(readOptionalString(entry.summary), stringifyMessageContent(entry.details)) || undefined;
}

function buildTranscriptSemanticGroupKey(
  stage: 'custom' | 'compaction',
  nodeType: string,
  hint: string | undefined,
  content: string
): string {
  const anchor = normalizeSemanticAnchor(content).slice(0, 72);
  return [stage, nodeType.toLowerCase(), (hint ?? '').toLowerCase(), anchor].filter(Boolean).join('|');
}

function normalizeSemanticAnchor(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCompressedCustomMessage(entry: TranscriptCustomMessageEntry): boolean {
  const normalized = `${entry.customType ?? ''} ${stringifyMessageContent(entry.display)} ${stringifyMessageContent(entry.details)}`.toLowerCase();
  return /summary|compact|compression|checkpoint/.test(normalized);
}

function isTranscriptHeader(value: unknown): value is TranscriptHeader {
  return Boolean(value && typeof value === 'object' && (value as { type?: string }).type === 'session');
}

function isTranscriptEntry(value: unknown): value is TranscriptEntry {
  return Boolean(value && typeof value === 'object' && typeof (value as { type?: string }).type === 'string');
}

function isTranscriptMessageEntry(value: TranscriptEntry): value is TranscriptMessageEntry {
  return value.type === 'message' && 'message' in value;
}

function isTranscriptCustomMessageEntry(value: TranscriptEntry): value is TranscriptCustomMessageEntry {
  return value.type === 'custom_message';
}

function isTranscriptCompactionEntry(value: TranscriptEntry): value is TranscriptCompactionEntry {
  return value.type === 'compaction';
}

function normalizeRole(role: unknown): RawContextRecord['role'] {
  if (role === 'assistant' || role === 'system' || role === 'tool') {
    return role;
  }

  if (role === 'toolResult') {
    return 'tool';
  }

  return 'user';
}

function stringifyMessageContent(content: unknown): string {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => stringifyContentItem(item))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  if (content && typeof content === 'object') {
    return stringifyContentItem(content);
  }

  return '';
}

function stringifyContentItem(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return String(value ?? '');
  }

  const record = value as Record<string, unknown>;

  if (typeof record.text === 'string') {
    return record.text;
  }

  if (typeof record.content === 'string') {
    return record.content;
  }

  if (Array.isArray(record.content)) {
    return record.content.map((item) => stringifyContentItem(item)).join('\n');
  }

  return JSON.stringify(record);
}

function joinTextParts(...parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join('\n')
    .trim();
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function hashId(...parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
