import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pidFile = resolve(repoRoot, '.tmp', 'control-plane', 'server.pid');

if (!existsSync(pidFile)) {
  process.stdout.write('没有找到后台 control-plane 的 PID 文件。\n');
  process.exit(0);
}

const raw = readFileSync(pidFile, 'utf8').trim();
const pid = Number(raw);

if (!Number.isInteger(pid) || pid <= 0) {
  safeUnlink(pidFile);
  process.stdout.write('PID 文件无效，已清理。\n');
  process.exit(0);
}

try {
  process.kill(pid);
  const stopped = await waitForExit(pid, 5000);
  safeUnlink(pidFile);
  if (stopped) {
    process.stdout.write(`已停止后台 control-plane，PID=${pid}\n`);
    process.exit(0);
  }

  process.stdout.write(`已发送停止信号，但后台 control-plane 仍未退出。PID=${pid}\n`);
  process.exit(1);
} catch (error) {
  safeUnlink(pidFile);
  process.stdout.write(`停止后台 control-plane 失败，已清理 PID 文件。PID=${pid}\n`);
  if (error instanceof Error && error.message) {
    process.stdout.write(`${error.message}\n`);
  }
}

function safeUnlink(path) {
  try {
    unlinkSync(path);
  } catch {
    // ignore pid cleanup errors
  }
}

async function waitForExit(pid, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  try {
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
}
