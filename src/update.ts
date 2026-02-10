import { platform, arch } from 'node:os';
import { join } from 'node:path';
import { chmod, rename, unlink } from 'node:fs/promises';
import { valid, gt, prerelease } from 'semver';
import type {
  OperationResult,
  Platform,
  Architecture,
} from './update-types.js';

const GITHUB_REPO = 'eli0shin/cli-lsp-client';

type GitHubRelease = {
  tag_name: string;
};

function isGitHubRelease(data: unknown): data is GitHubRelease {
  if (typeof data !== 'object' || data === null) return false;
  if (!('tag_name' in data)) return false;
  return typeof data.tag_name === 'string';
}

export function getBinaryName(p: Platform, a: Architecture): string {
  return `cli-lsp-client-${p}-${a}`;
}

export function isPrerelease(version: string): boolean {
  return prerelease(version) !== null;
}

export function isNewerVersion(current: string, latest: string): boolean {
  if (!valid(current) || !valid(latest)) return false;
  return gt(latest, current);
}

export function getPlatform(): OperationResult<Platform> {
  const p = platform();
  if (p === 'darwin') return { success: true, data: 'darwin' };
  if (p === 'linux') return { success: true, data: 'linux' };
  return { success: false, error: `Unsupported platform: ${p}` };
}

export function getArchitecture(): OperationResult<Architecture> {
  const a = arch();
  if (a === 'x64') return { success: true, data: 'x64' };
  if (a === 'arm64') return { success: true, data: 'arm64' };
  return { success: false, error: `Unsupported architecture: ${a}` };
}

export async function fetchLatestVersion(): Promise<
  OperationResult<{ version: string; downloadUrl: string }>
> {
  const platformResult = getPlatform();
  if (!platformResult.success) return platformResult;

  const archResult = getArchitecture();
  if (!archResult.success) return archResult;

  const binaryName = getBinaryName(platformResult.data, archResult.data);
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'cli-lsp-client',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { success: false, error: 'No releases found' };
    }
    return { success: false, error: `GitHub API error: ${response.status}` };
  }

  const data: unknown = await response.json();
  if (!isGitHubRelease(data)) {
    return { success: false, error: 'Invalid response from GitHub API' };
  }
  const version = data.tag_name.replace(/^v/, '');
  const downloadUrl = `https://github.com/${GITHUB_REPO}/releases/latest/download/${binaryName}`;

  return { success: true, data: { version, downloadUrl } };
}

export async function downloadBinary(
  url: string,
  targetDir: string
): Promise<OperationResult<string>> {
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      return { success: false, error: 'Binary not found for this platform' };
    }
    return { success: false, error: `Download failed: ${response.status}` };
  }

  const tempPath = join(targetDir, `.cli-lsp-client-update-${Date.now()}`);
  const arrayBuffer = await response.arrayBuffer();
  await Bun.write(tempPath, arrayBuffer);
  await chmod(tempPath, 0o755);

  return { success: true, data: tempPath };
}

export async function replaceBinary(
  tempPath: string,
  targetPath: string
): Promise<OperationResult> {
  try {
    await rename(tempPath, targetPath);
    return { success: true, data: undefined };
  } catch (err) {
    try {
      await unlink(tempPath);
    } catch {}

    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: `Failed to replace binary: ${message}` };
  }
}
