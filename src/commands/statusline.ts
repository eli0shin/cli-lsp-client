import type { Command } from '@commander-js/extra-typings';
import { sendToExistingDaemon } from '../client.js';

export function registerStatuslineCommand(program: Command) {
  program
    .command('statusline')
    .description('Show active LSP server names for statusline display')
    .action(async () => {
      try {
        const result = await sendToExistingDaemon('statusline', []);
        if (typeof result === 'string' && result.length > 0) {
          process.stdout.write(result + '\n');
        }
      } catch {
        // No daemon running — exit silently
      }
    });
}
