import { $ } from 'bun';

export const CLI_PATH = './cli-lsp-client';

export function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '').replace(/^\n/, '').replace(/\xa0/g, ' ').trimEnd();
}

export async function runDiagnostics(filePath: string) {
  return await $`${CLI_PATH} diagnostics ${filePath}`.nothrow();
}

export async function runHover(filePath: string, symbol: string) {
  return await $`${CLI_PATH} hover ${filePath} ${symbol}`.nothrow();
}