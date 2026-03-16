import {
  APP_WORKSPACES,
  PACKAGE_WORKSPACES,
  SHARED_WORKSPACES,
  SHELL_WORKSPACES,
  describeWorkspaceDependencyGraph,
  topologicallySortWorkspaces
} from './workspace-metadata.mjs';

const rows = describeWorkspaceDependencyGraph();
const ordered = topologicallySortWorkspaces(rows);

function printGroup(name, descriptors) {
  console.log(`${name}:`);
  for (const descriptor of descriptors) {
    console.log(`  - ${descriptor.name}`);
  }
}

console.log('Workspace dependency graph');
console.log('==========================');

for (const row of rows) {
  const deps = row.deps.length > 0 ? row.deps.join(', ') : '(none)';
  console.log(`- ${row.name}`);
  console.log(`  dir : ${row.dir}`);
  console.log(`  deps: ${deps}`);
}

console.log('\nTopological build order');
console.log('-----------------------');
for (const descriptor of ordered) {
  console.log(`- ${descriptor.name}`);
}

console.log('\nWorkspace groups');
console.log('----------------');
printGroup('shared', SHARED_WORKSPACES);
printGroup('shells', SHELL_WORKSPACES);
printGroup('packages', PACKAGE_WORKSPACES);
printGroup('apps', APP_WORKSPACES);
