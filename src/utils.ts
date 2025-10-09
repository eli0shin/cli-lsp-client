/**
 * Utility functions shared across the application
 */

import { spawn } from 'child_process';
import { z } from 'zod';
import { hasConfigConflict, stopDaemon, isDaemonRunning } from './daemon.js';

// Schema for Claude Code hook payload (supports PostToolUse, SessionStart, etc.)
export const HookDataSchema = z.object({
  session_id: z.string().optional(),
  transcript_path: z.string().optional(),
  cwd: z.string().optional(),
  hook_event_name: z.string().optional(),
  tool_name: z.string().optional(),
  tool_input: z
    .object({
      file_path: z.string().optional(),
      content: z.string().optional(),
    })
    .optional(),
  tool_response: z.any().optional(),
});

export type HookData = z.infer<typeof HookDataSchema>;

export async function readHookInput(): Promise<HookData | undefined> {
  // If stdin is a TTY, nothing was piped - return immediately
  // Check if stdin is readable (has data or will receive data)
  // If stdin is not readable and not ended, nothing is piped - return immediately
  if (process.stdin.isTTY || !process.stdin.readable) {
    return undefined;
  }

  const stdinData = await new Promise<string>((resolve, reject) => {
    let data = '';
    process.stdin.on('data', (chunk) => {
      data += chunk.toString();
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
    process.stdin.on('error', reject);
  });

  if (!stdinData.trim()) {
    return undefined;
  }

  const parseResult = HookDataSchema.safeParse(JSON.parse(stdinData));
  if (!parseResult.success) {
    return undefined;
  }

  return parseResult.data;
}

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
export async function ensureDaemonRunning(
  configFile?: string
): Promise<boolean> {
  // Check if there's a config conflict with the running daemon
  if (await hasConfigConflict(configFile)) {
    try {
      await stopDaemon();
      // Wait for daemon to actually stop
      let attempts = 0;
      while (attempts < 20 && (await isDaemonRunning())) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        attempts++;
      }

      if (await isDaemonRunning()) {
        process.stderr.write('Daemon failed to stop within timeout\n');
        return false;
      }
    } catch (error) {
      process.stderr.write(
        `Failed to stop daemon for config change: ${error}\n`
      );
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
