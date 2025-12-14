import type { Command } from '@commander-js/extra-typings';
import { runCommand } from '../client.js';
import { assertConfigFileOptions } from '../type-guards.js';

export function registerStatusCommand(program: Command) {
  program
    .command('status')
    .description('Show daemon status and memory usage')
    .action(async () => {
      const opts = program.optsWithGlobals();
      assertConfigFileOptions(opts);
      await runCommand('status', [], opts.configFile);
    });
}
