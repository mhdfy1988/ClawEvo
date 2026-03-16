#!/usr/bin/env node

import { homedir } from 'node:os';
import { resolve } from 'node:path';

import {
  ControlPlaneFacade,
  GovernanceService,
  ImportService,
  ObservabilityService,
  buildDefaultImporterRegistry
} from '@openclaw-compact-context/control-plane-core';
import { ControlPlaneHttpServer } from '@openclaw-compact-context/control-plane-shell/server';
import {
  ContextEngineRuntimeManager,
  normalizePluginConfig
} from '@openclaw-compact-context/openclaw-adapter/openclaw/context-engine-adapter';
import { OpenClawControlPlaneRuntimeBridge } from '@openclaw-compact-context/openclaw-adapter/openclaw/control-plane-runtime-bridge';

interface CliOptions {
  host: string;
  port: number;
  dbPath?: string;
  stateDir?: string;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const logger = createLogger();
  const config = normalizePluginConfig({
    dbPath: options.dbPath,
    enableGatewayMethods: false
  });
  const runtime = new ContextEngineRuntimeManager(
    config,
    logger,
    resolve,
    () => options.stateDir
  );
  const runtimeReadModel = new OpenClawControlPlaneRuntimeBridge(runtime, config);
  const facade = new ControlPlaneFacade(
    new GovernanceService(),
    new ObservabilityService(),
    new ImportService(),
    buildDefaultImporterRegistry()
  );
  const server = new ControlPlaneHttpServer(runtimeReadModel, facade, logger);

  const cleanup = async (): Promise<void> => {
    await server.close();
    await runtime.close();
  };

  process.on('SIGINT', () => {
    void cleanup().finally(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    void cleanup().finally(() => process.exit(0));
  });

  try {
    const address = await server.start({
      host: options.host,
      port: options.port
    });
    process.stdout.write(
      `Compact Context control-plane listening on http://${address.host === '::' ? '127.0.0.1' : address.host}:${address.port}\n`
    );
  } catch (error) {
    await cleanup();
    throw error;
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    host: '127.0.0.1',
    port: 3210,
    stateDir: defaultStateDir()
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--host') {
      options.host = args[index + 1] ?? options.host;
      index += 1;
      continue;
    }

    if (arg === '--port') {
      const parsed = Number(args[index + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.port = parsed;
      }
      index += 1;
      continue;
    }

    if (arg === '--db') {
      options.dbPath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--state-dir') {
      options.stateDir = args[index + 1];
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
      'Compact Context Control Plane',
      '',
      'Usage:',
      '  openclaw-control-plane [--host <host>] [--port <port>] [--db <path>] [--state-dir <path>]',
      '',
      'Options:',
      '  --host <host>       Bind host. Default: 127.0.0.1',
      '  --port <port>       Bind port. Default: 3210',
      '  --db <path>         Override SQLite database path.',
      '  --state-dir <path>  OpenClaw state directory used for db/snapshot/session discovery.',
      '  -h, --help          Show this help text.'
    ].join('\n')
  );
}

function defaultStateDir(): string {
  return process.env.OPENCLAW_STATE_DIR ? resolve(process.env.OPENCLAW_STATE_DIR) : resolve(homedir(), '.openclaw');
}

function createLogger() {
  return {
    info(message: string, meta?: Record<string, unknown>) {
      writeLog('info', message, meta);
    },
    warn(message: string, meta?: Record<string, unknown>) {
      writeLog('warn', message, meta);
    },
    error(message: string, meta?: Record<string, unknown>) {
      writeLog('error', message, meta);
    },
    debug(message: string, meta?: Record<string, unknown>) {
      writeLog('debug', message, meta);
    }
  };
}

function writeLog(level: string, message: string, meta?: Record<string, unknown>): void {
  const payload = meta ? ` ${JSON.stringify(meta)}` : '';
  process.stderr.write(`[control-plane:${level}] ${message}${payload}\n`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
