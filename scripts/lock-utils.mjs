import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const LOCK_ROOT = resolve(REPO_ROOT, '.tmp', 'locks');

function sleep(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

export async function withLock(lockName, operation, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const retryMs = options.retryMs ?? 100;
  const lockDir = resolve(LOCK_ROOT, `${lockName}.lock`);
  const startedAt = Date.now();

  await mkdir(LOCK_ROOT, { recursive: true });

  while (true) {
    try {
      await mkdir(lockDir);
      break;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
        if (Date.now() - startedAt >= timeoutMs) {
          throw new Error(`[lock] timed out waiting for ${lockName}`);
        }

        await sleep(retryMs);
        continue;
      }

      throw error;
    }
  }

  try {
    return await operation();
  } finally {
    await rm(lockDir, { recursive: true, force: true });
  }
}
