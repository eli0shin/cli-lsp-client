import { test, describe, expect } from 'bun:test';
import { stripAnsi, runDiagnostics } from '../test-utils.js';

describe('R Invalid Files', () => {
  test('syntax_error.r should exit with code 2 and show exact errors', async () => {
    const filePath = 'tests/fixtures/r/invalid/syntax_error.r';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stderr.toString()))
      .toBe(`[lintr] ERROR at line 4, column 24: unexpected '{' [error]
[lintr] INFO at line 4, column 24: Opening curly braces should never go on their own line and should always be followed by a new line. [brace_linter]
[lintr] INFO at line 5, column 1: Indentation should be 0 spaces but is 2 spaces. [indentation_linter]`);
  });
});