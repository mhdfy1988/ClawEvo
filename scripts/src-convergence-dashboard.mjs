import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ACTIVE_SRC_COMPAT_ENTRIES, REMOVED_SRC_COMPAT_PATHS } from './src-compat-metadata.mjs';
import { ACTIVE_SRC_COMPAT_ENTRIES as OWNERSHIP_COMPAT_ENTRIES, LONG_LIVED_REPO_SRC_AREAS } from './src-ownership-metadata.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SRC_ROOT = path.resolve(REPO_ROOT, 'src');

function countTreeStats(targetPath) {
  const absolutePath = path.resolve(REPO_ROOT, targetPath);
  if (!fs.existsSync(absolutePath)) {
    return {
      files: 0,
      dirs: 0,
      tsFiles: 0
    };
  }

  const stats = fs.statSync(absolutePath);
  if (stats.isFile()) {
    return {
      files: 1,
      dirs: 0,
      tsFiles: absolutePath.endsWith('.ts') ? 1 : 0
    };
  }

  let files = 0;
  let dirs = 0;
  let tsFiles = 0;

  const stack = [absolutePath];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        dirs += 1;
        stack.push(entryPath);
        continue;
      }
      if (entry.isFile()) {
        files += 1;
        if (entry.name.endsWith('.ts')) {
          tsFiles += 1;
        }
      }
    }
  }

  return { files, dirs, tsFiles };
}

function summarizeEntries(entries) {
  return entries.reduce(
    (acc, entry) => {
      const stats = countTreeStats(entry.path);
      acc.files += stats.files;
      acc.dirs += stats.dirs;
      acc.tsFiles += stats.tsFiles;
      return acc;
    },
    { files: 0, dirs: 0, tsFiles: 0 }
  );
}

function countBy(entries, key) {
  const counts = {};
  for (const entry of entries) {
    const value = entry[key];
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function listTopLevelSrcEntries() {
  return fs.readdirSync(SRC_ROOT, { withFileTypes: true }).map((entry) => ({
    name: entry.name,
    kind: entry.isDirectory() ? 'dir' : 'file'
  }));
}

export const SRC_CONVERGENCE_DASHBOARD = {
  version: 'src_convergence_dashboard.v1',
  baselineRecordedAt: '2026-03-16',
  currentTree: {
    topLevelEntries: listTopLevelSrcEntries(),
    topLevelEntryCount: listTopLevelSrcEntries().length,
    ...countTreeStats('src')
  },
  areaStats: {
    repoInternal: summarizeEntries(LONG_LIVED_REPO_SRC_AREAS),
    compat: summarizeEntries(ACTIVE_SRC_COMPAT_ENTRIES)
  },
  metadataSummary: {
    longLivedRepoAreaCount: LONG_LIVED_REPO_SRC_AREAS.length,
    activeCompatEntryCount: ACTIVE_SRC_COMPAT_ENTRIES.length,
    removedCompatEntryCount: REMOVED_SRC_COMPAT_PATHS.length,
    ownershipCompatEntryCount: OWNERSHIP_COMPAT_ENTRIES.length
  },
  targetStateSummary: {
    repoInternal: countBy(LONG_LIVED_REPO_SRC_AREAS, 'targetState'),
    compat: countBy(ACTIVE_SRC_COMPAT_ENTRIES, 'targetState')
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(SRC_CONVERGENCE_DASHBOARD, null, 2));
}
