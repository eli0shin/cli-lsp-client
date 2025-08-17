import { test, describe, expect } from 'bun:test';
import { stripAnsi, runDiagnostics } from '../test-utils.js';

describe('Lua Invalid Files', () => {
  test('syntax-error.lua should exit with code 2 and show syntax errors', async () => {
    const filePath = 'tests/fixtures/lua/invalid/syntax-error.lua';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);

    expect(stripAnsi(proc.stderr.toString())).toBe(
      '[Lua Syntax Check.] ERROR at line 4, column 1: Miss corresponding `end` . [miss-end]\n[Lua Syntax Check.] ERROR at line 8, column 13: Missed symbol `,`. [miss-symbol]\n[Lua Syntax Check.] ERROR at line 11, column 20: Missed symbol `"`. [miss-symbol]\n[Lua Syntax Check.] ERROR at line 11, column 20: Missed symbol `)`. [miss-symbol]'
    );
  });

  test('type-error.lua should exit with code 2 and show type-related warnings', async () => {
    const filePath = 'tests/fixtures/lua/invalid/type-error.lua';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);

    expect(stripAnsi(proc.stderr.toString())).toBe(
      '[Lua Diagnostics.] WARNING at line 15, column 11: Undefined global `undefined_variable`. [undefined-global]\n[Lua Diagnostics.] WARNING at line 19, column 19: Undefined field `field`. [undefined-field]\n[Lua Diagnostics.] HINT at line 2, column 7: Unused functions. [unused-function]\n[Lua Diagnostics.] HINT at line 2, column 16: Unused local `get_string`. [unused-local]\n[Lua Diagnostics.] HINT at line 15, column 7: Unused local `x`. [unused-local]\n[Lua Diagnostics.] HINT at line 19, column 7: Unused local `value`. [unused-local]'
    );
  });

  test('unused-variable.lua should exit with code 2 and show unused variable hints', async () => {
    const filePath = 'tests/fixtures/lua/invalid/unused-variable.lua';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);

    expect(stripAnsi(proc.stderr.toString())).toBe(
      '[Lua Diagnostics.] HINT at line 2, column 7: Unused functions. [unused-function]\n[Lua Diagnostics.] HINT at line 2, column 16: Unused local `unused_function`. [unused-local]\n[Lua Diagnostics.] HINT at line 7, column 11: Unused local `unused_var`. [unused-local]\n[Lua Diagnostics.] HINT at line 8, column 11: Unused local `another_unused`. [unused-local]\n[Lua Diagnostics.] HINT at line 10, column 11: Unused local `y`. [unused-local]\n[Lua Diagnostics.] HINT at line 11, column 1: Line with spaces only. [trailing-space]\n[Lua Diagnostics.] HINT at line 14, column 1: Line with spaces only. [trailing-space]\n[Lua Diagnostics.] HINT at line 16, column 35: Unused local `param2`. [unused-local]\n[Lua Diagnostics.] HINT at line 16, column 43: Unused local `param3`. [unused-local]\n[Lua Diagnostics.] HINT at line 19, column 1: Line with spaces only. [trailing-space]'
    );
  });
});
