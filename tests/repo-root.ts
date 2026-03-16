import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function resolveRepoRoot(importMetaUrl: string) {
  return process.env.COMPACT_CONTEXT_REPO_ROOT
    ? resolve(process.env.COMPACT_CONTEXT_REPO_ROOT)
    : resolve(fileURLToPath(new URL('../', importMetaUrl)));
}


