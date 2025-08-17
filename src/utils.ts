/**
 * Utility functions shared across the application
 */

import { spawn } from 'child_process';
import { isDaemonRunning } from './daemon.js';

/**
 * Creates a short unique identifier for a directory path using a simple hash function
 * @param dirPath The directory path to hash
 * @returns A base36 string representation of the hash
 */
export function hashPath(dirPath: string): string {
  let hash = 0;
  for (let i = 0; i < dirPath.length; i++) {
    const char = dirPath.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Ensures the daemon is running, starting it if necessary
 * @returns true if daemon is running or was successfully started, false otherwise
 */
export async function ensureDaemonRunning(): Promise<boolean> {
  // Check if daemon is already running
  if (await isDaemonRunning()) {
    return true;
  }

  // Spawn a new daemon process
  const child = spawn(process.execPath, [process.argv[1]], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      LSPCLI_DAEMON_MODE: '1',
    },
  });

  child.unref();

  // Wait for daemon to be ready
  let attempts = 0;
  while (attempts < 50 && !(await isDaemonRunning())) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    attempts++;
  }

  return await isDaemonRunning();
}
