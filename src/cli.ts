#!/usr/bin/env bun

import path from 'path';
import { z } from 'zod';
import { startDaemon } from './daemon.js';
import { runCommand, sendToExistingDaemon } from './client.js';
import { formatDiagnosticsPlain } from './lsp/formatter.js';
import type { Diagnostic } from './lsp/types.js';
import { HELP_MESSAGE } from './constants.js';
import { ensureDaemonRunning } from './utils.js';
import packageJson from '../package.json' with { type: 'json' };

// Schema for Claude Code PostToolUse hook payload
const HookDataSchema = z.object({
  session_id: z.string().optional(),
  transcript_path: z.string().optional(),
  cwd: z.string().optional(),
  hook_event_name: z.string().optional(),
  tool_name: z.string().optional(),
  tool_input: z
    .object({
      file_path: z.string().optional(),
      content: z.string().optional(),
    })
    .optional(),
  tool_response: z.any().optional(),
});

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

function showHelp(): void {
  process.stdout.write(HELP_MESSAGE + '\n');
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';
  const commandArgs = args.slice(1);

  // Check if we're being invoked to run as daemon
  if (process.env.LSPCLI_DAEMON_MODE === '1') {
    await startDaemon();
    return;
  }

  // Handle help command directly (no daemon needed)
  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  // Handle version command directly (no daemon needed)
  if (command === 'version' || command === '--version' || command === '-v') {
    process.stdout.write(packageJson.version + '\n');
    return;
  }

  // Handle claude-code-hook command directly (reads JSON from stdin)
  if (command === 'claude-code-hook') {
    try {
      // Read JSON from stdin
      const stdinData = await new Promise<string>((resolve, reject) => {
        let data = '';
        process.stdin.on('data', (chunk) => {
          data += chunk.toString();
        });
        process.stdin.on('end', () => {
          resolve(data);
        });
        process.stdin.on('error', reject);
      });

      if (!stdinData.trim()) {
        process.exit(0); // No input, silently exit
      }

      // Parse the JSON to get the file path
      const parseResult = HookDataSchema.safeParse(JSON.parse(stdinData));
      if (!parseResult.success) {
        process.exit(0); // Invalid JSON format, silently exit
      }
      const hookData = parseResult.data;
      // Extract file_path from PostToolUse tool_input
      const filePath = hookData.tool_input?.file_path;

      if (!filePath) {
        process.exit(0); // No file path, silently exit
      }

      const result = await handleClaudeCodeHook(filePath);
      if (result.daemonFailed) {
        // Daemon failed to start - exit with status 1 to show error to user
        process.stderr.write(result.output + '\n');
        process.exit(1);
      }
      if (result.hasIssues) {
        process.stderr.write(result.output + '\n');
        process.exit(2);
      }
      process.exit(0);
    } catch (_error) {
      // Silently fail for hook commands to not break Claude Code
      process.exit(0);
    }
  }

  // All other user commands are handled by the client (which auto-starts daemon if needed)
  await runCommand(command, commandArgs);
}

export { run };

if (import.meta.main) {
  run();
}
