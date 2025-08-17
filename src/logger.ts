import path from 'path';
import os from 'os';
import { hashPath } from './utils.js';
import fs from 'fs';

function getLogPath(): string {
  const cwd = process.cwd();
  const hashedCwd = hashPath(cwd);
  return path.join(os.tmpdir(), `cli-lsp-client-${hashedCwd}.log`);
}

export const LOG_PATH = getLogPath();

export async function log(message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;

  try {
    fs.appendFileSync(LOG_PATH, logEntry);
  } catch (_error) {
    // Ignore logging errors to not break functionality
  }
}

export async function clearLog(): Promise<void> {
  try {
    await Bun.write(LOG_PATH, '', { createPath: true });
  } catch (_error) {
    // Ignore errors
  }
}
