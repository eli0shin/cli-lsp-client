import { test, describe, expect } from 'bun:test';
import { runDiagnostics } from '../test-utils.js';

describe('Lua Valid Files', () => {

  test('simple-module.lua should exit with code 0', async () => {
    const filePath = 'tests/fixtures/lua/valid/simple-module.lua';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  }, 10000); // 10 second timeout

  test('class-example.lua should exit with code 0', async () => {
    const filePath = 'tests/fixtures/lua/valid/class-example.lua';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  }, 10000); // 10 second timeout

});