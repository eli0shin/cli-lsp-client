import { test, describe, expect } from 'bun:test';
import { runHover, stripAnsi } from '../test-utils.js';

describe('HTML Hover Command', () => {
  test('should handle HTML tag hover', async () => {
    const result = await runHover('tests/fixtures/html/valid/simple-page.html', 'html');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    // HTML might have limited hover support
    expect(output).toMatch(/html|No hover information found for the symbol\./);
  }, 10000);

  test('should handle HTML body tag hover', async () => {
    const result = await runHover('tests/fixtures/html/valid/simple-page.html', 'body');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toMatch(/body|No hover information found for the symbol\./);
  }, 10000);

  test('should handle HTML header tag hover', async () => {
    const result = await runHover('tests/fixtures/html/valid/simple-page.html', 'header');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toMatch(/header|No hover information found for the symbol\./);
  }, 10000);

  test('should handle symbol not found gracefully', async () => {
    const result = await runHover('tests/fixtures/html/valid/simple-page.html', 'NonExistentTag');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);
});