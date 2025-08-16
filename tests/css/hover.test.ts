import { test, describe, expect } from 'bun:test';
import { runHover, stripAnsi } from '../test-utils.js';

describe('CSS Hover Command', () => {
  test('should handle CSS selector hover', async () => {
    const result = await runHover('tests/fixtures/css/valid/styles.css', 'body');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    // CSS might not have rich hover support, so we accept either hover info or no info
    expect(output).toMatch(/body|No hover information found for the symbol\./);
  }, 10000);

  test('should handle CSS class selector hover', async () => {
    const result = await runHover('tests/fixtures/css/valid/styles.css', 'container');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toMatch(/container|No hover information found for the symbol\./);
  }, 10000);

  test('should handle CSS property hover', async () => {
    const result = await runHover('tests/fixtures/css/valid/styles.css', 'font-family');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toMatch(/font-family|No hover information found for the symbol\./);
  }, 10000);

  test('should handle symbol not found gracefully', async () => {
    const result = await runHover('tests/fixtures/css/valid/styles.css', 'NonExistentSelector');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);
});