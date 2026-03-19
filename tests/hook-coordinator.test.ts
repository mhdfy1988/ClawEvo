import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { registerLifecycleHooks } from '@openclaw-compact-context/openclaw-adapter/openclaw/hook-coordinator';
import { readCompressedToolResultContent } from '@openclaw-compact-context/openclaw-adapter/openclaw/tool-result-policy';
import type {
  AgentMessageLike,
  OpenClawHookRegistrationOptions,
  OpenClawPluginApi,
  OpenClawPluginLogger
} from '@openclaw-compact-context/openclaw-adapter/openclaw/types';
import { createOversizedFailureToolMessage } from './fixtures/tool-result-fixtures.js';

test('registerLifecycleHooks wires tool_result_persist, compresses oversized tool messages, and persists artifact sidecars', async () => {
  let toolPersistHandler: ((event: unknown, ctx: unknown) => Promise<unknown> | unknown) | undefined;
  const stateDir = await mkdtemp(join(tmpdir(), 'compact-context-hook-'));

  try {
    const logger: OpenClawPluginLogger = {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      debug: () => undefined
    };

    const api: OpenClawPluginApi = {
      id: 'test-plugin',
      name: 'Test Plugin',
      logger,
      runtime: {
        state: {
          resolveStateDir: () => stateDir
        }
      },
      registerContextEngine: () => undefined,
      registerGatewayMethod: () => undefined,
      on: () => undefined,
      registerHook: (events, handler, _opts?: OpenClawHookRegistrationOptions) => {
        const names = Array.isArray(events) ? events : [events];

        if (names.includes('tool_result_persist')) {
          toolPersistHandler = handler as (event: unknown, ctx: unknown) => Promise<unknown> | unknown;
        }
      }
    };

    registerLifecycleHooks(api, {} as never, {
      dbPath: undefined,
      defaultTokenBudget: 12000,
      compileBudgetRatio: 0.3,
      enableGatewayMethods: true,
      recentRawMessageCount: 8
    }, logger);

    assert.ok(toolPersistHandler);

    const rawMessage = createOversizedFailureToolMessage();
    const event = {
      message: rawMessage
    };
    const nextEvent = (await toolPersistHandler(event, {
      sessionId: 'session-tool'
    })) as { message: AgentMessageLike };
    const compressed = readCompressedToolResultContent(nextEvent.message.content);

    assert.ok(compressed);
    assert.equal(compressed.provenance.sourceStage, 'tool_result_persist');
    assert.equal(nextEvent.message.role, 'tool');
    assert.ok(compressed.summary.length > 0);
    assert.ok(compressed.artifact?.path);

    const artifactFile = await readFile(compressed.artifact?.path as string, 'utf8');

    assert.match(artifactFile, /compact-context\.tool-result-artifact\.v1/);
    assert.match(artifactFile, /pytest -q/);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test('registerLifecycleHooks refreshes derived artifacts after host compaction with hook provenance', async () => {
  let afterCompactionHandler: ((event: unknown, ctx: unknown) => Promise<unknown> | unknown) | undefined;
  const checkpointRequests: Array<Record<string, unknown>> = [];
  const skillRequests: Array<Record<string, unknown>> = [];

  const logger: OpenClawPluginLogger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined
  };

  const api: OpenClawPluginApi = {
    id: 'test-plugin',
    name: 'Test Plugin',
    logger,
    runtime: {
      state: {
        resolveStateDir: () => 'C:\\temp\\compact-context-hook'
      }
    },
    registerContextEngine: () => undefined,
    registerGatewayMethod: () => undefined,
    on: (eventName, handler) => {
      if (eventName === 'after_compaction') {
        afterCompactionHandler = handler as (event: unknown, ctx: unknown) => Promise<unknown> | unknown;
      }
    },
    registerHook: () => undefined
  };

  registerLifecycleHooks(
    api,
    {
      get: async () =>
        ({
          compileContext: async () => ({
            id: 'bundle-after-compaction',
            sessionId: 'session-after-compaction',
            query: 'refresh compacted session context',
            activeRules: [],
            activeConstraints: [],
            recentDecisions: [],
            recentStateChanges: [],
            relevantEvidence: [],
            candidateSkills: [],
            openRisks: [],
            tokenBudget: {
              total: 120,
              used: 48,
              reserved: 72
            },
            createdAt: '2026-03-19T12:00:00.000Z'
          }),
          getLatestCheckpoint: async () => undefined,
          createCheckpoint: async (request: Record<string, unknown>) => {
            checkpointRequests.push(request);
            return {
              checkpoint: { id: 'checkpoint-after-compaction' },
              delta: { id: 'delta-after-compaction' }
            };
          },
          crystallizeSkills: async (request: Record<string, unknown>) => {
            skillRequests.push(request);
            return { candidates: [] };
          }
        }) as never,
      wasRecentlyCompactedByPlugin: () => false
    } as never,
    {
      dbPath: undefined,
      defaultTokenBudget: 12000,
      compileBudgetRatio: 0.3,
      enableGatewayMethods: true,
      recentRawMessageCount: 8
    },
    logger
  );

  assert.ok(afterCompactionHandler);

  await afterCompactionHandler?.(
    {
      sessionFile: undefined,
      compactedCount: 3
    },
    {
      sessionId: 'session-after-compaction'
    }
  );

  assert.equal(checkpointRequests.length, 1);
  assert.equal(skillRequests.length, 1);
  assert.equal(checkpointRequests[0]?.triggerSource, 'after_compaction_hook');
  assert.equal(checkpointRequests[0]?.triggerCompressionMode, 'full');
  assert.equal(skillRequests[0]?.triggerSource, 'after_compaction_hook');
  assert.equal(skillRequests[0]?.triggerCompressionMode, 'full');
});


