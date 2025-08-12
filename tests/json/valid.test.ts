import { test, describe, expect } from 'bun:test';
import { runDiagnostics } from '../test-utils.js';

describe('JSON Valid Files', () => {

  test('package.json should exit with code 0', async () => {
    const filePath = 'tests/fixtures/json/valid/package.json';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });

});