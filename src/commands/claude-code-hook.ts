import type { Command } from '@commander-js/extra-typings';
import path from 'path';
import { sendToExistingDaemon } from '../client.js';
import { formatDiagnosticsPlain } from '../lsp/formatter.js';
import type { Diagnostic } from '../lsp/types.js';
import { ensureDaemonRunning, readHookInput } from '../utils.js';

export function registerClaudeCodeHookCommand(program: Command) {
  program
    .command('claude-code-hook')
    .description('Internal command for Claude Code integration')
    .action(async () => {
      try {
        const isPluginMode = !!process.env.CLAUDE_PLUGIN_ROOT;
        const hookData = await readHookInput();

        if (!hookData) {
          if (isPluginMode) {
            process.stdout.write('{}');
          }
          process.exit(0); // No input or invalid JSON, silently exit
        }
        // Extract file_path from PostToolUse tool_input
        const filePath = hookData.tool_input?.file_path;

        if (!filePath) {
          if (isPluginMode) {
            process.stdout.write('{}');
          }
          process.exit(0); // No file path, silently exit
        }

        const result = await handleClaudeCodeHook(filePath);

        if (isPluginMode) {
          // Plugin mode: output JSON to stdout and always exit 0
          if (result.daemonFailed) {
            process.stdout.write(
              JSON.stringify({
                reason: result.output,
                hookSpecificOutput: {
                  hookEventName: 'PostToolUse',
                  additionalContext: 'LSP diagnostics check exited with code 1',
                },
              })
            );
          } else if (result.hasIssues) {
            process.stdout.write(
              JSON.stringify({
                decision: 'block',
                reason: result.output,
              })
            );
          } else {
            process.stdout.write('{}');
          }
          process.exit(0);
        } else {
          // Non-plugin mode: use stderr and exit codes
          if (result.daemonFailed) {
            process.stderr.write(result.output + '\n');
            process.exit(1);
          }
          if (result.hasIssues) {
            process.stderr.write(result.output + '\n');
            process.exit(2);
          }
          process.exit(0);
        }
      } catch (_error) {
        // Silently fail for hook commands to not break Claude Code
        if (process.env.CLAUDE_PLUGIN_ROOT) {
          process.stdout.write('{}');
        }
        process.exit(0);
      }
    });
}

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
