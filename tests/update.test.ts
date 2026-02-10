import { test, describe, expect, beforeEach, afterEach, mock } from 'bun:test';
import { join } from 'node:path';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir, platform, arch } from 'node:os';
import {
  getBinaryName,
  isPrerelease,
  isNewerVersion,
  getPlatform,
  getArchitecture,
  fetchLatestVersion,
  downloadBinary,
  replaceBinary,
} from '../src/update.js';

describe('getBinaryName', () => {
  test('darwin-arm64', () => {
    expect(getBinaryName('darwin', 'arm64')).toBe(
      'cli-lsp-client-darwin-arm64'
    );
  });

  test('darwin-x64', () => {
    expect(getBinaryName('darwin', 'x64')).toBe('cli-lsp-client-darwin-x64');
  });

  test('linux-arm64', () => {
    expect(getBinaryName('linux', 'arm64')).toBe('cli-lsp-client-linux-arm64');
  });

  test('linux-x64', () => {
    expect(getBinaryName('linux', 'x64')).toBe('cli-lsp-client-linux-x64');
  });
});

describe('isPrerelease', () => {
  test('returns false for stable version', () => {
    expect(isPrerelease('1.2.3')).toBe(false);
  });

  test('returns true for prerelease version', () => {
    expect(isPrerelease('1.2.3-beta.1')).toBe(true);
  });

  test('returns true for rc version', () => {
    expect(isPrerelease('2.0.0-rc.1')).toBe(true);
  });

  test('returns true for alpha version', () => {
    expect(isPrerelease('1.0.0-alpha.0')).toBe(true);
  });

  test('returns false for garbage input', () => {
    expect(isPrerelease('garbage')).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(isPrerelease('')).toBe(false);
  });
});

describe('isNewerVersion', () => {
  test('returns true when major is higher', () => {
    expect(isNewerVersion('1.0.0', '2.0.0')).toBe(true);
  });

  test('returns true when minor is higher', () => {
    expect(isNewerVersion('1.0.0', '1.1.0')).toBe(true);
  });

  test('returns true when patch is higher', () => {
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true);
  });

  test('returns false when same version', () => {
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
  });

  test('returns false when current is newer', () => {
    expect(isNewerVersion('2.0.0', '1.0.0')).toBe(false);
  });

  test('returns false when current minor is higher', () => {
    expect(isNewerVersion('1.5.0', '1.4.0')).toBe(false);
  });

  test('returns true when latest is prerelease of higher patch', () => {
    expect(isNewerVersion('1.0.0', '1.0.1-beta.1')).toBe(true);
  });

  test('returns false when latest is prerelease of same version', () => {
    expect(isNewerVersion('1.0.1', '1.0.1-beta.1')).toBe(false);
  });

  test('returns true when comparing prerelease to its release', () => {
    expect(isNewerVersion('2.0.0-beta.1', '2.0.0')).toBe(true);
  });

  test('returns true for higher prerelease number', () => {
    expect(isNewerVersion('2.0.0-beta.1', '2.0.0-beta.2')).toBe(true);
  });

  test('returns false when current is garbage', () => {
    expect(isNewerVersion('garbage', '1.0.0')).toBe(false);
  });

  test('returns false when latest is garbage', () => {
    expect(isNewerVersion('1.0.0', 'garbage')).toBe(false);
  });

  test('returns false when both are empty strings', () => {
    expect(isNewerVersion('', '')).toBe(false);
  });

  test('returns false when both are garbage', () => {
    expect(isNewerVersion('garbage', 'garbage')).toBe(false);
  });
});

describe('getPlatform', () => {
  test('returns a valid platform on this machine', () => {
    const result = getPlatform();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(['darwin', 'linux'].includes(result.data)).toBe(true);
    }
  });
});

describe('getArchitecture', () => {
  test('returns a valid architecture on this machine', () => {
    const result = getArchitecture();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(['x64', 'arm64'].includes(result.data)).toBe(true);
    }
  });
});

describe('fetchLatestVersion', () => {
  const originalFetch = globalThis.fetch;

  function createMockFetch(response: Response) {
    const mockFn = mock(() => Promise.resolve(response));
    return Object.assign(mockFn, { preconnect: originalFetch.preconnect });
  }

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('returns version and download URL on success', async () => {
    globalThis.fetch = createMockFetch(
      new Response(JSON.stringify({ tag_name: 'v2.0.0' }), { status: 200 })
    );

    const currentPlatform = platform() === 'darwin' ? 'darwin' : 'linux';
    const currentArch = arch() === 'arm64' ? 'arm64' : 'x64';
    const expectedBinary = `cli-lsp-client-${currentPlatform}-${currentArch}`;

    const result = await fetchLatestVersion();
    expect(result).toEqual({
      success: true,
      data: {
        version: '2.0.0',
        downloadUrl: `https://github.com/eli0shin/cli-lsp-client/releases/latest/download/${expectedBinary}`,
      },
    });
  });

  test('returns error on 404', async () => {
    globalThis.fetch = createMockFetch(new Response('', { status: 404 }));

    const result = await fetchLatestVersion();
    expect(result).toEqual({
      success: false,
      error: 'No releases found',
    });
  });

  test('returns error on invalid response', async () => {
    globalThis.fetch = createMockFetch(
      new Response(JSON.stringify({ wrong: 'shape' }), { status: 200 })
    );

    const result = await fetchLatestVersion();
    expect(result).toEqual({
      success: false,
      error: 'Invalid response from GitHub API',
    });
  });
});

describe('downloadBinary', () => {
  const originalFetch = globalThis.fetch;
  let tempDir: string;

  function createMockFetch(response: Response) {
    const mockFn = mock(() => Promise.resolve(response));
    return Object.assign(mockFn, { preconnect: originalFetch.preconnect });
  }

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'update-download-test-'));
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true, force: true });
  });

  test('downloads binary to temp file', async () => {
    const binaryContent = Buffer.from('fake-binary-content');
    globalThis.fetch = createMockFetch(
      new Response(binaryContent, { status: 200 })
    );

    const result = await downloadBinary('https://example.com/binary', tempDir);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toContain('.cli-lsp-client-update-');
      const content = await Bun.file(result.data).text();
      expect(content).toBe('fake-binary-content');
      const fileStat = await stat(result.data);
      expect(fileStat.mode & 0o777).toBe(0o755);
    }
  });

  test('returns error on 404', async () => {
    globalThis.fetch = createMockFetch(
      new Response('Not found', { status: 404 })
    );

    const result = await downloadBinary('https://example.com/binary', tempDir);
    expect(result).toEqual({
      success: false,
      error: 'Binary not found for this platform',
    });
  });
});

describe('replaceBinary', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'update-replace-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('replaces target with temp file', async () => {
    const tempPath = join(tempDir, 'temp-binary');
    const targetPath = join(tempDir, 'target-binary');
    await Bun.write(tempPath, 'new-content');
    await Bun.write(targetPath, 'old-content');

    const result = await replaceBinary(tempPath, targetPath);
    expect(result).toEqual({ success: true, data: undefined });

    const content = await Bun.file(targetPath).text();
    expect(content).toBe('new-content');

    const tempExists = await Bun.file(tempPath).exists();
    expect(tempExists).toBe(false);
  });

  test('cleans up temp file on failure', async () => {
    const tempPath = join(tempDir, 'temp-binary');
    await Bun.write(tempPath, 'new-content');
    const targetPath = join(tempDir, 'nonexistent', 'subdir', 'target');

    const result = await replaceBinary(tempPath, targetPath);
    expect(result.success).toBe(false);

    const tempExists = await Bun.file(tempPath).exists();
    expect(tempExists).toBe(false);
  });
});
