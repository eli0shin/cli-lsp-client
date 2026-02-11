import type { Command } from '@commander-js/extra-typings';
import { runCommand } from '../client.js';
import { assertConfigFileOptions } from '../type-guards.js';

export function registerStatuslineCommand(program: Command) {
  program
    .command('statusline')
    .description('Show active LSP server names for statusline display')
    .action(async () => {
      const opts = program.optsWithGlobals();
      assertConfigFileOptions(opts);
      await runCommand('statusline', [], opts.configFile);
    });
}
