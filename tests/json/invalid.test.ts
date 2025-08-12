import { test, describe, expect } from 'bun:test';
import { stripAnsi, runDiagnostics } from '../test-utils.js';

describe('JSON Invalid Files', () => {

  test('syntax-error.json should exit with code 2 and show exact errors', async () => {
    const filePath = 'tests/fixtures/json/invalid/syntax-error.json';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stdout.toString())).toBe(`ERROR at line 3, column 23:
  Property expected
  Source: plaintext
  Code: 513

ERROR at line 5, column 1:
  Value expected
  Source: plaintext
  Code: 516`);
  });

});