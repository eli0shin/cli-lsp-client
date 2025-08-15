import path from 'path';
import os from 'os';

function getLogPath(): string {
  const cwd = process.cwd();
  const hashedCwd = Math.abs(
    cwd.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) & 0, 0)
  ).toString(36);
  return path.join(os.tmpdir(), `cli-lsp-client-${hashedCwd}.log`);
}

export const LOG_PATH = getLogPath();

export async function log(message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;

  try {
    // Use fs to append to file properly
    const fs = require('fs');
    fs.appendFileSync(LOG_PATH, logEntry);
  } catch (error) {
    // Ignore logging errors to not break functionality
  }
}

export function clearLog(): void {
  try {
    Bun.write(LOG_PATH, '', { createPath: true });
  } catch (error) {
    // Ignore errors
  }
}
