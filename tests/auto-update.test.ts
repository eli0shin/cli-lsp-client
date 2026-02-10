import { test, describe, expect, beforeEach, afterEach, mock } from 'bun:test';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { handleAutoUpdate } from '../src/auto-update.js';
import { writeUpdateState } from '../src/update-state.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'auto-update-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('handleAutoUpdate', () => {
  test('spawns worker when no state file exists', async () => {
    const spawnFn = mock((_args: string[]) => {});
    const statePath = join(tempDir, 'nonexistent-state');

    await handleAutoUpdate('1.0.0', 'auto', 24, statePath, spawnFn);

    expect(spawnFn).toHaveBeenCalledTimes(1);
    const args = spawnFn.mock.calls[0][0];
    expect(args[1]).toBe('--update-worker');
    expect(args[2]).toBe('1.0.0');
    expect(args[4]).toBe('auto');
  });

  test('spawns worker when cooldown expired', async () => {
    const spawnFn = mock((_args: string[]) => {});
    const statePath = join(tempDir, 'expired-state');
    await writeUpdateState(statePath, {
      lastCheckedAt: Date.now() - 25 * 60 * 60 * 1000,
    });

    await handleAutoUpdate('1.0.0', 'auto', 24, statePath, spawnFn);

    expect(spawnFn).toHaveBeenCalledTimes(1);
  });

  test('does not spawn when within cooldown', async () => {
    const spawnFn = mock((_args: string[]) => {});
    const statePath = join(tempDir, 'recent-state');
    await writeUpdateState(statePath, {
      lastCheckedAt: Date.now() - 1 * 60 * 60 * 1000,
    });

    await handleAutoUpdate('1.0.0', 'auto', 24, statePath, spawnFn);

    expect(spawnFn).toHaveBeenCalledTimes(0);
  });

  test('does not spawn when behavior is off', async () => {
    const spawnFn = mock((_args: string[]) => {});
    const statePath = join(tempDir, 'off-state');

    await handleAutoUpdate('1.0.0', 'off', 24, statePath, spawnFn);

    expect(spawnFn).toHaveBeenCalledTimes(0);
  });

  test('respects custom interval hours', async () => {
    const spawnFn = mock((_args: string[]) => {});
    const statePath = join(tempDir, 'custom-interval-state');
    await writeUpdateState(statePath, {
      lastCheckedAt: Date.now() - 2 * 60 * 60 * 1000,
    });

    // 1 hour interval - should spawn since last check was 2 hours ago
    await handleAutoUpdate('1.0.0', 'auto', 1, statePath, spawnFn);
    expect(spawnFn).toHaveBeenCalledTimes(1);
  });
});
