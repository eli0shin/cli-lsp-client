import type { Command } from '@commander-js/extra-typings';
import { runCommand } from '../client.js';
import { assertConfigFileOptions } from '../type-guards.js';

export function registerStopCommand(program: Command) {
  program
    .command('stop')
    .description('Stop the daemon')
    .action(async (_options, command) => {
      const opts = command.optsWithGlobals();
      assertConfigFileOptions(opts);
      await runCommand('stop', [], opts.configFile);
    });
}
