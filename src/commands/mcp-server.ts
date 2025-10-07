import type { Command } from '@commander-js/extra-typings';
import { startMcpServer } from '../mcp/server.js';

export function registerMcpServerCommand(program: Command) {
  program
    .command('mcp-server')
    .description('Start MCP server')
    .action(async () => {
      await startMcpServer();
    });
}
