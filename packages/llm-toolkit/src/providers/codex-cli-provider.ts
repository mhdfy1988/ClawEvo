import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

import type {
  LlmProviderAvailability,
  LlmReasoningEffort,
  LlmTextGenerateInput,
  LlmTextGenerateResult,
  LlmTextProvider
} from '../provider-types.js';

export interface CodexCliProviderOptions {
  command?: string;
  defaultModel?: string;
  defaultReasoningEffort?: LlmReasoningEffort;
  cwd?: string;
  spawnSyncImpl?: typeof spawnSync;
}

export class CodexCliTextProvider implements LlmTextProvider {
  readonly id = 'codex-cli';
  readonly label = 'Codex CLI';
  readonly transport = 'codex-cli' as const;

  readonly #command: string;
  readonly #defaultModel?: string;
  readonly #defaultReasoningEffort: LlmReasoningEffort;
  readonly #cwd: string;
  readonly #spawnSyncImpl: typeof spawnSync;
  #resolvedCommand?: string;

  constructor(options: CodexCliProviderOptions = {}) {
    this.#command = options.command?.trim() || process.env.OPENCLAW_CODEX_BIN?.trim() || 'codex';
    this.#defaultModel = options.defaultModel?.trim() || process.env.OPENCLAW_CODEX_MODEL?.trim() || undefined;
    this.#defaultReasoningEffort = normalizeReasoningEffort(
      options.defaultReasoningEffort || process.env.OPENCLAW_CODEX_REASONING_EFFORT
    );
    this.#cwd = options.cwd || resolve(process.cwd());
    this.#spawnSyncImpl = options.spawnSyncImpl || spawnSync;
  }

  isAvailable(): LlmProviderAvailability {
    const resolvedCommand = this.#resolveCommand();
    const result = this.#spawnSyncImpl(resolvedCommand, ['--version'], {
      stdio: 'ignore'
    });

    if ((result.status ?? 1) !== 0) {
      return {
        available: false,
        configured: false,
        reason: `未检测到可用的 Codex CLI：${resolvedCommand}`
      };
    }

    return {
      available: true,
      configured: true,
      reason: 'Codex CLI 可用。',
      details: {
        command: resolvedCommand
      }
    };
  }

  async generateText(input: LlmTextGenerateInput): Promise<LlmTextGenerateResult> {
    const tempRoot = await mkdtemp(join(tmpdir(), 'openclaw-codex-cli-'));
    const outputFile = join(tempRoot, 'output.txt');
    const reasoningEffort = normalizeReasoningEffort(input.reasoningEffort || this.#defaultReasoningEffort);
    const model = input.model?.trim() || this.#defaultModel;
    const resolvedCommand = this.#resolveCommand();
    const args = ['exec', '-c', `model_reasoning_effort="${reasoningEffort}"`];

    if (model) {
      args.push('-m', model);
    }

    args.push('-o', outputFile, '-');

    try {
      const result = this.#spawnSyncImpl(resolvedCommand, args, {
        cwd: this.#cwd,
        input: Buffer.from(input.prompt, 'utf8'),
        encoding: 'utf8'
      });

      if ((result.status ?? 1) !== 0) {
        throw new Error(
          [
            `codex exec 失败，退出码：${result.status ?? 1}`,
            result.stderr?.trim(),
            result.stdout?.trim()
          ]
            .filter(Boolean)
            .join('\n')
        );
      }

      const rawOutput = await readFile(outputFile, 'utf8');
      const text = sanitizeTextOutput(rawOutput);

      if (!text) {
        throw new Error('codex exec 没有返回可用文本。');
      }

      return {
        providerId: this.id,
        providerLabel: this.label,
        transport: this.transport,
        text,
        ...(model ? { model } : {}),
        reasoningEffort,
        diagnostics: {
          command: [resolvedCommand, ...args]
        }
      };
    } finally {
      await rm(tempRoot, {
        recursive: true,
        force: true
      });
    }
  }

  #resolveCommand(): string {
    if (this.#resolvedCommand) {
      return this.#resolvedCommand;
    }

    if (isExplicitCommandPath(this.#command)) {
      this.#resolvedCommand = this.#command;
      return this.#resolvedCommand;
    }

    if (this.#probeCommand(this.#command)) {
      this.#resolvedCommand = this.#command;
      return this.#resolvedCommand;
    }

    const discoveredCommand =
      this.#resolveCommandViaWhere(this.#command) ||
      resolveCodexCommandFromVsCodeExtension(this.#command);

    this.#resolvedCommand = discoveredCommand || this.#command;
    return this.#resolvedCommand;
  }

  #probeCommand(command: string): boolean {
    const result = this.#spawnSyncImpl(command, ['--version'], {
      stdio: 'ignore'
    });

    return (result.status ?? 1) === 0;
  }

  #resolveCommandViaWhere(command: string): string | undefined {
    if (process.platform !== 'win32') {
      return undefined;
    }

    for (const whereCommand of ['where', 'where.exe']) {
      const result = this.#spawnSyncImpl(whereCommand, [command], {
        stdio: 'pipe',
        encoding: 'utf8'
      });
      if ((result.status ?? 1) !== 0) {
        continue;
      }

      const firstLine = result.stdout
        ?.split(/\r?\n/u)
        .map((line) => line.trim())
        .find(Boolean);
      if (firstLine) {
        return firstLine;
      }
    }

    return undefined;
  }
}

function sanitizeTextOutput(rawOutput: string): string {
  const trimmed = rawOutput.trim();

  if (!trimmed) {
    return '';
  }

  return trimmed
    .replace(/^```[\w-]*\s*/u, '')
    .replace(/\s*```$/u, '')
    .trim();
}

function normalizeReasoningEffort(value: string | undefined): LlmReasoningEffort {
  return value === 'medium' || value === 'high' ? value : 'low';
}

function isExplicitCommandPath(command: string): boolean {
  if (isAbsolute(command)) {
    return existsSync(command);
  }

  return /[\\/]/u.test(command);
}

function resolveCodexCommandFromVsCodeExtension(command: string): string | undefined {
  if (process.platform !== 'win32' || command !== 'codex') {
    return undefined;
  }

  const userProfile = process.env.USERPROFILE?.trim();
  if (!userProfile) {
    return undefined;
  }

  const extensionsDir = join(userProfile, '.vscode', 'extensions');
  if (!existsSync(extensionsDir)) {
    return undefined;
  }

  const candidates = readdirSync(extensionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('openai.chatgpt-'))
    .map((entry) => join(extensionsDir, entry.name, 'bin', 'windows-x86_64', 'codex.exe'))
    .filter((candidate) => existsSync(candidate));

  return candidates[0];
}
