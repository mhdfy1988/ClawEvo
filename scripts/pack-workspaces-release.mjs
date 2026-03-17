import { spawnSync } from 'node:child_process';
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_WORKSPACES,
  collectManifestArtifactPaths,
  collectWorkspaceClosure,
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

function isStandaloneReleaseWorkspace(workspace) {
  return APP_WORKSPACES.some((candidate) => candidate.name === workspace.name);
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

async function readWorkspaceManifest(workspace) {
  return JSON.parse(await readFile(resolve(REPO_ROOT, workspace.dir, 'package.json'), 'utf8'));
}

function normalizeRelativePath(value) {
  return typeof value === 'string' ? value.replace(/\\/g, '/').replace(/^\.\/+/, './') : value;
}

function rewriteTypePath(value) {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.startsWith('./src/') && value.endsWith('.ts')) {
    return `./dist/${value.slice('./src/'.length, -'.ts'.length)}.d.ts`;
  }

  return normalizeRelativePath(value);
}

function rewriteRuntimePath(value) {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.startsWith('./src/') && value.endsWith('.ts')) {
    return `./dist/${value.slice('./src/'.length, -'.ts'.length)}.js`;
  }

  return normalizeRelativePath(value);
}

function rewriteExportsForRelease(exportsValue) {
  if (typeof exportsValue === 'string') {
    return rewriteRuntimePath(exportsValue);
  }

  if (!exportsValue || typeof exportsValue !== 'object') {
    return exportsValue;
  }

  return Object.fromEntries(
    Object.entries(exportsValue).map(([key, value]) => {
      if (key === 'types') {
        return [key, rewriteTypePath(value)];
      }

      if (key === 'default') {
        return [key, rewriteRuntimePath(value)];
      }

      return [key, rewriteExportsForRelease(value)];
    })
  );
}

function createReleaseManifest(workspace, manifest, bundledDependencies, dependencyVersionMap) {
  const rewrittenManifest = {
    name: manifest.name,
    version: manifest.version,
    type: manifest.type,
    description: manifest.description,
    ...(manifest.openclaw
      ? {
          openclaw: {
            ...manifest.openclaw,
            ...(Array.isArray(manifest.openclaw.extensions)
              ? {
                  extensions: manifest.openclaw.extensions.map((entry) => rewriteRuntimePath(entry))
                }
              : {})
          }
        }
      : {}),
    files: [...(manifest.files ?? [])],
    ...(manifest.main ? { main: rewriteRuntimePath(manifest.main) } : {}),
    ...(manifest.bin
      ? {
          bin:
            typeof manifest.bin === 'string'
              ? rewriteRuntimePath(manifest.bin)
              : Object.fromEntries(
                  Object.entries(manifest.bin).map(([key, value]) => [key, rewriteRuntimePath(value)])
                )
        }
      : {}),
    ...(manifest.exports ? { exports: rewriteExportsForRelease(manifest.exports) } : {}),
    ...(manifest.types ? { types: rewriteTypePath(manifest.types) } : {})
  };

  if (bundledDependencies.length > 0) {
    const existingDependencies = manifest.dependencies ?? {};
    const externalDependencies = Object.fromEntries(
      Object.entries(existingDependencies).filter(([dependencyName]) => !bundledDependencies.includes(dependencyName))
    );

    rewrittenManifest.dependencies = {
      ...externalDependencies,
      ...Object.fromEntries(
        bundledDependencies.map((dependencyName) => [dependencyName, dependencyVersionMap.get(dependencyName) ?? '0.1.0'])
      )
    };
    rewrittenManifest.bundledDependencies = [...bundledDependencies];
  } else if (manifest.dependencies) {
    rewrittenManifest.dependencies = { ...manifest.dependencies };
  }

  if (!isStandaloneReleaseWorkspace(workspace) && manifest.dependencies && !rewrittenManifest.dependencies) {
    rewrittenManifest.dependencies = { ...manifest.dependencies };
  }

  return rewrittenManifest;
}

async function copyPublishFiles(sourceDir, targetDir, manifest, manifestOverride) {
  await mkdir(targetDir, {
    recursive: true
  });

  for (const fileEntry of manifest.files ?? []) {
    const sourcePath = resolve(sourceDir, fileEntry);
    const targetPath = resolve(targetDir, fileEntry);
    await cp(sourcePath, targetPath, {
      recursive: true
    });
  }

  await writeFile(resolve(targetDir, 'package.json'), `${JSON.stringify(manifestOverride ?? manifest, null, 2)}\n`, 'utf8');
}

function getScopedPackagePath(packageName) {
  const parts = packageName.split('/');
  return parts.length === 2 ? join(parts[0], parts[1]) : packageName;
}

async function createStandaloneStage(workspace) {
  const stagingRoot = await mkdir(resolve(tmpdir(), 'openclaw-compact-context-release-staging'), {
    recursive: true
  }).then(() => resolve(tmpdir(), 'openclaw-compact-context-release-staging', getWorkspaceReleaseDirName(workspace)));

  await rm(stagingRoot, {
    recursive: true,
    force: true
  });
  await mkdir(stagingRoot, {
    recursive: true
  });

  const workspaceManifest = await readWorkspaceManifest(workspace);
  const closure = topologicallySortWorkspaces(collectWorkspaceClosure([workspace]));
  const bundledWorkspaces = closure.filter((candidate) => candidate.name !== workspace.name);
  const bundledDependencyNames = bundledWorkspaces.map((candidate) => candidate.name);
  const dependencyVersionMap = new Map();

  for (const bundledWorkspace of bundledWorkspaces) {
    const bundledManifest = await readWorkspaceManifest(bundledWorkspace);
    dependencyVersionMap.set(bundledWorkspace.name, bundledManifest.version);
  }

  const releaseManifest = createReleaseManifest(
    workspace,
    workspaceManifest,
    bundledDependencyNames,
    dependencyVersionMap
  );
  await copyPublishFiles(resolve(REPO_ROOT, workspace.dir), stagingRoot, workspaceManifest, releaseManifest);

  if (bundledWorkspaces.length === 0) {
    return stagingRoot;
  }

  const nodeModulesRoot = resolve(stagingRoot, 'node_modules');
  await mkdir(nodeModulesRoot, {
    recursive: true
  });

  for (const bundledWorkspace of bundledWorkspaces) {
    const bundledManifest = await readWorkspaceManifest(bundledWorkspace);
    const bundledReleaseManifest = createReleaseManifest(bundledWorkspace, bundledManifest, [], new Map());
    const targetDir = resolve(nodeModulesRoot, getScopedPackagePath(bundledWorkspace.name));
    await copyPublishFiles(resolve(REPO_ROOT, bundledWorkspace.dir), targetDir, bundledManifest, bundledReleaseManifest);
  }

  return stagingRoot;
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

function runPack(workspace, workspaceOutputDir, sourceDir = REPO_ROOT) {
  const isStandaloneSource = sourceDir !== REPO_ROOT;
  const packDestination = isStandaloneSource
    ? relative(sourceDir, workspaceOutputDir).replace(/\\/g, '/')
    : relative(REPO_ROOT, workspaceOutputDir).replace(/\\/g, '/');
  const result = process.platform === 'win32'
    ? spawnSync(
        process.env.ComSpec ?? 'cmd.exe',
        [
          '/d',
          '/s',
          '/c',
          isStandaloneSource
            ? `npm.cmd pack --json --pack-destination ${packDestination} --ignore-scripts`
            : `npm.cmd pack --workspace=${workspace.name} --json --pack-destination ${packDestination} --ignore-scripts`
        ],
        {
          cwd: sourceDir,
          env: process.env,
          encoding: 'utf8'
        }
      )
    : spawnSync(
        'npm',
        isStandaloneSource
          ? ['pack', '--json', '--pack-destination', workspaceOutputDir, '--ignore-scripts']
          : ['pack', '--workspace', workspace.name, '--json', '--pack-destination', workspaceOutputDir, '--ignore-scripts'],
        {
          cwd: sourceDir,
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
  let packSourceDir = REPO_ROOT;

  console.log(`\n[pack:release] verify -> ${workspace.name}`);
  console.log(`[pack:release] output dir -> ${workspaceOutputDir}`);
  await assertWorkspaceArtifactsExist(workspace);

  if (isStandaloneReleaseWorkspace(workspace)) {
    packSourceDir = await createStandaloneStage(workspace);
    console.log(`[pack:release] standalone stage -> ${packSourceDir}`);
  }

  try {
    const packed = runPack(workspace, workspaceOutputDir, packSourceDir);
    if (!packed.ok) {
      process.exit(packed.exitCode);
    }
  } finally {
    if (packSourceDir !== REPO_ROOT) {
      await rm(packSourceDir, {
        recursive: true,
        force: true
      });
    }
  }
}
