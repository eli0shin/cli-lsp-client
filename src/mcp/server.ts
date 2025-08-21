import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { sendToExistingDaemon } from '../client.js';
import { ensureDaemonRunning } from '../utils.js';
import type { HoverResult } from '../lsp/types.js';

const server = new McpServer({
  name: 'cli-lsp-hover',
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
      const location = `Location: ${result.location.file}:${result.location.line}:${result.location.column}`;

      let content = '';
      const contents = result.hover.contents;

      if (typeof contents === 'string') {
        content = contents;
      } else if (Array.isArray(contents)) {
        content = contents
          .map((c) => (typeof c === 'string' ? c : 'value' in c ? c.value : ''))
          .join('\n');
      } else if (
        contents &&
        typeof contents === 'object' &&
        'value' in contents
      ) {
        content = contents.value;
      }

      return `${location}\n${content}`;
    })
    .join('\n\n---\n\n');
}

server.registerTool(
  'hover',
  {
    title: 'Hover Tool',
    description: 'Get hover information for a symbol in a file',
    inputSchema: {
      file: z.string().describe('The file path containing the symbol'),
      symbol: z.string().describe('The symbol to get hover information for'),
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
              text: 'No hover information found for the symbol.',
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

