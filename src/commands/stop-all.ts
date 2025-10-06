import type { Command } from '@commander-js/extra-typings';
import { stopAllDaemons } from '../client.js';

export function registerStopAllCommand(program: Command) {
  program
    .command('stop-all')
    .description('Stop all daemons across all directories')
    .action(async () => {
      await stopAllDaemons();
    });
}
