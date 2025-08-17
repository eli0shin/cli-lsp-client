import { test, describe, expect } from 'bun:test';
import { stripAnsi, runDiagnostics } from '../test-utils.js';

describe('Bash Invalid Files', () => {
  test('syntax-error.sh should exit with code 2 and show shellcheck errors', async () => {
    const filePath = 'tests/fixtures/bash/invalid/syntax-error.sh';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);

    // Bash/ShellCheck can produce various errors, let's check for key ones
    const output = stripAnsi(proc.stderr.toString());

    // Should contain shellcheck errors
    expect(output).toContain('[shellcheck]');
    expect(output).toContain('ERROR');

    // Should catch the unclosed string error
    expect(output).toMatch(/SC107[0-9]|parse|string|quoted/i);
  });
});
