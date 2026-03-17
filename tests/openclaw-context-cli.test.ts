import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveRepoRoot } from './repo-root.js';

const REPO_ROOT = resolveRepoRoot(import.meta.url);

interface MockRegistryResult {
  modeUsed: 'code' | 'codex-cli' | 'codex-oauth' | 'openai-responses';
  provider: 'codex-cli' | 'codex-oauth' | 'openai-responses';
  summary: string;
  model?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

async function loadSummaryModule() {
  return import(
    pathToFileURL(resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/cli/context-summary.js')).href
  ) as Promise<{
    summarizeText(
      input: {
        text: string;
        mode?: 'auto' | 'code' | 'codex' | 'codex-cli' | 'codex-oauth' | 'openai-responses' | 'llm';
        instruction?: string;
        modelRef?: string;
        configFilePath?: string;
      },
      dependencies?: {
        createCodexRegistry?: (_options?: Record<string, unknown>) => {
          listAvailability(): Promise<Array<{ availability: { available: boolean; configured: boolean; reason: string } }>>;
          generateWithOrder(
            input: { prompt: string; reasoningEffort?: 'low' | 'medium' | 'high'; model?: string },
            order: readonly string[]
          ): Promise<{
            result: {
              providerId: string;
              providerLabel: string;
              transport: 'codex-cli' | 'codex-oauth' | 'openai-responses';
              text: string;
              model?: string;
              reasoningEffort?: 'low' | 'medium' | 'high';
              diagnostics?: Record<string, unknown>;
            };
            attempts: string[];
            failures: Array<{ providerId: string; stage: string; message: string }>;
          }>;
        };
        createCatalogRegistry?: (_options?: Record<string, unknown>) => {
          listAvailability(): Promise<Array<{ availability: { available: boolean; configured: boolean; reason: string } }>>;
          listProviders(): Array<{ id: string }>;
          generateWithOrder(
            input: { prompt: string; reasoningEffort?: 'low' | 'medium' | 'high'; model?: string },
            order: readonly string[]
          ): Promise<{
            result: {
              providerId: string;
              providerLabel: string;
              transport: 'openai-compatible-chat' | 'openai-compatible-responses';
              text: string;
              model?: string;
              reasoningEffort?: 'low' | 'medium' | 'high';
              diagnostics?: Record<string, unknown>;
            };
            attempts: string[];
            failures: Array<{ providerId: string; stage: string; message: string }>;
          }>;
        };
      }
    ): Promise<{
      modeUsed: string;
      provider: string;
      summary: string;
      compressed: boolean;
      fallbackUsed: boolean;
      providerAvailable: boolean;
      reason: string;
      diagnostics: {
        summaryCandidateCount?: number;
        providerAttempts?: string[];
        providerFailures?: string[];
        selectedModelRef?: string;
        selectedModelSource?: string;
        providerBaseUrl?: string;
      };
    }>;
  }>;
}

function createMockRegistry(options: {
  available?: boolean;
  result?: MockRegistryResult;
  error?: Error;
  unavailableReason?: string;
}) {
  return {
    async listAvailability() {
      return [
        {
          availability: {
            available: options.available ?? true,
            configured: options.available ?? true,
            reason: options.unavailableReason || 'mock provider'
          }
        }
      ];
    },
    async generateWithOrder(_input: { prompt: string }, order: readonly string[]) {
      if (options.error) {
        throw options.error;
      }

      if (!options.result) {
        throw new Error('missing mock result');
      }

      return {
        result: {
          providerId: options.result.provider,
          providerLabel: options.result.provider,
          transport: options.result.provider,
          text: options.result.summary,
          ...(options.result.model ? { model: options.result.model } : {}),
          ...(options.result.reasoningEffort ? { reasoningEffort: options.result.reasoningEffort } : {}),
          diagnostics: {
            baseUrl: options.result.provider === 'codex-oauth' ? 'https://chatgpt.com/backend-api' : undefined
          }
        },
        attempts: [...order],
        failures: []
      };
    }
  };
}

test('openclaw context cli code mode keeps short sentence raw when main path chooses not to compress', async () => {
  const { summarizeText } = await loadSummaryModule();
  const result = await summarizeText({
    text: '今天先把首页做成控制塔视角。',
    mode: 'code'
  });

  assert.equal(result.modeUsed, 'code');
  assert.equal(result.provider, 'code');
  assert.equal(result.compressed, false);
  assert.equal(result.summary, '今天先把首页做成控制塔视角。');
});

test('openclaw context cli code mode can surface concept-style compressed summary', async () => {
  const { summarizeText } = await loadSummaryModule();
  const result = await summarizeText({
    text: 'KG recall should stay aligned with ctx compression, traceability, runtime bundle diagnostics, and artifact sidecar retention.',
    mode: 'code'
  });

  assert.equal(result.modeUsed, 'code');
  assert.equal(result.provider, 'code');
  assert.equal(result.compressed, true);
  assert.ok((result.diagnostics.summaryCandidateCount ?? 0) > 0);
  assert.match(result.summary, /knowledge graph|context compression|traceability|runtime bundle|artifact sidecar/i);
});

test('openclaw context cli auto mode falls back to code summary when no codex provider succeeds', async () => {
  const { summarizeText } = await loadSummaryModule();
  const result = await summarizeText(
    {
      text: '测试一下自动回退。',
      mode: 'auto'
    },
    {
      createCodexRegistry: () =>
        createMockRegistry({
          available: false,
          error: new Error('no provider'),
          unavailableReason: 'mock unavailable'
        })
    }
  );

  assert.equal(result.modeUsed, 'code');
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.providerAvailable, false);
  assert.match(result.reason, /自动回退到代码摘要/);
});

test('openclaw context cli codex-oauth mode accepts toolkit registry result', async () => {
  const { summarizeText } = await loadSummaryModule();
  const result = await summarizeText(
    {
      text: '请压缩这句话：测试一下这个接入。',
      mode: 'codex-oauth'
    },
    {
      createCodexRegistry: () =>
        createMockRegistry({
          available: true,
          result: {
            modeUsed: 'codex-oauth',
            provider: 'codex-oauth',
            summary: '测试这个接入',
            model: 'gpt-5.4',
            reasoningEffort: 'low'
          }
        })
    }
  );

  assert.equal(result.modeUsed, 'codex-oauth');
  assert.equal(result.provider, 'codex-oauth');
  assert.equal(result.summary, '测试这个接入');
  assert.equal(result.compressed, true);
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.providerAvailable, true);
  assert.deepEqual(result.diagnostics.providerAttempts, ['codex-oauth']);
});

test('openclaw context cli llm mode accepts catalog registry result', async () => {
  const { summarizeText } = await loadSummaryModule();
  const result = await summarizeText(
    {
      text: '请把这句话压成一句更短的中文摘要。',
      mode: 'llm',
      modelRef: 'qwen-compatible/qwen3.5-plus'
    },
    {
      createCatalogRegistry: () => ({
        async listAvailability() {
          return [
            {
              availability: {
                available: true,
                configured: true,
                reason: 'mock catalog provider'
              }
            }
          ];
        },
        listProviders() {
          return [{ id: 'qwen-compatible' }];
        },
        async generateWithOrder(input, order) {
          assert.equal(input.model, 'qwen3.5-plus');
          assert.deepEqual(order, ['qwen-compatible']);
          return {
            result: {
              providerId: 'qwen-compatible',
              providerLabel: 'Qwen Compatible',
              transport: 'openai-compatible-chat',
              text: '更短的中文摘要',
              model: 'qwen3.5-plus',
              diagnostics: {
                baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
              }
            },
            attempts: [...order],
            failures: []
          };
        }
      })
    }
  );

  assert.equal(result.modeUsed, 'openai-compatible-chat');
  assert.equal(result.provider, 'qwen-compatible');
  assert.equal(result.summary, '更短的中文摘要');
  assert.equal(result.diagnostics.selectedModelRef, 'qwen-compatible/qwen3.5-plus');
  assert.equal(result.diagnostics.selectedModelSource, 'cli');
  assert.equal(result.diagnostics.providerBaseUrl, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
});

test('openclaw context cli explicit --model overrides state and config defaults', async () => {
  const { summarizeText } = await loadSummaryModule();
  const tempDir = await import('node:fs/promises').then(({ mkdtemp }) => mkdtemp(resolve(REPO_ROOT, '.tmp-model-override-')));
  const configFilePath = resolve(tempDir, 'openclaw.llm.config.json');
  const stateDir = resolve(tempDir, '.openclaw');
  let capturedModel: string | undefined;
  let capturedOrder: readonly string[] = [];

  try {
    await import('node:fs/promises').then(({ mkdir, writeFile }) =>
      Promise.all([
        mkdir(stateDir, { recursive: true }),
        writeFile(
          configFilePath,
          JSON.stringify(
            {
              runtime: {
                defaultModelRef: 'codex-oauth/gpt-5.4',
                stateFilePath: './.openclaw/llm.state.json'
              },
              codex: {
                providerOrder: ['codex-cli', 'codex-oauth', 'openai-responses'],
                providers: {
                  'codex-cli': { enabled: true, command: 'codex', model: 'gpt-5-codex' },
                  'codex-oauth': { enabled: true, model: 'gpt-5.4' }
                }
              }
            },
            null,
            2
          ),
          'utf8'
        ),
        writeFile(
          resolve(stateDir, 'llm.state.json'),
          JSON.stringify({ currentModelRef: 'codex-oauth/gpt-5.4' }, null, 2),
          'utf8'
        )
      ])
    );

    const result = await summarizeText(
      {
        text: '测试显式模型覆盖。',
        mode: 'codex',
        configFilePath,
        modelRef: 'codex-cli/gpt-5-codex'
      },
      {
        createCodexRegistry: () => ({
          async listAvailability() {
            return [
              {
                availability: {
                  available: true,
                  configured: true,
                  reason: 'mock provider'
                }
              }
            ];
          },
          async generateWithOrder(input, order) {
            capturedModel = input.model;
            capturedOrder = [...order];
            return {
              result: {
                providerId: 'codex-cli',
                providerLabel: 'codex-cli',
                transport: 'codex-cli',
                text: '显式模型已生效',
                model: input.model
              },
              attempts: [...order],
              failures: []
            };
          }
        })
      }
    );

    assert.equal(capturedModel, 'gpt-5-codex');
    assert.deepEqual(capturedOrder, ['codex-cli', 'codex-oauth', 'openai-responses']);
    assert.equal(result.diagnostics.selectedModelRef, 'codex-cli/gpt-5-codex');
    assert.equal(result.diagnostics.selectedModelSource, 'cli');
  } finally {
    await import('node:fs/promises').then(({ rm }) => rm(tempDir, { recursive: true, force: true }));
  }
});

test('openclaw context cli dist bin wires app-local command entry', async () => {
  const binSource = await readFile(
    resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/bin/openclaw-context-cli.js'),
    'utf8'
  );

  assert.match(binSource, /summarizeText/);
  assert.match(binSource, /OpenClaw Context CLI/);
  assert.match(binSource, /codex-oauth/);
  assert.match(binSource, /openai-responses/);
  assert.match(binSource, /llm/);
  assert.match(binSource, /--config <path>/);
  assert.match(binSource, /--model <provider>\/<model>/);
  assert.match(binSource, /models list/);
  assert.match(binSource, /models use/);
  assert.match(binSource, /models default/);
  assert.match(binSource, /models clear/);
  assert.match(binSource, /models reset/);
});
