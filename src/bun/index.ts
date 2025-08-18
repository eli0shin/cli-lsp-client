import type { Subprocess } from 'bun';

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
 * Returns a command array that uses the embedded Bun runtime
 * to execute a package with 'bun x' (equivalent to bunx).
 * @param packageName The package to execute
 * @param args Additional arguments to pass to the package
 */
export function bunxCommand(packageName: string, ...args: string[]): string[] {
  return [which(), 'x', packageName, ...args];
}