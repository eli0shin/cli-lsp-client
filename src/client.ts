import net from 'net';
import { spawn } from 'child_process';
import { SOCKET_PATH, isDaemonRunning, type Request, type StatusResult } from './daemon.js';

export async function sendToExistingDaemon(command: string, args: string[]): Promise<string | number | StatusResult> {
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

export function startDaemonInBackground(): void {
  // For compiled Bun executable, use the process.execPath
  const executablePath = process.execPath;
  const args = ['daemon'];
  
  const child = spawn(executablePath, args, {
    detached: true,
    stdio: 'ignore'
  });
  
  child.unref();
}

export async function runCommand(command: string, commandArgs: string[]): Promise<void> {
  try {
    // For all commands: check if daemon running, start if needed, send command, exit
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