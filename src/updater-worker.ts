import { dirname } from 'node:path';
import {
  fetchLatestVersion,
  isNewerVersion,
  isPrerelease,
  downloadBinary,
  replaceBinary,
} from './update.js';
import { getUpdateStatePath, writeUpdateState } from './update-state.js';
import { stopAllDaemons } from './client.js';
import type { UpdateState } from './update-types.js';

export type WorkerDeps = {
  fetchLatestVersion: typeof fetchLatestVersion;
  downloadBinary: typeof downloadBinary;
  replaceBinary: typeof replaceBinary;
  stopAllDaemons: typeof stopAllDaemons;
  writeUpdateState: typeof writeUpdateState;
  getUpdateStatePath: typeof getUpdateStatePath;
};

const defaultDeps: WorkerDeps = {
  fetchLatestVersion,
  downloadBinary,
  replaceBinary,
  stopAllDaemons,
  writeUpdateState,
  getUpdateStatePath,
};

export async function runUpdaterWorker(
  deps: WorkerDeps = defaultDeps
): Promise<void> {
  const [currentVersion, binaryPath] = process.argv.slice(3);

  if (!currentVersion || !binaryPath) {
    return;
  }

  const statePath = deps.getUpdateStatePath();

  try {
    const releaseResult = await deps.fetchLatestVersion();
    if (!releaseResult.success) {
      return;
    }

    const { version: latestVersion, downloadUrl } = releaseResult.data;

    if (isPrerelease(latestVersion)) {
      await updateTimestamp(statePath, deps);
      return;
    }

    if (!isNewerVersion(currentVersion, latestVersion)) {
      await updateTimestamp(statePath, deps);
      return;
    }

    const binaryDir = dirname(binaryPath);
    const downloadResult = await deps.downloadBinary(downloadUrl, binaryDir);
    if (!downloadResult.success) {
      await updateTimestamp(statePath, deps);
      return;
    }

    const replaceResult = await deps.replaceBinary(
      downloadResult.data,
      binaryPath
    );
    if (!replaceResult.success) {
      await updateTimestamp(statePath, deps);
      return;
    }

    // Stop all daemons so they restart with the new binary
    await deps.stopAllDaemons();

    await updateTimestamp(statePath, deps);
  } catch {
    // Silent failure — background process
  }
}

async function updateTimestamp(
  statePath: string,
  deps: WorkerDeps
): Promise<void> {
  const state = {
    lastCheckedAt: Date.now(),
  } satisfies UpdateState;
  await deps.writeUpdateState(statePath, state);
}
