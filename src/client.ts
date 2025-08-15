import net from 'net';
import { spawn } from 'child_process';
import { SOCKET_PATH, isDaemonRunning, type StatusResult } from './daemon.js';
import { formatDiagnostics } from './lsp/formatter.js';
import type { Diagnostic } from './lsp/types.js';
import { HELP_MESSAGE } from './constants.js';

function showHelpForUnknownCommand(command: string): void {
  console.error(`Unknown command: ${command}\n`);
  console.log(HELP_MESSAGE);
}

export async function sendToExistingDaemon(command: string, args: string[]): Promise<string | number | StatusResult> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(SOCKET_PATH);
    let buffer = '';
    let resolved = false;

    const handleResponse = (response: any) => {
      if (resolved) return;
      resolved = true;
      client.end();

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
        const response = JSON.parse(buffer);
        handleResponse(response);
      } catch (error) {
        // JSON is incomplete, continue buffering
      }
    });

    client.on('end', () => {
      if (resolved) return;
      
      // If connection ends without successful parse, try one final parse
      if (buffer) {
        try {
          const response = JSON.parse(buffer);
          handleResponse(response);
        } catch (error) {
          resolved = true;
          reject(new Error(`Failed to parse response: ${buffer.substring(0, 100)}...`));
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

function spawnDaemon(): void {
  // Spawn a new process of ourselves with daemon mode enabled
  const child = spawn(process.execPath, [process.argv[1]], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      LSPCLI_DAEMON_MODE: '1'
    }
  });
  
  child.unref();
}

export async function runCommand(command: string, commandArgs: string[]): Promise<void> {
  try {
    // For all commands: check if daemon running, start if needed, send command, exit
    let daemonRunning = await isDaemonRunning();
    
    if (!daemonRunning) {
      // Start daemon in background process
      spawnDaemon();

      // Wait for daemon to be ready
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
      
      // Special formatting for diagnostics command
      if (command === 'diagnostics' && Array.isArray(result)) {
        const diagnostics = result as Diagnostic[];
        const filePath = commandArgs[0] || 'unknown';
        const output = formatDiagnostics(filePath, diagnostics);
        
        if (output) {
          console.error(output);
          process.exit(2); // Exit with error code when diagnostics found
        } else {
          process.exit(0); // Exit with success code when no diagnostics
        }
      } else {
        console.log('Result:', result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if it's an unknown command error
      if (errorMessage.startsWith('Unknown command:')) {
        showHelpForUnknownCommand(command);
        process.exit(1);
      }
      
      console.error('Error communicating with daemon:', errorMessage);
      process.exit(1);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
    process.exit(1);
  }
}