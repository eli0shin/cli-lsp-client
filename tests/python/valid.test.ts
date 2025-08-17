import { test, describe, expect } from 'bun:test';
import { runDiagnostics } from '../test-utils.js';

describe('Python Valid Files', () => {
  test('simple-module.py should exit with code 0', async () => {
    const filePath = 'tests/fixtures/python/valid/simple-module.py';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });

  test('class-example.py should exit with code 0', async () => {
    const filePath = 'tests/fixtures/python/valid/class-example.py';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });
});
