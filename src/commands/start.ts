import type { Command } from '@commander-js/extra-typings';
import { runCommand } from '../client.js';

export function registerStartCommand(program: Command) {
  program
    .command('start')
    .description('Start LSP servers for a directory (default: current)')
    .argument('[directory]', 'directory to start servers for')
    .action(async (directory: string | undefined, _options, command) => {
      const opts = command.optsWithGlobals() as { configFile?: string };
      await runCommand('start', directory ? [directory] : [], opts.configFile);
    });
}
