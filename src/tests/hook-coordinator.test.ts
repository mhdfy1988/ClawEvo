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
