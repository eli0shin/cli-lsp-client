#!/usr/bin/env bun

import path from 'path';
import { startDaemon } from './daemon.js';
import { runCommand } from './client.js';
import { formatDiagnosticsPlain } from './lsp/formatter.js';
import type { Diagnostic } from './lsp/types.js';

export async function handleClaudeCodeHook(filePath: string): Promise<{ hasIssues: boolean; output: string }> {
  // Check if file exists
  if (!await Bun.file(filePath).exists()) {
    return { hasIssues: false, output: '' };
  }
  
  // Filter supported file types
  const supportedExts = ['.ts', '.tsx', '.js', '.jsx', '.py'];
  const ext = path.extname(filePath);
  if (!supportedExts.includes(ext)) {
    return { hasIssues: false, output: '' };
  }
  
  // Get diagnostics (suppress errors to stdout)
  try {
    const { sendToExistingDaemon } = await import('./client.js');
    const result = await sendToExistingDaemon('diagnostics', [filePath]);
    
    // The diagnostics command returns an array of diagnostics
    if (!Array.isArray(result) || result.length === 0) {
      return { hasIssues: false, output: '' };
    }
    
    const diagnostics = result as Diagnostic[];
    
    // Format output for Claude Code hook (plain text, no ANSI codes)
    const formatted = formatDiagnosticsPlain(filePath, diagnostics);
    return { hasIssues: true, output: formatted || '' };
  } catch (error) {
    // Silently fail - don't break Claude Code experience
    return { hasIssues: false, output: '' };
  }
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
      const hookData = JSON.parse(stdinData);
      const filePath = hookData.file_path || hookData.filePath;
      
      if (!filePath) {
        process.exit(0); // No file path, silently exit
      }

      const result = await handleClaudeCodeHook(filePath);
      if (result.hasIssues) {
        console.log(result.output);
        process.exit(2);
      }
      process.exit(0);
    } catch (error) {
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
