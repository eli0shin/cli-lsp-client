import { test, describe, expect } from 'bun:test';
import { stripAnsi, runDiagnostics } from '../test-utils.js';

describe('Python Invalid Files', () => {

  test('syntax-error.py should exit with code 2 and show exact error', async () => {
    const filePath = 'tests/fixtures/python/invalid/syntax-error.py';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stdout.toString())).toBe(`ERROR at line 2, column 13:
  Expected ":"
  Source: Pyright`);
  });

  test('type-error.py should exit with code 2 and show exact errors', async () => {
    const filePath = 'tests/fixtures/python/invalid/type-error.py';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stdout.toString())).toBe(`ERROR at line 3, column 12:
  Type "Literal[42]" is not assignable to return type "str"
  "Literal[42]" is not assignable to "str"
  Source: Pyright
  Code: reportReturnType

ERROR at line 6, column 14:
  Type "Literal[123]" is not assignable to declared type "str"
  "Literal[123]" is not assignable to "str"
  Source: Pyright
  Code: reportAssignmentType`);
  });
});