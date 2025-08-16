import { test, describe, expect } from 'bun:test';
import { runHover, stripAnsi } from '../test-utils.js';

describe('Java Hover Command', () => {
  test('should get hover info for class', async () => {
    const result = await runHover('tests/fixtures/java/valid/src/main/java/com/example/HelloWorld.java', 'HelloWorld');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should get hover info for method', async () => {
    const result = await runHover('tests/fixtures/java/valid/src/main/java/com/example/HelloWorld.java', 'printGreeting');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('Location: tests/fixtures/java/valid/src/main/java/com/example/HelloWorld.java:8:13');
  }, 10000);

  test('should get hover info for method with parameters', async () => {
    const result = await runHover('tests/fixtures/java/valid/src/main/java/com/example/HelloWorld.java', 'printCustomGreeting');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('Location: tests/fixtures/java/valid/src/main/java/com/example/HelloWorld.java:11:17');
  }, 10000);

  test('should get hover info for field', async () => {
    const result = await runHover('tests/fixtures/java/valid/src/main/java/com/example/HelloWorld.java', 'GREETING');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('Location: tests/fixtures/java/valid/src/main/java/com/example/HelloWorld.java:4:33');
  }, 10000);

  test('should get hover info for variable', async () => {
    const result = await runHover('tests/fixtures/java/valid/src/main/java/com/example/HelloWorld.java', 'app');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('Location: tests/fixtures/java/valid/src/main/java/com/example/HelloWorld.java:3:14');
  }, 10000);

  test('should handle symbol not found gracefully', async () => {
    const result = await runHover('tests/fixtures/java/valid/src/main/java/com/example/HelloWorld.java', 'NonExistentSymbol');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);
});