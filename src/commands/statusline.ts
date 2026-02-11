import type { Command } from '@commander-js/extra-typings';
import { runCommand } from '../client.js';

export function registerStatuslineCommand(program: Command) {
  program
    .command('statusline')
    .description('Show active LSP server names for statusline display')
    .action(async () => {
      await runCommand('statusline', []);
    });
}
