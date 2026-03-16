import { createHash } from 'node:crypto';

import { ContextEngine } from '@openclaw-compact-context/runtime-core/engine/context-engine';
import type { NormalizedPluginConfig } from '@openclaw-compact-context/openclaw-adapter/openclaw/context-engine-adapter';
import {
  buildCompressedToolResultMetadata,
  readCompressedToolResultContent,
  summarizeToolResultMessageContent
} from '@openclaw-compact-context/openclaw-adapter/openclaw/tool-result-policy';
import { createCompressedFailureToolMessage } from './tool-result-fixtures.js';

export interface DebugSmokeFixture {
  engine: ContextEngine;
  sessionId: string;
  selectedRiskNodeId: string;
  skippedStepNodeId: string;
  defaultQuery: string;
  totalTokenBudget: number;
  compileTokenBudget: number;
}

export function createDebugSmokePluginConfig(): NormalizedPluginConfig {
  return {
    defaultTokenBudget: 12000,
    compileBudgetRatio: 0.3,
    enableGatewayMethods: true,
    recentRawMessageCount: 8
  };
}

export async function createDebugSmokeFixture(sessionId = 'session-debug-smoke'): Promise<DebugSmokeFixture> {
  const engine = new ContextEngine();

  await engine.ingest({
    sessionId,
    records: [
      {
        id: `${sessionId}:goal`,
        scope: 'session',
        sourceType: 'conversation',
        role: 'user',
        content: 'We need to understand why the build is blocked and keep provenance intact.',
        metadata: {
          nodeType: 'Goal'
        }
      },
      {
        id: `${sessionId}:rule`,
        scope: 'session',
        sourceType: 'rule',
        role: 'system',
        content: 'Always preserve provenance when selecting context.',
        metadata: {
          nodeType: 'Rule'
        }
      },
      {
        id: `${sessionId}:step`,
        scope: 'session',
        sourceType: 'workflow',
        role: 'system',
        content:
          'Step 4: produce a long current process explanation with enough detail to overflow the tiny debug budget while still being semantically recognizable as the current step.'
      },
      {
        id: `${sessionId}:risk`,
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: 'build failed and is blocked by a sqlite timeout during migration step 4.',
        metadata: {
          toolStatus: 'failure',
          toolExitCode: 1,
          toolResultKind: 'build_run'
        }
      },
      {
        id: `${sessionId}:evidence`,
        scope: 'session',
        sourceType: 'document',
        role: 'system',
        content:
          'supporting evidence: the current build log points to a migration timeout, but this note is lower priority than the explicit open risk.',
        metadata: {
          nodeType: 'Evidence'
        }
      }
    ]
  });

  const [riskNode] = await engine.queryNodes({
    sessionId,
    types: ['Risk']
  });
  const [stepNode] = await engine.queryNodes({
    sessionId,
    types: ['Step']
  });

  if (!riskNode || !stepNode) {
    throw new Error('failed to create debug smoke fixture nodes');
  }

  return {
    engine,
    sessionId,
    selectedRiskNodeId: riskNode.id,
    skippedStepNodeId: stepNode.id,
    defaultQuery: 'why is the build blocked',
    totalTokenBudget: 2400,
    compileTokenBudget: 720
  };
}

export async function createCompressedToolSmokeFixture(
  sessionId = 'session-debug-smoke-compressed'
): Promise<{
  engine: ContextEngine;
  sessionId: string;
  compressedNodeId: string;
}> {
  const engine = new ContextEngine();
  const message = createCompressedFailureToolMessage();
  const compressedContent = readCompressedToolResultContent(message.content);

  if (!compressedContent) {
    throw new Error('expected compressed tool result fixture to contain compressed content');
  }

  await engine.ingest({
    sessionId,
    records: [
      {
        id: `${sessionId}:compressed-tool`,
        scope: 'session',
        sourceType: 'tool_output',
        role: 'tool',
        content: summarizeToolResultMessageContent(message.content) ?? compressedContent.summary,
        provenance: {
          ...compressedContent.provenance,
          rawSourceId: compressedContent.provenance.rawSourceId ?? `${sessionId}:compressed-tool`,
          rawContentHash:
            compressedContent.provenance.rawContentHash ??
            createHash('sha256').update(JSON.stringify(message.content)).digest('hex')
        },
        metadata: {
          ...buildCompressedToolResultMetadata(compressedContent),
          nodeType: 'State'
        }
      }
    ]
  });

  const [compressedNode] = await engine.queryNodes({
    sessionId,
    originKinds: ['compressed']
  });

  if (!compressedNode) {
    throw new Error('failed to create compressed tool smoke fixture node');
  }

  return {
    engine,
    sessionId,
    compressedNodeId: compressedNode.id
  };
}


