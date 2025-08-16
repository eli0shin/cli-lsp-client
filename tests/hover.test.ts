import { test, describe, expect } from 'bun:test';
import { $ } from 'bun';
import { runHover, stripAnsi } from './test-utils.js';

describe('Hover Command', () => {
  test('should get hover info for file-scoped symbol', async () => {
    const result = await runHover('tests/fixtures/typescript/valid/simple-function.ts', 'add');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe(`Location: /Users/elioshinsky/code/lspcli/tests/fixtures/typescript/valid/simple-function.ts:7:17
\`\`\`typescript
function add(a: number, b: number): number
\`\`\`
Adds two numbers together

@param a — The first number  

@param b — The second number  

@returns — The sum of a and b`);
  }, 10000); // 10 second timeout for LSP operations

  test('should get hover info for another symbol in same file', async () => {
    const result = await runHover('tests/fixtures/typescript/valid/simple-function.ts', 'greet');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe(`Location: /Users/elioshinsky/code/lspcli/tests/fixtures/typescript/valid/simple-function.ts:16:17
\`\`\`typescript
function greet(name: string): string
\`\`\`
Greets a person by name

@param name — The name of the person to greet  

@returns — A greeting message`);
  }, 10000);

  test('should handle symbol not found gracefully', async () => {
    const result = await runHover('tests/fixtures/typescript/valid/simple-function.ts', 'NonExistentSymbol');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should handle file not found error', async () => {
    const result = await runHover('tests/fixtures/typescript/nonexistent.ts', 'add');
    
    expect(result.exitCode).toBe(1);
    const errorOutput = stripAnsi(result.stderr.toString());
    expect(errorOutput).toContain('File does not exist');
  }, 10000);

  test('should validate required arguments - missing symbol', async () => {
    // Test with only file argument (missing symbol)
    const result = await $`./cli-lsp-client hover tests/fixtures/typescript/valid/simple-function.ts`.nothrow();
    
    expect(result.exitCode).toBe(1);
    const errorOutput = stripAnsi(result.stderr.toString());
    expect(errorOutput).toContain('hover command requires: hover <file> <symbol>');
  }, 10000);

  test('should validate required arguments - no arguments', async () => {
    // Test with no arguments
    const result = await $`./cli-lsp-client hover`.nothrow();
    
    expect(result.exitCode).toBe(1);
    const errorOutput = stripAnsi(result.stderr.toString());
    expect(errorOutput).toContain('hover command requires: hover <file> <symbol>');
  }, 10000);

  test('should get hover info for imported symbols', async () => {
    // Test with HoverResult which is imported in formatter.ts
    const result = await runHover('src/lsp/formatter.ts', 'HoverResult');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe(`Location: /Users/elioshinsky/code/lspcli/src/lsp/types.ts:47:13
\`\`\`typescript
type HoverResult = {
    symbol: string;
    hover: Hover;
    location: {
        file: string;
        line: number;
        column: number;
    };
}
\`\`\``);
  }, 10000);

  test('should get hover info for imported types', async () => {
    // Test with Diagnostic which is also imported
    const result = await runHover('src/lsp/formatter.ts', 'Diagnostic');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe(`Location: /Users/elioshinsky/code/lspcli/src/lsp/types.ts:14:13
\`\`\`typescript
type Diagnostic = VSCodeDiagnostic
\`\`\``);
  }, 10000);
});