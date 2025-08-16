import net from 'net';
import os from 'os';
import path from 'path';
import { lspManager } from './lsp/manager.js';
import { executeWarmup } from './lsp/warmup.js';
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

export type Request = {
  command: string;
  args?: string[];
};

export type StatusResult = {
  pid: number;
  uptime: number;
  memory: NodeJS.MemoryUsage;
};

export async function handleRequest(request: Request): Promise<string | number | StatusResult | any> {
  const { command, args = [] } = request;

  switch (command) {
    case 'status':
      return {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      };

    case 'diagnostics':
      if (!args[0]) {
        throw new Error('diagnostics command requires a file path');
      }
      return await lspManager.getDiagnostics(args[0]);

    case 'warmup':
      const directory = args[0]; // Optional directory argument
      log(`=== DAEMON WARMUP START - PID: ${process.pid} ===`);
      log(`Starting warmup for directory: ${directory || 'current'}`);
      try {
        const startedServers = await executeWarmup(directory);
        log('=== DAEMON WARMUP SUCCESS ===');
        if (startedServers.length === 0) {
          return 'Started LSP daemon';
        }
        return `Started LSP servers for ${startedServers.join(',')}`;
      } catch (error) {
        log(`=== DAEMON WARMUP ERROR: ${error} ===`);
        throw error;
      }

    case 'logs':
      const { LOG_PATH } = await import('./logger.js');
      return LOG_PATH;

    case 'pwd':
      return process.cwd();

    case 'hover':
      // Parse arguments - require both file and symbol
      if (args.length !== 2) {
        throw new Error('hover command requires: hover <file> <symbol>');
      }
      
      const targetFile = args[0];
      const targetSymbol = args[1];
      
      const hoverResults = await lspManager.getHover(targetSymbol, targetFile);
      return hoverResults;

    case 'stop':
      setTimeout(async () => await shutdown(), 100);
      return 'Daemon stopping...';

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

let server: net.Server | null = null;

export async function startDaemon(): Promise<void> {
  console.log('Starting daemon…');
  const { LOG_PATH } = await import('./logger.js');
  console.log(`Daemon log: ${LOG_PATH}`);
  log(`Daemon starting... PID: ${process.pid}`);

  await cleanup();

  server = net.createServer((socket) => {
    log('Client connected');

    socket.on('data', async (data) => {
      try {
        const request = JSON.parse(data.toString()) as Request;
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
    console.log(`Daemon listening on ${SOCKET_PATH}`);

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
    console.error('Server error:', error);
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
    } catch (e) {
      await cleanup();
      return false;
    }
  } catch (e) {
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
  } catch (e) {
    // Ignore cleanup errors
  }
}

export async function shutdown(): Promise<void> {
  console.log('Shutting down daemon…');
  log(`=== DAEMON SHUTDOWN START - PID: ${process.pid} ===`);

  // Shutdown LSP manager first
  try {
    await lspManager.shutdown();
    log('LSP manager shutdown completed');
  } catch (error) {
    console.error('Error shutting down LSP manager:', error);
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