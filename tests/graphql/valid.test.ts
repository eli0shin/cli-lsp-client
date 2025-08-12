import { test, describe, expect } from 'bun:test';
import { runDiagnostics } from '../test-utils.js';

describe('GraphQL Valid Files', () => {

  test('schema.graphql should exit with code 0', async () => {
    const filePath = 'tests/fixtures/graphql/valid/schema.graphql';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });

  test('simple-query.gql should exit with code 0', async () => {
    const filePath = 'tests/fixtures/graphql/valid/simple-query.gql';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
  });
});