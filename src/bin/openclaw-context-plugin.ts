#!/usr/bin/env node

import { resolve } from 'node:path';

import { ContextEngine } from '../engine/context-engine.js';
import { ContextEnginePlugin } from '../plugin/context-engine-plugin.js';
import { ContextPluginStdioServer } from '../plugin/stdio-server.js';

interface CliOptions {
  dbPath?: string;
  memory: boolean;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const engine = options.memory
    ? new ContextEngine()
    : await ContextEngine.openSqlite({
        dbPath: resolve(options.dbPath ?? './.openclaw/context-engine.sqlite')
      });

  const plugin = new ContextEnginePlugin(engine);
  const server = new ContextPluginStdioServer(plugin);

  const cleanup = async (): Promise<void> => {
    await engine.close();
  };

  process.on('SIGINT', () => {
    void cleanup().finally(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    void cleanup().finally(() => process.exit(0));
  });

  try {
    await server.start();
  } finally {
    await cleanup();
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    memory: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--memory') {
      options.memory = true;
      continue;
    }

    if (arg === '--db') {
      options.dbPath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  process.stdout.write(
    [
      'OpenClaw Context Engine Plugin',
      '',
      'Usage:',
      '  openclaw-context-plugin [--db <path>] [--memory]',
      '',
      'Options:',
      '  --db <path>   Use a SQLite database file for graph and context persistence.',
      '  --memory      Run fully in memory without SQLite persistence.',
      '  -h, --help    Show this help text.'
    ].join('\n')
  );
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
