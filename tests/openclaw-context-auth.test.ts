import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveRepoRoot } from './repo-root.js';

const REPO_ROOT = resolveRepoRoot(import.meta.url);

async function loadAuthModule() {
  return import(
    pathToFileURL(resolve(REPO_ROOT, 'apps/openclaw-plugin/dist/cli/context-auth.js')).href
  ) as Promise<{
    runAuthStatus(input?: { configFilePath?: string }): Promise<{
      provider: 'codex-oauth';
      available: boolean;
      configured: boolean;
      reason: string;
      credentialFilePath: string;
      hasCredential: boolean;
      hasRefreshToken: boolean;
      accountId?: string;
      expiresAt?: string;
    }>;
    runAuthLogin(
      input?: { configFilePath?: string; timeoutMs?: number },
      dependencies?: {
        createContext?: (_input: { configFilePath?: string; timeoutMs?: number }) => {
          session: {
            baseUrl: string;
            credentialFilePath: string;
            getAvailability(): Promise<{
              available: boolean;
              configured: boolean;
              reason: string;
              details?: { source?: string };
            }>;
            loadCredential(): Promise<{
              access: string;
              refresh?: string;
              expires?: number;
              accountId?: string;
            } | null>;
            loginWithBrowser(timeoutMs?: number): Promise<{
              access: string;
              refresh?: string;
              expires?: number;
              accountId?: string;
            }>;
            clearCredential(): Promise<void>;
          };
          configSource: string;
          configFilePath?: string;
        };
      }
    ): Promise<{
      loginCompleted: true;
      available: boolean;
      hasCredential: boolean;
      accountId?: string;
    }>;
    runAuthLogout(input?: { configFilePath?: string }): Promise<{
      loginCompleted: false;
      available: boolean;
      hasCredential: boolean;
      hasRefreshToken: boolean;
    }>;
  }>;
}

test('context auth status and logout reflect credential file state', async () => {
  const { runAuthStatus, runAuthLogout } = await loadAuthModule();
  const tempDir = resolve(REPO_ROOT, '.tmp-auth-status-test');
  const configFilePath = resolve(tempDir, 'compact-context.llm.config.json');
  const credentialFilePath = resolve(tempDir, 'compact-context.codex-oauth.json');
  const expiresAt = Date.now() + 60_000;

  try {
    await writeFile(
      configFilePath,
      `${JSON.stringify(
        {
          runtime: {
            providers: {
              'codex-oauth': {
                enabled: true,
                credentialFilePath: './compact-context.codex-oauth.json'
              }
            }
          }
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await writeFile(
      credentialFilePath,
      `${JSON.stringify(
        {
          access: 'access-token',
          refresh: 'refresh-token',
          expires: expiresAt,
          accountId: 'account-1'
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const status = await runAuthStatus({ configFilePath });
    assert.equal(status.provider, 'codex-oauth');
    assert.equal(status.available, true);
    assert.equal(status.configured, true);
    assert.equal(status.hasCredential, true);
    assert.equal(status.hasRefreshToken, true);
    assert.equal(status.accountId, 'account-1');
    assert.equal(status.credentialFilePath, credentialFilePath);
    assert.ok(status.expiresAt);

    const logout = await runAuthLogout({ configFilePath });
    assert.equal(logout.loginCompleted, false);
    assert.equal(logout.available, false);
    assert.equal(logout.hasCredential, false);
    assert.equal(logout.hasRefreshToken, false);

    const credentialExists = await readFile(credentialFilePath, 'utf8').then(
      () => true,
      () => false
    );
    assert.equal(credentialExists, false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('context auth login uses injected session and updates status', async () => {
  const { runAuthLogin } = await loadAuthModule();
  let storedCredential:
    | {
        access: string;
        refresh?: string;
        expires?: number;
        accountId?: string;
      }
    | null = null;
  let capturedTimeoutMs: number | undefined;

  const result = await runAuthLogin(
    {
      timeoutMs: 180_000
    },
    {
      createContext() {
        return {
          configSource: 'inline',
          session: {
            baseUrl: 'https://chatgpt.com/backend-api',
            credentialFilePath: 'D:/mock/compact-context.codex-oauth.json',
            async getAvailability() {
              return storedCredential
                ? {
                    available: true,
                    configured: true,
                    reason: 'Codex OAuth 凭据可用。',
                    details: {
                      source: 'D:/mock/compact-context.codex-oauth.json'
                    }
                  }
                : {
                    available: false,
                    configured: false,
                    reason: '未检测到 Codex OAuth 凭据。'
                  };
            },
            async loadCredential() {
              return storedCredential;
            },
            async loginWithBrowser(timeoutMs?: number) {
              capturedTimeoutMs = timeoutMs;
              storedCredential = {
                access: 'access-token',
                refresh: 'refresh-token',
                expires: Date.now() + 60_000,
                accountId: 'account-2'
              };
              return storedCredential;
            },
            async clearCredential() {
              storedCredential = null;
            }
          }
        };
      }
    }
  );

  assert.equal(capturedTimeoutMs, 180_000);
  assert.equal(result.loginCompleted, true);
  assert.equal(result.available, true);
  assert.equal(result.hasCredential, true);
  assert.equal(result.accountId, 'account-2');
});
