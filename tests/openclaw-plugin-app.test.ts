import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveRepoRoot } from './repo-root.js';

const REPO_ROOT = resolveRepoRoot(import.meta.url);

class MockProgram {
  readonly name: string;
  readonly children = new Map<string, MockProgram>();
  actionHandler?: (...args: unknown[]) => Promise<unknown> | unknown;

  constructor(name = 'root') {
    this.name = name;
  }

  command(name: string): MockProgram {
    const normalizedName = name.trim().split(/\s+/)[0] ?? name;
    const command = new MockProgram(normalizedName);
    this.children.set(normalizedName, command);
    return command;
  }

  description(_text: string): MockProgram {
    return this;
  }

  addHelpText(_position: 'before' | 'after', _text: string | (() => string)): MockProgram {
    return this;
  }

  option(_flags: string, _description?: string, _defaultValue?: unknown): MockProgram {
    return this;
  }

  argument(_name: string, _description?: string): MockProgram {
    return this;
  }

  action(handler: (...args: unknown[]) => Promise<unknown> | unknown): MockProgram {
    this.actionHandler = handler;
    return this;
  }
}

test('openclaw-plugin workspace publishes a thin shell with adapter dependency', async () => {
  const manifest = JSON.parse(
    await readFile(resolve(REPO_ROOT, 'apps/openclaw-plugin/package.json'), 'utf8')
  ) as {
    scripts?: Record<string, string>;
    bin?: Record<string, string>;
    files?: string[];
    dependencies?: Record<string, string>;
    openclaw?: {
      extensions?: string[];
    };
  };
  const pluginManifest = JSON.parse(
    await readFile(resolve(REPO_ROOT, 'apps/openclaw-plugin/openclaw.plugin.json'), 'utf8')
  ) as {
    id?: string;
    kind?: string;
  };

  assert.equal(
    manifest.scripts?.test,
    'node ../../scripts/run-current-workspace-script.mjs workspace-artifacts test:local'
  );
  assert.equal(manifest.dependencies?.['@openclaw-compact-context/openclaw-adapter'], '0.1.0');
  assert.equal(manifest.dependencies?.['@openclaw-compact-context/compact-context-core'], '0.1.0');
  assert.equal(manifest.dependencies?.['@openclaw-compact-context/llm-toolkit'], '0.1.0');
  assert.equal(manifest.dependencies?.['@openclaw-compact-context/runtime-core'], undefined);
  assert.equal(manifest.bin?.['openclaw-context-plugin'], './dist/bin/openclaw-context-plugin.js');
  assert.equal(manifest.bin?.['openclaw-context-cli'], './dist/bin/openclaw-context-cli.js');
  assert.ok(manifest.files?.includes('compact-context.llm.config.example.json'));
  assert.deepEqual(manifest.openclaw?.extensions, ['./src/index.ts']);
  assert.equal(pluginManifest.id, 'compact-context');
  assert.equal(pluginManifest.kind, 'context-engine');
});

test('openclaw-plugin app dist keeps adapter forwarding plus compact-context-core assembly boundary', async () => {
  const indexSource = await readFile(resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/index.js'), 'utf8');
  const binSource = await readFile(resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/bin/openclaw-context-plugin.js'), 'utf8');
  const cliBinSource = await readFile(resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/bin/openclaw-context-cli.js'), 'utf8');
  const cliRuntimeSource = await readFile(resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/cli/context-cli-runtime.js'), 'utf8');

  assert.match(indexSource, /export \* from '@openclaw-compact-context\/openclaw-adapter';/);
  assert.match(indexSource, /createOpenClawPlugin/);
  assert.match(indexSource, /registerCompactContextHostCli/);
  assert.match(indexSource, /compact-context/);
  assert.match(binSource, /import '@openclaw-compact-context\/openclaw-adapter\/bin';/);
  assert.match(cliBinSource, /executeContextCli/);
  assert.match(cliRuntimeSource, /OpenClaw Context CLI/);
  assert.match(cliRuntimeSource, /roundtrip/);
  assert.match(cliRuntimeSource, /explain/);
  assert.match(cliRuntimeSource, /codex-oauth/);
  assert.match(cliRuntimeSource, /openai-responses/);
});

test('openclaw-plugin registers compact-context host subcommand when cli api is available', async () => {
  const pluginModule = (await import(pathToFileURL(resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/index.js')).href)) as {
    default: {
      register?: (api: Record<string, unknown>) => Promise<void> | void;
    };
  };
  const registeredCli: Array<{
    registrar: (ctx: {
      program: MockProgram;
      config: Record<string, unknown>;
      workspaceDir?: string;
      logger: Record<string, (...args: unknown[]) => void>;
    }) => Promise<void> | void;
    commands: string[];
  }> = [];
  const noop = () => undefined;

  const registerResult = pluginModule.default.register?.({
    id: 'compact-context-test',
    name: 'compact-context-test',
    logger: {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop
    },
    pluginConfig: {},
    resolvePath: (input: string) => input,
    runtime: {
      state: {
        resolveStateDir: () => REPO_ROOT
      }
    },
    registerContextEngine: noop,
    registerGatewayMethod: noop,
    registerHook: noop,
    on: noop,
    registerCli(
      registrar: (ctx: {
        program: MockProgram;
        config: Record<string, unknown>;
        workspaceDir?: string;
        logger: Record<string, (...args: unknown[]) => void>;
      }) => Promise<void> | void,
      opts?: {
        commands?: string[];
      }
    ) {
      registeredCli.push({
        registrar,
        commands: opts?.commands ?? []
      });
    }
  });

  assert.ok(!(registerResult && typeof (registerResult as Promise<unknown>).then === 'function'));

  assert.equal(registeredCli.length, 1);
  assert.deepEqual(registeredCli[0]?.commands, ['compact-context']);

  const program = new MockProgram();
  await registeredCli[0]!.registrar({
    program,
    config: {},
    workspaceDir: REPO_ROOT,
    logger: {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop
    }
  });

  const compactContext = program.children.get('compact-context');
  assert.ok(compactContext);
  assert.ok(compactContext?.children.has('summarize'));
  assert.ok(compactContext?.children.has('roundtrip'));
  assert.ok(compactContext?.children.has('explain'));
  assert.ok(compactContext?.children.has('models'));
  assert.ok(compactContext?.children.has('auth'));

  const modelsList = compactContext?.children.get('models')?.children.get('list');
  assert.ok(modelsList?.actionHandler);

  let stdout = '';
  let stderr = '';
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;

  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;

  try {
    await modelsList!.actionHandler?.({ json: true });
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  assert.equal(stderr, '');
  assert.match(stdout, /"providers":/);
});


