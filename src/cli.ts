#!/usr/bin/env bun

import { startDaemon } from './daemon.js';
import { runCommand } from './client.js';

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';
  const commandArgs = args.slice(1);

  // Check if we're being invoked to run as daemon
  if (process.env.LSPCLI_DAEMON_MODE === '1') {
    await startDaemon();
    return;
  }

  // All user commands are handled by the client (which auto-starts daemon if needed)
  await runCommand(command, commandArgs);
}

export { run };

if (import.meta.main) {
  run();
}
