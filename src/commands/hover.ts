import type { Command } from '@commander-js/extra-typings';
import { runCommand } from '../client.js';
import { assertConfigFileOptions } from '../type-guards.js';

export function registerHoverCommand(program: Command) {
  program
    .command('hover')
    .description('Get hover info for a symbol in specific file')
    .argument('<file>', 'file path')
    .argument('<symbol>', 'symbol name')
    .action(async (file: string, symbol: string, _options, command) => {
      const opts = command.optsWithGlobals();
      assertConfigFileOptions(opts);
      await runCommand('hover', [file, symbol], opts.configFile);
    });
}
