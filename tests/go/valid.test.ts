import { test, describe, expect } from 'bun:test';
import { runDiagnostics } from '../test-utils.js';

describe('Go Valid Files', () => {

  test('main-package/simple-function.go should exit with code 0', async () => {
    const filePath = 'tests/fixtures/go/valid/main-package/simple-function.go';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });

  test('person-package/struct-example.go should exit with code 0', async () => {
    const filePath = 'tests/fixtures/go/valid/person-package/struct-example.go';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });
});