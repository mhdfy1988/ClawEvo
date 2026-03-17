import {
  OpenClawCodexOAuthSession,
  loadLlmToolkitConfig,
  resolveProviderRuntimeConfig,
  resolveToolkitRelativePath
} from '@openclaw-compact-context/llm-toolkit';
import { getPluginConfigFallbackDirs } from './config-paths.js';

export interface AuthInput {
  configFilePath?: string;
  timeoutMs?: number;
}

export interface AuthStatusResult {
  provider: 'codex-oauth';
  available: boolean;
  configured: boolean;
  reason: string;
  configSource: string;
  configFilePath?: string;
  baseUrl: string;
  credentialFilePath: string;
  credentialSource?: string;
  hasCredential: boolean;
  hasRefreshToken: boolean;
  accountId?: string;
  expiresAt?: string;
}

export interface AuthLoginResult extends AuthStatusResult {
  loginCompleted: true;
}

export interface AuthLogoutResult extends AuthStatusResult {
  loginCompleted: false;
}

interface CodexOAuthCredentialLike {
  access: string;
  refresh?: string;
  expires?: number;
  accountId?: string;
}

interface CodexOAuthSessionLike {
  readonly baseUrl: string;
  readonly credentialFilePath: string;
  getAvailability(): Promise<{
    available: boolean;
    configured: boolean;
    reason: string;
    details?: {
      source?: string;
    };
  }>;
  loadCredential(): Promise<CodexOAuthCredentialLike | null>;
  loginWithBrowser(timeoutMs?: number): Promise<CodexOAuthCredentialLike>;
  clearCredential(): Promise<void>;
}

interface ResolvedAuthContext {
  session: CodexOAuthSessionLike;
  configSource: string;
  configFilePath?: string;
}

export interface AuthDependencies {
  createContext?: (input: AuthInput) => ResolvedAuthContext;
}

export async function runAuthStatus(
  input: AuthInput = {},
  dependencies: AuthDependencies = {}
): Promise<AuthStatusResult> {
  const context = resolveAuthContext(input, dependencies);
  return collectAuthStatus(context);
}

export async function runAuthLogin(
  input: AuthInput = {},
  dependencies: AuthDependencies = {}
): Promise<AuthLoginResult> {
  const context = resolveAuthContext(input, dependencies);
  await context.session.loginWithBrowser(input.timeoutMs);
  const status = await collectAuthStatus(context);
  return {
    ...status,
    loginCompleted: true
  };
}

export async function runAuthLogout(
  input: AuthInput = {},
  dependencies: AuthDependencies = {}
): Promise<AuthLogoutResult> {
  const context = resolveAuthContext(input, dependencies);
  await context.session.clearCredential();
  const status = await collectAuthStatus(context);
  return {
    ...status,
    loginCompleted: false
  };
}

function resolveAuthContext(input: AuthInput, dependencies: AuthDependencies): ResolvedAuthContext {
  if (dependencies.createContext) {
    return dependencies.createContext(input);
  }

  const fallbackDirs = getPluginConfigFallbackDirs();
  const loadedConfig = loadLlmToolkitConfig({
    ...(input.configFilePath ? { configFilePath: input.configFilePath } : {}),
    fallbackDirs
  });
  const runtimeConfig = resolveProviderRuntimeConfig(loadedConfig.config, 'codex-oauth');
  const configDir = loadedConfig.configDir;

  const session = new OpenClawCodexOAuthSession({
    ...(runtimeConfig?.baseUrl ? { baseUrl: runtimeConfig.baseUrl } : {}),
    ...(runtimeConfig?.credentialFilePath
      ? { credentialFilePath: resolveToolkitRelativePath(configDir, runtimeConfig.credentialFilePath) }
      : {}),
    ...(runtimeConfig?.authorizeUrl ? { authorizeUrl: runtimeConfig.authorizeUrl } : {}),
    ...(runtimeConfig?.tokenUrl ? { tokenUrl: runtimeConfig.tokenUrl } : {}),
    ...(runtimeConfig?.redirectUri ? { redirectUri: runtimeConfig.redirectUri } : {}),
    ...(runtimeConfig?.scope ? { scope: runtimeConfig.scope } : {}),
    ...(runtimeConfig?.clientId ? { clientId: runtimeConfig.clientId } : {})
  });

  return {
    session,
    configSource: formatConfigSource(loadedConfig),
    ...(loadedConfig.filePath ? { configFilePath: loadedConfig.filePath } : {})
  };
}

async function collectAuthStatus(context: ResolvedAuthContext): Promise<AuthStatusResult> {
  const availability = await context.session.getAvailability();
  const credential = await context.session.loadCredential();

  return {
    provider: 'codex-oauth',
    available: availability.available,
    configured: availability.configured,
    reason: availability.reason,
    configSource: context.configSource,
    ...(context.configFilePath ? { configFilePath: context.configFilePath } : {}),
    baseUrl: context.session.baseUrl,
    credentialFilePath: context.session.credentialFilePath,
    ...(typeof availability.details?.source === 'string' ? { credentialSource: availability.details.source } : {}),
    hasCredential: Boolean(credential?.access),
    hasRefreshToken: Boolean(credential?.refresh),
    ...(credential?.accountId ? { accountId: credential.accountId } : {}),
    ...(typeof credential?.expires === 'number' ? { expiresAt: new Date(credential.expires).toISOString() } : {})
  };
}

function formatConfigSource(input: { source: 'defaults' | 'inline' | 'file'; filePath?: string }): string {
  if (input.source === 'file') {
    return input.filePath || 'file';
  }

  return input.source;
}
