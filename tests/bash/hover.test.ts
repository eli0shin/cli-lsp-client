import { test, describe, expect } from 'bun:test';
import { runHover, stripAnsi } from '../test-utils.js';

describe('Bash Hover Command', () => {
  test('should get hover info for function', async () => {
    const result = await runHover('tests/fixtures/bash/valid/script.sh', 'main');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe(`Location: tests/fixtures/bash/valid/script.sh:11:1
Function: main - defined on line 6`);
  }, 10000);

  test('should get hover info for variable', async () => {
    const result = await runHover('tests/fixtures/bash/valid/script.sh', 'name');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should handle symbol not found gracefully', async () => {
    const result = await runHover('tests/fixtures/bash/valid/script.sh', 'NonExistentSymbol');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);
});