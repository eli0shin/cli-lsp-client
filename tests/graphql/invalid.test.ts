import { test, describe, expect } from 'bun:test';
import { stripAnsi, runDiagnostics } from '../test-utils.js';

describe('GraphQL Invalid Files', () => {
  test('unknown-type.graphql should exit with code 2 and show exact error', async () => {
    const filePath = 'tests/fixtures/graphql/invalid/unknown-type.graphql';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stderr.toString())).toBe(
      `[GraphQL: Validation] ERROR at line 11, column 17: Unknown type "NonExistentType".`
    );
  });

  test('syntax-error.gql should exit with code 2 and show exact error', async () => {
    const filePath = 'tests/fixtures/graphql/invalid/syntax-error.gql';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stderr.toString())).toBe(
      `[GraphQL: Syntax] ERROR at line 13, column 6: Syntax Error: Expected ":", found Name "Post".`
    );
  });

  test('duplicate-field.graphql should exit with code 2 and show exact error', async () => {
    const filePath = 'tests/fixtures/graphql/invalid/duplicate-field.graphql';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stderr.toString())).toBe(
      `[GraphQL: Validation] ERROR at line 11, column 21: Unknown type "UnknownField".`
    );
  });
});
