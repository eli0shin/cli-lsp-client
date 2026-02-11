#!/usr/bin/env bun

import { Command } from '@commander-js/extra-typings';
import { startDaemon } from './daemon.js';
import packageJson from '../package.json' with { type: 'json' };
import { registerVersionCommand } from './commands/version.js';
import { registerStatusCommand } from './commands/status.js';
import { registerListCommand } from './commands/list.js';
import { registerDiagnosticsCommand } from './commands/diagnostics.js';
import { registerHoverCommand } from './commands/hover.js';
import { registerStartCommand } from './commands/start.js';
import { registerLogsCommand } from './commands/logs.js';
import { registerStopCommand } from './commands/stop.js';
import { registerStopAllCommand } from './commands/stop-all.js';
import { registerMcpServerCommand } from './commands/mcp-server.js';
import { registerClaudeCodeHookCommand } from './commands/claude-code-hook.js';
import { registerUpdateCommand } from './commands/update.js';
import { registerStatuslineCommand } from './commands/statusline.js';
import { runUpdaterWorker } from './updater-worker.js';
import { handleAutoUpdate } from './auto-update.js';
import { loadConfigFile, getUpdateBehavior } from './lsp/config.js';

async function run(): Promise<void> {
  // Handle update worker mode early (before Commander parses)
  if (process.argv[2] === '--update-worker') {
    await runUpdaterWorker();
    process.exit(0);
  }

  // Check if we're being invoked to run as daemon
  if (process.env.LSPCLI_DAEMON_MODE === '1') {
    await startDaemon();
    return;
  }

  // Start auto-update check (non-blocking)
  const config = await loadConfigFile().catch(() => null);
  const updateBehavior = getUpdateBehavior(config);
  await handleAutoUpdate(packageJson.version, updateBehavior).catch(() => {});

  const program = new Command()
    .name('cli-lsp-client')
    .description('CLI tool for fast LSP diagnostics with background daemon')
    .version(packageJson.version)
    .option('--config-file <path>', 'path to configuration file')
    .addHelpText(
      'after',
      `
Examples:
  cli-lsp-client status                         # Check daemon status
  cli-lsp-client list                           # List all running daemons
  cli-lsp-client diagnostics src/main.ts        # Get TypeScript diagnostics
  cli-lsp-client diagnostics ./script.py        # Get Python diagnostics
  cli-lsp-client hover src/client.ts runCommand # Get hover info for runCommand function
  cli-lsp-client start                          # Start servers for current directory
  cli-lsp-client start /path/to/project         # Start servers for specific directory
  cli-lsp-client logs                           # Get log file location
  cli-lsp-client stop                           # Stop the daemon
  cli-lsp-client stop-all                       # Stop all daemons (useful after package updates)
  cli-lsp-client mcp-server                     # Start MCP server
  cli-lsp-client update                         # Update to the latest version

The daemon automatically starts when needed and caches LSP servers for fast diagnostics.
Use 'cli-lsp-client logs' to find the log file for debugging.
`
    );

  // Register all commands
  registerVersionCommand(program);
  registerStatusCommand(program);
  registerListCommand(program);
  registerDiagnosticsCommand(program);
  registerHoverCommand(program);
  registerStartCommand(program);
  registerLogsCommand(program);
  registerStopCommand(program);
  registerStopAllCommand(program);
  registerMcpServerCommand(program);
  registerClaudeCodeHookCommand(program);
  registerUpdateCommand(program);
  registerStatuslineCommand(program);

  // Set default command to status
  if (process.argv.length === 2) {
    process.argv.push('status');
  }

  await program.parseAsync(process.argv);
}

if (import.meta.main) {
  run();
}
