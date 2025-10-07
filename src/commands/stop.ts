import type { Command } from '@commander-js/extra-typings';
import { runCommand } from '../client.js';

export function registerStopCommand(program: Command) {
  program
    .command('stop')
    .description('Stop the daemon')
    .action(async (_options, command) => {
      const opts = command.optsWithGlobals() as { configFile?: string };
      await runCommand('stop', [], opts.configFile);
    });
}
