import { test, describe, expect } from 'bun:test';
import { runDiagnostics } from '../test-utils.js';

describe('C# Valid Files', () => {
  test('Simple.cs should exit with code 0', async () => {
    const filePath = 'tests/fixtures/csharp/valid/Simple.cs';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });

  test('Calculator.cs should exit with code 0', async () => {
    const filePath = 'tests/fixtures/csharp/valid/Calculator.cs';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });
});