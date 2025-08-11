#!/usr/bin/env bun

import { startDaemon } from './daemon.js';
import { runCommand } from './client.js';

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'hello';
  const commandArgs = args.slice(1);

  // Special case: explicit daemon mode stays running
  if (command === 'daemon') {
    await startDaemon();
    return;
  }

  // For all other commands: delegate to client
  await runCommand(command, commandArgs);
}

export { run };

if (import.meta.main) {
  run();
}
