import type { Command } from '@commander-js/extra-typings';
import { runCommand } from '../client.js';

export function registerLogsCommand(program: Command) {
  program
    .command('logs')
    .description('Show the daemon log file path')
    .action(async (_options, command) => {
      const opts = command.optsWithGlobals() as { configFile?: string };
      await runCommand('logs', [], opts.configFile);
    });
}
