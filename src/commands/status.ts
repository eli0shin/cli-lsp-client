import type { Command } from '@commander-js/extra-typings';
import { runCommand } from '../client.js';

export function registerStatusCommand(program: Command) {
  program
    .command('status')
    .description('Show daemon status and memory usage')
    .action(async () => {
      const opts = program.optsWithGlobals() as { configFile?: string };
      await runCommand('status', [], opts.configFile);
    });
}
