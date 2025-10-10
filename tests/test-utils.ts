import { spawn, execSync } from 'child_process';

export const CLI_PATH = process.env.CLI_LSP_CLIENT_BIN_PATH || './bin/cli-lsp-client';

// Get the log file path using the CLI's logs command
export function getLogPath(): string {
  try {
    return execSync(`${CLI_PATH} logs`, { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown-log-path';
  }
}

export function stripAnsi(str: string): string {
  return str
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/^\n/, '')
    .replace(/\xa0/g, ' ')
    .trimEnd();
}

async function runCommand(
  args: string[]
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(CLI_PATH, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.stdin?.end();

    proc.on('error', reject);

    proc.on('close', (code) => {
      resolve({ exitCode: code ?? 0, stdout, stderr });
    });
  });
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

export async function runHookCommand(
  input: string,
  env?: Record<string, string>
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(CLI_PATH, ['claude-code-hook'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: env ? { ...process.env, ...env } : process.env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.stdin?.write(input);
    proc.stdin?.end();

    proc.on('error', reject);

    proc.on('close', (code) => {
      resolve({ exitCode: code ?? 0, stdout, stderr });
    });
  });
}
