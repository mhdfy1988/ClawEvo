import test from 'node:test';
import assert from 'node:assert/strict';

import { registerLifecycleHooks } from '../openclaw/hook-coordinator.js';
import { readCompressedToolResultContent } from '../openclaw/tool-result-policy.js';
import type {
  AgentMessageLike,
  OpenClawHookRegistrationOptions,
  OpenClawPluginApi,
  OpenClawPluginLogger
} from '../openclaw/types.js';
import { createOversizedFailureToolMessage } from './fixtures/tool-result-fixtures.js';

test('registerLifecycleHooks wires tool_result_persist and compresses oversized tool messages', () => {
  let toolPersistHandler: ((event: unknown, ctx: unknown) => unknown) | undefined;

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
    registerContextEngine: () => undefined,
    registerGatewayMethod: () => undefined,
    on: () => undefined,
    registerHook: (events, handler, _opts?: OpenClawHookRegistrationOptions) => {
      const names = Array.isArray(events) ? events : [events];

      if (names.includes('tool_result_persist')) {
        toolPersistHandler = handler as (event: unknown, ctx: unknown) => unknown;
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
  const nextEvent = toolPersistHandler(event, { sessionId: 'session-tool' }) as { message: AgentMessageLike };
  const compressed = readCompressedToolResultContent(nextEvent.message.content);

  assert.ok(compressed);
  assert.equal(compressed.provenance.sourceStage, 'tool_result_persist');
  assert.equal(nextEvent.message.role, 'tool');
  assert.ok(compressed.summary.length > 0);
});
