import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
    const result = this.#spawnSyncImpl(this.#command, ['--version'], {
      stdio: 'ignore'
    });

    if ((result.status ?? 1) !== 0) {
      return {
        available: false,
        configured: false,
        reason: `未检测到可用的 Codex CLI：${this.#command}`
      };
    }

    return {
      available: true,
      configured: true,
      reason: 'Codex CLI 可用。',
      details: {
        command: this.#command
      }
    };
  }

  async generateText(input: LlmTextGenerateInput): Promise<LlmTextGenerateResult> {
    const tempRoot = await mkdtemp(join(tmpdir(), 'openclaw-codex-cli-'));
    const outputFile = join(tempRoot, 'output.txt');
    const reasoningEffort = normalizeReasoningEffort(input.reasoningEffort || this.#defaultReasoningEffort);
    const model = input.model?.trim() || this.#defaultModel;
    const args = ['exec', '-c', `model_reasoning_effort="${reasoningEffort}"`];

    if (model) {
      args.push('-m', model);
    }

    args.push('-o', outputFile, '-');

    try {
      const result = this.#spawnSyncImpl(this.#command, args, {
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
          command: [this.#command, ...args]
        }
      };
    } finally {
      await rm(tempRoot, {
        recursive: true,
        force: true
      });
    }
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
