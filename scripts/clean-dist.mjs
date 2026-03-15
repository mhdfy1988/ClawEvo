import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , ...targets] = process.argv;

if (targets.length === 0) {
  console.error('[clean-dist] expected at least one target path');
  process.exit(1);
}

for (const target of targets) {
  rmSync(resolve(process.cwd(), target), {
    recursive: true,
    force: true
  });
}
