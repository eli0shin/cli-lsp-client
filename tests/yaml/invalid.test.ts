import { test, describe, expect } from 'bun:test';
import { stripAnsi, runDiagnostics } from '../test-utils.js';

describe('YAML Invalid Files', () => {

  test('indentation-error.yml should exit with code 2 and show exact error', async () => {
    const filePath = 'tests/fixtures/yaml/invalid/indentation-error.yml';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stderr.toString())).toBe(`[YAML] ERROR at line 7, column 1: All mapping items must start at the same column [0]`);
  });

});