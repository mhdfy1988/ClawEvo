import type { AgentMessageLike } from '../../openclaw/types.js';
import { applyToolResultPolicy } from '../../openclaw/tool-result-policy.js';

export function createOversizedFailureToolMessage(): AgentMessageLike {
  const stdout = Array.from({ length: 120 }, (_, index) => `PASS test_case_${index} src/module_${index % 5}.test.ts`)
    .join('\n');
  const stderr = [
    'FAILED tests/context-compiler.test.ts::selects_open_risks',
    'AssertionError: expected open risk node to be selected',
    'at ContextCompiler.compile (src/runtime/context-compiler.ts:120:13)',
    ...Array.from({ length: 80 }, (_, index) => `trace_line_${index}: pytest failure detail ${index}`)
  ].join('\n');

  return {
    id: 'tool-call-001',
    role: 'tool',
    timestamp: '2026-03-13T10:00:00.000Z',
    content: {
      toolName: 'shell_command',
      toolCallId: 'call_tool_result_001',
      status: 'failure',
      command: 'pytest -q',
      stdout,
      stderr,
      exitCode: 1,
      error: {
        name: 'ProcessExitError',
        code: 'EXIT_NON_ZERO',
        message: 'pytest exited with code 1'
      },
      affectedPaths: [
        'src/runtime/context-compiler.ts',
        'src/runtime/ingest-pipeline.ts',
        'src/tests/context-compiler.test.ts'
      ]
    }
  };
}

export function createCompressedFailureToolMessage(): AgentMessageLike {
  return applyToolResultPolicy(createOversizedFailureToolMessage()).message;
}

export function createCompressedToolTranscript(): string {
  const message = createCompressedFailureToolMessage();

  return [
    JSON.stringify({
      type: 'session',
      id: 'session-tool-result',
      timestamp: '2026-03-13T09:59:59.000Z'
    }),
    JSON.stringify({
      id: 'entry-tool-result-001',
      type: 'message',
      timestamp: '2026-03-13T10:00:00.000Z',
      message
    })
  ].join('\n');
}

