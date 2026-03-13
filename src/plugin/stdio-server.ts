import { createInterface } from 'node:readline';

import type { ContextPluginRequest, ContextPluginResponse } from './api.js';
import { ContextEnginePlugin } from './context-engine-plugin.js';

export interface StdioServerOptions {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  errorOutput?: NodeJS.WritableStream;
}

export class ContextPluginStdioServer {
  private readonly input: NodeJS.ReadableStream;
  private readonly output: NodeJS.WritableStream;
  private readonly errorOutput: NodeJS.WritableStream;

  constructor(
    private readonly plugin: ContextEnginePlugin,
    options: StdioServerOptions = {}
  ) {
    this.input = options.input ?? process.stdin;
    this.output = options.output ?? process.stdout;
    this.errorOutput = options.errorOutput ?? process.stderr;
  }

  async start(): Promise<void> {
    const readline = createInterface({
      input: this.input,
      crlfDelay: Infinity
    });

    for await (const rawLine of readline) {
      const line = rawLine.trim();

      if (!line) {
        continue;
      }

      const response = await this.handleLine(line);
      this.output.write(`${JSON.stringify(response)}\n`);
    }
  }

  private async handleLine(line: string): Promise<ContextPluginResponse> {
    let request: ContextPluginRequest | undefined;

    try {
      request = JSON.parse(line) as ContextPluginRequest;
    } catch (error) {
      return {
        requestId: 'invalid-json',
        method: 'health',
        ok: false,
        data: {
          ok: true
        },
        error: {
          code: 'INVALID_JSON',
          message: error instanceof Error ? error.message : 'Failed to parse JSON request.'
        }
      };
    }

    try {
      return await this.plugin.handle(request);
    } catch (error) {
      this.errorOutput.write(formatError(request, error));

      return {
        requestId: request.requestId,
        method: request.method,
        ok: false,
        data: undefined as never,
        error: {
          code: 'PLUGIN_RUNTIME_ERROR',
          message: error instanceof Error ? error.message : 'Unknown plugin runtime error.'
        }
      };
    }
  }
}

function formatError(request: ContextPluginRequest, error: unknown): string {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  return `[context-plugin] requestId=${request.requestId} method=${request.method}\n${message}\n`;
}
