import type { Command } from '@commander-js/extra-typings';
import { runCommand } from '../client.js';
import { assertConfigFileOptions } from '../type-guards.js';

export function registerDiagnosticsCommand(program: Command) {
  program
    .command('diagnostics')
    .description('Get diagnostics for a file')
    .argument('<file>', 'file path to analyze')
    .action(async (file: string, _options, command) => {
      const opts = command.optsWithGlobals();
      assertConfigFileOptions(opts);
      await runCommand('diagnostics', [file], opts.configFile);
    });
}
