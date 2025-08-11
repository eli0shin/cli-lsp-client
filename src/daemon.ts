import net from 'net';
import os from 'os';
import path from 'path';

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

export function handleRequest(request: Request): string | number | StatusResult {
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

let server: net.Server | null = null;

export async function startDaemon(): Promise<void> {
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

  if (server) {
    server.close();
  }

  await cleanup();
  process.exit(0);
}