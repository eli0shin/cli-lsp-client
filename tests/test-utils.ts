import { spawn, execSync } from 'child_process';

export const CLI_PATH = './cli-lsp-client';

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
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  return new Promise((resolve, reject) => {
    console.log(`[TEST] Running: ${CLI_PATH} ${args.join(' ')}`);
    
    const proc = spawn(CLI_PATH, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      
      // In CI, show output in real-time for debugging
      if (isCI) {
        process.stdout.write(`[STDOUT] ${chunk}`);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      
      // In CI, show output in real-time for debugging
      if (isCI) {
        process.stderr.write(`[STDERR] ${chunk}`);
      }
    });

    proc.stdin?.end();

    proc.on('error', (error) => {
      console.log(`[TEST] Process error:`, error);
      reject(error);
    });

    proc.on('close', (code) => {
      console.log(`[TEST] Process closed with code: ${code}`);
      if (isCI && (stdout || stderr)) {
        console.log(`[TEST] Final stdout length: ${stdout.length}, stderr length: ${stderr.length}`);
      }
      resolve({ exitCode: code ?? 0, stdout, stderr });
    });

    // Add timeout logging for CI
    if (isCI) {
      const timeout = setTimeout(() => {
        console.log(`[TEST] Command still running after 30s: ${CLI_PATH} ${args.join(' ')}`);
        console.log(`[TEST] Log file location: ${getLogPath()}`);
      }, 30000);
      
      proc.on('close', () => clearTimeout(timeout));
    }
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
  input: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  return new Promise((resolve, reject) => {
    console.log(`[TEST] Running hook command: ${CLI_PATH} claude-code-hook`);
    if (isCI) {
      console.log(`[TEST] Hook input length: ${input.length} characters`);
    }
    
    const proc = spawn(CLI_PATH, ['claude-code-hook'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      
      // In CI, show output in real-time for debugging
      if (isCI) {
        process.stdout.write(`[HOOK-STDOUT] ${chunk}`);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      
      // In CI, show output in real-time for debugging
      if (isCI) {
        process.stderr.write(`[HOOK-STDERR] ${chunk}`);
      }
    });

    proc.stdin?.write(input);
    proc.stdin?.end();

    proc.on('error', (error) => {
      console.log(`[TEST] Hook process error:`, error);
      reject(error);
    });

    proc.on('close', (code) => {
      console.log(`[TEST] Hook process closed with code: ${code}`);
      if (isCI && (stdout || stderr)) {
        console.log(`[TEST] Hook final stdout length: ${stdout.length}, stderr length: ${stderr.length}`);
      }
      resolve({ exitCode: code ?? 0, stdout, stderr });
    });

    // Add timeout logging for CI
    if (isCI) {
      const timeout = setTimeout(() => {
        console.log(`[TEST] Hook command still running after 30s`);
        console.log(`[TEST] Log file location: ${getLogPath()}`);
      }, 30000);
      
      proc.on('close', () => clearTimeout(timeout));
    }
  });
}
