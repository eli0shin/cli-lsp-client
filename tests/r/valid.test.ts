import { test, describe, expect } from 'bun:test';
import { runDiagnostics } from '../test-utils.js';

describe('R Valid Files', () => {
  test('simple.r should exit with code 0', async () => {
    const filePath = 'tests/fixtures/r/valid/simple.r';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });

  test('hello.r should exit with code 0', async () => {
    const filePath = 'tests/fixtures/r/valid/hello.r';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });
});