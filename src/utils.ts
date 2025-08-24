/**
 * Utility functions shared across the application
 */

import { spawn } from 'child_process';
import { hasConfigConflict, stopDaemon, isDaemonRunning } from './daemon.js';

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
 * Safely converts a file:// URL to a decoded file path
 * @param url The URL string to convert
 * @returns The decoded file path, or the original pathname if decoding fails
 */
export function urlToFilePath(url: string): string {
  try {
    const urlObj = new URL(url);
    return decodeURIComponent(urlObj.pathname);
  } catch (error) {
    // Fallback to undecoded pathname if decodeURIComponent fails
    try {
      return new URL(url).pathname;
    } catch {
      // If URL parsing fails entirely, return the original string
      return url;
    }
  }
}

/**
 * Ensures the daemon is running, starting it if necessary
 * @param configFile Optional path to config file to pass to daemon
 * @returns true if daemon is running or was successfully started, false otherwise
 */
export async function ensureDaemonRunning(configFile?: string): Promise<boolean> {
  // Check if there's a config conflict with the running daemon
  if (await hasConfigConflict(configFile)) {
    try {
      await stopDaemon();
      // Wait for daemon to actually stop
      let attempts = 0;
      while (attempts < 20 && await isDaemonRunning()) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
      
      if (await isDaemonRunning()) {
        process.stderr.write('Daemon failed to stop within timeout\n');
        return false;
      }
    } catch (error) {
      process.stderr.write(`Failed to stop daemon for config change: ${error}\n`);
      return false;
    }
  }
  
  // Check if daemon is already running (covers case where no config conflict)
  if (await isDaemonRunning()) {
    return true;
  }

  // Spawn a new daemon process
  const env: Record<string, string> = {
    ...process.env,
    LSPCLI_DAEMON_MODE: '1',
  };
  
  // Pass config file path via environment variable if provided
  if (configFile) {
    env.LSPCLI_CONFIG_FILE = configFile;
  }
  
  const child = spawn(process.execPath, [process.argv[1]], {
    detached: true,
    stdio: 'ignore',
    env,
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
