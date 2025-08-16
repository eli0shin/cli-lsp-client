# Hover Command Implementation Steps

## Overview
This document provides step-by-step instructions for implementing the hover command feature in the CLI LSP client.

## Prerequisites
- Familiarity with TypeScript and the existing codebase
- Understanding of LSP protocol (see hover-command-spec.md)
- Development environment set up with Bun

## Implementation Steps

### Step 1: Extend LSP Types (src/lsp/types.ts)

Add new type definitions for symbol and hover operations:

```typescript
// Add to types.ts
import type { 
  SymbolInformation, 
  DocumentSymbol, 
  WorkspaceSymbol,
  Hover,
  Position,
  MarkupContent 
} from "vscode-languageserver-types";

export type { 
  SymbolInformation, 
  DocumentSymbol, 
  WorkspaceSymbol,
  Hover,
  Position,
  MarkupContent 
};

export interface HoverResult {
  symbol: string;
  hover: Hover;
  location: {
    file: string;
    line: number;
    column: number;
  };
}
```

### Step 2: Add LSP Request Methods to Client (src/lsp/client.ts)

Extend the LSPClient interface and implementation with new methods:

```typescript
// In LSPClient interface, add:
searchWorkspaceSymbols(query: string): Promise<SymbolInformation[]>;
getDocumentSymbols(filePath: string): Promise<DocumentSymbol[] | SymbolInformation[]>;
getHover(filePath: string, position: Position): Promise<Hover | null>;

// In createLSPClient function, add implementations:
async searchWorkspaceSymbols(query: string): Promise<SymbolInformation[]> {
  log(`Searching workspace for symbol: ${query}`);
  try {
    const result = await connection.sendRequest("workspace/symbol", {
      query: query
    });
    return result || [];
  } catch (error) {
    log(`workspace/symbol not supported or failed: ${error}`);
    return [];
  }
},

async getDocumentSymbols(filePath: string): Promise<DocumentSymbol[] | SymbolInformation[]> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  log(`Getting document symbols for: ${absolutePath}`);
  
  // Ensure file is open
  await this.openFile(absolutePath);
  
  try {
    const result = await connection.sendRequest("textDocument/documentSymbol", {
      textDocument: {
        uri: `file://${absolutePath}`
      }
    });
    return result || [];
  } catch (error) {
    log(`documentSymbol not supported or failed: ${error}`);
    return [];
  }
},

async getHover(filePath: string, position: Position): Promise<Hover | null> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  log(`Getting hover for ${absolutePath} at ${position.line}:${position.character}`);
  
  // Ensure file is open
  await this.openFile(absolutePath);
  
  try {
    const result = await connection.sendRequest("textDocument/hover", {
      textDocument: {
        uri: `file://${absolutePath}`
      },
      position: position
    });
    return result;
  } catch (error) {
    log(`hover request failed: ${error}`);
    return null;
  }
}
```

### Step 3: Update Server Capabilities (src/lsp/servers.ts)

Ensure server initialization requests the necessary capabilities:

```typescript
// In the capabilities object of initialization, add:
capabilities: {
  // ... existing capabilities ...
  workspace: {
    symbol: {
      dynamicRegistration: false
    },
    // ... other workspace capabilities ...
  },
  textDocument: {
    // ... existing textDocument capabilities ...
    documentSymbol: {
      dynamicRegistration: false,
      hierarchicalDocumentSymbolSupport: true
    },
    hover: {
      dynamicRegistration: false,
      contentFormat: ["markdown", "plaintext"]
    }
  }
}
```

### Step 4: Implement Hover Manager Method (src/lsp/manager.ts)

Add the main hover method to LSPManager:

```typescript
async getHover(symbolName: string, filePath?: string): Promise<HoverResult[]> {
  log(`=== HOVER REQUEST START ===`);
  log(`Symbol: ${symbolName}, File: ${filePath || 'workspace'}`);
  
  const results: HoverResult[] = [];
  
  if (filePath) {
    // File-scoped search
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    
    if (!await Bun.file(absolutePath).exists()) {
      throw new Error(`File does not exist: ${absolutePath}`);
    }
    
    const applicableServers = await getApplicableServers(absolutePath);
    
    for (const server of applicableServers) {
      const root = await getProjectRoot(absolutePath, server);
      const client = await this.getOrCreateClient(server, root);
      
      if (!client) continue;
      
      // Get document symbols
      const symbols = await client.getDocumentSymbols(absolutePath);
      
      // Find matching symbol
      const matches = this.findMatchingSymbols(symbols, symbolName);
      
      // Get hover for each match
      for (const match of matches) {
        const hover = await client.getHover(absolutePath, match.position);
        if (hover) {
          results.push({
            symbol: symbolName,
            hover: hover,
            location: {
              file: absolutePath,
              line: match.position.line,
              column: match.position.character
            }
          });
        }
      }
    }
  } else {
    // Workspace-wide search
    // Get all clients (may need to warm up first)
    for (const [key, client] of this.clients) {
      const symbols = await client.searchWorkspaceSymbols(symbolName);
      
      for (const symbol of symbols) {
        const uri = new URL(symbol.location.uri);
        const filePath = uri.pathname;
        const position = symbol.location.range.start;
        
        const hover = await client.getHover(filePath, position);
        if (hover) {
          results.push({
            symbol: symbolName,
            hover: hover,
            location: {
              file: filePath,
              line: position.line,
              column: position.character
            }
          });
        }
      }
    }
  }
  
  log(`=== HOVER REQUEST COMPLETE - Found ${results.length} results ===`);
  return results;
}

// Helper method to find matching symbols
private findMatchingSymbols(symbols: DocumentSymbol[] | SymbolInformation[], query: string): Array<{position: Position}> {
  const matches: Array<{position: Position}> = [];
  
  // Handle both DocumentSymbol and SymbolInformation formats
  for (const symbol of symbols) {
    if ('location' in symbol) {
      // SymbolInformation
      if (symbol.name === query) {
        matches.push({position: symbol.location.range.start});
      }
    } else {
      // DocumentSymbol
      if (symbol.name === query) {
        matches.push({position: symbol.selectionRange.start});
      }
      // Recursively search children
      if (symbol.children) {
        matches.push(...this.findMatchingSymbols(symbol.children, query));
      }
    }
  }
  
  return matches;
}

// Helper to get or create client
private async getOrCreateClient(server: LSPServer, root: string): Promise<LSPClient | null> {
  const clientKey = this.getClientKey(server.id, root);
  
  if (this.broken.has(clientKey)) {
    return null;
  }
  
  let client = this.clients.get(clientKey);
  
  if (!client) {
    try {
      const serverHandle = await spawnServer(server, root);
      if (!serverHandle) {
        this.broken.add(clientKey);
        return null;
      }
      
      client = await createLSPClient(server.id, serverHandle, root);
      this.clients.set(clientKey, client);
    } catch (error) {
      log(`Failed to create client: ${error}`);
      this.broken.add(clientKey);
      return null;
    }
  }
  
  return client;
}
```

### Step 5: Add Hover Formatter (src/lsp/formatter.ts)

Create formatting functions for hover output:

```typescript
export function formatHoverResults(results: HoverResult[]): string {
  if (results.length === 0) {
    return "No hover information found for the symbol.";
  }
  
  const output: string[] = [];
  
  for (const result of results) {
    output.push(`${chalk.cyan('Symbol:')} ${result.symbol}`);
    output.push(`${chalk.gray('Location:')} ${result.location.file}:${result.location.line + 1}:${result.location.column + 1}`);
    output.push('');
    
    // Format hover content
    const content = formatHoverContent(result.hover);
    output.push(content);
    
    if (results.length > 1) {
      output.push(chalk.gray('─'.repeat(60)));
    }
  }
  
  return output.join('\n');
}

function formatHoverContent(hover: Hover): string {
  if (!hover.contents) {
    return "No documentation available.";
  }
  
  let content = '';
  
  if (typeof hover.contents === 'string') {
    content = hover.contents;
  } else if (Array.isArray(hover.contents)) {
    content = hover.contents.map(c => typeof c === 'string' ? c : c.value).join('\n\n');
  } else if ('kind' in hover.contents) {
    content = hover.contents.value;
  }
  
  // Simple markdown to terminal formatting
  content = content
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      return chalk.gray('```') + (lang ? chalk.yellow(lang) : '') + '\n' + 
             chalk.green(code.trim()) + '\n' + 
             chalk.gray('```');
    })
    .replace(/`([^`]+)`/g, (_, code) => chalk.green(code))
    .replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk.bold(text))
    .replace(/\*([^*]+)\*/g, (_, text) => chalk.italic(text));
  
  return content;
}
```

### Step 6: Update Daemon Handler (src/daemon.ts)

Add the hover command case:

```typescript
case 'hover':
  // Parse arguments
  let targetFile: string | undefined;
  let targetSymbol: string;
  
  if (args.length === 1) {
    // Global search: hover <symbol>
    targetSymbol = args[0];
  } else if (args.length === 2) {
    // File search: hover <file> <symbol>
    targetFile = args[0];
    targetSymbol = args[1];
  } else {
    throw new Error('hover command requires: hover <symbol> or hover <file> <symbol>');
  }
  
  const hoverResults = await lspManager.getHover(targetSymbol, targetFile);
  return hoverResults;
```

### Step 7: Update CLI Handler (src/cli.ts)

Handle hover command display:

```typescript
// In runCommand function, add special handling for hover
if (command === 'hover') {
  try {
    const result = await sendToExistingDaemon(command, commandArgs);
    
    if (Array.isArray(result)) {
      const formatted = formatHoverResults(result as HoverResult[]);
      console.log(formatted);
      process.exit(0);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
```

### Step 8: Update Help Message (src/constants.ts)

Add hover command to help text:

```typescript
export const HELP_MESSAGE = `
CLI LSP Client - Fast LSP diagnostics with background daemon

Usage:
  cli-lsp-client <command> [arguments]

Commands:
  diagnostics <file>       Get diagnostics for a file
  hover <symbol>          Get hover info for a symbol (workspace search)
  hover <file> <symbol>   Get hover info for a symbol in specific file
  status                  Show daemon status
  // ... rest of commands
  
Examples:
  cli-lsp-client hover createLSPClient
  cli-lsp-client hover src/client.ts createLSPClient
`;
```

### Step 9: Write Tests

Create test file `tests/hover.test.ts`:

```typescript
import { expect, test, describe } from "bun:test";
import { spawn } from "child_process";
import { stripAnsi } from "./test-utils";

describe("hover command", () => {
  test("should get hover info for a symbol", async () => {
    const result = await $`./cli-lsp-client hover Promise`.nothrow();
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain("Symbol: Promise");
  });
  
  test("should get hover info for file-scoped symbol", async () => {
    const result = await $`./cli-lsp-client hover tests/fixtures/example.ts testFunction`.nothrow();
    
    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain("Symbol: testFunction");
    expect(output).toContain("example.ts");
  });
  
  test("should handle symbol not found", async () => {
    const result = await $`./cli-lsp-client hover NonExistentSymbol`.nothrow();
    
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain("No hover information found");
  });
});
```

### Step 10: Build and Test

```bash
# Install dependencies if needed
bun install

# Type check
bun run typecheck

# Run tests
bun test

# Build the executable
bun run build

# Test the hover command
./cli-lsp-client hover Array
./cli-lsp-client hover src/cli.ts handleRequest
```

## Testing Checklist

- [ ] Test with TypeScript files (.ts, .tsx)
- [ ] Test with JavaScript files (.js, .jsx)
- [ ] Test with Python files (.py)
- [ ] Test workspace-wide symbol search
- [ ] Test file-scoped symbol search
- [ ] Test with symbols that don't exist
- [ ] Test with multiple matches
- [ ] Test formatting of different hover content types
- [ ] Test with different LSP servers
- [ ] Verify performance with large workspaces

## Troubleshooting

### Common Issues

1. **"workspace/symbol not supported"**
   - Some LSP servers don't support workspace-wide symbol search
   - Solution: Use file-scoped search or implement fallback

2. **Empty hover results**
   - Symbol might be in a file not yet indexed
   - Solution: Run warmup command first

3. **Timeout errors**
   - Large workspace taking too long to search
   - Solution: Use file-scoped search or increase timeout

4. **Markdown formatting issues**
   - Complex markdown not rendering correctly
   - Solution: Enhance markdown parser or use a library

## Next Steps

After basic implementation:
1. Add fuzzy matching for symbol names
2. Implement caching for faster repeated searches
3. Add support for partial symbol names
4. Create interactive mode for multiple matches
5. Add syntax highlighting for code blocks

## Notes

- The implementation should be incremental - start with basic functionality and enhance
- Ensure backward compatibility with existing commands
- Follow existing code patterns and style
- Add appropriate logging for debugging
- Consider performance implications for large codebases