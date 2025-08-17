import { test, describe, expect } from 'bun:test';
import { runDiagnostics } from '../test-utils.js';

describe('TypeScript Valid Files', () => {
  test('simple-function.ts should exit with code 0', async () => {
    const filePath = 'tests/fixtures/typescript/valid/simple-function.ts';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });

  test('class-example.ts should exit with code 0', async () => {
    const filePath = 'tests/fixtures/typescript/valid/class-example.ts';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });
});
