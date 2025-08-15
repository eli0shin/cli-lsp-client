import { test, describe, expect } from 'bun:test';
import { stripAnsi, runDiagnostics } from '../test-utils.js';

describe('TypeScript Invalid Files', () => {

  test('type-error.ts should exit with code 2 and show exact errors', async () => {
    const filePath = 'tests/fixtures/typescript/invalid/type-error.ts';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stderr.toString())).toBe(`[typescript] ERROR at line 3, column 3: Type 'number' is not assignable to type 'string'. [2322]
[typescript] ERROR at line 7, column 9: Type 'number' is not assignable to type 'string'. [2322]
[typescript] HINT at line 1, column 27: 'name' is declared but its value is never read. [6133]
[typescript] HINT at line 7, column 9: 'x' is declared but its value is never read. [6133]`);
  });

  test('unused-variable.ts should exit with code 2 and show exact warnings', async () => {
    const filePath = 'tests/fixtures/typescript/invalid/unused-variable.ts';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stderr.toString())).toBe(`[typescript] HINT at line 2, column 9: 'unused' is declared but its value is never read. [6133]
[typescript] HINT at line 3, column 9: 'alsoUnused' is declared but its value is never read. [6133]`);
  });

  test('syntax-error.ts should exit with code 2 and show exact error', async () => {
    const filePath = 'tests/fixtures/typescript/invalid/syntax-error.ts';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stderr.toString())).toBe(`[typescript] ERROR at line 4, column 2: Declaration or statement expected. [1128]`);
  });
});