import type { Subprocess } from 'bun';
import path from 'path';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { z } from 'zod';

const PackageJsonSchema = z.object({
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
});

/**
 * Returns the path to the current executable.
 * - When running with `bun run`, this returns the path to the Bun runtime
 * - When running as a compiled executable, this returns the path to that executable
 * Both cases work correctly with BUN_BE_BUN=1 environment variable.
 */
export function which(): string {
  return process.execPath;
}

/**
 * Spawns a subprocess using the embedded Bun runtime.
 * Sets BUN_BE_BUN=1 to ensure the executable acts as Bun itself.
 */
export function spawn(
  cmd: string[],
  options?: Parameters<typeof Bun.spawn>[1]
): Subprocess {
  const env = {
    ...process.env,
    ...(options?.env ?? {}),
    BUN_BE_BUN: '1',
  };

  return Bun.spawn(cmd, {
    ...options,
    env,
  });
}


/**
 * Get the local package directory for LSP servers
 */
function getLspPackageDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(homeDir, '.lsp-cli-client', 'packages');
}

/**
 * Ensure a package is installed locally for LSP use
 */
export async function ensurePackageInstalled(packageName: string): Promise<boolean> {
  const packageDir = getLspPackageDir();
  const packageJsonPath = path.join(packageDir, 'package.json');
  
  try {
    // Create directory if it doesn't exist
    if (!existsSync(packageDir)) {
      execSync(`mkdir -p "${packageDir}"`);
    }
    
    // Initialize package.json if it doesn't exist
    if (!existsSync(packageJsonPath)) {
      execSync(`cd "${packageDir}" && ${which()} init -y`, { 
        env: { ...process.env, BUN_BE_BUN: '1' }
      });
    }
    
    // Check if package is already installed
    const packageJson = PackageJsonSchema.parse(
      await Bun.file(packageJsonPath).json()
    );
    if (packageJson.dependencies?.[packageName] || packageJson.devDependencies?.[packageName]) {
      return true;
    }
    
    // Install the package
    execSync(`cd "${packageDir}" && ${which()} add ${packageName}`, {
      env: { ...process.env, BUN_BE_BUN: '1' },
      stdio: 'pipe'
    });
    
    return true;
  } catch {
    // Installation failed, but we'll try to proceed anyway
    return false;
  }
}

/**
 * Get the path to a locally installed command
 */
export function getLocalCommandPath(command: string): string {
  const packageDir = getLspPackageDir();
  return path.join(packageDir, 'node_modules', '.bin', command);
}

/**
 * Returns a command array that uses the locally installed package path.
 * This ensures consistent behavior and avoids global cache issues.
 * @param packageOrCommand The command name to execute
 * @param args Additional arguments to pass to the command
 */
export function bunxCommand(packageOrCommand: string, ...args: string[]): string[] {
  const localCommand = getLocalCommandPath(packageOrCommand);
  return [localCommand, ...args];
}