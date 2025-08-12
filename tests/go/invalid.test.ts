import { test, describe, expect } from 'bun:test';
import { stripAnsi, runDiagnostics } from '../test-utils.js';

describe('Go Invalid Files', () => {

  test('type-error.go should exit with code 2 and show exact error', async () => {
    const filePath = 'tests/fixtures/go/invalid/type-error/type-error.go';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stdout.toString())).toBe(`ERROR at line 6, column 14:
  cannot use "hello world" (untyped string constant) as int value in variable declaration
  Source: compiler
  Code: IncompatibleAssign`);
  });

  test('undefined-function.go should exit with code 2 and show exact error', async () => {
    const filePath = 'tests/fixtures/go/invalid/undefined-function/undefined-function.go';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stdout.toString())).toBe(`ERROR at line 9, column 2:
  undefined: undefinedFunction
  Source: compiler
  Code: UndeclaredName`);
  });

  test('syntax-error.go should exit with code 2 and show exact error', async () => {
    const filePath = 'tests/fixtures/go/invalid/syntax-error/syntax-error.go';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stdout.toString())).toBe(`ERROR at line 7, column 15:
  missing ',' before newline in argument list
  Source: syntax`);
  });
});