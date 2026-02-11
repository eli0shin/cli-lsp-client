import { test, describe, expect } from 'bun:test';
import { runCommandWithArgs, stripAnsi } from './test-utils.js';

describe('Statusline Command', () => {
  test('should return sorted, comma-separated server IDs after start', async () => {
    // Ensure daemon is running with servers started
    const startResult = await runCommandWithArgs(['start']);
    expect(startResult.exitCode).toBe(0);

    // Give servers a moment to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const result = await runCommandWithArgs(['statusline']);
    expect(result.exitCode).toBe(0);

    const output = stripAnsi(result.stdout);
    // This project has .ts, .json, .sh, .yaml files so these servers should be active
    // Output should be comma-separated, sorted, and deduplicated
    const servers = output.split(', ');
    // Verify sorted order
    const sorted = [...servers].sort();
    expect(servers.join(', ')).toBe(sorted.join(', '));
    // Verify at least typescript and json are present
    expect(servers.includes('typescript')).toBe(true);
    expect(servers.includes('json')).toBe(true);
  }, 30000);

  test('should have no trailing whitespace or newlines', async () => {
    const result = await runCommandWithArgs(['statusline']);
    expect(result.exitCode).toBe(0);

    // stripAnsi already trims trailing whitespace, so compare raw stdout
    const raw = result.stdout;
    // Should end with exactly one newline (from process.stdout.write(result + '\n'))
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw.endsWith('\n\n')).toBe(false);
  }, 10000);

  test('should exit with code 0', async () => {
    const result = await runCommandWithArgs(['statusline']);
    expect(result.exitCode).toBe(0);
  }, 10000);
});
