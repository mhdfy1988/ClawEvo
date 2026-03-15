export type ToolResultCompressionStatus = 'success' | 'empty' | 'partial' | 'failure';

export type ToolResultCompressionKind =
  | 'command_execution'
  | 'structured_query'
  | 'search_listing'
  | 'document_fetch'
  | 'file_read'
  | 'patch_apply'
  | 'test_run'
  | 'build_run'
  | 'unknown';

export interface ToolResultCompressionMetadataView {
  compressed: true;
  toolName?: string;
  toolCallId?: string;
  status?: ToolResultCompressionStatus;
  resultKind?: ToolResultCompressionKind;
  summary?: string;
  keySignals: string[];
  affectedPaths: string[];
  policyId: string;
  reason?: string;
  droppedSections: string[];
  lookup: {
    artifactPath?: string;
    sourcePath?: string;
    sourceUrl?: string;
    contentHash?: string;
    byteLength?: number;
  };
  metrics: {
    byteLength?: number;
    lineCount?: number;
    itemCount?: number;
  };
  error?: {
    exitCode?: number;
    code?: string;
  };
}

export function readCompressedToolResultMetadata(
  value: unknown
): ToolResultCompressionMetadataView | undefined {
  const metadata = asRecord(value);

  if (!metadata || metadata.toolResultCompressed !== true) {
    return undefined;
  }

  const policyId = readStringFromRecord(metadata, ['toolPolicyId']);
  if (!policyId) {
    return undefined;
  }

  const toolName = readStringFromRecord(metadata, ['toolName']);
  const toolCallId = readStringFromRecord(metadata, ['toolCallId']);
  const status = readToolResultStatus(metadata);
  const resultKind = readToolResultKind(metadata);
  const summary = readStringFromRecord(metadata, ['toolSummary']);
  const reason = readStringFromRecord(metadata, ['toolCompressionReason']);
  const artifactPath = readStringFromRecord(metadata, ['toolArtifactPath']);
  const sourcePath = readStringFromRecord(metadata, ['toolArtifactSourcePath']);
  const sourceUrl = readStringFromRecord(metadata, ['toolArtifactSourceUrl']);
  const contentHash = readStringFromRecord(metadata, ['toolArtifactContentHash']);
  const artifactByteLength = readNumberFromRecord(metadata, ['toolArtifactByteLength']);
  const byteLength = readNumberFromRecord(metadata, ['toolByteLength']);
  const lineCount = readNumberFromRecord(metadata, ['toolLineCount']);
  const itemCount = readNumberFromRecord(metadata, ['toolItemCount']);
  const exitCode = readNumberFromRecord(metadata, ['toolExitCode']);
  const errorCode = readStringFromRecord(metadata, ['toolErrorCode']);

  return {
    compressed: true,
    ...(toolName ? { toolName } : {}),
    ...(toolCallId ? { toolCallId } : {}),
    ...(status ? { status } : {}),
    ...(resultKind ? { resultKind } : {}),
    ...(summary ? { summary } : {}),
    keySignals: readStringArrayFromRecord(metadata, ['toolKeySignals']),
    affectedPaths: readStringArrayFromRecord(metadata, ['toolAffectedPaths']),
    policyId,
    ...(reason ? { reason } : {}),
    droppedSections: readStringArrayFromRecord(metadata, ['toolDroppedSections']),
    lookup: {
      ...(artifactPath ? { artifactPath } : {}),
      ...(sourcePath ? { sourcePath } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(contentHash ? { contentHash } : {}),
      ...(typeof artifactByteLength === 'number' ? { byteLength: artifactByteLength } : {})
    },
    metrics: {
      ...(typeof byteLength === 'number' ? { byteLength } : {}),
      ...(typeof lineCount === 'number' ? { lineCount } : {}),
      ...(typeof itemCount === 'number' ? { itemCount } : {})
    },
    ...(typeof exitCode === 'number' || errorCode
      ? {
          error: {
            ...(typeof exitCode === 'number' ? { exitCode } : {}),
            ...(errorCode ? { code: errorCode } : {})
          }
        }
      : {})
  };
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

function readToolResultStatus(
  record: Record<string, unknown> | undefined
): ToolResultCompressionStatus | undefined {
  const status = readStringFromRecord(record, ['toolStatus']);
  return status === 'success' || status === 'empty' || status === 'partial' || status === 'failure'
    ? status
    : undefined;
}

function readToolResultKind(
  record: Record<string, unknown> | undefined
): ToolResultCompressionKind | undefined {
  const kind = readStringFromRecord(record, ['toolResultKind']);
  return kind === 'command_execution' ||
    kind === 'structured_query' ||
    kind === 'search_listing' ||
    kind === 'document_fetch' ||
    kind === 'file_read' ||
    kind === 'patch_apply' ||
    kind === 'test_run' ||
    kind === 'build_run' ||
    kind === 'unknown'
    ? kind
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
