import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function getPluginConfigFallbackDirs(): string[] {
  return [PLUGIN_ROOT_DIR];
}
