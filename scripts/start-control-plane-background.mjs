import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const controlPlaneDir = resolve(repoRoot, '.tmp', 'control-plane');
const pidFile = resolve(controlPlaneDir, 'server.pid');
const stdoutFile = resolve(controlPlaneDir, 'stdout.log');
const stderrFile = resolve(controlPlaneDir, 'stderr.log');
const entryFile = resolve(repoRoot, 'apps', 'control-plane', 'dist', 'bin', 'openclaw-control-plane.js');
const host = '127.0.0.1';
const port = 3210;
const healthUrl = `http://${host}:${port}/api/health`;
const startupTimeoutMs = 10_000;
const shutdownTimeoutMs = 5_000;

mkdirSync(controlPlaneDir, { recursive: true });

const existingPid = readExistingPid(pidFile);
if (existingPid && isPidAlive(existingPid)) {
  if (await isHealthReady()) {
    console.log(`control-plane 已在后台运行，PID=${existingPid}`);
    process.exit(0);
  }

  console.log(`检测到旧的后台 control-plane 进程但健康检查未通过，先尝试清理。PID=${existingPid}`);
  const stopped = await stopPid(existingPid, shutdownTimeoutMs);
  safeUnlink(pidFile);
  if (!stopped) {
    console.error(`旧的后台 control-plane 进程仍未退出，无法继续启动。PID=${existingPid}`);
    process.exit(1);
  }
}

if (existingPid && !isPidAlive(existingPid)) {
  safeUnlink(pidFile);
}

if (!existingPid && (await isHealthReady())) {
  console.log('检测到 3210 端口上已经有可用的 control-plane 服务，但它不受当前后台脚本管理。');
  console.log('如果你想继续使用后台脚本，请先手动停止现有服务，再执行 start:control-plane:bg。');
  process.exit(0);
}

const stdoutFd = openSync(stdoutFile, 'a');
const stderrFd = openSync(stderrFile, 'a');

const child = spawn(process.execPath, [entryFile], {
  cwd: repoRoot,
  detached: true,
  stdio: ['ignore', stdoutFd, stderrFd],
  windowsHide: true
});

child.unref();
closeSync(stdoutFd);
closeSync(stderrFd);

const ready = await waitForHealth(child.pid, startupTimeoutMs);
if (!ready) {
  await stopPid(child.pid, shutdownTimeoutMs);
  safeUnlink(pidFile);
  console.error(`control-plane 后台启动失败，健康检查未通过。PID=${child.pid}`);
  const lastStderr = readTail(stderrFile, 12);
  if (lastStderr) {
    console.error('最近 stderr 输出：');
    console.error(lastStderr);
  }
  process.exit(1);
}

writeFileSync(pidFile, `${child.pid}\n`, 'utf8');
console.log(`control-plane 已后台启动并通过健康检查，PID=${child.pid}`);

function readExistingPid(path) {
  if (!existsSync(path)) {
    return 0;
  }

  const raw = readFileSync(path, 'utf8').trim();
  const pid = Number(raw);
  return Number.isInteger(pid) && pid > 0 ? pid : 0;
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForHealth(pid, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!isPidAlive(pid)) {
      return false;
    }

    if (await isHealthReady()) {
      return true;
    }

    await sleep(250);
  }

  return false;
}

async function isHealthReady() {
  try {
    const response = await fetch(healthUrl, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(1_500)
    });
    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return Boolean(payload && payload.ok === true);
  } catch {
    return false;
  }
}

async function stopPid(pid, timeoutMs) {
  if (!isPidAlive(pid)) {
    return true;
  }

  try {
    process.kill(pid);
  } catch {
    return !isPidAlive(pid);
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!isPidAlive(pid)) {
      return true;
    }
    await sleep(200);
  }

  return !isPidAlive(pid);
}

function readTail(path, lineCount) {
  if (!existsSync(path)) {
    return '';
  }

  const lines = readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean);
  return lines.slice(-lineCount).join('\n');
}

function safeUnlink(path) {
  try {
    unlinkSync(path);
  } catch {
    // ignore stale file cleanup errors
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
