import net from 'net';
import os from 'os';
import path from 'path';
import { readdir } from 'node:fs/promises';
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

    // Timeout after 2 seconds
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      client.end();
      reject(new Error('Timeout waiting for daemon to stop'));
    }, 2000);
  });
}

export async function stopAllDaemons(): Promise<void> {
  const tempDir = os.tmpdir();
  
  // Read all files from temp directory using Node.js fs API
  let allFiles: string[] = [];
  try {
    allFiles = await readdir(tempDir);
  } catch (error) {
    console.log('Error reading temp directory:', error);
    return;
  }
  
  // Filter for our daemon files
  const socketFiles = allFiles
    .filter(f => f.startsWith('cli-lsp-client-') && f.endsWith('.sock'))
    .map(f => path.join(tempDir, f));

  if (socketFiles.length === 0) {
    console.log('No daemons found to stop');
    return;
  }

  console.log(`Found ${socketFiles.length} daemon(s) to stop...`);

  let stoppedCount = 0;
  let errorCount = 0;

  for (const socketPath of socketFiles) {
    try {
      // Try graceful shutdown via socket first
      await sendStopCommandToSocket(socketPath);
      stoppedCount++;
      console.log(`✓ Stopped daemon: ${path.basename(socketPath)}`);
    } catch (socketError) {
      // If socket communication fails, try using PID file for forceful termination
      const pidFile = socketPath.replace('.sock', '.pid');
      try {
        const pidExists = await Bun.file(pidFile).exists();
        if (pidExists) {
          const pidContent = await Bun.file(pidFile).text();
          const pid = parseInt(pidContent.trim());
          process.kill(pid, 'SIGTERM');
          stoppedCount++;
          console.log(`✓ Force stopped daemon: ${path.basename(socketPath)} (PID: ${pid})`);
        } else {
          console.log(`! Daemon ${path.basename(socketPath)} already stopped`);
        }
      } catch (pidError) {
        errorCount++;
        console.log(`✗ Failed to stop daemon: ${path.basename(socketPath)}`);
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
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }

  console.log(`\nStopped ${stoppedCount} daemon(s)${errorCount > 0 ? `, ${errorCount} error(s)` : ''}`);
}

async function sendCommandToSocket(socketPath: string, command: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath);
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
      const request = JSON.stringify({ command, args: [] });
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
  
  // Read all files from temp directory using Node.js fs API
  let allFiles: string[] = [];
  try {
    allFiles = await readdir(tempDir);
  } catch (error) {
    console.log('Error reading temp directory:', error);
    return;
  }
  
  // Filter for socket files and only include those that also have corresponding PID files
  const socketFiles = allFiles
    .filter(f => f.startsWith('cli-lsp-client-') && f.endsWith('.sock'))
    .filter(f => {
      // Only include if corresponding PID file also exists
      const pidFile = f.replace('.sock', '.pid');
      return allFiles.includes(pidFile);
    })
    .map(f => path.join(tempDir, f));

  if (socketFiles.length === 0) {
    console.log('No daemons found');
    return;
  }

  console.log('\nRunning Daemons:');
  console.log('================');
  
  const results: Array<{
    hash: string;
    pid: number | string;
    workingDir: string;
    status: string;
  }> = [];

  for (const socketPath of socketFiles) {
    const hash = path.basename(socketPath, '.sock');
    const pidFile = socketPath.replace('.sock', '.pid');
    
    let pid: number | string = 'Unknown';
    let workingDir: string = 'Unknown';
    let status = 'Unknown';

    try {
      // Get PID
      const pidExists = await Bun.file(pidFile).exists();
      if (pidExists) {
        const pidContent = await Bun.file(pidFile).text();
        pid = parseInt(pidContent.trim());
        
        // Check if process is running
        try {
          process.kill(pid as number, 0);
          status = 'Running';
          
          // Get working directory from daemon
          try {
            workingDir = await sendCommandToSocket(socketPath, 'pwd') as string;
          } catch (error) {
            workingDir = 'Unresponsive';
            status = 'Unresponsive';
          }
        } catch (error) {
          status = 'Dead';
          workingDir = 'Process not found';
        }
      } else {
        status = 'No PID file';
      }
    } catch (error) {
      status = 'Error';
    }

    results.push({
      hash: hash.replace('cli-lsp-client-', ''),
      pid,
      workingDir,
      status
    });
  }

  // Display results in a table format
  const maxHashLen = Math.max(4, ...results.map(r => r.hash.length));
  const maxPidLen = Math.max(3, ...results.map(r => r.pid.toString().length));
  const maxStatusLen = Math.max(6, ...results.map(r => r.status.length));
  const maxDirLen = Math.max(15, ...results.map(r => r.workingDir.length));

  // Header
  console.log(
    `${'Hash'.padEnd(maxHashLen)} | ` +
    `${'PID'.padEnd(maxPidLen)} | ` +
    `${'Status'.padEnd(maxStatusLen)} | ` +
    `${'Working Directory'.padEnd(maxDirLen)}`
  );
  console.log('-'.repeat(maxHashLen + maxPidLen + maxStatusLen + maxDirLen + 10));

  // Rows
  for (const result of results) {
    const statusIcon = result.status === 'Running' ? '●' : 
                      result.status === 'Dead' ? '○' : 
                      result.status === 'Unresponsive' ? '◐' : '?';
    
    console.log(
      `${result.hash.padEnd(maxHashLen)} | ` +
      `${result.pid.toString().padEnd(maxPidLen)} | ` +
      `${statusIcon} ${result.status.padEnd(maxStatusLen - 2)} | ` +
      `${result.workingDir}`
    );
  }
  
  const runningCount = results.filter(r => r.status === 'Running').length;
  console.log(`\n${runningCount}/${results.length} daemon(s) running`);
}

export async function runCommand(command: string, commandArgs: string[]): Promise<void> {
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

    // For all other commands: check if daemon running, start if needed, send command, exit
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