import { spawnSync } from 'node:child_process';

const workspaces = [
  '@openclaw-compact-context/contracts',
  '@openclaw-compact-context/runtime-core',
  '@openclaw-compact-context/control-plane-core',
  '@openclaw-compact-context/openclaw-plugin',
  '@openclaw-compact-context/control-plane'
];

for (const workspace of workspaces) {
  console.log(`\n[pack:workspace] ${workspace}`);

  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec ?? 'cmd.exe',
          ['/d', '/s', '/c', `npm.cmd pack --workspace=${workspace} --json --dry-run --ignore-scripts`],
          {
            stdio: 'inherit'
          }
        )
      : spawnSync('npm', ['pack', '--workspace', workspace, '--json', '--dry-run', '--ignore-scripts'], {
          stdio: 'inherit'
        });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
