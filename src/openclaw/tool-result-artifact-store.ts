import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { readCompressedToolResultContent, type ToolResultPolicyDecision } from './tool-result-policy.js';
import type { AgentMessageLike, OpenClawPluginLogger } from './types.js';

const PLUGIN_ID = 'compact-context';

export class ToolResultArtifactStore {
  constructor(
    private readonly rootDir: string,
    private readonly logger?: OpenClawPluginLogger
  ) {}

  async persistDecision(
    originalMessage: AgentMessageLike,
    decision: ToolResultPolicyDecision
  ): Promise<ToolResultPolicyDecision> {
    if (!decision.changed) {
      return decision;
    }

    const compressed = readCompressedToolResultContent(decision.message.content);

    if (!compressed || !compressed.artifact || compressed.artifact.path) {
      return decision;
    }

    const artifactPath = this.buildArtifactPath(compressed.artifact.contentHash);
    const artifactContent = buildArtifactEnvelope(originalMessage, compressed.provenance.rawSourceId);

    await mkdir(dirname(artifactPath), { recursive: true });

    try {
      await writeFile(artifactPath, artifactContent, {
        encoding: 'utf8',
        flag: 'wx'
      });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== 'EEXIST') {
        throw error;
      }

      this.logger?.debug?.(`[${PLUGIN_ID}] tool result artifact already exists`, {
        artifactPath,
        rawSourceId: compressed.provenance.rawSourceId ?? null
      });
    }

    return {
      ...decision,
      message: {
        ...decision.message,
        content: {
          ...compressed,
          artifact: {
            ...compressed.artifact,
            path: artifactPath
          }
        }
      }
    };
  }

  async pruneStaleArtifacts(options: {
    maxAgeMs: number;
    nowMs?: number;
  }): Promise<{
    scannedFiles: number;
    deletedFiles: number;
    deletedPaths: string[];
  }> {
    const thresholdMs = (options.nowMs ?? Date.now()) - options.maxAgeMs;
    const files = await collectArtifactFiles(this.rootDir);
    const deletedPaths: string[] = [];

    for (const file of files) {
      const fileStat = await stat(file);

      if (fileStat.mtimeMs > thresholdMs) {
        continue;
      }

      await rm(file, { force: true });
      deletedPaths.push(file);
    }

    return {
      scannedFiles: files.length,
      deletedFiles: deletedPaths.length,
      deletedPaths
    };
  }

  private buildArtifactPath(contentHash: string): string {
    return join(this.rootDir, contentHash.slice(0, 2), `${contentHash}.json`);
  }
}

export function resolveToolResultArtifactRoot(options: {
  stateDir?: string;
  resolvePath?: (input: string) => string;
}): string {
  const relativePath = join('.openclaw', 'plugins', PLUGIN_ID, 'artifacts', 'tool-results');

  if (options.stateDir) {
    return resolve(options.stateDir, 'plugins', PLUGIN_ID, 'artifacts', 'tool-results');
  }

  if (options.resolvePath) {
    return options.resolvePath(relativePath);
  }

  return resolve(process.cwd(), relativePath);
}

function buildArtifactEnvelope(originalMessage: AgentMessageLike, rawSourceId: string | undefined): string {
  return JSON.stringify(
    {
      schema: 'compact-context.tool-result-artifact.v1',
      storedAt: new Date().toISOString(),
      rawSourceId: rawSourceId ?? null,
      messageId: typeof originalMessage.id === 'string' ? originalMessage.id : null,
      role: typeof originalMessage.role === 'string' ? originalMessage.role : null,
      timestamp: typeof originalMessage.timestamp === 'string' ? originalMessage.timestamp : null,
      content: serializeUnknown(originalMessage.content)
    },
    null,
    2
  );
}

function serializeUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? '');
  }
}

async function collectArtifactFiles(rootDir: string): Promise<string[]> {
  try {
    const entries = await readdir(rootDir, {
      withFileTypes: true
    });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = join(rootDir, entry.name);

      if (entry.isDirectory()) {
        files.push(...(await collectArtifactFiles(fullPath)));
        continue;
      }

      if (entry.isFile() && fullPath.endsWith('.json')) {
        files.push(fullPath);
      }
    }

    return files;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}
