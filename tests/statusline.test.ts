import { test, describe, expect } from 'bun:test';
import { runCommandWithArgs, stripAnsi } from './test-utils.js';

describe('Statusline Command', () => {
  test('should return sorted, deduplicated, comma-separated server IDs', async () => {
    const statusResult = await runCommandWithArgs(['status']);
    const statusOutput = stripAnsi(statusResult.stdout);
    const serverIDs = statusOutput
      .split('\n')
      .filter(line => line.startsWith('- '))
      .map(line => line.slice(2, line.indexOf(' (')));
    const expected = [...new Set(serverIDs)].sort().join(', ');

    const result = await runCommandWithArgs(['statusline']);
    expect(result.exitCode).toBe(0);
    expect(stripAnsi(result.stdout)).toBe(expected);
  }, 10000);
});
