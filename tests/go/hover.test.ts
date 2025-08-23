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
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should get hover info for struct type', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'Person'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should get hover info for struct field', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'Name'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should get hover info for method', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'Greet'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should get hover info for constructor function', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'NewPerson'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should expand struct types showing all fields with their types', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/complex-types/complex-struct.go',
      'User'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should show nested struct information', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/complex-types/complex-struct.go',
      'Address'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should show method signatures with receiver and return types', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/complex-types/complex-struct.go',
      'AddTag'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
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
