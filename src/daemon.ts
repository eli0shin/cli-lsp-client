import net from 'net';
import os from 'os';
import path from 'path';
import { z } from 'zod';
import { lspManager } from './lsp/manager.js';
import { executeStart } from './lsp/start.js';
import { log } from './logger.js';
import { hashPath } from './utils.js';

function getDaemonPaths() {
  const cwd = process.cwd();
  const hashedCwd = hashPath(cwd);
  
  return {
    socketPath: path.join(os.tmpdir(), `cli-lsp-client-${hashedCwd}.sock`),
    pidFile: path.join(os.tmpdir(), `cli-lsp-client-${hashedCwd}.pid`)
  };
}

export const { socketPath: SOCKET_PATH, pidFile: PID_FILE } = getDaemonPaths();

const RequestSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional()
});

export type Request = z.infer<typeof RequestSchema>;

export type StatusResult = {
  pid: number;
  uptime: number;
  memory: NodeJS.MemoryUsage;
}

function formatUptime(uptimeMs: number): string {
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export async function handleRequest(request: Request): Promise<string | number | StatusResult | unknown> {
  const { command, args = [] } = request;

  switch (command) {
    case 'status': {
      const runningServers = lspManager.getRunningServers();
      const daemonUptimeMs = process.uptime() * 1000;
      
      let output = 'LSP Daemon Status\n';
      output += '================\n';
      output += `PID: ${process.pid}\n`;
      output += `Uptime: ${formatUptime(daemonUptimeMs)}\n\n`;
      
      if (runningServers.length === 0) {
        output += 'No language servers running\n';
      } else {
        output += 'Language Servers:\n';
        for (const server of runningServers) {
          const relativePath = path.relative(process.cwd(), server.root) || '.';
          output += `- ${server.serverID} (${relativePath}) - running ${formatUptime(server.uptime)}\n`;
        }
        output += `\nTotal: ${runningServers.length} language server${runningServers.length === 1 ? '' : 's'} running\n`;
      }
      
      return output;
    }

    case 'diagnostics': {
      if (!args[0]) {
        throw new Error('diagnostics command requires a file path');
      }
      return await lspManager.getDiagnostics(args[0]);
    }

    case 'start': {
      const directory = args[0]; // Optional directory argument
      log(`=== DAEMON START - PID: ${process.pid} ===`);
      log(`Starting LSP servers for directory: ${directory || 'current'}`);
      try {
        const startedServers = await executeStart(directory);
        log('=== DAEMON START SUCCESS ===');
        if (startedServers.length === 0) {
          return 'Started LSP daemon';
        }
        return `Started LSP servers for ${startedServers.join(',')}`;
      } catch (error) {
        log(`=== DAEMON START ERROR: ${error} ===`);
        throw error;
      }
    }

    case 'logs': {
      const { LOG_PATH } = await import('./logger.js');
      return LOG_PATH;
    }

    case 'pwd': {
      return process.cwd();
    }

    case 'hover': {
      // Parse arguments - require both file and symbol
      if (args.length !== 2) {
        throw new Error('hover command requires: hover <file> <symbol>');
      }
      
      const targetFile = args[0];
      const targetSymbol = args[1];
      
      const hoverResults = await lspManager.getHover(targetSymbol, targetFile);
      return hoverResults;
    }

    case 'stop': {
      setTimeout(async () => await shutdown(), 100);
      return 'Daemon stopping...';
    }

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

let server: net.Server | null = null;

export async function startDaemon(): Promise<void> {
  process.stdout.write('Starting daemon…\n');
  const { LOG_PATH } = await import('./logger.js');
  process.stdout.write(`Daemon log: ${LOG_PATH}\n`);
  log(`Daemon starting... PID: ${process.pid}`);

  await cleanup();

  server = net.createServer((socket) => {
    log('Client connected');

    socket.on('data', async (data) => {
      try {
        const rawRequest = JSON.parse(data.toString()) as unknown;
        const parseResult = RequestSchema.safeParse(rawRequest);
        
        if (!parseResult.success) {
          socket.write(JSON.stringify({
            success: false,
            error: `Invalid request format: ${parseResult.error.message}`
          }));
          socket.end();
          return;
        }
        
        const request = parseResult.data;
        log(`Received request: ${JSON.stringify(request)}`);

        const result = await handleRequest(request);

        socket.write(JSON.stringify({
          success: true,
          result: result,
          timestamp: new Date().toISOString()
        }));
        socket.end();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        socket.write(JSON.stringify({
          success: false,
          error: errorMessage
        }));
        socket.end();
      }
    });

    socket.on('end', () => {
      log('Client disconnected');
    });
  });

  server.listen(SOCKET_PATH, async () => {
    process.stdout.write(`Daemon listening on ${SOCKET_PATH}\n`);

    await Bun.write(PID_FILE, process.pid.toString());

    process.on('SIGINT', async () => {
      log('Received SIGINT signal');
      await shutdown();
    });
    process.on('SIGTERM', async () => {
      log('Received SIGTERM signal');
      await shutdown();
    });
    
    // Log unexpected exits
    process.on('exit', async (code) => {
      log(`Process exiting with code: ${code}`);
    });
    
    process.on('uncaughtException', async (error) => {
      log(`Uncaught exception: ${error.message}`);
      await shutdown();
    });
    
    process.on('unhandledRejection', async (reason, promise) => {
      log(`Unhandled rejection at: ${promise}, reason: ${reason}`);
    });
  });

  server.on('error', (error) => {
    process.stderr.write(`Server error: ${error}\n`);
    process.exit(1);
  });
}

export async function isDaemonRunning(): Promise<boolean> {
  try {
    const pidFileExists = await Bun.file(PID_FILE).exists();
    if (!pidFileExists) {
      return false;
    }

    const pidContent = await Bun.file(PID_FILE).text();
    const pid = parseInt(pidContent);

    try {
      process.kill(pid, 0);

      return new Promise((resolve) => {
        const testSocket = net.createConnection(SOCKET_PATH);
        testSocket.on('connect', () => {
          testSocket.end();
          resolve(true);
        });
        testSocket.on('error', () => {
          resolve(false);
        });
      });
    } catch (_e) {
      await cleanup();
      return false;
    }
  } catch (_e) {
    return false;
  }
}

export async function cleanup(): Promise<void> {
  try {
    const socketExists = await Bun.file(SOCKET_PATH).exists();
    if (socketExists) {
      await Bun.file(SOCKET_PATH).unlink();
    }
    const pidExists = await Bun.file(PID_FILE).exists();
    if (pidExists) {
      await Bun.file(PID_FILE).unlink();
    }
  } catch (_e) {
    // Ignore cleanup errors
  }
}

export async function shutdown(): Promise<void> {
  process.stdout.write('Shutting down daemon…\n');
  log(`=== DAEMON SHUTDOWN START - PID: ${process.pid} ===`);

  // Shutdown LSP manager first
  try {
    await lspManager.shutdown();
    log('LSP manager shutdown completed');
  } catch (error) {
    process.stderr.write(`Error shutting down LSP manager: ${error}\n`);
    log(`LSP manager shutdown error: ${error}`);
  }

  if (server) {
    server.close();
    log('Server closed');
  }

  await cleanup();
  log('=== DAEMON SHUTDOWN COMPLETE ===');
  process.exit(0);
}