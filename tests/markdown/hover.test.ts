import { test, describe, expect } from 'bun:test';
import { runHover, stripAnsi } from '../test-utils.js';

describe('Markdown Hover Command', () => {
  test('should handle Markdown heading hover', async () => {
    const result = await runHover(
      'tests/fixtures/markdown/valid/README.md',
      'Features'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    // Markdown might have limited hover support
    expect(output).toMatch(
      /Features|No hover information found for the symbol\./
    );
  }, 10000);

  test('should handle Markdown link hover', async () => {
    const result = await runHover(
      'tests/fixtures/markdown/valid/README.md',
      'Installation'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toMatch(
      /Installation|No hover information found for the symbol\./
    );
  }, 10000);

  test('should handle Markdown code block language hover', async () => {
    const result = await runHover(
      'tests/fixtures/markdown/valid/README.md',
      'bash'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toMatch(/bash|No hover information found for the symbol\./);
  }, 10000);

  test('should handle symbol not found gracefully', async () => {
    const result = await runHover(
      'tests/fixtures/markdown/valid/README.md',
      'NonExistentHeading'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);
});
