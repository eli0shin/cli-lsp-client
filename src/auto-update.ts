import { spawn as nodeSpawn } from 'node:child_process';
import {
  readUpdateState,
  shouldCheckForUpdate,
  getUpdateStatePath,
} from './update-state.js';
import type { UpdateBehavior } from './update-types.js';

export type SpawnFn = (args: string[]) => void;

function defaultSpawn(args: string[]): void {
  const [cmd, ...rest] = args;
  const proc = nodeSpawn(cmd, rest, {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  proc.unref();
}

export async function handleAutoUpdate(
  currentVersion: string,
  updateBehavior: UpdateBehavior,
  checkIntervalHours = 24,
  statePath: string = getUpdateStatePath(),
  spawnFn: SpawnFn = defaultSpawn
): Promise<void> {
  if (updateBehavior === 'off') {
    return;
  }

  const stateResult = await readUpdateState(statePath);
  const state = stateResult.success ? stateResult.data : null;

  if (!shouldCheckForUpdate(state, checkIntervalHours)) {
    return;
  }

  const binaryPath = process.execPath;
  spawnFn([
    binaryPath,
    '--update-worker',
    currentVersion,
    binaryPath,
    updateBehavior,
  ]);
}
