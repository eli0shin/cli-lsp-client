import type { Command } from '@commander-js/extra-typings';
import { runCommand } from '../client.js';
import { assertConfigFileOptions } from '../type-guards.js';

export function registerLogsCommand(program: Command) {
  program
    .command('logs')
    .description('Show the daemon log file path')
    .action(async (_options, command) => {
      const opts = command.optsWithGlobals();
      assertConfigFileOptions(opts);
      await runCommand('logs', [], opts.configFile);
    });
}
