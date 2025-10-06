#!/usr/bin/env bun

import path from 'path';
import { Command } from '@commander-js/extra-typings';
import { startDaemon } from './daemon.js';
import { sendToExistingDaemon } from './client.js';
import { formatDiagnosticsPlain } from './lsp/formatter.js';
import type { Diagnostic } from './lsp/types.js';
import { ensureDaemonRunning } from './utils.js';
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

export async function handleClaudeCodeHook(
  filePath: string
): Promise<{ hasIssues: boolean; output: string; daemonFailed?: boolean }> {
  // Check if file exists
  if (!(await Bun.file(filePath).exists())) {
    return { hasIssues: false, output: '' };
  }

  // Filter supported file types
  const supportedExts = [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.mts',
    '.cts',
    '.py',
    '.pyi',
    '.go',
    '.json',
    '.jsonc',
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.yaml',
    '.yml',
    '.sh',
    '.bash',
    '.zsh',
    '.java',
    '.lua',
    '.graphql',
    '.gql',
    '.r',
    '.R',
    '.rmd',
    '.Rmd',
    '.cs',
  ];
  const ext = path.extname(filePath);
  if (!supportedExts.includes(ext)) {
    return { hasIssues: false, output: '' };
  }

  // Get diagnostics (suppress errors to stdout)
  try {
    // Ensure daemon is running
    const daemonStarted = await ensureDaemonRunning();

    if (!daemonStarted) {
      // Failed to start daemon - return with flag so caller can handle
      return {
        hasIssues: false,
        output:
          'Failed to start LSP daemon. Please try running "cli-lsp-client stop" and retry.',
        daemonFailed: true,
      };
    }

    const result = await sendToExistingDaemon('diagnostics', [filePath]);

    // The diagnostics command returns an array of diagnostics
    if (!Array.isArray(result) || result.length === 0) {
      return { hasIssues: false, output: '' };
    }

    const diagnostics = result as Diagnostic[];

    // Format output for Claude Code hook (plain text, no ANSI codes)
    const formatted = formatDiagnosticsPlain(filePath, diagnostics);
    return { hasIssues: true, output: formatted || '' };
  } catch (_error) {
    // Silently fail - don't break Claude Code experience
    return { hasIssues: false, output: '' };
  }
}

async function run(): Promise<void> {
  // Check if we're being invoked to run as daemon
  if (process.env.LSPCLI_DAEMON_MODE === '1') {
    await startDaemon();
    return;
  }

  const program = new Command()
    .name('cli-lsp-client')
    .description('CLI tool for fast LSP diagnostics with background daemon')
    .version(packageJson.version)
    .option('--config-file <path>', 'path to configuration file')
    .addHelpText('after', `
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

The daemon automatically starts when needed and caches LSP servers for fast diagnostics.
Use 'cli-lsp-client logs' to find the log file for debugging.
`);

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

  // Set default command to status
  if (process.argv.length === 2) {
    process.argv.push('status');
  }

  await program.parseAsync(process.argv);
}

export { run };

if (import.meta.main) {
  run();
}
