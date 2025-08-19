import { test, describe, expect } from 'bun:test';
import { runHover, stripAnsi } from '../test-utils.js';

describe('Python Hover Command', () => {
  test('should get hover info for function with type hints', async () => {
    const result = await runHover(
      'tests/fixtures/python/valid/simple-module.py',
      'add'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output)
      .toBe(`Location: tests/fixtures/python/valid/simple-module.py:1:5
\`\`\`python
(function) def add(
    a: int,
    b: int
) -> int
\`\`\`
---
Add two numbers together.`);
  }, 10000);

  test('should get hover info for function with docstring', async () => {
    const result = await runHover(
      'tests/fixtures/python/valid/simple-module.py',
      'greet'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output)
      .toBe(`Location: tests/fixtures/python/valid/simple-module.py:5:5
\`\`\`python
(function) def greet(name: str) -> str
\`\`\`
---
Greet a person by name.`);
  }, 10000);

  test('should get hover info for variable', async () => {
    const result = await runHover(
      'tests/fixtures/python/valid/simple-module.py',
      'PI'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toMatch(/Location: .*\.lsp-cli-client\/packages\/node_modules\/pyright\/dist\/typeshed-fallback\/stdlib\/builtins\.pyi:353:7\n```python\n\(class\) float\n```/);
  }, 10000);

  test('should get hover info for class', async () => {
    const result = await runHover(
      'tests/fixtures/python/valid/class-example.py',
      'Calculator'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('Calculator');
  }, 10000);

  test('should get hover info for class method', async () => {
    const result = await runHover(
      'tests/fixtures/python/valid/class-example.py',
      'add'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('add');
  }, 10000);

  test('should handle symbol not found gracefully', async () => {
    const result = await runHover(
      'tests/fixtures/python/valid/simple-module.py',
      'NonExistentSymbol'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);
});
