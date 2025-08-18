import { test, describe, expect } from 'bun:test';
import { runHover, stripAnsi } from '../test-utils.js';

describe('JSON Hover Command', () => {
  test('should get hover info for package.json name field with schema', async () => {
    const result = await runHover(
      'tests/fixtures/json/valid/package-with-schema.json',
      'name'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output)
      .toBe(`Location: tests/fixtures/json/valid/package-with-schema.json:3:4
The name of the package\\.`);
  }, 10000);

  test('should get hover info for package.json description field with schema', async () => {
    const result = await runHover(
      'tests/fixtures/json/valid/package-with-schema.json',
      'description'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output)
      .toBe(`Location: tests/fixtures/json/valid/package-with-schema.json:5:4
This helps people discover your package, as it's listed in 'npm search'\\.`);
  }, 10000);

  test('should get hover info for package.json scripts field with schema', async () => {
    const result = await runHover(
      'tests/fixtures/json/valid/package-with-schema.json',
      'scripts'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('scripts');
    expect(output).toContain(
      'Location: tests/fixtures/json/valid/package-with-schema.json'
    );
  }, 10000);

  test('should get hover info for tsconfig.json target field with schema', async () => {
    const result = await runHover(
      'tests/fixtures/json/valid/tsconfig-with-schema.json',
      'target'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output)
      .toBe(`Location: tests/fixtures/json/valid/tsconfig-with-schema.json:4:6
Set the JavaScript language version for emitted JavaScript and include compatible library declarations.

See more: https://www.typescriptlang.org/tsconfig#target`);
  }, 10000);

  test('should get hover info for tsconfig.json strict field with schema', async () => {
    const result = await runHover(
      'tests/fixtures/json/valid/tsconfig-with-schema.json',
      'strict'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output)
      .toBe(`Location: tests/fixtures/json/valid/tsconfig-with-schema.json:7:6
Enable all strict type checking options.

See more: https://www.typescriptlang.org/tsconfig#strict`);
  }, 10000);

  test('should handle JSON without schema gracefully', async () => {
    const result = await runHover(
      'tests/fixtures/json/valid/test-package.json',
      'name'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    // Without schema, JSON LSP might not provide hover info
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should handle symbol not found gracefully', async () => {
    const result = await runHover(
      'tests/fixtures/json/valid/package-with-schema.json',
      'NonExistentProperty'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);
});
