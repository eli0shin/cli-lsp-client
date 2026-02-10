import { test, describe, expect, beforeEach, afterEach, mock } from 'bun:test';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runUpdaterWorker } from '../src/updater-worker.js';
import type { WorkerDeps } from '../src/updater-worker.js';

let tempDir: string;
let originalArgv: string[];

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'updater-worker-test-'));
  originalArgv = process.argv;
});

afterEach(async () => {
  process.argv = originalArgv;
  await rm(tempDir, { recursive: true, force: true });
});

function createMockDeps(overrides: Partial<WorkerDeps> = {}): WorkerDeps {
  return {
    fetchLatestVersion: mock(async () => ({
      success: true as const,
      data: { version: '2.0.0', downloadUrl: 'https://example.com/binary' },
    })),
    downloadBinary: mock(async () => ({
      success: true as const,
      data: join(tempDir, 'temp-binary'),
    })),
    replaceBinary: mock(async () => ({
      success: true as const,
      data: undefined,
    })),
    stopAllDaemons: mock(async () => {}),
    writeUpdateState: mock(async () => ({
      success: true as const,
      data: undefined,
    })),
    getUpdateStatePath: () => join(tempDir, 'update-state'),
    ...overrides,
  };
}

describe('runUpdaterWorker', () => {
  test('returns early when args are missing', async () => {
    process.argv = ['bun', 'script', '--update-worker'];
    const deps = createMockDeps();

    await runUpdaterWorker(deps);

    expect(deps.fetchLatestVersion).toHaveBeenCalledTimes(0);
  });

  test('downloads, replaces, and stops daemons when newer version available', async () => {
    const binaryPath = join(tempDir, 'cli-lsp-client');
    process.argv = [
      'bun',
      'script',
      '--update-worker',
      '1.0.0',
      binaryPath,
      'auto',
    ];
    const deps = createMockDeps();

    await runUpdaterWorker(deps);

    expect(deps.fetchLatestVersion).toHaveBeenCalledTimes(1);
    expect(deps.downloadBinary).toHaveBeenCalledTimes(1);
    expect(deps.replaceBinary).toHaveBeenCalledTimes(1);
    expect(deps.stopAllDaemons).toHaveBeenCalledTimes(1);
    expect(deps.writeUpdateState).toHaveBeenCalledTimes(1);
  });

  test('skips update when version is not newer', async () => {
    const binaryPath = join(tempDir, 'cli-lsp-client');
    process.argv = [
      'bun',
      'script',
      '--update-worker',
      '3.0.0',
      binaryPath,
      'auto',
    ];
    const deps = createMockDeps();

    await runUpdaterWorker(deps);

    expect(deps.fetchLatestVersion).toHaveBeenCalledTimes(1);
    expect(deps.downloadBinary).toHaveBeenCalledTimes(0);
    expect(deps.stopAllDaemons).toHaveBeenCalledTimes(0);
    expect(deps.writeUpdateState).toHaveBeenCalledTimes(1);
  });

  test('skips prerelease versions', async () => {
    const binaryPath = join(tempDir, 'cli-lsp-client');
    process.argv = [
      'bun',
      'script',
      '--update-worker',
      '1.0.0',
      binaryPath,
      'auto',
    ];
    const deps = createMockDeps({
      fetchLatestVersion: mock(async () => ({
        success: true as const,
        data: {
          version: '2.0.0-beta.1',
          downloadUrl: 'https://example.com/binary',
        },
      })),
    });

    await runUpdaterWorker(deps);

    expect(deps.downloadBinary).toHaveBeenCalledTimes(0);
    expect(deps.stopAllDaemons).toHaveBeenCalledTimes(0);
    expect(deps.writeUpdateState).toHaveBeenCalledTimes(1);
  });

  test('does not update timestamp on fetch failure', async () => {
    const binaryPath = join(tempDir, 'cli-lsp-client');
    process.argv = [
      'bun',
      'script',
      '--update-worker',
      '1.0.0',
      binaryPath,
      'auto',
    ];
    const deps = createMockDeps({
      fetchLatestVersion: mock(async () => ({
        success: false as const,
        error: 'Network error',
      })),
    });

    await runUpdaterWorker(deps);

    expect(deps.downloadBinary).toHaveBeenCalledTimes(0);
    expect(deps.writeUpdateState).toHaveBeenCalledTimes(0);
  });

  test('does not stop daemons when download fails', async () => {
    const binaryPath = join(tempDir, 'cli-lsp-client');
    process.argv = [
      'bun',
      'script',
      '--update-worker',
      '1.0.0',
      binaryPath,
      'auto',
    ];
    const deps = createMockDeps({
      downloadBinary: mock(async () => ({
        success: false as const,
        error: 'Download failed',
      })),
    });

    await runUpdaterWorker(deps);

    expect(deps.replaceBinary).toHaveBeenCalledTimes(0);
    expect(deps.stopAllDaemons).toHaveBeenCalledTimes(0);
    expect(deps.writeUpdateState).toHaveBeenCalledTimes(1);
  });
});
