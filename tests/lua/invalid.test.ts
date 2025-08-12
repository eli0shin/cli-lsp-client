import { test, describe, expect } from 'bun:test';
import { stripAnsi, runDiagnostics } from '../test-utils.js';

describe('Lua Invalid Files', () => {

  test('syntax-error.lua should exit with code 2 and show syntax errors', async () => {
    const filePath = 'tests/fixtures/lua/invalid/syntax-error.lua';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    
    const output = stripAnsi(proc.stdout.toString());
    expect(output).toContain('ERROR');
    expect(output).toContain('Missed symbol');
    expect(output).toContain('Source: Lua Syntax Check');
  });

  test('type-error.lua should exit with code 2 and show type-related warnings', async () => {
    const filePath = 'tests/fixtures/lua/invalid/type-error.lua';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    
    const output = stripAnsi(proc.stdout.toString());
    expect(output).toContain('WARNING');
    expect(output).toContain('Undefined global');
    expect(output).toContain('Source: Lua Diagnostics');
  });

  test('unused-variable.lua should exit with code 2 and show unused variable hints', async () => {
    const filePath = 'tests/fixtures/lua/invalid/unused-variable.lua';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    
    const output = stripAnsi(proc.stdout.toString());
    expect(output).toContain('HINT');
    expect(output).toContain('Unused local');
    expect(output).toContain('Source: Lua Diagnostics');
  });

});