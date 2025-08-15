import { test, describe, expect } from 'bun:test';
import { stripAnsi, runDiagnostics } from '../test-utils.js';

describe('JavaScript Invalid Files', () => {

  test('syntax-error.js should exit with code 2 and show exact error', async () => {
    const filePath = 'tests/fixtures/javascript/invalid/syntax-error.js';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stderr.toString())).toBe(`[typescript] ERROR at line 4, column 2: Declaration or statement expected. [1128]`);
  });
});