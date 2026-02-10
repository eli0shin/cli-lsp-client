import { homedir } from 'node:os';
import { join } from 'node:path';
import type { OperationResult, UpdateState } from './update-types.js';

export function getUpdateStatePath(): string {
  const xdgStateHome = process.env.XDG_STATE_HOME;
  if (xdgStateHome) {
    return join(xdgStateHome, 'cli-lsp-client-update-state');
  }
  return join(homedir(), '.cli-lsp-client-update-state');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUpdateState(value: unknown): value is UpdateState {
  if (!isRecord(value)) return false;
  return typeof value.lastCheckedAt === 'number';
}

export async function readUpdateState(
  statePath: string = getUpdateStatePath()
): Promise<OperationResult<UpdateState | null>> {
  const file = Bun.file(statePath);

  if (!(await file.exists())) {
    return { success: true, data: null };
  }

  try {
    const content: unknown = await file.json();
    if (!isUpdateState(content)) {
      return { success: true, data: null };
    }
    return { success: true, data: content };
  } catch {
    return { success: true, data: null };
  }
}

export async function writeUpdateState(
  statePath: string,
  state: UpdateState
): Promise<OperationResult> {
  try {
    await Bun.write(statePath, JSON.stringify(state, null, 2) + '\n');
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Failed to write update state' };
  }
}

export function shouldCheckForUpdate(
  state: UpdateState | null,
  intervalHours = 24
): boolean {
  if (!state) return true;
  const cooldownMs = intervalHours * 60 * 60 * 1000;
  return Date.now() - state.lastCheckedAt >= cooldownMs;
}
