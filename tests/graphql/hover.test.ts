import { test, describe, expect } from 'bun:test';
import { runHover, stripAnsi } from '../test-utils.js';

describe('GraphQL Hover Command', () => {
  test('should get hover info for GraphQL User type', async () => {
    const result = await runHover(
      'tests/fixtures/graphql/valid/schema.graphql',
      'User'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    // TODO: Fix flaky test - GraphQL LSP returns different User occurrences
    // inconsistently (type definition vs references). Should be deterministic.
    expect(output).toMatch(
      /^Location: tests\/fixtures\/graphql\/valid\/schema\.graphql:\d+:\d+\nNo documentation available\.$/
    );
  }, 10000);

  test('should get hover info for GraphQL Query type', async () => {
    const result = await runHover(
      'tests/fixtures/graphql/valid/schema.graphql',
      'Query'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output)
      .toBe(`Location: tests/fixtures/graphql/valid/schema.graphql:4:6
No documentation available.`);
  }, 10000);

  test('should get hover info for GraphQL name field', async () => {
    const result = await runHover(
      'tests/fixtures/graphql/valid/schema.graphql',
      'name'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output)
      .toBe(`Location: tests/fixtures/graphql/valid/schema.graphql:19:9
No documentation available.`);
  }, 10000);

  test('should get hover info for GraphQL CreateUserInput type', async () => {
    const result = await runHover(
      'tests/fixtures/graphql/valid/schema.graphql',
      'CreateUserInput'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output)
      .toBe(`Location: tests/fixtures/graphql/valid/schema.graphql:48:21
No documentation available.`);
  }, 10000);

  test('should handle symbol not found gracefully', async () => {
    const result = await runHover(
      'tests/fixtures/graphql/valid/schema.graphql',
      'NonExistentType'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);
});
