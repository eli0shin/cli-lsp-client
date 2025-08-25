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
      .toBe(`Declaration: tests/fixtures/python/valid/simple-module.py:1:5
\`\`\`python
(function) def add(
    a: int,
    b: int
) -> int
\`\`\`
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
      .toBe(`Declaration: tests/fixtures/python/valid/simple-module.py:5:5
\`\`\`python
(function) def greet(name: str) -> str
\`\`\`
Greet a person by name.`);
  }, 10000);

  test('should get hover info for variable', async () => {
    const result = await runHover(
      'tests/fixtures/python/valid/simple-module.py',
      'PI'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toMatch(/Declaration: tests\/fixtures\/python\/valid\/simple-module\.py:9:1\n```python\n\(constant\) PI: float\n```\n\nType Definition: .*\.lsp-cli-client\/packages\/node_modules\/pyright\/dist\/typeshed-fallback\/stdlib\/builtins\.pyi:35[34]:7\n```python\n\(class\) float\n```/);
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

  test('should expand class with type annotations showing actual types', async () => {
    const result = await runHover(
      'tests/fixtures/python/valid/class-with-types.py',
      'Person'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    // Python shows class but not full expansion like TypeScript interfaces
    expect(output)
      .toBe(`Type Definition: tests/fixtures/python/valid/class-with-types.py:6:7
\`\`\`python
(class) Person
\`\`\`
A person with various attributes for testing type expansion`);
  }, 10000);

  test('should show complex method signatures with type hints', async () => {
    const result = await runHover(
      'tests/fixtures/python/valid/class-with-types.py',
      'process_batch'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    // Should show the method with full type signature
    expect(output)
      .toBe(`Declaration: tests/fixtures/python/valid/class-with-types.py:37:9
\`\`\`python
(method) def process_batch(
    self: Self@DataProcessor,
    items: List[Dict[str, Any]],
    filter_func: ((Dict[str, Any]) -> bool) | None = None
) -> List[Dict[str, Any]]
\`\`\`
Process a batch of items with optional filtering`);
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
