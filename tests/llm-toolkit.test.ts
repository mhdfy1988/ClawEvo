import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveRepoRoot } from './repo-root.js';

const REPO_ROOT = resolveRepoRoot(import.meta.url);

async function loadToolkitModule() {
  return import(pathToFileURL(resolve(REPO_ROOT, 'packages/llm-toolkit/dist/index.js')).href) as Promise<{
    LlmProviderRegistry: new (options?: {
      availabilityCacheTtlMs?: number;
      cooldownMs?: number;
      now?: () => number;
    }) => {
      register(provider: {
        id: string;
        label: string;
        transport:
          | 'codex-cli'
          | 'codex-oauth'
          | 'openai-responses'
          | 'openai-compatible-chat'
          | 'openai-compatible-responses';
        isAvailable(): Promise<{ available: boolean; configured: boolean; reason: string }>;
        generateText(input: { prompt: string }): Promise<{
          providerId: string;
          providerLabel: string;
          transport:
            | 'codex-cli'
            | 'codex-oauth'
            | 'openai-responses'
            | 'openai-compatible-chat'
            | 'openai-compatible-responses';
          text: string;
        }>;
      }): unknown;
      generateWithOrder(
        input: { prompt: string },
        order: readonly string[]
      ): Promise<{
        result: {
          providerId: string;
          transport:
            | 'codex-cli'
            | 'codex-oauth'
            | 'openai-responses'
            | 'openai-compatible-chat'
            | 'openai-compatible-responses';
          text: string;
        };
        attempts: string[];
        failures: Array<{
          providerId: string;
          stage: string;
          code?: string;
          message: string;
          transport?:
            | 'codex-cli'
            | 'codex-oauth'
            | 'openai-responses'
            | 'openai-compatible-chat'
            | 'openai-compatible-responses';
        }>;
      }>;
      listAvailability(): Promise<
        Array<{
          provider: {
            id: string;
            label: string;
            transport:
              | 'codex-cli'
              | 'codex-oauth'
              | 'openai-responses'
              | 'openai-compatible-chat'
              | 'openai-compatible-responses';
          };
          availability: {
            available: boolean;
            configured: boolean;
            reason: string;
          };
        }>
      >;
    };
    CodexCliTextProvider: new (options?: {
      command?: string;
      spawnSyncImpl?: typeof import('node:child_process').spawnSync;
    }) => {
      isAvailable(): { available: boolean; configured: boolean; reason: string; details?: Record<string, string> };
      generateText(input: { prompt: string }): Promise<{
        providerId: string;
        transport: 'codex-cli';
        text: string;
        diagnostics?: Record<string, unknown>;
      }>;
    };
    OpenClawCodexOAuthSession: new (options?: {
      credentialFilePath?: string;
      fetchFn?: typeof fetch;
      openExternalUrl?: (url: string) => Promise<void> | void;
    }) => {
      saveCredential(credential: { access: string; refresh?: string; expires?: number; accountId?: string }): Promise<void>;
      loadCredential(): Promise<{ access: string; refresh?: string; expires?: number; accountId?: string } | null>;
      beginAuthorization(): Promise<{
        state: string;
        verifier: string;
        authorizationUrl: string;
      }>;
      loginWithBrowser(timeoutMs?: number): Promise<{
        access: string;
        refresh?: string;
        expires?: number;
        accountId?: string;
      }>;
    };
    buildOpenExternalCommand(url: string): {
      command: string;
      args: string[];
      windowsVerbatimArguments?: boolean;
    };
    OpenClawCodexOAuthTextProvider: new (options?: {
      session?: {
        getAvailability(): Promise<{ available: boolean; configured: boolean; reason: string }>;
        getValidCredential(): Promise<{ access: string; refresh?: string; expires?: number; accountId?: string }>;
      };
      defaultTransport?: 'sse' | 'websocket' | 'auto';
      completeSimpleImpl?: (
        model: { id: string; provider: string; api: string; baseUrl: string },
        context: {
          systemPrompt?: string;
          messages: Array<{
            role: 'user';
            content: string;
            timestamp: number;
          }>;
        },
        options?: {
          apiKey?: string;
          transport?: 'sse' | 'websocket' | 'auto';
          reasoning?: 'low' | 'medium' | 'high';
          maxTokens?: number;
        }
      ) => Promise<{
        content: Array<
          | { type: 'text'; text: string }
          | { type: 'thinking'; thinking: string }
        >;
        stopReason: string;
      }>;
      getModelImpl?: (provider: string, modelId: string) => {
        id: string;
        provider: string;
        api: string;
        baseUrl: string;
      };
    }) => {
      isAvailable(): Promise<{ available: boolean; configured: boolean; reason: string }>;
      generateText(input: { prompt: string }): Promise<{
        providerId: string;
        providerLabel: string;
        transport: 'codex-oauth';
        text: string;
        diagnostics?: Record<string, unknown>;
      }>;
    };
    OpenAIResponsesTextProvider: new (options?: {
      apiKey?: string;
      fetchFn?: typeof fetch;
    }) => {
      isAvailable(): { available: boolean; configured: boolean; reason: string };
      generateText(input: { prompt: string }): Promise<{
        providerId: string;
        transport: 'openai-responses';
        text: string;
      }>;
    };
    OpenAICompatibleChatTextProvider: new (options: {
      id: string;
      label?: string;
      baseUrl?: string;
      apiKey?: string;
      apiKeyEnv?: string;
      defaultModel?: string;
      auth?: 'none' | 'api-key';
      fetchFn?: typeof fetch;
    }) => {
      isAvailable(): { available: boolean; configured: boolean; reason: string };
      generateText(input: { prompt: string; model?: string }): Promise<{
        providerId: string;
        transport: 'openai-compatible-chat';
        text: string;
      }>;
    };
    OpenAICompatibleResponsesTextProvider: new (options: {
      id: string;
      label?: string;
      baseUrl?: string;
      apiKey?: string;
      apiKeyEnv?: string;
      defaultModel?: string;
      auth?: 'none' | 'api-key';
      fetchFn?: typeof fetch;
    }) => {
      isAvailable(): { available: boolean; configured: boolean; reason: string };
      generateText(input: { prompt: string; model?: string }): Promise<{
        providerId: string;
        transport: 'openai-compatible-responses';
        text: string;
      }>;
    };
    createDefaultCodexProviderRegistry(options?: {
      configFilePath?: string;
      codexCli?: false | Record<string, unknown>;
      codexOauth?: false | Record<string, unknown>;
      openaiResponses?: false | Record<string, unknown>;
    }): {
      listProviders(): Array<{ id: string }>;
    };
    createCodexProviderRegistry(options?: {
      configFilePath?: string;
      codexCli?: false | Record<string, unknown>;
      codexOauth?: false | Record<string, unknown>;
      openaiResponses?: false | Record<string, unknown>;
    }): {
      listProviders(): Array<{ id: string }>;
    };
    resolveCodexProviderOrder(
      mode: 'auto' | 'codex' | 'codex-cli' | 'codex-oauth' | 'openai-responses',
      options?: {
        configFilePath?: string;
        registeredProviderIds?: readonly string[];
      }
    ): string[];
    loadLlmToolkitConfig(options?: {
      configFilePath?: string;
      cwd?: string;
      fallbackDirs?: string[];
    }): {
      source: 'defaults' | 'inline' | 'file';
      filePath?: string;
      config: {
        catalog?: {
          providerOrder?: string[];
          providers?: Record<
            string,
            {
              enabled?: boolean;
              status?: 'implemented' | 'experimental' | 'planned';
              label?: string;
              vendor?: string;
              auth?: 'none' | 'api-key' | 'oauth' | 'cli';
              api?:
                | 'codex-cli'
                | 'openai-codex-responses'
                | 'openai-responses'
                | 'openai-chat-completions'
                | 'openai-compatible-responses'
                | 'openai-compatible-chat-completions'
                | 'ollama-chat'
                | 'custom';
              models?: Array<{ id: string }>;
            }
          >;
        };
        codex?: {
          providerOrder?: string[];
          providers?: {
            'codex-cli'?: { enabled?: boolean };
            'codex-oauth'?: { enabled?: boolean };
            'openai-responses'?: { enabled?: boolean };
          };
        };
      };
    };
    listCatalogProviders(config?: {
      catalog?: {
        providers?: Record<string, unknown>;
      };
    }): Array<{
      id: string;
      enabled: boolean;
      status: string;
      api?: string;
      auth?: string;
      models: Array<{ id: string }>;
    }>;
    resolveCatalogProviderOrder(config?: {
      catalog?: {
        providerOrder?: string[];
        providers?: Record<string, unknown>;
      };
    }): string[];
    createCatalogProviderRegistry(options?: {
      configFilePath?: string;
    }): {
      listProviders(): Array<{ id: string; transport: string }>;
      getProvider(id: string): {
        isAvailable():
          | { available: boolean; configured: boolean; reason: string }
          | Promise<{ available: boolean; configured: boolean; reason: string }>;
      };
    };
    loadLlmToolkitState(options?: {
      configFilePath?: string;
    }): {
      source: 'defaults' | 'file';
      filePath: string;
      state: {
        currentModelRef?: string;
      };
    };
    saveCurrentModelRef(
      modelRef: string | undefined,
      options?: {
        configFilePath?: string;
      }
    ): {
      filePath: string;
      state: {
        currentModelRef?: string;
      };
    };
    saveDefaultModelRef(
      modelRef: string | undefined,
      options?: {
        configFilePath?: string;
        cwd?: string;
        fallbackDirs?: string[];
      }
    ): {
      source: 'defaults' | 'inline' | 'file';
      filePath?: string;
      configDir?: string;
      config: {
        runtime?: {
          defaultModelRef?: string;
        };
      };
    };
    resolveModelSelection(options?: {
      configFilePath?: string;
      mode?: string;
      registeredProviderIds?: readonly string[];
    }): {
      currentModelRef?: string;
      defaultModelRef?: string;
      effectiveModelRef?: string;
      effectiveSource?: 'state' | 'config';
      stateFilePath: string;
    };
    createLlmToolkitRuntime(options?: {
      configFilePath?: string;
      cwd?: string;
      fallbackDirs?: string[];
    }): {
      loadedConfig: {
        source: 'defaults' | 'inline' | 'file';
        filePath?: string;
      };
      createRegistry(mode: 'llm' | 'auto' | 'codex' | 'codex-cli' | 'codex-oauth' | 'openai-responses'): {
        listProviders(): Array<{ id: string }>;
      };
      resolveProviderOrder(
        mode: 'llm' | 'auto' | 'codex' | 'codex-cli' | 'codex-oauth' | 'openai-responses',
        registeredProviderIds?: readonly string[]
      ): string[];
      resolveModelSelection(input?: {
        mode?: string;
        registeredProviderIds?: readonly string[];
      }): {
        currentModelRef?: string;
        defaultModelRef?: string;
        effectiveModelRef?: string;
        effectiveSource?: 'state' | 'config';
        stateFilePath: string;
      };
      resolveTextRuntime(input: {
        mode: 'llm' | 'auto' | 'codex' | 'codex-cli' | 'codex-oauth' | 'openai-responses';
      }): {
        providerOrder: string[];
        registeredProviderIds: string[];
        modelSelection: {
          effectiveModelRef?: string;
          effectiveSource?: 'state' | 'config';
        };
      };
    };
  }>;
}

async function loadToolkitCodexModule() {
  return import(pathToFileURL(resolve(REPO_ROOT, 'packages/llm-toolkit/dist/codex.js')).href) as Promise<{
    createCodexProviderRegistry(options?: {
      configFilePath?: string;
      codexCli?: false | Record<string, unknown>;
      codexOauth?: false | Record<string, unknown>;
      openaiResponses?: false | Record<string, unknown>;
    }): {
      listProviders(): Array<{ id: string }>;
    };
    createDefaultCodexProviderRegistry(options?: {
      configFilePath?: string;
      codexCli?: false | Record<string, unknown>;
      codexOauth?: false | Record<string, unknown>;
      openaiResponses?: false | Record<string, unknown>;
    }): {
      listProviders(): Array<{ id: string }>;
    };
    resolveCodexProviderOrder(
      mode: 'auto' | 'codex' | 'codex-cli' | 'codex-oauth' | 'openai-responses',
      options?: {
        configFilePath?: string;
        registeredProviderIds?: readonly string[];
      }
    ): string[];
  }>;
}

test('llm toolkit registry can skip unavailable provider and use next provider', async () => {
  const { LlmProviderRegistry } = await loadToolkitModule();
  const registry = new LlmProviderRegistry();

  registry.register({
    id: 'codex-cli',
    label: 'codex-cli',
    transport: 'codex-cli',
    async isAvailable() {
      return {
        available: false,
        configured: false,
        reason: 'cli missing'
      };
    },
    async generateText() {
      throw new Error('should not run');
    }
  });
  registry.register({
    id: 'openai-responses',
    label: 'openai-responses',
    transport: 'openai-responses',
    async isAvailable() {
      return {
        available: true,
        configured: true,
        reason: 'ready'
      };
    },
    async generateText() {
      return {
        providerId: 'openai-responses',
        providerLabel: 'openai-responses',
        transport: 'openai-responses',
        text: '摘要结果'
      };
    }
  });

  const result = await registry.generateWithOrder({ prompt: 'test' }, ['codex-cli', 'openai-responses']);
  assert.equal(result.result.providerId, 'openai-responses');
  assert.deepEqual(result.attempts, ['codex-cli', 'openai-responses']);
  assert.equal(result.failures[0]?.providerId, 'codex-cli');
});

test('llm toolkit registry caches availability checks within ttl window', async () => {
  const { LlmProviderRegistry } = await loadToolkitModule();
  let now = 1_000;
  let availabilityCalls = 0;
  const registry = new LlmProviderRegistry({
    availabilityCacheTtlMs: 200,
    now: () => now
  });

  registry.register({
    id: 'qwen-compatible',
    label: 'Qwen Compatible',
    transport: 'openai-compatible-chat',
    async isAvailable() {
      availabilityCalls += 1;
      return {
        available: true,
        configured: true,
        reason: 'ready'
      };
    },
    async generateText() {
      return {
        providerId: 'qwen-compatible',
        providerLabel: 'Qwen Compatible',
        transport: 'openai-compatible-chat',
        text: 'ok'
      };
    }
  });

  await registry.listAvailability();
  await registry.listAvailability();
  assert.equal(availabilityCalls, 1);

  now += 250;
  await registry.listAvailability();
  assert.equal(availabilityCalls, 2);
});

test('llm toolkit registry cools down provider after generate failure', async () => {
  const { LlmProviderRegistry } = await loadToolkitModule();
  let now = 1_000;
  let brokenGenerateCalls = 0;
  const registry = new LlmProviderRegistry({
    cooldownMs: 5_000,
    now: () => now
  });

  registry.register({
    id: 'broken-provider',
    label: 'Broken Provider',
    transport: 'openai-compatible-chat',
    async isAvailable() {
      return {
        available: true,
        configured: true,
        reason: 'ready'
      };
    },
    async generateText() {
      brokenGenerateCalls += 1;
      throw new Error('simulated failure');
    }
  });
  registry.register({
    id: 'fallback-provider',
    label: 'Fallback Provider',
    transport: 'openai-compatible-responses',
    async isAvailable() {
      return {
        available: true,
        configured: true,
        reason: 'ready'
      };
    },
    async generateText() {
      return {
        providerId: 'fallback-provider',
        providerLabel: 'Fallback Provider',
        transport: 'openai-compatible-responses',
        text: 'fallback ok'
      };
    }
  });

  const firstAttempt = await registry.generateWithOrder({ prompt: 'test' }, ['broken-provider', 'fallback-provider']);
  assert.equal(firstAttempt.result.providerId, 'fallback-provider');
  assert.equal(firstAttempt.failures[0]?.code, 'generate-error');
  assert.equal(brokenGenerateCalls, 1);

  const secondAttempt = await registry.generateWithOrder({ prompt: 'test' }, ['broken-provider', 'fallback-provider']);
  assert.equal(secondAttempt.result.providerId, 'fallback-provider');
  assert.equal(secondAttempt.failures[0]?.code, 'provider-cooldown');
  assert.equal(brokenGenerateCalls, 1);

  now += 6_000;
  await registry.generateWithOrder({ prompt: 'test' }, ['broken-provider', 'fallback-provider']);
  assert.equal(brokenGenerateCalls, 2);
});

test('codex cli provider writes utf8 stdin and reads output file', async () => {
  const { CodexCliTextProvider } = await loadToolkitModule();
  const mockSpawnSync = ((
    command?: string,
    args?: readonly string[],
    options?: {
      input?: string | Buffer | Uint8Array;
    }
  ) => {
    if (args?.includes('--version')) {
      return { status: 0, stdout: '', stderr: '' };
    }

    const outputFile = String(args?.[args.indexOf('-o') + 1]);
    writeFileSync(outputFile, '压缩后的摘要', 'utf8');
    assert.equal(command, 'codex');
    assert.equal(Buffer.isBuffer(options?.input), true);
    return { status: 0, stdout: '', stderr: '' };
  }) as typeof import('node:child_process').spawnSync;

  const provider = new CodexCliTextProvider({
    command: 'codex',
    spawnSyncImpl: mockSpawnSync
  });

  const result = await provider.generateText({ prompt: '请压缩这句话' });
  assert.equal(result.providerId, 'codex-cli');
  assert.equal(result.transport, 'codex-cli');
  assert.equal(result.text, '压缩后的摘要');
});

test('codex cli provider can resolve absolute command path via where on Windows', async () => {
  const { CodexCliTextProvider } = await loadToolkitModule();
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  const mockSpawnSync = ((
    command?: string,
    args?: readonly string[],
    options?: {
      stdio?: string;
      encoding?: string;
      input?: string | Buffer | Uint8Array;
    }
  ) => {
    if (command === 'codex' && args?.includes('--version')) {
      return { status: 1, stdout: '', stderr: '' };
    }

    if ((command === 'where' || command === 'where.exe') && args?.[0] === 'codex') {
      return {
        status: 0,
        stdout: 'C:\\mock\\codex.exe\r\n',
        stderr: ''
      };
    }

    if (command === 'C:\\mock\\codex.exe' && args?.includes('--version')) {
      return { status: 0, stdout: '', stderr: '' };
    }

    if (command === 'C:\\mock\\codex.exe' && args?.[0] === 'exec') {
      const outputFile = String(args?.[args.indexOf('-o') + 1]);
      writeFileSync(outputFile, '通过绝对路径执行', 'utf8');
      assert.equal(Buffer.isBuffer(options?.input), true);
      return { status: 0, stdout: '', stderr: '' };
    }

    throw new Error(`unexpected spawn: ${String(command)} ${(args || []).join(' ')}`);
  }) as typeof import('node:child_process').spawnSync;

  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: 'win32'
  });

  try {
    const provider = new CodexCliTextProvider({
      command: 'codex',
      spawnSyncImpl: mockSpawnSync
    });

    const availability = provider.isAvailable();
    assert.equal(availability.available, true);
    assert.equal(availability.details?.command, 'C:\\mock\\codex.exe');

    const result = await provider.generateText({ prompt: '请压缩这句话' });
    assert.equal(result.text, '通过绝对路径执行');
    assert.equal(Array.isArray(result.diagnostics?.command), true);
    assert.equal((result.diagnostics?.command as string[])[0], 'C:\\mock\\codex.exe');
    assert.equal((result.diagnostics?.command as string[])[1], 'exec');
  } finally {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  }
});

test('openclaw codex oauth session can persist credential file', async () => {
  const { OpenClawCodexOAuthSession } = await loadToolkitModule();
  const tempDir = mkdtempSync(join(tmpdir(), 'llm-toolkit-oauth-'));
  const credentialFile = join(tempDir, 'credential.json');
  const session = new OpenClawCodexOAuthSession({
    credentialFilePath: credentialFile
  });

  try {
    await session.saveCredential({
      access: 'access-token',
      refresh: 'refresh-token',
      expires: Date.now() + 60_000,
      accountId: 'account-1'
    });

    const credential = await session.loadCredential();
    assert.equal(credential?.access, 'access-token');
    assert.equal(credential?.refresh, 'refresh-token');
    assert.equal(credential?.accountId, 'account-1');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('openclaw codex oauth session uses pi-ai compatible authorization defaults', async () => {
  const { OpenClawCodexOAuthSession } = await loadToolkitModule();
  const session = new OpenClawCodexOAuthSession();

  const flow = await session.beginAuthorization();
  const authorizationUrl = new URL(flow.authorizationUrl);

  assert.equal(authorizationUrl.origin, 'https://auth.openai.com');
  assert.equal(authorizationUrl.pathname, '/oauth/authorize');
  assert.equal(authorizationUrl.searchParams.get('response_type'), 'code');
  assert.equal(authorizationUrl.searchParams.get('client_id'), 'app_EMoamEEZ73f0CkXaXp7hrann');
  assert.equal(authorizationUrl.searchParams.get('redirect_uri'), 'http://localhost:1455/auth/callback');
  assert.equal(authorizationUrl.searchParams.get('scope'), 'openid profile email offline_access');
  assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorizationUrl.searchParams.get('id_token_add_organizations'), 'true');
  assert.equal(authorizationUrl.searchParams.get('codex_cli_simplified_flow'), 'true');
  assert.equal(authorizationUrl.searchParams.get('originator'), 'pi');
  assert.ok(authorizationUrl.searchParams.get('state'));
  assert.ok(authorizationUrl.searchParams.get('code_challenge'));
});

test('openclaw codex oauth browser open command preserves oauth query parameters on Windows', async () => {
  const { buildOpenExternalCommand } = await loadToolkitModule();
  const url =
    'https://auth.openai.com/oauth/authorize?response_type=code&client_id=test-client&redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback&scope=openid+profile+email+offline_access&code_challenge=test&code_challenge_method=S256&state=test-state&id_token_add_organizations=true&codex_cli_simplified_flow=true&originator=pi';
  const launch = buildOpenExternalCommand(url);

  if (process.platform === 'win32') {
    assert.equal(launch.command, 'cmd');
    assert.deepEqual(launch.args, ['/c', 'start', '""', `"${url}"`]);
    assert.equal(launch.windowsVerbatimArguments, true);
    return;
  }

  assert.ok(['open', 'xdg-open'].includes(launch.command));
  assert.deepEqual(launch.args, [url]);
});

test('openclaw codex oauth provider uses oauth session and response payload', async () => {
  const { OpenClawCodexOAuthTextProvider } = await loadToolkitModule();
  const provider = new OpenClawCodexOAuthTextProvider({
    session: {
      async getAvailability() {
        return {
          available: true,
          configured: true,
          reason: 'ready'
        };
      },
      async getValidCredential() {
        return {
          access: 'access-token',
          accountId: 'account-1'
        };
      }
    },
    completeSimpleImpl: async (model, context, options) => {
      assert.equal(model.provider, 'openai-codex');
      assert.equal(model.api, 'openai-codex-responses');
      assert.equal(model.baseUrl, 'https://chatgpt.com/backend-api');
      assert.equal(context.systemPrompt, 'You are a helpful assistant. Reply clearly and concisely.');
      assert.equal(typeof context.messages[0]?.content, 'string');
      assert.equal(options?.apiKey, 'access-token');
      assert.equal(options?.transport, 'auto');
      return {
        content: [{ type: 'text', text: 'oauth summary' }],
        stopReason: 'stop'
      };
    }
  });

  const availability = await provider.isAvailable();
  assert.equal(availability.available, true);

  const result = await provider.generateText({ prompt: '请压缩这句话' });
  assert.equal(result.providerId, 'codex-oauth');
  assert.equal(result.transport, 'codex-oauth');
  assert.equal(result.diagnostics?.transport, 'auto');
  assert.equal(result.text, 'oauth summary');
});

test('openclaw codex oauth session can complete local browser login flow', async () => {
  const { OpenClawCodexOAuthSession } = await loadToolkitModule();
  const tempDir = mkdtempSync(join(tmpdir(), 'llm-toolkit-oauth-browser-'));
  const credentialFile = join(tempDir, 'credential.json');
  let callbackUrl: string | undefined;

  const session = new OpenClawCodexOAuthSession({
    credentialFilePath: credentialFile,
    fetchFn: async (_input, init) =>
      new Response(
        JSON.stringify({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 60
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      ),
    openExternalUrl: async (url) => {
      callbackUrl = url;
      const authUrl = new URL(url);
      const state = authUrl.searchParams.get('state');
      assert.ok(state);
      const response = await fetch(
        `http://127.0.0.1:1455/auth/callback?state=${encodeURIComponent(state ?? '')}&code=test-code`
      );
      assert.equal(response.status, 200);
    }
  });

  try {
    const credential = await session.loginWithBrowser(5_000);
    assert.ok(callbackUrl);
    assert.equal(credential.access, 'access-token');
    assert.equal(credential.refresh, 'refresh-token');
    assert.equal(typeof credential.expires, 'number');

    const persisted = await session.loadCredential();
    assert.equal(persisted?.access, 'access-token');
    assert.equal(persisted?.refresh, 'refresh-token');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('openai responses provider parses official response payload', async () => {
  const {
    OpenAIResponsesTextProvider,
    OpenAICompatibleChatTextProvider,
    OpenAICompatibleResponsesTextProvider,
    resolveCodexProviderOrder,
    createDefaultCodexProviderRegistry,
    loadLlmToolkitConfig,
    listCatalogProviders,
    resolveCatalogProviderOrder,
    createCatalogProviderRegistry
  } =
    await loadToolkitModule();
  const provider = new OpenAIResponsesTextProvider({
    apiKey: 'test-key',
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          id: 'resp-2',
          output: [
            {
              content: [
                {
                  text: 'Responses 摘要'
                }
              ]
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
  });

  const result = await provider.generateText({ prompt: '请压缩这句话' });
  assert.equal(result.providerId, 'openai-responses');
  assert.equal(result.transport, 'openai-responses');
  assert.equal(result.text, 'Responses 摘要');
  assert.deepEqual(resolveCodexProviderOrder('codex'), ['codex-cli', 'codex-oauth', 'openai-responses']);
  assert.equal(createDefaultCodexProviderRegistry().listProviders().length, 3);

  const tempDir = mkdtempSync(join(tmpdir(), 'llm-toolkit-config-'));
  const configFile = join(tempDir, 'openclaw.llm.config.json');

  try {
    writeFileSync(
      configFile,
      JSON.stringify(
        {
          catalog: {
            providerOrder: ['qwen-compatible', 'ollama-local'],
            providers: {
              'qwen-compatible': {
                enabled: true,
                status: 'planned',
                auth: 'api-key',
                api: 'openai-compatible-chat-completions',
                models: [
                  {
                    id: 'qwen3.5-plus'
                  }
                ]
              },
              'ollama-local': {
                enabled: false,
                status: 'planned',
                auth: 'none',
                api: 'openai-compatible-chat-completions',
                models: [
                  {
                    id: 'qwen2.5:7b'
                  }
                ]
              }
            }
          },
          codex: {
            providerOrder: ['codex-oauth', 'codex-cli']
          },
          runtime: {
            providers: {
              'codex-cli': {
                enabled: true,
                model: 'gpt-5-codex'
              },
              'codex-oauth': {
                enabled: true,
                baseUrl: 'https://chatgpt.com/backend-api',
                credentialFilePath: './.openclaw/openclaw-codex-oauth.json',
                model: 'gpt-5.4'
              },
              'openai-responses': {
                enabled: false
              }
            }
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const loadedConfig = loadLlmToolkitConfig({
      configFilePath: configFile
    });
    assert.equal(loadedConfig.source, 'file');
    assert.equal(loadedConfig.filePath, configFile);
    assert.deepEqual(resolveCatalogProviderOrder(loadedConfig.config), ['qwen-compatible', 'ollama-local']);
    assert.deepEqual(
      listCatalogProviders(loadedConfig.config).map((provider) => ({
        id: provider.id,
        enabled: provider.enabled,
        status: provider.status,
        api: provider.api,
        auth: provider.auth,
        models: provider.models.map((model) => ({ id: model.id }))
      })),
      [
        {
          id: 'qwen-compatible',
          enabled: true,
          status: 'planned',
          api: 'openai-compatible-chat-completions',
          auth: 'api-key',
          models: [{ id: 'qwen3.5-plus' }]
        },
        {
          id: 'ollama-local',
          enabled: false,
          status: 'planned',
          api: 'openai-compatible-chat-completions',
          auth: 'none',
          models: [{ id: 'qwen2.5:7b' }]
        }
      ]
    );
    assert.deepEqual(loadedConfig.config.codex?.providerOrder, ['codex-oauth', 'codex-cli']);
    assert.deepEqual(resolveCodexProviderOrder('codex', { configFilePath: configFile }), ['codex-oauth', 'codex-cli']);
    assert.deepEqual(
      createDefaultCodexProviderRegistry({ configFilePath: configFile })
        .listProviders()
        .map((provider) => provider.id),
      ['codex-cli', 'codex-oauth']
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  const compatibleProvider = new OpenAICompatibleChatTextProvider({
    id: 'qwen-compatible',
    label: 'Qwen Compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: 'test-key',
    defaultModel: 'qwen3.5-plus',
    fetchFn: async (_input, init) => {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('Authorization'), 'Bearer test-key');
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-1',
          choices: [
            {
              message: {
                content: '兼容层摘要'
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
  });

  const compatibleResult = await compatibleProvider.generateText({ prompt: '请压缩这句话' });
  assert.equal(compatibleResult.providerId, 'qwen-compatible');
  assert.equal(compatibleResult.transport, 'openai-compatible-chat');
  assert.equal(compatibleResult.text, '兼容层摘要');

  const compatibleResponsesProvider = new OpenAICompatibleResponsesTextProvider({
    id: 'custom-responses',
    label: 'Custom Responses',
    baseUrl: 'https://example.test/v1',
    apiKey: 'test-key',
    defaultModel: 'custom-responses-model',
    fetchFn: async (_input, init) => {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('Authorization'), 'Bearer test-key');
      return new Response(
        JSON.stringify({
          id: 'resp-compatible-1',
          output_text: '兼容 Responses 摘要'
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
  });

  const compatibleResponsesResult = await compatibleResponsesProvider.generateText({ prompt: '请压缩这句话' });
  assert.equal(compatibleResponsesResult.providerId, 'custom-responses');
  assert.equal(compatibleResponsesResult.transport, 'openai-compatible-responses');
  assert.equal(compatibleResponsesResult.text, '兼容 Responses 摘要');

  const compatibleConfigDir = mkdtempSync(join(tmpdir(), 'llm-toolkit-catalog-'));
  const compatibleConfigFile = join(compatibleConfigDir, 'openclaw.llm.config.json');

  try {
    writeFileSync(
      compatibleConfigFile,
      JSON.stringify(
        {
          catalog: {
            providerOrder: ['qwen-compatible', 'ollama-local', 'custom-responses'],
            providers: {
              'qwen-compatible': {
                enabled: true,
                status: 'experimental',
                auth: 'api-key',
                api: 'openai-compatible-chat-completions',
                models: [{ id: 'qwen3.5-plus', reasoning: true }]
              },
              'ollama-local': {
                enabled: true,
                status: 'experimental',
                auth: 'none',
                api: 'openai-compatible-chat-completions',
                models: [{ id: 'qwen2.5:7b' }]
              },
              'custom-responses': {
                enabled: true,
                status: 'experimental',
                auth: 'api-key',
                api: 'openai-compatible-responses',
                models: [{ id: 'responses-model' }]
              }
            }
          },
          runtime: {
            providers: {
              'qwen-compatible': {
                baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                apiKey: 'test-key',
                model: 'qwen3.5-plus'
              },
              'ollama-local': {
                auth: 'none',
                baseUrl: 'http://127.0.0.1:11434/v1',
                model: 'qwen2.5:7b'
              },
              'custom-responses': {
                baseUrl: 'https://example.test/v1',
                apiKey: 'test-key',
                model: 'responses-model'
              }
            }
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const catalogRegistry = createCatalogProviderRegistry({
      configFilePath: compatibleConfigFile
    });
    assert.deepEqual(
      catalogRegistry.listProviders().map((entry) => ({ id: entry.id, transport: entry.transport })),
      [
        { id: 'qwen-compatible', transport: 'openai-compatible-chat' },
        { id: 'ollama-local', transport: 'openai-compatible-chat' },
        { id: 'custom-responses', transport: 'openai-compatible-responses' }
      ]
    );

    const localAvailability = await catalogRegistry.getProvider('ollama-local').isAvailable();
    assert.equal(localAvailability.available, true);
  } finally {
    await rm(compatibleConfigDir, { recursive: true, force: true });
  }
});

test('catalog registry treats codex oauth as dedicated openai-codex-responses transport', async () => {
  const { createCatalogProviderRegistry } = await loadToolkitModule();
  const tempDir = mkdtempSync(join(tmpdir(), 'llm-toolkit-codex-catalog-'));
  const configFile = join(tempDir, 'openclaw.llm.config.json');

  try {
    writeFileSync(
      configFile,
      JSON.stringify(
        {
          catalog: {
            providerOrder: ['codex-cli', 'codex-oauth', 'openai-responses'],
            providers: {
              'codex-cli': {
                enabled: true,
                status: 'implemented',
                auth: 'cli',
                api: 'codex-cli',
                models: [{ id: 'gpt-5-codex' }]
              },
              'codex-oauth': {
                enabled: true,
                status: 'experimental',
                auth: 'oauth',
                api: 'openai-codex-responses',
                models: [{ id: 'gpt-5.4' }]
              },
              'openai-responses': {
                enabled: true,
                status: 'implemented',
                auth: 'api-key',
                api: 'openai-responses',
                models: [{ id: 'gpt-5-codex' }]
              }
            }
          },
          runtime: {
            providers: {
              'codex-cli': {
                enabled: true,
                command: 'codex',
                model: 'gpt-5-codex'
              },
              'codex-oauth': {
                enabled: true,
                baseUrl: 'https://chatgpt.com/backend-api',
                credentialFilePath: './.openclaw/openclaw-codex-oauth.json',
                model: 'gpt-5.4'
              },
              'openai-responses': {
                enabled: true,
                apiKey: 'sk-test',
                baseUrl: 'https://api.openai.com/v1',
                model: 'gpt-5-codex'
              }
            }
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const registry = createCatalogProviderRegistry({
      configFilePath: configFile
    });
    assert.deepEqual(
      registry.listProviders().map((provider) => ({ id: provider.id, transport: provider.transport })),
      [
        { id: 'codex-cli', transport: 'codex-cli' },
        { id: 'codex-oauth', transport: 'codex-oauth' },
        { id: 'openai-responses', transport: 'openai-responses' }
      ]
    );

    const availability = await registry.getProvider('codex-oauth').isAvailable();
    assert.equal(availability.available, false);
    assert.match(availability.reason, /未检测到|凭据/i);
    assert.doesNotMatch(availability.reason, /apiKey|OPENAI_API_KEY/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('llm toolkit config loader can fall back to plugin directory candidates', async () => {
  const { loadLlmToolkitConfig } = await loadToolkitModule();
  const tempRoot = mkdtempSync(join(tmpdir(), 'llm-toolkit-fallback-'));
  const cwdDir = join(tempRoot, 'workspace');
  const pluginDir = join(tempRoot, 'plugin');
  const pluginConfigFile = join(pluginDir, 'openclaw.llm.config.json');
  const pluginNestedConfigFile = join(pluginDir, '.openclaw', 'llm.config.json');

  try {
    mkdirSync(cwdDir, { recursive: true });
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(
      pluginConfigFile,
      JSON.stringify(
        {
          runtime: {
            defaultModelRef: 'codex-cli/gpt-5-codex'
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const defaultFallback = loadLlmToolkitConfig({
      cwd: cwdDir,
      fallbackDirs: [pluginDir]
    });
    assert.equal(defaultFallback.source, 'file');
    assert.equal(defaultFallback.filePath, pluginConfigFile);

    mkdirSync(join(pluginDir, '.openclaw'), { recursive: true });
    writeFileSync(
      pluginNestedConfigFile,
      JSON.stringify(
        {
          runtime: {
            defaultModelRef: 'codex-oauth/gpt-5.4'
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const explicitFallback = loadLlmToolkitConfig({
      cwd: cwdDir,
      configFilePath: '.openclaw/llm.config.json',
      fallbackDirs: [pluginDir]
    });
    assert.equal(explicitFallback.source, 'file');
    assert.equal(explicitFallback.filePath, pluginNestedConfigFile);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('llm toolkit config loader throws when explicit config path is missing', async () => {
  const { loadLlmToolkitConfig } = await loadToolkitModule();
  const tempDir = mkdtempSync(join(tmpdir(), 'llm-toolkit-explicit-missing-'));

  try {
    assert.throws(
      () =>
        loadLlmToolkitConfig({
          cwd: tempDir,
          configFilePath: 'missing/openclaw.llm.config.json'
        }),
      /显式配置文件不存在/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('codex provider order uses catalog order by default and codex order as override', async () => {
  const { resolveCodexProviderOrder } = await loadToolkitModule();
  const tempDir = mkdtempSync(join(tmpdir(), 'llm-toolkit-codex-order-'));
  const catalogConfigFile = join(tempDir, 'catalog.json');
  const overrideConfigFile = join(tempDir, 'override.json');

  try {
    writeFileSync(
      catalogConfigFile,
      JSON.stringify(
        {
          catalog: {
            providerOrder: ['openai-responses', 'codex-oauth', 'codex-cli']
          }
        },
        null,
        2
      ),
      'utf8'
    );

    assert.deepEqual(resolveCodexProviderOrder('codex', { configFilePath: catalogConfigFile }), [
      'openai-responses',
      'codex-oauth',
      'codex-cli'
    ]);

    writeFileSync(
      overrideConfigFile,
      JSON.stringify(
        {
          catalog: {
            providerOrder: ['openai-responses', 'codex-oauth', 'codex-cli']
          },
          codex: {
            providerOrder: ['codex-cli', 'codex-oauth']
          }
        },
        null,
        2
      ),
      'utf8'
    );

    assert.deepEqual(resolveCodexProviderOrder('codex', { configFilePath: overrideConfigFile }), [
      'codex-cli',
      'codex-oauth'
    ]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('llm toolkit runtime facade can resolve registry, provider order and model selection', async () => {
  const { createLlmToolkitRuntime } = await loadToolkitModule();
  const tempDir = mkdtempSync(join(tmpdir(), 'llm-toolkit-runtime-'));
  const configFile = join(tempDir, 'openclaw.llm.config.json');

  try {
    writeFileSync(
      configFile,
      JSON.stringify(
        {
          catalog: {
            providerOrder: ['qwen-compatible', 'custom-responses'],
            providers: {
              'qwen-compatible': {
                enabled: true,
                status: 'experimental',
                auth: 'api-key',
                api: 'openai-compatible-chat-completions',
                models: [{ id: 'qwen3.5-plus' }]
              },
              'custom-responses': {
                enabled: true,
                status: 'experimental',
                auth: 'api-key',
                api: 'openai-compatible-responses',
                models: [{ id: 'responses-model' }]
              }
            }
          },
          codex: {
            providers: {
              'openai-responses': {
                enabled: false
              }
            }
          },
          runtime: {
            defaultModelRef: 'codex-cli/gpt-5-codex',
            providers: {
              'qwen-compatible': {
                baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                apiKey: 'test-key',
                model: 'qwen3.5-plus'
              },
              'custom-responses': {
                baseUrl: 'https://example.test/v1',
                apiKey: 'test-key',
                model: 'responses-model'
              },
              'codex-cli': {
                enabled: true,
                model: 'gpt-5-codex'
              }
            }
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const runtime = createLlmToolkitRuntime({
      configFilePath: configFile
    });
    assert.equal(runtime.loadedConfig.source, 'file');

    const llmRuntime = runtime.resolveTextRuntime({
      mode: 'llm'
    });
    assert.deepEqual(llmRuntime.registeredProviderIds, ['qwen-compatible', 'custom-responses']);
    assert.deepEqual(llmRuntime.providerOrder, ['qwen-compatible', 'custom-responses']);
    assert.equal(llmRuntime.modelSelection.effectiveModelRef, undefined);

    const codexRuntime = runtime.resolveTextRuntime({
      mode: 'codex'
    });
    assert.ok(codexRuntime.registeredProviderIds.includes('codex-cli'));
    assert.deepEqual(codexRuntime.providerOrder, ['codex-cli', 'codex-oauth']);
    assert.equal(codexRuntime.modelSelection.effectiveModelRef, 'codex-cli/gpt-5-codex');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('llm toolkit runtime facade preserves config directory for relative codex oauth credential paths', async () => {
  const { createLlmToolkitRuntime } = await loadToolkitModule();
  const tempDir = mkdtempSync(join(tmpdir(), 'llm-toolkit-runtime-oauth-'));
  const configFile = join(tempDir, 'openclaw.llm.config.json');
  const credentialDir = join(tempDir, '.openclaw');
  const credentialFile = join(credentialDir, 'openclaw-codex-oauth.json');

  try {
    mkdirSync(credentialDir, { recursive: true });
    writeFileSync(
      configFile,
      JSON.stringify(
        {
          catalog: {
            providerOrder: ['codex-oauth'],
            providers: {
              'codex-oauth': {
                enabled: true,
                status: 'experimental',
                auth: 'oauth',
                api: 'openai-codex-responses',
                models: [{ id: 'gpt-5.4' }]
              }
            }
          },
          runtime: {
            providers: {
              'codex-oauth': {
                enabled: true,
                baseUrl: 'https://chatgpt.com/backend-api',
                credentialFilePath: './.openclaw/openclaw-codex-oauth.json',
                model: 'gpt-5.4'
              }
            }
          }
        },
        null,
        2
      ),
      'utf8'
    );
    writeFileSync(
      credentialFile,
      JSON.stringify(
        {
          access: 'access-token',
          refresh: 'refresh-token',
          expires: Date.now() + 60_000,
          accountId: 'account-1'
        },
        null,
        2
      ),
      'utf8'
    );

    const runtime = createLlmToolkitRuntime({
      configFilePath: configFile
    }) as unknown as {
      createRegistry(mode: 'codex-oauth'): {
        getProvider(id: 'codex-oauth'): {
          isAvailable(): Promise<{ available: boolean; configured: boolean; reason: string }>;
        };
      };
    };
    const registry = runtime.createRegistry('codex-oauth');
    const availability = await registry.getProvider('codex-oauth').isAvailable();
    assert.equal(availability.available, true);
    assert.equal(availability.configured, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('codex compatibility subpath still re-exports preset helpers', async () => {
  const codexModule = await loadToolkitCodexModule();
  assert.deepEqual(
    codexModule.createCodexProviderRegistry().listProviders().map((provider) => provider.id),
    codexModule.createDefaultCodexProviderRegistry().listProviders().map((provider) => provider.id)
  );
  assert.deepEqual(codexModule.resolveCodexProviderOrder('codex'), ['codex-cli', 'codex-oauth', 'openai-responses']);
});

test('llm toolkit can persist current model state and resolve effective selection', async () => {
  const {
    loadLlmToolkitState,
    saveCurrentModelRef,
    saveDefaultModelRef,
    resolveModelSelection
  } = await loadToolkitModule();
  const tempDir = mkdtempSync(join(tmpdir(), 'llm-toolkit-state-'));
  const configFile = join(tempDir, 'openclaw.llm.config.json');

  try {
    writeFileSync(
      configFile,
      JSON.stringify(
        {
          catalog: {
            providers: {
              'codex-cli': {
                enabled: true,
                status: 'implemented',
                auth: 'cli',
                api: 'codex-cli',
                models: [{ id: 'gpt-5-codex' }]
              },
              'codex-oauth': {
                enabled: true,
                status: 'experimental',
                auth: 'oauth',
                api: 'openai-codex-responses',
                models: [{ id: 'gpt-5.4' }]
              }
            }
          },
          runtime: {
            defaultModelRef: 'codex-cli/gpt-5-codex'
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const initialSelection = resolveModelSelection({
      configFilePath: configFile,
      registeredProviderIds: ['codex-cli', 'codex-oauth']
    });
    assert.equal(initialSelection.defaultModelRef, 'codex-cli/gpt-5-codex');
    assert.equal(initialSelection.effectiveModelRef, 'codex-cli/gpt-5-codex');
    assert.equal(initialSelection.effectiveSource, 'config');

    const savedState = saveCurrentModelRef('codex-oauth/gpt-5.4', {
      configFilePath: configFile
    });
    assert.equal(savedState.state.currentModelRef, 'codex-oauth/gpt-5.4');

    const loadedState = loadLlmToolkitState({
      configFilePath: configFile
    });
    assert.equal(loadedState.state.currentModelRef, 'codex-oauth/gpt-5.4');

    const stateSelection = resolveModelSelection({
      configFilePath: configFile,
      registeredProviderIds: ['codex-cli', 'codex-oauth']
    });
    assert.equal(stateSelection.currentModelRef, 'codex-oauth/gpt-5.4');
    assert.equal(stateSelection.effectiveModelRef, 'codex-oauth/gpt-5.4');
    assert.equal(stateSelection.effectiveSource, 'state');

    const modeSelection = resolveModelSelection({
      configFilePath: configFile,
      mode: 'codex-cli',
      registeredProviderIds: ['codex-cli', 'codex-oauth']
    });
    assert.equal(modeSelection.effectiveModelRef, 'codex-cli/gpt-5-codex');
    assert.equal(modeSelection.effectiveSource, 'config');

    const providerAwareSelection = resolveModelSelection({
      configFilePath: configFile,
      mode: 'codex-oauth',
      registeredProviderIds: ['codex-cli', 'codex-oauth']
    });
    assert.equal(providerAwareSelection.effectiveModelRef, 'codex-oauth/gpt-5.4');
    assert.equal(providerAwareSelection.effectiveSource, 'state');

    const updatedConfig = saveDefaultModelRef('codex-oauth/gpt-5.4', {
      configFilePath: configFile
    });
    assert.equal(updatedConfig.config.runtime?.defaultModelRef, 'codex-oauth/gpt-5.4');
    const persistedConfig = JSON.parse(readFileSync(configFile, 'utf8')) as {
      runtime?: { defaultModelRef?: string };
    };
    assert.equal(persistedConfig.runtime?.defaultModelRef, 'codex-oauth/gpt-5.4');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('llm toolkit clearing default model does not create an empty config file from defaults', async () => {
  const { saveDefaultModelRef } = await loadToolkitModule();
  const tempDir = mkdtempSync(join(tmpdir(), 'llm-toolkit-reset-default-'));
  const configFile = join(tempDir, 'openclaw.llm.config.json');

  try {
    const result = saveDefaultModelRef(undefined, {
      cwd: tempDir
    });

    assert.equal(result.source, 'defaults');
    assert.equal(result.filePath, undefined);
    assert.equal(existsSync(configFile), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
