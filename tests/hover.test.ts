import { test, describe, expect } from 'bun:test';
import { runHover, runCommandWithArgs, stripAnsi } from './test-utils.js';

describe('Hover Command', () => {
  test('should get hover info for file-scoped symbol', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/simple-function.ts',
      'add'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    expect(output)
      .toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:7:17
\`\`\`typescript
function add(a: number, b: number): number
\`\`\`
Adds two numbers together

@param a — The first number  

@param b — The second number  

@returns — The sum of a and b`);
  }, 10000); // 10 second timeout for LSP operations

  test('should get hover info for another symbol in same file', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/simple-function.ts',
      'greet'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    expect(output)
      .toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:16:17
\`\`\`typescript
function greet(name: string): string
\`\`\`
Greets a person by name

@param name — The name of the person to greet  

@returns — A greeting message`);
  }, 10000);

  test('should handle symbol not found gracefully', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/simple-function.ts',
      'NonExistentSymbol'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should handle file not found error', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/nonexistent.ts',
      'add'
    );

    expect(result.exitCode).toBe(1);
    const errorOutput = stripAnsi(result.stderr);
    expect(errorOutput).toBe(
      'File does not exist: tests/fixtures/typescript/nonexistent.ts'
    );
  }, 10000);

  test('should validate required arguments - missing symbol', async () => {
    // Test with only file argument (missing symbol)
    const result = await runCommandWithArgs([
      'hover',
      'tests/fixtures/typescript/valid/simple-function.ts',
    ]);

    expect(result.exitCode).toBe(1);
    const errorOutput = stripAnsi(result.stderr);
    expect(errorOutput).toBe('hover command requires: hover <file> <symbol>');
  }, 10000);

  test('should validate required arguments - no arguments', async () => {
    // Test with no arguments
    const result = await runCommandWithArgs(['hover']);

    expect(result.exitCode).toBe(1);
    const errorOutput = stripAnsi(result.stderr);
    expect(errorOutput).toBe('hover command requires: hover <file> <symbol>');
  }, 10000);

  test('should get hover info for imported symbols', async () => {
    // Test with HoverResult which is imported in import-example.ts
    const result = await runHover('tests/fixtures/typescript/valid/import-example.ts', 'HoverResult');

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // When hovering over an import, we get deduplicated results showing multiple locations for same content
    expect(output).toBe(`Location: tests/fixtures/typescript/valid/import-example.ts:1:10
Location: tests/fixtures/typescript/valid/import-example.ts:3:38
\`\`\`typescript
(alias) type HoverResult = {
    symbol: string;
    hover: string;
    location: {
        file: string;
        line: number;
        column: number;
    };
}
import HoverResult
\`\`\`

Type Definition: tests/fixtures/typescript/valid/types.ts:1:13
\`\`\`typescript
type HoverResult = {
    symbol: string;
    hover: string;
    location: {
        file: string;
        line: number;
        column: number;
    };
}
\`\`\``);
    expect(result.exitCode).toBe(0);
  }, 10000);

  test('should get hover info for imported types', async () => {
    // Test with Diagnostic which is also imported
    const result = await runHover('src/lsp/formatter.ts', 'Diagnostic');

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // When hovering over an import, we get deduplicated results showing multiple locations for same content
    expect(output).toBe(`Location: src/lsp/formatter.ts:2:15
Location: src/lsp/formatter.ts:20:39
Location: src/lsp/formatter.ts:20:54
Location: src/lsp/formatter.ts:50:16
Location: src/lsp/formatter.ts:83:16
\`\`\`typescript
(alias) type Diagnostic = Diagnostic
import Diagnostic
\`\`\`

Type Definition: src/lsp/types.ts:24:13
\`\`\`typescript
type Diagnostic = VSCodeDiagnostic
\`\`\``);
    expect(result.exitCode).toBe(0);
  }, 10000);

  test('should get hover info for async function with JSDoc', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/simple-function.ts',
      'fetchData'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    expect(output)
      .toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:26:23
\`\`\`typescript
function fetchData(): Promise<string>
\`\`\`
Fetches data asynchronously from a remote source

@returns — A promise that resolves to a string containing the fetched data`);
  }, 10000);

  test('should get hover info for variable with interface type', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/simple-function.ts',
      'myUser'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // Now shows both type definition and variable declaration
    expect(output).toBe(`Type Definition: tests/fixtures/typescript/valid/simple-function.ts:35:18
\`\`\`typescript
interface User
\`\`\`

Location: tests/fixtures/typescript/valid/simple-function.ts:42:14
\`\`\`typescript
const myUser: User
\`\`\``);
  }, 10000);

  test('should get hover info for variable with type alias', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/simple-function.ts',
      'userId'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // For variables with type aliases, we show the resolved type (string, not UserID)
    expect(output)
      .toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:49:14
\`\`\`typescript
const userId: string
\`\`\``);
  }, 10000);

  test('should get hover info for type alias itself', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/simple-function.ts',
      'UserID'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    expect(output)
      .toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:31:13
\`\`\`typescript
type UserID = string
\`\`\``);
  }, 10000);

  test('should get hover info for interface', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/simple-function.ts',
      'User'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // When hovering on interface definition itself, shows single location
    expect(output).toContain('Location: tests/fixtures/typescript/valid/simple-function.ts:35:18');
    expect(output).toContain('interface User');
  }, 10000);

  test('should get hover info for variable with inferred type', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/simple-function.ts',
      'config'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // Should show the const declaration with inferred type
    expect(output)
      .toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:52:14
\`\`\`typescript
const config: {
    apiUrl: string;
    timeout: number;
}
\`\`\``);
  }, 10000);

  test('should expand interface properties instead of showing just interface name', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/interface-expansion.ts',
      'Person'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // Now shows interface with JSDoc comment but no source parsing expansion
    expect(output)
      .toBe(`Location: tests/fixtures/typescript/valid/interface-expansion.ts:6:11
\`\`\`typescript
interface Person
\`\`\`
A person with various properties to test type expansion`);
  }, 10000);

  test('should handle large truncated types by showing full structure', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/truncated-type.ts',
      'ServerCapabilities'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // TypeScript LSP server truncates very large types with "... N more ..."
    // This is a limitation of the TypeScript language server itself
    expect(output)
      .toBe(`Location: tests/fixtures/typescript/valid/truncated-type.ts:6:6
\`\`\`typescript
type ServerCapabilities = {
    textDocumentSync?: number | {
        openClose?: boolean;
        change?: number;
        willSave?: boolean;
        willSaveWaitUntil?: boolean;
        save?: boolean | {
            includeText?: boolean;
        };
    };
    diagnosticProvider?: boolean | {
        interFileDependencies?: boolean;
        workspaceDiagnostics?: boolean;
        workDoneProgress?: boolean;
    };
    completionProvider?: {
        triggerCharacters?: string[];
        allCommitCharacters?: string[];
        resolveProvider?: boolean;
        completionItem?: {
            labelDetailsSupport?: boolean;
        };
    };
    hoverProvider?: boolean | {
        workDoneProgress?: boolean;
    };
    signatureHelpProvider?: {
        triggerCharacters?: string[];
        retriggerCharacters?: string[];
        workDoneProgress?: boolean;
    };
    definitionProvider?: boolean | {
        workDoneProgress?: boolean;
    };
    typeDefinitionProvider?: boolean | {
        workDoneProgress?: boolean;
    };
    implementationProvider?: boolean | {
        workDoneProgress?: boolean;
    };
    referencesProvider?: boolean | {
        workDoneProgress?: boolean;
    };
    documentHighlightProvider?: boolean | {
        workDoneProgress?: boolean;
    };
    documentSymbolProvider?: boolean | {
        workDoneProgress?: boolean;
        label?: string;
    };
    codeActionProvider?: boolean | {
        codeActionKinds?: string[];
        workDoneProgress?: boolean;
        resolveProvider?: boolean;
    };
    codeLensProvider?: {
        resolveProvider?: boolean;
        workDoneProgress?: boolean;
    };
    documentLinkProvider?: {
        resolveProvider?: boolean;
        workDoneProgress?: boolean;
    };
    colorProvider?: boolean | {
        workDoneProgress?: boolean;
    };
    documentFormattingProvider?: boolean | {
        workDoneProgress?: boolean;
    };
    documentRangeFormattingProvider?: boolean | {
        workDoneProgress?: boolean;
    };
    renameProvider?: boolean | {
        prepareProvider?: boolean;
        workDoneProgress?: boolean;
    };
    foldingRangeProvider?: boolean | {
        workDoneProgress?: boolean;
    };
    selectionRangeProvider?: boolean | {
        workDoneProgress?: boolean;
    };
    executeCommandProvider?: {
        commands: string[];
        workDoneProgress?: boolean;
    };
    workspace?: {
        workspaceFolders?: {
            supported?: boolean;
            changeNotifications?: string | boolean;
        };
        fileOperations?: {
            didCreate?: {
                filters: Array<{
                    glob: string;
                    matches?: string;
                }>;
            };
            willCreate?: {
                filters: Array<{
                    glob: string;
                    matches?: string;
                }>;
            };
            didRename?: {
                filters: Array<{
                    glob: string;
                    matches?: string;
                }>;
            };
            willRename?: {
                filters: Array<{
                    glob: string;
                    matches?: string;
                }>;
            };
            didDelete?: {
                filters: Array<{
                    glob: string;
                    matches?: string;
                }>;
            };
            willDelete?: {
                filters: Array<{
                    glob: string;
                    matches?: string;
                }>;
            };
        };
    };
}
\`\`\`
A large type that might get truncated by the language server`);
  }, 10000);

  test('should get hover info for variable with imported type', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/simple-function.ts',
      'myPromise'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // For variables with Promise type, should show both declaration and Promise interface
    expect(output).toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:58:14
\`\`\`typescript
const myPromise: Promise<number>
\`\`\`

Type Definition: node_modules/typescript/lib/lib.es5.d.ts:1550:11
\`\`\`typescript
interface Promise<T>
\`\`\`
Represents the completion of an asynchronous operation`);
  }, 10000);

  test('should get hover info for function with type alias return', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/simple-function.ts',
      'getUserId'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // Should show function signature, not the return type definition
    expect(output)
      .toBe(`Location: tests/fixtures/typescript/valid/simple-function.ts:61:17
\`\`\`typescript
function getUserId(): UserID
\`\`\``);
  }, 10000);

  test('should return all matching symbols with the same name in a file', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/duplicate-symbols.ts',
      'greet'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);

    // Expect two precise hover blocks separated by a blank line
    const expected = `Location: tests/fixtures/typescript/valid/duplicate-symbols.ts:4:3
\`\`\`typescript
(method) GreeterA.greet(name: string): string
\`\`\`

Location: tests/fixtures/typescript/valid/duplicate-symbols.ts:10:3
\`\`\`typescript
(method) GreeterB.greet(name: string): string
\`\`\``;
    expect(output).toBe(expected);
  }, 20000);

  test('should show correct hover styles for different result variable types', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/multi-result-types.ts',
      'result'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);

    const expected = `Location: tests/fixtures/typescript/valid/multi-result-types.ts:2:9
\`\`\`typescript
const result: "hello"
\`\`\`

Location: tests/fixtures/typescript/valid/multi-result-types.ts:7:9
\`\`\`typescript
const result: {
    a: number;
    b: string;
}
\`\`\`

Location: tests/fixtures/typescript/valid/multi-result-types.ts:15:9
\`\`\`typescript
const result: {
    readonly a: 1;
    readonly b: "y";
    readonly nested: {
        readonly flag: true;
    };
}
\`\`\``;

    expect(output).toBe(expected);
  }, 20000);

  test('should get hover info for strCase function', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/multi-result-types.ts',
      'strCase'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    expect(output)
      .toBe(`Location: tests/fixtures/typescript/valid/multi-result-types.ts:1:17
\`\`\`typescript
function strCase(): string
\`\`\``);
  }, 10000);

  test('should get hover info for objCase function', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/multi-result-types.ts',
      'objCase'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    expect(output)
      .toBe(`Location: tests/fixtures/typescript/valid/multi-result-types.ts:6:17
\`\`\`typescript
function objCase(): {
    a: number;
    b: string;
}
\`\`\``);
  }, 10000);

  test('should get hover info for objConstCase function', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/valid/multi-result-types.ts',
      'objConstCase'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    expect(output)
      .toBe(`Location: tests/fixtures/typescript/valid/multi-result-types.ts:14:17
\`\`\`typescript
function objConstCase(): {
    readonly a: 1;
    readonly b: "y";
    readonly nested: {
        readonly flag: true;
    };
}
\`\`\``);
  }, 10000);

  test('should get enhanced hover info for complex class with complete structure', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/enhanced-hover/complex-api.ts',
      'APIServer'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    expect(output).toBe(`Location: tests/fixtures/typescript/enhanced-hover/complex-api.ts:30:14
\`\`\`typescript
class APIServer<TContext = unknown>
\`\`\`
A complex API server class with various method signatures
to test the enhanced hover parsing capabilities.`);
  }, 10000);

  test('should get dual hover info for class instance variable', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/enhanced-hover/complex-api.ts',
      'serverInstance'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // Should show both type definition and variable declaration
    expect(output).toBe(`Type Definition: tests/fixtures/typescript/enhanced-hover/complex-api.ts:30:14
\`\`\`typescript
class APIServer<TContext = unknown>
\`\`\`
A complex API server class with various method signatures
to test the enhanced hover parsing capabilities.

Location: tests/fixtures/typescript/enhanced-hover/complex-api.ts:139:7
\`\`\`typescript
const serverInstance: APIServer<string>
\`\`\``);
  }, 10000);

  test('should get dual hover info for variable with JSDoc', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/enhanced-hover/complex-api.ts',
      'productionServer'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // Should show both type definition and variable declaration with JSDoc
    expect(output).toBe(`Type Definition: tests/fixtures/typescript/enhanced-hover/complex-api.ts:30:14
\`\`\`typescript
class APIServer<TContext = unknown>
\`\`\`
A complex API server class with various method signatures
to test the enhanced hover parsing capabilities.

Location: tests/fixtures/typescript/enhanced-hover/complex-api.ts:144:7
\`\`\`typescript
const productionServer: APIServer<{
    env: string;
}>
\`\`\`
Another instance with complex configuration for testing hover on instances`);
  }, 10000);

  test('should get hover info for method with JSDoc', async () => {
    const result = await runHover(
      'tests/fixtures/typescript/enhanced-hover/complex-api.ts',
      'registerRoute'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout);
    // Should show method signature with JSDoc
    expect(output).toContain('Location: tests/fixtures/typescript/enhanced-hover/complex-api.ts:73:3');
    expect(output).toContain('(method) APIServer');
    expect(output).toContain('registerRoute');
    expect(output).toContain('Registers a route handler with complex configuration object');
  }, 10000);
});
