#!/usr/bin/env node

import { createProcessCliIo, executeContextCli } from '../cli/context-cli-runtime.js';

void (async () => {
  const exitCode = await executeContextCli(process.argv.slice(2), createProcessCliIo(), {
    invocationName: 'openclaw-context-cli'
  });
  process.exitCode = exitCode;
})();
