import type { Command } from '@commander-js/extra-typings';
import { listAllDaemons } from '../client.js';

export function registerListCommand(program: Command) {
  program
    .command('list')
    .description('List all running daemons with their working directories')
    .action(async () => {
      await listAllDaemons();
    });
}
