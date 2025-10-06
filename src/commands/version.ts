import type { Command } from '@commander-js/extra-typings';
import packageJson from '../../package.json' with { type: 'json' };

export function registerVersionCommand(program: Command) {
  program
    .command('version')
    .description('Show version number')
    .action(() => {
      process.stdout.write(packageJson.version + '\n');
    });
}
