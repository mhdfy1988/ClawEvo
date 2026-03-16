import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, rm } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectManifestArtifactPaths,
  expandWorkspaceArgs,
  PACK_WORKSPACES,
  RELEASE_WORKSPACES,
  topologicallySortWorkspaces
} from './workspace-metadata.mjs';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

function parseArguments(argv) {
  const workspaceArgs = [];
  let outDir = 'artifacts/releases';

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--out-dir') {
      outDir = argv[index + 1] ?? outDir;
      index += 1;
      continue;
    }

    workspaceArgs.push(value);
  }

  return {
    workspaceArgs,
    outDir
  };
}

async function assertWorkspaceArtifactsExist(workspace) {
  const packageJsonPath = resolve(REPO_ROOT, workspace.dir, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const requiredPaths = collectManifestArtifactPaths(packageJson);

  for (const requiredPath of requiredPaths) {
    const absolutePath = resolve(REPO_ROOT, workspace.dir, requiredPath);

    try {
      await access(absolutePath);
    } catch {
      throw new Error(
        `[pack:release] missing required artifact for ${workspace.name}: ${workspace.dir}/${requiredPath}`
      );
    }
  }
}

function getWorkspaceReleaseDirName(workspace) {
  const dirName = basename(workspace.dir.replace(/\\/g, '/'));
  return dirName || workspace.name.replace(/^@/, '').replace(/[\\/]/g, '-');
}

async function prepareWorkspaceOutputDir(outputRoot, workspace) {
  const workspaceOutputDir = resolve(outputRoot, getWorkspaceReleaseDirName(workspace));
  await rm(workspaceOutputDir, {
    recursive: true,
    force: true
  });
  await mkdir(workspaceOutputDir, {
    recursive: true
  });

  return workspaceOutputDir;
}

async function removeLegacyAggregateDirs(outputRoot) {
  for (const legacyDirName of ['apps', 'workspaces']) {
    await rm(resolve(outputRoot, legacyDirName), {
      recursive: true,
      force: true
    });
  }
}

async function removeNonTargetWorkspaceDirs(outputRoot, selectedWorkspaces) {
  const selectedDirNames = new Set(selectedWorkspaces.map((workspace) => getWorkspaceReleaseDirName(workspace)));

  for (const workspace of PACK_WORKSPACES) {
    const dirName = getWorkspaceReleaseDirName(workspace);
    if (selectedDirNames.has(dirName)) {
      continue;
    }

    await rm(resolve(outputRoot, dirName), {
      recursive: true,
      force: true
    });
  }
}

function runPack(workspace, workspaceOutputDir) {
  const packDestination = relative(REPO_ROOT, workspaceOutputDir).replace(/\\/g, '/');
  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec ?? 'cmd.exe',
          [
            '/d',
            '/s',
            '/c',
            `npm.cmd pack --workspace=${workspace.name} --json --pack-destination ${packDestination} --ignore-scripts`
          ],
          {
            cwd: REPO_ROOT,
            env: process.env,
            encoding: 'utf8'
          }
        )
      : spawnSync(
          'npm',
          ['pack', '--workspace', workspace.name, '--json', '--pack-destination', workspaceOutputDir, '--ignore-scripts'],
          {
            cwd: REPO_ROOT,
            env: process.env,
            encoding: 'utf8'
          }
        );

  if ((result.status ?? 1) !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    return {
      ok: false,
      exitCode: result.status ?? 1
    };
  }

  const payload = JSON.parse(result.stdout);
  const packed = Array.isArray(payload) ? payload[0] : payload;

  console.log(`[pack:release] wrote -> ${workspace.name} -> ${resolve(workspaceOutputDir, packed.filename)}`);

  return {
    ok: true,
    packed
  };
}

const { workspaceArgs, outDir } = parseArguments(process.argv.slice(2));
const descriptors =
  workspaceArgs.length > 0 ? expandWorkspaceArgs(workspaceArgs) : [...RELEASE_WORKSPACES];
const orderedWorkspaces = topologicallySortWorkspaces(descriptors);
const outputDir = resolve(REPO_ROOT, outDir);

await mkdir(outputDir, {
  recursive: true
});
await removeLegacyAggregateDirs(outputDir);
await removeNonTargetWorkspaceDirs(outputDir, orderedWorkspaces);

console.log(`[pack:release] output root -> ${outputDir}`);

for (const workspace of orderedWorkspaces) {
  const workspaceOutputDir = await prepareWorkspaceOutputDir(outputDir, workspace);

  console.log(`\n[pack:release] verify -> ${workspace.name}`);
  console.log(`[pack:release] output dir -> ${workspaceOutputDir}`);
  await assertWorkspaceArtifactsExist(workspace);

  const packed = runPack(workspace, workspaceOutputDir);
  if (!packed.ok) {
    process.exit(packed.exitCode);
  }
}
