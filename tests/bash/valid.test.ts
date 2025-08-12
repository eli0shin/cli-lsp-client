import { test, describe, expect } from 'bun:test';
import { runDiagnostics } from '../test-utils.js';

describe('Bash Valid Files', () => {

  test('script.sh should exit with code 0', async () => {
    const filePath = 'tests/fixtures/bash/valid/script.sh';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });

});