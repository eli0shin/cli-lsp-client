import { spawn } from 'bun';

export const CLI_PATH = './cli-lsp-client';

export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[[0-9;]*m/g, '').replace(/^\n/, '').replace(/\xa0/g, ' ').trimEnd();
}

async function runCommand(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = spawn([CLI_PATH, ...args], {
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  
  proc.stdin?.end();
  
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  
  return { exitCode, stdout, stderr };
}

export async function runDiagnostics(filePath: string) {
  return await runCommand(['diagnostics', filePath]);
}

export async function runHover(filePath: string, symbol: string) {
  return await runCommand(['hover', filePath, symbol]);
}

export async function runCommandWithArgs(args: string[]) {
  return await runCommand(args);
}