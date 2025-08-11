#!/usr/bin/env bun

import path from 'path';
import net from 'net';
import os from 'os';
import { spawn } from 'child_process';

function hashPath(dirPath: string): string {
  // Simple hash function to create a short unique identifier for the path
  let hash = 0;
  for (let i = 0; i < dirPath.length; i++) {
    const char = dirPath.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

function getDaemonPaths() {
  const cwd = process.cwd();
  const hashedCwd = hashPath(cwd);
  
  return {
    socketPath: path.join(os.tmpdir(), `lspcli-${hashedCwd}.sock`),
    pidFile: path.join(os.tmpdir(), `lspcli-${hashedCwd}.pid`)
  };
}

const { socketPath: SOCKET_PATH, pidFile: PID_FILE } = getDaemonPaths();

let server: net.Server | null = null;

async function isDaemonRunning(): Promise<boolean> {
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

type Request = {
  command: string;
  args?: string[];
};

type StatusResult = {
  pid: number;
  uptime: number;
  memory: NodeJS.MemoryUsage;
};

function handleRequest(request: Request): string | number | StatusResult {
  const { command, args = [] } = request;

  switch (command) {
    case 'hello':
      return `Hello ${args[0] || 'World'}! Daemon PID: ${process.pid}`;

    case 'add':
      return args.reduce((sum, num) => sum + parseFloat(num), 0);

    case 'status':
      return {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      };

    case 'stop':
      setTimeout(async () => await shutdown(), 100);
      return 'Daemon stopping...';

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function startDaemon(): Promise<void> {
  console.log('Starting daemon…');

  await cleanup();

  server = net.createServer((socket) => {
    console.log('Client connected');

    socket.on('data', (data) => {
      try {
        const request = JSON.parse(data.toString()) as Request;
        console.log('Received request:', request);

        const result = handleRequest(request);

        socket.write(JSON.stringify({
          success: true,
          result: result,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        socket.write(JSON.stringify({
          success: false,
          error: errorMessage
        }));
      }
    });

    socket.on('end', () => {
      console.log('Client disconnected');
    });
  });

  server.listen(SOCKET_PATH, async () => {
    console.log(`Daemon listening on ${SOCKET_PATH}`);

    await Bun.write(PID_FILE, process.pid.toString());

    process.on('SIGINT', async () => await shutdown());
    process.on('SIGTERM', async () => await shutdown());
  });

  server.on('error', (error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}

async function sendToExistingDaemon(command: string, args: string[]): Promise<string | number | StatusResult> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(SOCKET_PATH);

    client.on('connect', () => {
      const request = JSON.stringify({ command, args });
      client.write(request);
    });

    client.on('data', (data) => {
      try {
        const response = JSON.parse(data.toString());
        client.end();

        if (response.success) {
          resolve(response.result);
        } else {
          reject(new Error(response.error));
        }
      } catch (error) {
        reject(error);
      }
    });

    client.on('error', (error) => {
      reject(error);
    });
  });
}

async function cleanup(): Promise<void> {
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

async function shutdown(): Promise<void> {
  console.log('Shutting down daemon…');

  if (server) {
    server.close();
  }

  await cleanup();
  process.exit(0);
}

function startDaemonInBackground(): void {
  // For compiled Bun executable, use the process.execPath
  const executablePath = process.execPath;
  const args = ['daemon'];
  
  const child = spawn(executablePath, args, {
    detached: true,
    stdio: 'ignore'
  });
  
  child.unref();
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'hello';
  const commandArgs = args.slice(1);

  try {
    // Special case: explicit daemon mode stays running
    if (command === 'daemon') {
      await startDaemon();
      return;
    }

    // For all other commands: check if daemon running, start if needed, send command, exit
    let daemonRunning = await isDaemonRunning();
    
    if (!daemonRunning) {
      // Start daemon in background
      startDaemonInBackground();

      // Wait for daemon to start
      let attempts = 0;
      while (attempts < 50 && !(await isDaemonRunning())) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!(await isDaemonRunning())) {
        console.error('Failed to start daemon');
        process.exit(1);
      }
    }

    // Send command to daemon and exit
    try {
      const result = await sendToExistingDaemon(command, commandArgs);
      console.log('Result:', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error communicating with daemon:', errorMessage);
      process.exit(1);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
    process.exit(1);
  }
}

export {
  run,
  startDaemon,
  sendToExistingDaemon,
  isDaemonRunning,
  handleRequest,
  cleanup,
  shutdown
};

if (import.meta.main) {
  run();
}
