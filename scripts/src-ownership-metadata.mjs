export const LONG_LIVED_REPO_SRC_AREAS = [];

export const ACTIVE_SRC_COMPAT_ENTRIES = [];

export const SRC_OWNERSHIP_RULES = [
  'root src has been fully retired; repo-internal tests now live under tests/ instead of src/tests.',
  'shared contracts and type sources live under packages/contracts/src, and evaluation harnesses live under internal/evaluation.',
  'legacy compat forwarding is fully removed; new compat entrypoints must not be reintroduced under a root src directory.',
  'if a new repo-internal root directory is needed, document why it cannot live in package-local src or internal tooling first.'
];
