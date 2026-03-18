import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const args = new Set(process.argv.slice(2));

const shouldPack = args.has('--pack');
const globalOnly = args.has('--global-only');
const openclawOnly = args.has('--openclaw-only');
const skipOauth = args.has('--skip-oauth');

if (globalOnly && openclawOnly) {
  throw new Error('不能同时传入 --global-only 和 --openclaw-only。');
}

const runGlobal = !openclawOnly;
const runOpenClaw = !globalOnly;

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const openclawCommand = process.platform === 'win32' ? 'openclaw.cmd' : 'openclaw';
const cliCommand = process.platform === 'win32' ? 'openclaw-context-cli.cmd' : 'openclaw-context-cli';

const packageName = '@openclaw-compact-context/compact-context';
const pluginId = 'compact-context';
const tgzPath = resolve(
  repoRoot,
  'artifacts',
  'releases',
  pluginId,
  'openclaw-compact-context-compact-context-0.1.0.tgz'
);
const unpackRoot = resolve(repoRoot, '.tmp', 'verify-compact-context-host-package');
const unpackedPackageDir = join(unpackRoot, 'package');
const pluginRootDir = resolve(repoRoot, 'apps', 'openclaw-plugin');
const repoConfigPath = join(pluginRootDir, 'compact-context.llm.config.json');
const repoOauthPath = join(pluginRootDir, 'compact-context.codex-oauth.json');
const openclawConfigPath = resolve(homedir(), '.openclaw', 'openclaw.json');
const linkedSourcePath = resolve(repoRoot, 'apps', 'openclaw-plugin');
const extensionInstallPath = resolve(homedir(), '.openclaw', 'extensions', pluginId);

main();

function main() {
  printBanner('Compact Context 安装验证');

  assertExists(repoConfigPath, `未找到插件目录里的正式配置文件：${repoConfigPath}`);

  if (shouldPack) {
    repackReleaseBundle();
  }

  assertExists(tgzPath, `未找到 release 包：${tgzPath}`);

  const oauthSourcePath = resolveRepoOauthSourcePath();
  const canVerifyOauth = Boolean(oauthSourcePath) && !skipOauth;
  if (!oauthSourcePath && !skipOauth) {
    printNote('未找到插件目录里的 OAuth 凭据，本轮将跳过 codex-oauth 验证。');
  }

  if (runGlobal) {
    verifyGlobalInstall({ oauthSourcePath, canVerifyOauth });
  }

  if (runOpenClaw) {
    verifyOpenClawInstall({ oauthSourcePath, canVerifyOauth });
  }

  printBanner('验证完成');
}

function repackReleaseBundle() {
  printStep('重新打 release 包');
  const previousMtime = existsSync(tgzPath) ? statSync(tgzPath).mtimeMs : null;

  run(npmCommand, ['run', 'build:workspace:apps'], { cwd: repoRoot });
  const packExitCode = run(
    'node',
    ['./scripts/pack-workspaces-release.mjs', packageName, '--out-dir', 'artifacts/releases'],
    { cwd: repoRoot, allowFailure: true }
  );

  assertExists(tgzPath, `打包后仍未找到 release 包：${tgzPath}`);

  if (packExitCode !== 0) {
    printNote(`打包命令返回了非零退出码（${packExitCode}），但 release 包已生成，继续按最新产物验证。`);
    return;
  }

  if (previousMtime === null) {
    printNote(`首次生成 release 包：${tgzPath}`);
    return;
  }

  const nextMtime = statSync(tgzPath).mtimeMs;
  if (nextMtime !== previousMtime) {
    printNote(`已更新 release 包：${tgzPath}`);
  }
}

function resolveRepoOauthSourcePath() {
  if (existsSync(repoOauthPath)) {
    return repoOauthPath;
  }

  return undefined;
}

function verifyGlobalInstall(input) {
  printStep('全局 npm 安装验证');

  run(npmCommand, ['uninstall', '-g', packageName], {
    cwd: repoRoot,
    allowFailure: true
  });
  run(npmCommand, ['install', '-g', tgzPath], { cwd: repoRoot });

  const globalPackageDir = resolveGlobalPackageDir();
  syncPluginFiles(globalPackageDir, input.oauthSourcePath);

  run(cliCommand, ['summarize', '--text', '测试一句话能不能被压缩。'], {
    cwd: homedir()
  });

  if (input.canVerifyOauth) {
    run(cliCommand, ['summarize', '--mode', 'codex-oauth', '--text', '测试一下OAuth摘要。'], {
      cwd: homedir()
    });
  }
}

function verifyOpenClawInstall(input) {
  printStep('OpenClaw 宿主安装验证');

  const backupPath = backupAndCleanOpenClawState();
  printNote(`已备份 OpenClaw 主配置：${backupPath}`);

  rmSync(unpackRoot, { recursive: true, force: true });
  mkdirSync(unpackRoot, { recursive: true });
  run('tar', ['-xf', tgzPath, '-C', unpackRoot], { cwd: repoRoot });
  assertExists(unpackedPackageDir, `未找到解包目录：${unpackedPackageDir}`);

  syncPluginFiles(unpackedPackageDir, input.oauthSourcePath);

  run(openclawCommand, ['plugins', 'install', unpackedPackageDir], { cwd: homedir() });
  run(openclawCommand, ['plugins', 'info', pluginId], { cwd: homedir() });
  run(openclawCommand, [pluginId, '--help'], { cwd: homedir() });
  run(openclawCommand, [pluginId, 'summarize', '--text', '测试一句话能不能被压缩。'], {
    cwd: homedir()
  });

  if (input.canVerifyOauth) {
    run(openclawCommand, [pluginId, 'summarize', '--mode', 'codex-oauth', '--text', '测试一下OAuth摘要。'], {
      cwd: homedir()
    });
  }
}

function resolveGlobalPackageDir() {
  const shouldUseShellWrapper = process.platform === 'win32' && /\.(cmd|bat)$/i.test(npmCommand);
  const result = shouldUseShellWrapper
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', quoteForCmd(npmCommand, ['root', '-g'])], {
        cwd: repoRoot,
        shell: false,
        encoding: 'utf8'
      })
    : spawnSync(npmCommand, ['root', '-g'], {
        cwd: repoRoot,
        shell: false,
        encoding: 'utf8'
      });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error('无法解析全局 npm root。');
  }

  const root = result.stdout.trim();
  if (!root) {
    throw new Error('全局 npm root 为空。');
  }

  return resolve(root, '@openclaw-compact-context', 'compact-context');
}

function syncPluginFiles(targetDir, oauthSourcePath) {
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(repoConfigPath, join(targetDir, 'compact-context.llm.config.json'));
  printNote(`已同步插件配置到：${targetDir}`);

  if (oauthSourcePath) {
    copyFileSync(oauthSourcePath, join(targetDir, 'compact-context.codex-oauth.json'));
    printNote(`已同步 OAuth 凭据到：${targetDir}`);
  }
}

function backupAndCleanOpenClawState() {
  assertExists(openclawConfigPath, `未找到 OpenClaw 配置：${openclawConfigPath}`);

  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const backupPath = `${openclawConfigPath}.pre-compact-context-verify-${timestamp}.bak`;
  copyFileSync(openclawConfigPath, backupPath);

  const config = JSON.parse(readFileSync(openclawConfigPath, 'utf8'));
  const plugins = config.plugins ?? {};

  if (plugins.load?.paths && Array.isArray(plugins.load.paths)) {
    plugins.load.paths = plugins.load.paths.filter((entry) => entry !== linkedSourcePath);
  }

  if (plugins.entries) {
    delete plugins.entries[pluginId];
  }

  if (plugins.installs) {
    delete plugins.installs[pluginId];
  }

  if (plugins.allow && Array.isArray(plugins.allow)) {
    plugins.allow = plugins.allow.filter((entry) => entry !== pluginId);
  }

  if (plugins.slots?.contextEngine === pluginId) {
    delete plugins.slots.contextEngine;
  }

  config.plugins = plugins;
  writeFileSync(openclawConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  rmSync(extensionInstallPath, { recursive: true, force: true });
  return backupPath;
}

function run(command, commandArgs, input = {}) {
  const label = [command, ...commandArgs].join(' ');
  printNote(`执行：${label}`);

  const shouldUseShellWrapper = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  const result = shouldUseShellWrapper
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', quoteForCmd(command, commandArgs)], {
        cwd: input.cwd,
        stdio: 'inherit',
        shell: false
      })
    : spawnSync(command, commandArgs, {
        cwd: input.cwd,
        stdio: 'inherit',
        shell: false
      });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !input.allowFailure) {
    throw new Error(`命令执行失败（exit ${result.status}）：${label}`);
  }

  return result.status ?? 0;
}

function quoteForCmd(command, commandArgs) {
  return [command, ...commandArgs].map(quoteCmdToken).join(' ');
}

function quoteCmdToken(token) {
  const text = String(token);
  if (text.length === 0) {
    return '""';
  }

  if (!/[\s"]/u.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '\\"')}"`;
}

function assertExists(targetPath, message) {
  if (!existsSync(targetPath)) {
    throw new Error(message);
  }
}

function printBanner(title) {
  console.log(`\n== ${title} ==`);
}

function printStep(title) {
  console.log(`\n[步骤] ${title}`);
}

function printNote(message) {
  console.log(`[info] ${message}`);
}
