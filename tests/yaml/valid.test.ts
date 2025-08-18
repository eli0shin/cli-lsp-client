import { test, describe, expect } from 'bun:test';
import { runDiagnostics } from '../test-utils.js';

describe('YAML Valid Files', () => {
  test('docker-compose-example.yml should exit with code 0', async () => {
    const filePath = 'tests/fixtures/yaml/valid/docker-compose-example.yml';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });
});
