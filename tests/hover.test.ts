import { test, describe, expect } from 'bun:test';
import { runHover, runCommandWithArgs, stripAnsi } from './test-utils.js';

describe('Hover Command', () => {
  test('should get hover info for file-scoped symbol', async () => {
    const result = await runHover('tests/fixtures/typescript/valid/simple-function.ts', 'add');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    expect(output).toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:7:17
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
    const output = stripAnsi(result.stdout);
    expect(output).toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:16:17
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
    const output = stripAnsi(result.stdout);
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should handle file not found error', async () => {
    const result = await runHover('tests/fixtures/typescript/nonexistent.ts', 'add');
    
    expect(result.exitCode).toBe(1);
    const errorOutput = stripAnsi(result.stderr);
    expect(errorOutput).toBe('Error communicating with daemon: File does not exist: /Users/elioshinsky/code/lspcli/tests/fixtures/typescript/nonexistent.ts');
  }, 10000);

  test('should validate required arguments - missing symbol', async () => {
    // Test with only file argument (missing symbol)
    const result = await runCommandWithArgs(['hover', 'tests/fixtures/typescript/valid/simple-function.ts']);
    
    expect(result.exitCode).toBe(1);
    const errorOutput = stripAnsi(result.stderr);
    expect(errorOutput).toBe('Error communicating with daemon: hover command requires: hover <file> <symbol>');
  }, 10000);

  test('should validate required arguments - no arguments', async () => {
    // Test with no arguments
    const result = await runCommandWithArgs(['hover']);
    
    expect(result.exitCode).toBe(1);
    const errorOutput = stripAnsi(result.stderr);
    expect(errorOutput).toBe('Error communicating with daemon: hover command requires: hover <file> <symbol>');
  }, 10000);

  test('should get hover info for imported symbols', async () => {
    // Test with HoverResult which is imported in formatter.ts
    const result = await runHover('src/lsp/formatter.ts', 'HoverResult');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // When hovering over an import, we follow to the actual type definition
    expect(output).toBe(`Location: src/lsp/types.ts:48:13
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
    const output = stripAnsi(result.stdout);
    // When hovering over an import, we follow to the actual type definition
    expect(output).toBe(`Location: src/lsp/types.ts:15:13
\`\`\`typescript
type Diagnostic = VSCodeDiagnostic
\`\`\``);
  }, 10000);

  test('should get hover info for async function with JSDoc', async () => {
    const result = await runHover('tests/fixtures/typescript/valid/simple-function.ts', 'fetchData');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    expect(output).toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:26:23
\`\`\`typescript
function fetchData(): Promise<string>
\`\`\`
Fetches data asynchronously from a remote source

@returns — A promise that resolves to a string containing the fetched data`);
  }, 10000);

  test('should get hover info for variable with interface type', async () => {
    const result = await runHover('tests/fixtures/typescript/valid/simple-function.ts', 'myUser');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // For variables, we expect to see the interface definition
    expect(output).toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:35:18
\`\`\`typescript
interface User
\`\`\``);
  }, 10000);

  test('should get hover info for variable with type alias', async () => {
    const result = await runHover('tests/fixtures/typescript/valid/simple-function.ts', 'userId');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // For variables with type aliases, we show the resolved type (string, not UserID)
    expect(output).toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:49:14
\`\`\`typescript
const userId: string
\`\`\``);
  }, 10000);

  test('should get hover info for type alias itself', async () => {
    const result = await runHover('tests/fixtures/typescript/valid/simple-function.ts', 'UserID');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    expect(output).toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:31:13
\`\`\`typescript
type UserID = string
\`\`\``);
  }, 10000);

  test('should get hover info for interface', async () => {
    const result = await runHover('tests/fixtures/typescript/valid/simple-function.ts', 'User');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    expect(output).toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:35:18
\`\`\`typescript
interface User
\`\`\``);
  }, 10000);

  test('should get hover info for variable with inferred type', async () => {
    const result = await runHover('tests/fixtures/typescript/valid/simple-function.ts', 'config');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // Should show the const declaration with inferred type
    expect(output).toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:52:14
\`\`\`typescript
const config: {
    apiUrl: string;
    timeout: number;
}
\`\`\``);
  }, 10000);

  test('should get hover info for variable with imported type', async () => {
    const result = await runHover('tests/fixtures/typescript/valid/simple-function.ts', 'myPromise');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // For variables with Promise type, should show Promise interface
    expect(output).toBe(`Location: node_modules/typescript/lib/lib.es5.d.ts:1550:11
\`\`\`typescript
interface Promise<T>
\`\`\`
Represents the completion of an asynchronous operation`);
  }, 10000);

  test('should get hover info for function with type alias return', async () => {
    const result = await runHover('tests/fixtures/typescript/valid/simple-function.ts', 'getUserId');
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // Should show function signature, not the return type definition
    expect(output).toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:61:17
\`\`\`typescript
function getUserId(): UserID
\`\`\``);
  }, 10000);
});