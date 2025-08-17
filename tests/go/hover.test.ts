import { test, describe, expect } from 'bun:test';
import { runHover, stripAnsi } from '../test-utils.js';

describe('Go Hover Command', () => {
  test('should get hover info for function', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/main-package/simple-function.go',
      'greet'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should get hover info for variable', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/main-package/simple-function.go',
      'message'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('message');
  }, 10000);

  test('should get hover info for struct type', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'Person'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('Person');
  }, 10000);

  test('should get hover info for struct field', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'Name'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('Name');
  }, 10000);

  test('should get hover info for method', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'Greet'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('Greet');
  }, 10000);

  test('should get hover info for constructor function', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'NewPerson'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('NewPerson');
  }, 10000);

  test('should handle symbol not found gracefully', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/main-package/simple-function.go',
      'NonExistentSymbol'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);
});
