import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveRepoRoot } from './repo-root.js';

const REPO_ROOT = resolveRepoRoot(import.meta.url);

async function loadToolkitModule() {
  return import(pathToFileURL(resolve(REPO_ROOT, 'packages/llm-toolkit/dist/index.js')).href) as Promise<{
    LlmProviderRegistry: new () => {
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
        failures: Array<{ providerId: string; stage: string; message: string }>;
      }>;
    };
    CodexCliTextProvider: new (options?: {
      command?: string;
      spawnSyncImpl?: typeof import('node:child_process').spawnSync;
    }) => {
      isAvailable(): { available: boolean };
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
    }) => {
      saveCredential(credential: { access: string; refresh?: string; expires?: number; accountId?: string }): Promise<void>;
      loadCredential(): Promise<{ access: string; refresh?: string; expires?: number; accountId?: string } | null>;
    };
    OpenClawCodexOAuthTextProvider: new (options?: {
      session?: {
        getAvailability(): Promise<{ available: boolean; configured: boolean; reason: string }>;
        getValidCredential(): Promise<{ access: string; refresh?: string; expires?: number; accountId?: string }>;
      };
      fetchFn?: typeof fetch;
    }) => {
      isAvailable(): Promise<{ available: boolean; configured: boolean; reason: string }>;
      generateText(input: { prompt: string }): Promise<{
        providerId: string;
        transport: 'codex-oauth';
        text: string;
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
        isAvailable(): { available: boolean; configured: boolean; reason: string };
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
      }
    ): {
      filePath?: string;
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
    fetchFn: async (_input, init) =>
      new Response(
        JSON.stringify({
          id: 'resp-1',
          output_text: 'OAuth 摘要'
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
  });

  const availability = await provider.isAvailable();
  assert.equal(availability.available, true);

  const result = await provider.generateText({ prompt: '请压缩这句话' });
  assert.equal(result.providerId, 'codex-oauth');
  assert.equal(result.transport, 'codex-oauth');
  assert.equal(result.text, 'OAuth 摘要');
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
            providerOrder: ['codex-oauth', 'codex-cli'],
            providers: {
              'codex-cli': {
                enabled: true
              },
              'codex-oauth': {
                enabled: true
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
                baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                apiKey: 'test-key',
                models: [{ id: 'qwen3.5-plus', reasoning: true }]
              },
              'ollama-local': {
                enabled: true,
                status: 'experimental',
                auth: 'none',
                api: 'openai-compatible-chat-completions',
                baseUrl: 'http://127.0.0.1:11434/v1',
                models: [{ id: 'qwen2.5:7b' }]
              },
              'custom-responses': {
                enabled: true,
                status: 'experimental',
                auth: 'api-key',
                api: 'openai-compatible-responses',
                baseUrl: 'https://example.test/v1',
                apiKey: 'test-key',
                models: [{ id: 'responses-model' }]
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

    const localAvailability = catalogRegistry.getProvider('ollama-local').isAvailable();
    assert.equal(localAvailability.available, true);
  } finally {
    await rm(compatibleConfigDir, { recursive: true, force: true });
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
                api: 'openai-responses',
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
