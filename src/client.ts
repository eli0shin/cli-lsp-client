import net from 'net';
import os from 'os';
import path from 'path';
import { readdir } from 'node:fs/promises';
import { z } from 'zod';
import { SOCKET_PATH } from './daemon.js';
import { formatDiagnostics, formatHoverResults } from './lsp/formatter.js';
import { DiagnosticSchema, HoverResultSchema } from './lsp/types.js';
import { ensureDaemonRunning } from './utils.js';
import { isDiagnosticsArray, isHoverResultArray } from './type-guards.js';

// Zod schema for daemon responses with proper result typing
const DaemonResultSchema = z.union([
  z.string(),
  z.array(DiagnosticSchema),
  z.array(HoverResultSchema),
]);

const DaemonResponseSchema = z.union([
  z.object({
    success: z.literal(true),
    result: DaemonResultSchema,
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

// Infer the result type from schema
type DaemonResult = z.infer<typeof DaemonResultSchema>;

export async function sendToExistingDaemon(
  command: string,
  args: string[]
): Promise<DaemonResult> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(SOCKET_PATH);
    let buffer = '';
    let resolved = false;

    const handleResponse = (rawResponse: unknown) => {
      if (resolved) return;
      resolved = true;
      client.end();

      const parseResult = DaemonResponseSchema.safeParse(rawResponse);
      if (!parseResult.success) {
        reject(
          new Error(
            `Invalid response from daemon: ${JSON.stringify(rawResponse)}`
          )
        );
        return;
      }

      const response = parseResult.data;
      if (response.success) {
        resolve(response.result);
      } else {
        reject(new Error(response.error));
      }
    };

    client.on('connect', () => {
      const request = JSON.stringify({ command, args });
      client.write(request);
    });

    client.on('data', (data) => {
      if (resolved) return;
      buffer += data.toString();

      try {
        const rawResponse = JSON.parse(buffer);
        handleResponse(rawResponse);
      } catch (_error) {
        // JSON is incomplete, continue buffering
      }
    });

    client.on('end', () => {
      if (resolved) return;

      // If connection ends without successful parse, try one final parse
      if (buffer) {
        try {
          const rawResponse = JSON.parse(buffer);
          handleResponse(rawResponse);
        } catch (_error) {
          resolved = true;
          reject(
            new Error(
              `Failed to parse response: ${buffer.substring(0, 100)}...`
            )
          );
        }
      }
    });

    client.on('error', (error) => {
      if (resolved) return;
      resolved = true;
      reject(error);
    });
  });
}

async function sendStopCommandToSocket(socketPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath);
    let resolved = false;

    const handleResponse = () => {
      if (resolved) return;
      resolved = true;
      client.end();
      resolve();
    };

    client.on('connect', () => {
      const request = JSON.stringify({ command: 'stop', args: [] });
      client.write(request);
    });

    client.on('data', () => {
      handleResponse();
    });

    client.on('end', () => {
      handleResponse();
    });

    client.on('error', (error) => {
      if (resolved) return;
      resolved = true;
      reject(error);
    });

    // Wait for actual connection end (daemon shutdown)
    // Increase timeout to give daemon time to shut down properly
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      client.end();
      reject(new Error('Timeout waiting for daemon to stop'));
    }, 2000);
  });
}

async function readTmpDirectoryFiles(): Promise<string[]> {
  try {
    return await readdir(os.tmpdir());
  } catch (error) {
    process.stderr.write(`Error reading temp directory: ${error}\n`);
    return [];
  }
}

export async function stopAllDaemons(): Promise<void> {
  const tempDir = os.tmpdir();
  const allFiles = await readTmpDirectoryFiles();

  // Filter for our daemon files
  const socketFiles = allFiles
    .filter((f) => f.startsWith('cli-lsp-client-') && f.endsWith('.sock'))
    .map((f) => path.join(tempDir, f));

  if (socketFiles.length === 0) {
    process.stdout.write('No daemons found to stop\n');
    return;
  }

  process.stdout.write(`Found ${socketFiles.length} daemon(s) to stop...\n`);

  let stoppedCount = 0;
  let errorCount = 0;

  for (const socketPath of socketFiles) {
    try {
      // Try graceful shutdown via socket first
      await sendStopCommandToSocket(socketPath);
      stoppedCount++;
      process.stdout.write(`✓ Stopped daemon: ${path.basename(socketPath)}\n`);
    } catch (_socketError) {
      // If socket communication fails, try using PID file for forceful termination
      const pidFile = socketPath.replace('.sock', '.pid');
      try {
        const pidExists = await Bun.file(pidFile).exists();
        if (pidExists) {
          const pidContent = await Bun.file(pidFile).text();
          const pid = parseInt(pidContent.trim());
          process.kill(pid, 'SIGTERM');
          stoppedCount++;
          process.stdout.write(
            `✓ Force stopped daemon: ${path.basename(socketPath)} (PID: ${pid})\n`
          );
        } else {
          process.stdout.write(
            `! Daemon ${path.basename(socketPath)} already stopped\n`
          );
        }
      } catch (_pidError) {
        errorCount++;
        process.stderr.write(
          `✗ Failed to stop daemon: ${path.basename(socketPath)}\n`
        );
      }
    }

    // Clean up stale files
    try {
      const socketExists = await Bun.file(socketPath).exists();
      if (socketExists) {
        await Bun.file(socketPath).unlink();
      }
      const pidFile = socketPath.replace('.sock', '.pid');
      const pidExists = await Bun.file(pidFile).exists();
      if (pidExists) {
        await Bun.file(pidFile).unlink();
      }
    } catch (_cleanupError) {
      // Ignore cleanup errors
    }
  }

  process.stdout.write(
    `\nStopped ${stoppedCount} daemon(s)${errorCount > 0 ? `, ${errorCount} error(s)` : ''}\n`
  );
}

async function sendCommandToSocket(
  socketPath: string,
  command: string
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath);
    let buffer = '';
    let resolved = false;

    const handleResponse = (rawResponse: unknown) => {
      if (resolved) return;
      resolved = true;
      client.end();

      const parseResult = DaemonResponseSchema.safeParse(rawResponse);
      if (!parseResult.success) {
        reject(
          new Error(
            `Invalid response from daemon: ${JSON.stringify(rawResponse)}`
          )
        );
        return;
      }

      const response = parseResult.data;
      if (response.success) {
        resolve(response.result);
      } else {
        reject(new Error(response.error));
      }
    };

    client.on('connect', () => {
      const request = JSON.stringify({ command, args: [] });
      client.write(request);
    });

    client.on('data', (data) => {
      if (resolved) return;
      buffer += data.toString();

      try {
        const rawResponse = JSON.parse(buffer);
        handleResponse(rawResponse);
      } catch (_error) {
        // JSON is incomplete, continue buffering
      }
    });

    client.on('end', () => {
      if (resolved) return;

      // If connection ends without successful parse, try one final parse
      if (buffer) {
        try {
          const rawResponse = JSON.parse(buffer);
          handleResponse(rawResponse);
        } catch (_error) {
          resolved = true;
          reject(
            new Error(
              `Failed to parse response: ${buffer.substring(0, 100)}...`
            )
          );
        }
      }
    });

    client.on('error', (error) => {
      if (resolved) return;
      resolved = true;
      reject(error);
    });

    // Timeout after 2 seconds
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      client.end();
      reject(new Error('Timeout waiting for daemon response'));
    }, 2000);
  });
}

export async function listAllDaemons(): Promise<void> {
  const tempDir = os.tmpdir();
  const allFiles = await readTmpDirectoryFiles();

  // Filter for socket files and only include those that also have corresponding PID files
  const socketFiles = allFiles
    .filter((f) => f.startsWith('cli-lsp-client-') && f.endsWith('.sock'))
    .filter((f) => {
      // Only include if corresponding PID file also exists
      const pidFile = f.replace('.sock', '.pid');
      return allFiles.includes(pidFile);
    })
    .map((f) => path.join(tempDir, f));

  if (socketFiles.length === 0) {
    process.stdout.write('No daemons found\n');
    return;
  }

  process.stdout.write('\nRunning Daemons:\n');
  process.stdout.write('================\n');

  const results: {
    hash: string;
    pid: number | string;
    workingDir: string;
    status: string;
  }[] = [];

  for (const socketPath of socketFiles) {
    const hash = path.basename(socketPath, '.sock');
    const pidFile = socketPath.replace('.sock', '.pid');

    let pid: number | string = 'Unknown';
    let workingDir = 'Unknown';
    let status = 'Unknown';

    try {
      // Get PID
      const pidExists = await Bun.file(pidFile).exists();
      if (pidExists) {
        const pidContent = await Bun.file(pidFile).text();
        pid = parseInt(pidContent.trim());

        // Check if process is running
        try {
          process.kill(pid, 0);
          status = 'Running';

          // Get working directory from daemon
          try {
            const pwdResult = await sendCommandToSocket(socketPath, 'pwd');
            workingDir = typeof pwdResult === 'string' ? pwdResult : 'Unknown';
          } catch (_error) {
            workingDir = 'Unresponsive';
            status = 'Unresponsive';
          }
        } catch (_error) {
          status = 'Dead';
          workingDir = 'Process not found';
        }
      } else {
        status = 'No PID file';
      }
    } catch (_error) {
      status = 'Error';
    }

    results.push({
      hash: hash.replace('cli-lsp-client-', ''),
      pid,
      workingDir,
      status,
    });
  }

  // Display results in a table format
  const maxHashLen = Math.max(4, ...results.map((r) => r.hash.length));
  const maxPidLen = Math.max(3, ...results.map((r) => r.pid.toString().length));
  const maxStatusLen = Math.max(6, ...results.map((r) => r.status.length));
  const maxDirLen = Math.max(15, ...results.map((r) => r.workingDir.length));

  // Header
  process.stdout.write(
    `${'Hash'.padEnd(maxHashLen)} | ` +
      `${'PID'.padEnd(maxPidLen)} | ` +
      `${'Status'.padEnd(maxStatusLen)} | ` +
      `${'Working Directory'.padEnd(maxDirLen)}\n`
  );
  process.stdout.write(
    '-'.repeat(maxHashLen + maxPidLen + maxStatusLen + maxDirLen + 10) + '\n'
  );

  // Rows
  for (const result of results) {
    const statusIcon =
      result.status === 'Running'
        ? '●'
        : result.status === 'Dead'
          ? '○'
          : result.status === 'Unresponsive'
            ? '◐'
            : '?';

    process.stdout.write(
      `${result.hash.padEnd(maxHashLen)} | ` +
        `${result.pid.toString().padEnd(maxPidLen)} | ` +
        `${statusIcon} ${result.status.padEnd(maxStatusLen - 2)} | ` +
        `${result.workingDir}\n`
    );
  }

  const runningCount = results.filter((r) => r.status === 'Running').length;
  process.stdout.write(
    `\n${runningCount}/${results.length} daemon(s) running\n`
  );
}

export async function runCommand(
  command: string,
  commandArgs: string[],
  configFile?: string,
  isHook = false
): Promise<void> {
  try {
    // Handle stop-all command without daemon communication
    if (command === 'stop-all') {
      await stopAllDaemons();
      return;
    }

    // Handle list command without daemon communication
    if (command === 'list') {
      await listAllDaemons();
      return;
    }

    // Handle statusline command — stdout is ONLY the server list, errors to stderr, always exit 0
    if (command === 'statusline') {
      try {
        const result = await sendToExistingDaemon('statusline', []);
        if (typeof result === 'string' && result.length > 0) {
          process.stdout.write(result + '\n');
        }
      } catch (error) {
        // Connection errors (no daemon) — silent
        // Unexpected errors — report to stderr only, never pollute stdout
        if (error instanceof Error && !('code' in error)) {
          process.stderr.write(`${error.message}\n`);
        }
      }
      return;
    }

    // For all other commands: check if daemon running, start if needed, send command, exit
    const daemonStarted = await ensureDaemonRunning(configFile);

    if (!daemonStarted) {
      process.stderr.write('Failed to start daemon\n');
      process.exit(1);
    }

    // Send command to daemon and exit
    try {
      const result = await sendToExistingDaemon(command, commandArgs);

      // Special formatting for diagnostics command
      if (command === 'diagnostics' && isDiagnosticsArray(result)) {
        const filePath = commandArgs[0] || 'unknown';
        const output = formatDiagnostics(filePath, result);

        if (output) {
          process.stderr.write(output + '\n');
          process.exit(2); // Exit with error code when diagnostics found
        } else {
          process.exit(0); // Exit with success code when no diagnostics
        }
      } else if (command === 'hover' && isHoverResultArray(result)) {
        // Special formatting for hover command
        const formatted = await formatHoverResults(result);
        process.stdout.write(formatted + '\n');
        process.exit(0);
      } else {
        // Suppress output for start command when run as SessionStart hook
        if (!(command === 'start' && isHook)) {
          process.stdout.write(`${result}\n`);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      process.stderr.write(`${errorMessage}\n`);
      process.exit(1);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    process.stderr.write(`Error: ${errorMessage}\n`);
    process.exit(1);
  }
}
