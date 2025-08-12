import { test, describe, expect } from 'bun:test';
import { runDiagnostics } from '../test-utils.js';

describe('Fish Valid Files', () => {

  test('valid.fish should exit with code 0', async () => {
    const filePath = 'tests/fish/valid.fish';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });

});