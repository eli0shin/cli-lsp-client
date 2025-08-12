import { test, describe, expect } from 'bun:test';
import { runDiagnostics } from '../test-utils.js';

describe('Java Valid Files', () => {

  test('HelloWorld.java should exit with code 0', async () => {
    const filePath = 'tests/fixtures/java/valid/src/main/java/com/example/HelloWorld.java';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });
});