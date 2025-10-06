import type { Command } from '@commander-js/extra-typings';
import { z } from 'zod';
import { handleClaudeCodeHook } from '../cli.js';

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

export function registerClaudeCodeHookCommand(program: Command) {
  program
    .command('claude-code-hook')
    .description('Internal command for Claude Code integration')
    .action(async () => {
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
    });
}
