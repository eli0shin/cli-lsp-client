import { $ } from 'bun';

export const CLI_PATH = './lspcli';

export function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '').replace(/^\n/, '').replace(/\xa0/g, ' ').trimEnd();
}

export async function runDiagnostics(filePath: string) {
  return await $`${CLI_PATH} diagnostics ${filePath}`.nothrow();
}