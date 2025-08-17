import { test, describe, expect } from 'bun:test';
import { runHover, stripAnsi } from '../test-utils.js';

describe('Lua Hover Command', () => {
  test('should get hover info for function', async () => {
    const result = await runHover(
      'tests/fixtures/lua/valid/simple-module.lua',
      'greet'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('greet');
  }, 10000);

  test('should get hover info for calculate function', async () => {
    const result = await runHover(
      'tests/fixtures/lua/valid/simple-module.lua',
      'calculate'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('calculate');
  }, 10000);

  test('should get hover info for transform function', async () => {
    const result = await runHover(
      'tests/fixtures/lua/valid/simple-module.lua',
      'transform'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('transform');
  }, 10000);

  test('should get hover info for config table', async () => {
    const result = await runHover(
      'tests/fixtures/lua/valid/simple-module.lua',
      'config'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('config');
  }, 10000);

  test('should get hover info for Person constructor', async () => {
    const result = await runHover(
      'tests/fixtures/lua/valid/class-example.lua',
      'Person'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should get hover info for method', async () => {
    const result = await runHover(
      'tests/fixtures/lua/valid/class-example.lua',
      'introduce'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('introduce');
  }, 10000);

  test('should handle symbol not found gracefully', async () => {
    const result = await runHover(
      'tests/fixtures/lua/valid/simple-module.lua',
      'NonExistentSymbol'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);
});
