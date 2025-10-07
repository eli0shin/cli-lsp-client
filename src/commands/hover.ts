import type { Command } from '@commander-js/extra-typings';
import { runCommand } from '../client.js';

export function registerHoverCommand(program: Command) {
  program
    .command('hover')
    .description('Get hover info for a symbol in specific file')
    .argument('<file>', 'file path')
    .argument('<symbol>', 'symbol name')
    .action(async (file: string, symbol: string, _options, command) => {
      const opts = command.optsWithGlobals() as { configFile?: string };
      await runCommand('hover', [file, symbol], opts.configFile);
    });
}
