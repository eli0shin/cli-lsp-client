import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { sendToExistingDaemon } from '../client.js';
import { ensureDaemonRunning } from '../utils.js';
import type { HoverResult } from '../lsp/types.js';

const server = new McpServer({
  name: 'lsp-code-intelligence',
  version: '1.0.0',
});

async function initializeDaemon() {
  const started = await ensureDaemonRunning();
  if (!started) {
    throw new Error('Failed to start LSP daemon');
  }
}

// Format hover results as plain text without ANSI codes
function formatHoverResultsPlain(hoverResults: HoverResult[]): string {
  if (hoverResults.length === 0) {
    return 'No hover information found for the symbol.';
  }

  return hoverResults
    .map((result) => {
      const location = `${result.description}: ${result.location.file}:${result.location.line}:${result.location.column}`;

      let content = '';
      const contents = result.hover.contents;

      if (typeof contents === 'string') {
        content = contents;
      } else if (Array.isArray(contents)) {
        content = contents
          .map((c) => (typeof c === 'string' ? c : 'value' in c ? c.value : ''))
          .join('\n');
      } else if (typeof contents === 'object' && 'value' in contents) {
        content = contents.value;
      }

      return `${location}\n${content}`;
    })
    .join('\n\n');
}

server.registerTool(
  'get-symbol-definition',
  {
    title: 'Get Symbol Definition and Documentation',
    description: `Retrieves comprehensive information about a symbol's definition, type signature, and documentation from a Language Server Protocol (LSP) provider.

Use this tool when you need to:
- Understand what a function, variable, class, or type does
- Get the type signature or function parameters of a symbol
- Read documentation or comments associated with a symbol
- Investigate unfamiliar code symbols in a codebase
- Verify the expected behavior or contract of an API

This tool performs the equivalent of "hovering" over a symbol in an IDE, providing rich contextual information that helps understand code without navigating to the definition.`,
    inputSchema: {
      file: z
        .string()
        .describe(
          'The absolute or relative file path containing the symbol (e.g., "src/utils.ts", "/home/user/project/main.py")'
        ),
      symbol: z
        .string()
        .describe(
          'The exact symbol name to look up (e.g., "calculateTotal", "MyClass", "MAX_SIZE"). Case-sensitive.'
        ),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ file, symbol }) => {
    try {
      // Ensure daemon is running
      await initializeDaemon();

      const result = await sendToExistingDaemon('hover', [file, symbol]);

      // Handle the result exactly like the CLI does
      if (!result || !Array.isArray(result) || result.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No definition found for symbol "${symbol}" in file "${file}". 

Possible reasons:
- The symbol name might be misspelled (check exact spelling and case)
- The file path might be incorrect
- The symbol might be defined in a different file
- The Language Server for this file type might not be running

Try using a more specific symbol name or verifying the file path.`,
            },
          ],
        };
      }

      // Format the hover results as plain text (no ANSI codes)
      const hoverResults = result as HoverResult[];
      const formatted = formatHoverResultsPlain(hoverResults);

      return {
        content: [
          {
            type: 'text',
            text: formatted,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Return the actual error message
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

export async function startMcpServer() {
  // Initialize daemon when server starts
  await initializeDaemon();

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
