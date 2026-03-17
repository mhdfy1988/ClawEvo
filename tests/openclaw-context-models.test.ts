import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveRepoRoot } from './repo-root.js';

const REPO_ROOT = resolveRepoRoot(import.meta.url);

async function loadModelsModule() {
  return import(
    pathToFileURL(resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/cli/context-models.js')).href
  ) as Promise<{
    runModelsList(input?: { configFilePath?: string }): {
      currentModelRef?: string;
      defaultModelRef?: string;
      effectiveModelRef?: string;
      effectiveSource?: 'state' | 'config';
      stateFilePath: string;
      providers: Array<{
        id: string;
        models: Array<{
          ref: string;
          isCurrent: boolean;
          isDefault: boolean;
        }>;
      }>;
    };
    runModelsCurrent(input?: { configFilePath?: string }): {
      currentModelRef?: string;
      defaultModelRef?: string;
      effectiveModelRef?: string;
      effectiveSource?: 'state' | 'config';
      stateFilePath: string;
    };
    runModelsUse(input: { configFilePath?: string; modelRef?: string }): {
      targetModelRef: string;
      currentModelRef?: string;
      effectiveModelRef?: string;
      effectiveSource?: 'state' | 'config';
      stateFilePath: string;
    };
    runModelsDefault(input: { configFilePath?: string; modelRef?: string }): {
      targetModelRef: string;
      defaultModelRef?: string;
      effectiveModelRef?: string;
      effectiveSource?: 'state' | 'config';
      configFilePath?: string;
      stateFilePath: string;
    };
  }>;
}

test('openclaw context models commands can list, set current, and set default model', async () => {
  const { runModelsList, runModelsCurrent, runModelsUse, runModelsDefault } = await loadModelsModule();
  const tempDir = mkdtempSync(join(tmpdir(), 'openclaw-context-models-'));
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
                label: 'Codex CLI',
                auth: 'cli',
                api: 'codex-cli',
                models: [{ id: 'gpt-5-codex' }]
              },
              'codex-oauth': {
                enabled: true,
                status: 'experimental',
                label: 'Codex OAuth',
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

    const initialList = runModelsList({ configFilePath: configFile });
    assert.equal(initialList.defaultModelRef, 'codex-cli/gpt-5-codex');
    assert.equal(initialList.effectiveModelRef, 'codex-cli/gpt-5-codex');
    assert.equal(initialList.effectiveSource, 'config');
    assert.equal(initialList.providers[0]?.models[0]?.isDefault, true);

    const useResult = runModelsUse({
      configFilePath: configFile,
      modelRef: 'codex-oauth/gpt-5.4'
    });
    assert.equal(useResult.targetModelRef, 'codex-oauth/gpt-5.4');
    assert.equal(useResult.currentModelRef, 'codex-oauth/gpt-5.4');
    assert.equal(useResult.effectiveModelRef, 'codex-oauth/gpt-5.4');
    assert.equal(useResult.effectiveSource, 'state');

    const currentResult = runModelsCurrent({ configFilePath: configFile });
    assert.equal(currentResult.currentModelRef, 'codex-oauth/gpt-5.4');
    assert.equal(currentResult.defaultModelRef, 'codex-cli/gpt-5-codex');
    assert.equal(currentResult.effectiveModelRef, 'codex-oauth/gpt-5.4');

    const defaultResult = runModelsDefault({
      configFilePath: configFile,
      modelRef: 'codex-oauth/gpt-5.4'
    });
    assert.equal(defaultResult.targetModelRef, 'codex-oauth/gpt-5.4');
    assert.equal(defaultResult.defaultModelRef, 'codex-oauth/gpt-5.4');

    const persistedConfig = JSON.parse(readFileSync(configFile, 'utf8')) as {
      runtime?: { defaultModelRef?: string };
    };
    assert.equal(persistedConfig.runtime?.defaultModelRef, 'codex-oauth/gpt-5.4');

    const finalList = runModelsList({ configFilePath: configFile });
    assert.equal(finalList.currentModelRef, 'codex-oauth/gpt-5.4');
    assert.equal(finalList.defaultModelRef, 'codex-oauth/gpt-5.4');
    assert.equal(finalList.providers[1]?.models[0]?.isCurrent, true);
    assert.equal(finalList.providers[1]?.models[0]?.isDefault, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
