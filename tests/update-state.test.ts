import { test, describe, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  readUpdateState,
  writeUpdateState,
  shouldCheckForUpdate,
  getUpdateStatePath,
} from '../src/update-state.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'update-state-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('getUpdateStatePath', () => {
  test('uses XDG_STATE_HOME when set', () => {
    const original = process.env.XDG_STATE_HOME;
    process.env.XDG_STATE_HOME = '/tmp/xdg-state';
    try {
      const result = getUpdateStatePath();
      expect(result).toBe('/tmp/xdg-state/cli-lsp-client-update-state');
    } finally {
      if (original === undefined) {
        delete process.env.XDG_STATE_HOME;
      } else {
        process.env.XDG_STATE_HOME = original;
      }
    }
  });
});

describe('readUpdateState', () => {
  test('returns null for missing file', async () => {
    const result = await readUpdateState(join(tempDir, 'nonexistent'));
    expect(result).toEqual({ success: true, data: null });
  });

  test('returns null for malformed JSON', async () => {
    const statePath = join(tempDir, 'bad-state');
    await Bun.write(statePath, 'not json');
    const result = await readUpdateState(statePath);
    expect(result).toEqual({ success: true, data: null });
  });

  test('returns null for JSON missing lastCheckedAt', async () => {
    const statePath = join(tempDir, 'incomplete-state');
    await Bun.write(statePath, JSON.stringify({ foo: 'bar' }));
    const result = await readUpdateState(statePath);
    expect(result).toEqual({ success: true, data: null });
  });

  test('returns state for valid file', async () => {
    const statePath = join(tempDir, 'valid-state');
    const state = { lastCheckedAt: 1000000 };
    await Bun.write(statePath, JSON.stringify(state));
    const result = await readUpdateState(statePath);
    expect(result).toEqual({ success: true, data: state });
  });
});

describe('writeUpdateState', () => {
  test('writes state to file', async () => {
    const statePath = join(tempDir, 'write-state');
    const state = { lastCheckedAt: 1234567890 };
    const result = await writeUpdateState(statePath, state);
    expect(result).toEqual({ success: true, data: undefined });

    const content = await Bun.file(statePath).json();
    expect(content).toEqual(state);
  });
});

describe('shouldCheckForUpdate', () => {
  test('returns true when state is null', () => {
    expect(shouldCheckForUpdate(null)).toBe(true);
  });

  test('returns true when cooldown expired', () => {
    const state = { lastCheckedAt: Date.now() - 25 * 60 * 60 * 1000 };
    expect(shouldCheckForUpdate(state, 24)).toBe(true);
  });

  test('returns false when within cooldown', () => {
    const state = { lastCheckedAt: Date.now() - 1 * 60 * 60 * 1000 };
    expect(shouldCheckForUpdate(state, 24)).toBe(false);
  });

  test('respects custom interval', () => {
    const state = { lastCheckedAt: Date.now() - 2 * 60 * 60 * 1000 };
    expect(shouldCheckForUpdate(state, 1)).toBe(true);
    expect(shouldCheckForUpdate(state, 3)).toBe(false);
  });
});
