import { spawnSync } from 'node:child_process';
import { collectWorkspaceClosure, expandWorkspaceArgs, topologicallySortWorkspaces } from './workspace-metadata.mjs';

const [mode, ...workspaceArgs] = process.argv.slice(2);

if (!mode || !['build', 'check'].includes(mode)) {
  console.error('[run-workspace-plan] expected mode: build | check');
  process.exit(1);
}

if (workspaceArgs.length === 0) {
  console.error('[run-workspace-plan] expected at least one workspace or workspace group');
  process.exit(1);
}

let targets;

try {
  targets = expandWorkspaceArgs(workspaceArgs);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const targetNames = new Set(targets.map((descriptor) => descriptor.name));
const orderedClosure = topologicallySortWorkspaces(collectWorkspaceClosure(targets));

function runWorkspaceScript(descriptor, scriptName) {
  console.log(`\n[run-workspace-plan] ${scriptName} -> ${descriptor.name}`);
  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec ?? 'cmd.exe',
          ['/d', '/s', '/c', `npm.cmd run ${scriptName} --workspace ${descriptor.name}`],
          {
            stdio: 'inherit',
            env: process.env
          }
        )
      : spawnSync('npm', ['run', scriptName, '--workspace', descriptor.name], {
          stdio: 'inherit',
          env: process.env
        });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (mode === 'build') {
  for (const descriptor of orderedClosure) {
    runWorkspaceScript(descriptor, 'build:self');
  }
  process.exit(0);
}

for (const descriptor of orderedClosure) {
  runWorkspaceScript(descriptor, 'build:self');
}

for (const descriptor of orderedClosure) {
  if (targetNames.has(descriptor.name)) {
    runWorkspaceScript(descriptor, 'check:self');
  }
}
