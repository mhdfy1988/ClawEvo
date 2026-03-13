import { createHash } from 'node:crypto';

import type { RawContextInput, RawContextRecord, RawContextSourceType } from '../types/io.js';
import {
  ContextEngineRuntimeManager,
  type NormalizedPluginConfig,
  resolveCompileBudget
} from './context-engine-adapter.js';
import {
  applyToolResultPolicy,
  buildCompressedToolResultMetadata,
  readCompressedToolResultContent,
  summarizeToolResultMessageContent
} from './tool-result-policy.js';
import { resolveToolResultArtifactRoot, ToolResultArtifactStore } from './tool-result-artifact-store.js';
import { loadTranscriptContextInput } from './transcript-loader.js';
import type {
  AgentMessageLike,
  OpenClawHookAfterCompactionEvent,
  OpenClawHookAgentContext,
  OpenClawHookBeforeCompactionEvent,
  OpenClawHookToolResultPersistEvent,
  OpenClawPluginApi,
  OpenClawPluginLogger
} from './types.js';

const PLUGIN_ID = 'compact-context';
const POST_COMPACTION_QUERY = 'refresh compacted session context';

export function registerLifecycleHooks(
  api: OpenClawPluginApi,
  runtime: ContextEngineRuntimeManager,
  config: NormalizedPluginConfig,
  logger: OpenClawPluginLogger
): void {
  const artifactStore = new ToolResultArtifactStore(
    resolveToolResultArtifactRoot({
      stateDir: safelyResolveStateDir(api),
      resolvePath: api.resolvePath
    }),
    logger
  );

  if (!api.on) {
    logger.warn(`[${PLUGIN_ID}] plugin api does not expose typed hooks; compaction lifecycle sync disabled`);
  } else {
    api.on(
      'before_compaction',
      async (event, ctx) => {
        const sessionId = resolveSessionId(ctx);

        if (!sessionId) {
          logger.warn(`[${PLUGIN_ID}] before_compaction hook missing session id; skipping`);
          return;
        }

        try {
          const imported = await syncSessionState({
            runtime,
            sessionId,
            hookName: 'before_compaction',
            sessionFile: event.sessionFile,
            messages: event.messages
          });

          logger.debug?.(`[${PLUGIN_ID}] before_compaction synchronized session state`, {
            sessionId,
            importedRecords: imported,
            messageCount: event.messageCount,
            compactingCount: event.compactingCount ?? null
          });
        } catch (error) {
          logger.warn(`[${PLUGIN_ID}] before_compaction sync failed`, {
            sessionId,
            err: error instanceof Error ? error.message : String(error)
          });
        }
      },
      {
        priority: 0
      }
    );

    api.on(
      'after_compaction',
      async (event, ctx) => {
        const sessionId = resolveSessionId(ctx);

        if (!sessionId) {
          logger.warn(`[${PLUGIN_ID}] after_compaction hook missing session id; skipping`);
          return;
        }

        if (runtime.wasRecentlyCompactedByPlugin(sessionId)) {
          logger.debug?.(`[${PLUGIN_ID}] after_compaction already handled by context engine compact()`, {
            sessionId
          });
          return;
        }

        try {
          const engine = await runtime.get(event.sessionFile);
          const imported = await syncSessionState({
            runtime,
            sessionId,
            hookName: 'after_compaction',
            sessionFile: event.sessionFile
          });

          const bundle = await engine.compileContext({
            sessionId,
            query: POST_COMPACTION_QUERY,
            tokenBudget: resolveCompileBudget(config.defaultTokenBudget, config)
          });
          const checkpointResult = await engine.createCheckpoint({
            sessionId,
            bundle
          });

          await engine.crystallizeSkills({
            sessionId,
            bundle
          });

          logger.info(`[${PLUGIN_ID}] after_compaction refreshed checkpoint and skill candidates`, {
            sessionId,
            importedRecords: imported,
            compactedCount: event.compactedCount,
            checkpointId: checkpointResult.checkpoint.id
          });
        } catch (error) {
          logger.warn(`[${PLUGIN_ID}] after_compaction refresh failed`, {
            sessionId,
            err: error instanceof Error ? error.message : String(error)
          });
        }
      },
      {
        priority: 0
      }
    );
  }

  registerToolResultPersistHook(api, logger, artifactStore);
}

async function syncSessionState(params: {
  runtime: ContextEngineRuntimeManager;
  sessionId: string;
  hookName: 'before_compaction' | 'after_compaction';
  sessionFile?: string;
  messages?: AgentMessageLike[];
}): Promise<number> {
  const engine = await params.runtime.get(params.sessionFile);
  const input = await loadHookContextInput(params);

  if (input.records.length === 0) {
    return 0;
  }

  await engine.ingest(input);
  return input.records.length;
}

async function loadHookContextInput(params: {
  sessionId: string;
  hookName: 'before_compaction' | 'after_compaction';
  sessionFile?: string;
  messages?: AgentMessageLike[];
}): Promise<RawContextInput> {
  if (params.sessionFile) {
    return loadTranscriptContextInput({
      sessionId: params.sessionId,
      sessionFile: params.sessionFile
    });
  }

  return {
    sessionId: params.sessionId,
    records: (params.messages ?? [])
      .map((message) => mapAgentMessageToRecord(params.sessionId, message, params.hookName))
      .filter((record): record is RawContextRecord => Boolean(record))
  };
}

function mapAgentMessageToRecord(
  sessionId: string,
  message: AgentMessageLike,
  hookName: 'before_compaction' | 'after_compaction'
): RawContextRecord | undefined {
  const role = normalizeRole(message.role);
  const compressedToolResult = role === 'tool' ? readCompressedToolResultContent(message.content) : undefined;
  const content =
    (role === 'tool' ? summarizeToolResultMessageContent(message.content) : undefined) ?? stringifyMessageContent(message.content);

  if (!content) {
    return undefined;
  }

  const sourceType = roleToSourceType(role);
  const recordId = message.id ? `${sessionId}:${message.id}` : hashId(sessionId, JSON.stringify(message));

  return {
    id: recordId,
    scope: 'session',
    sourceType,
    role,
    content,
    createdAt: readOptionalString(message.timestamp),
    provenance: compressedToolResult
      ? {
          ...compressedToolResult.provenance,
          rawSourceId: compressedToolResult.provenance.rawSourceId ?? recordId,
          rawContentHash:
            compressedToolResult.provenance.rawContentHash ??
            createHash('sha256').update(JSON.stringify(message.content)).digest('hex')
        }
      : {
          originKind: 'raw',
          sourceStage: role === 'tool' ? 'tool_output_raw' : 'hook_message_snapshot',
          producer: 'openclaw',
          rawSourceId: recordId,
          rawContentHash: createHash('sha256').update(content).digest('hex'),
          createdByHook: hookName
        },
    metadata: {
      importedByHook: true,
      ...(role === 'user' ? { nodeType: 'Intent' } : {}),
      ...(role === 'assistant' ? { nodeType: 'Decision' } : {}),
      ...(role === 'tool' ? { nodeType: 'State' } : {}),
      ...(compressedToolResult ? buildCompressedToolResultMetadata(compressedToolResult) : {})
    }
  };
}

function registerToolResultPersistHook(
  api: OpenClawPluginApi,
  logger: OpenClawPluginLogger,
  artifactStore: ToolResultArtifactStore
): void {
  if (!api.registerHook) {
    logger.warn(`[${PLUGIN_ID}] plugin api does not expose generic hooks; tool_result_persist disabled`);
    return;
  }

  api.registerHook(
    'tool_result_persist',
    async (event: unknown, ctx: unknown) => {
      const extracted = extractToolResultPersistMessage(event);

      if (!extracted) {
        return event;
      }

      const decision = await artifactStore.persistDecision(extracted.message, applyToolResultPolicy(extracted.message));

      if (!decision.changed) {
        return event;
      }

      const compressed = readCompressedToolResultContent(decision.message.content);

      logger.debug?.(`[${PLUGIN_ID}] tool_result_persist compressed tool output`, {
        sessionId: resolveSessionId((ctx as OpenClawHookAgentContext | undefined) ?? {}),
        rawSize: decision.rawSize,
        compressedSize: decision.compressedSize,
        policyId: decision.policyId ?? null,
        summary: decision.summary ?? null,
        artifactPath: compressed?.artifact?.path ?? null
      });

      return extracted.rebuild(decision.message);
    },
    {
      priority: 0,
      name: `${PLUGIN_ID}:tool_result_persist`
    }
  );
}

function extractToolResultPersistMessage(event: unknown):
  | {
      message: AgentMessageLike;
      rebuild: (nextMessage: AgentMessageLike) => unknown;
    }
  | undefined {
  if (isToolMessage(event)) {
    return {
      message: event,
      rebuild: (nextMessage) => nextMessage
    };
  }

  const record = event as OpenClawHookToolResultPersistEvent | undefined;

  if (record && isToolMessage(record.message)) {
    return {
      message: record.message,
      rebuild: (nextMessage) => ({
        ...record,
        message: nextMessage
      })
    };
  }

  if (record && isToolMessage(record.toolResult)) {
    return {
      message: record.toolResult,
      rebuild: (nextMessage) => ({
        ...record,
        toolResult: nextMessage
      })
    };
  }

  if (record && isToolMessage(record.result)) {
    return {
      message: record.result,
      rebuild: (nextMessage) => ({
        ...record,
        result: nextMessage
      })
    };
  }

  return undefined;
}

function resolveSessionId(ctx: OpenClawHookAgentContext): string | undefined {
  return readOptionalString(ctx.sessionId) ?? readOptionalString(ctx.sessionKey);
}

function safelyResolveStateDir(api: OpenClawPluginApi): string | undefined {
  try {
    return api.runtime?.state?.resolveStateDir?.();
  } catch {
    return undefined;
  }
}

function roleToSourceType(role: RawContextRecord['role']): RawContextSourceType {
  if (role === 'system') {
    return 'system';
  }

  if (role === 'tool') {
    return 'tool_output';
  }

  return 'conversation';
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

function isToolMessage(value: unknown): value is AgentMessageLike {
  return Boolean(value && typeof value === 'object' && normalizeRole((value as AgentMessageLike).role) === 'tool');
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
