import { test, describe, expect } from 'bun:test';
import { runDiagnostics } from '../test-utils.js';

describe('JavaScript Valid Files', () => {
  test('simple-module.js should exit with code 0', async () => {
    const filePath = 'tests/fixtures/javascript/valid/simple-module.js';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });
});