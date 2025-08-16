# Technical Specification: Hover Command for CLI LSP Client

## Overview

Add a new `hover` command to the CLI LSP client that retrieves hover information for symbols. The command accepts a symbol name (function, variable, method, class, etc.) and optionally a file path to scope the search.

## Command Syntax

```bash
# Global symbol search across workspace
cli-lsp-client hover <symbol_name>

# File-scoped symbol search
cli-lsp-client hover <file_path> <symbol_name>

# Examples
cli-lsp-client hover createLSPClient
cli-lsp-client hover src/lsp/client.ts createLSPClient
```

## Architecture

### 1. Command Flow

```
User Input → CLI → Daemon → LSP Manager → LSP Client → LSP Server
                                                     ↓
                                              Symbol Search
                                                     ↓
                                             Get Symbol Location
                                                     ↓
                                              Request Hover
                                                     ↓
User Output ← Formatter ← Daemon ← LSP Manager ← Hover Response
```

### 2. Implementation Modes

#### Mode 1: Global Symbol Search
- Uses `workspace/symbol` LSP request
- Searches across entire workspace/project
- May return multiple matches if symbol exists in multiple locations
- Falls back to file-by-file search if workspace/symbol not supported

#### Mode 2: File-Scoped Symbol Search
- Uses `textDocument/documentSymbol` LSP request
- Searches only within specified file
- More precise and faster than global search
- Requires file to be opened in LSP server first

## LSP Protocol Implementation

### New LSP Requests to Implement

#### 1. workspace/symbol Request

**Request:**
```typescript
interface WorkspaceSymbolParams {
  query: string; // The symbol name to search for
}
```

**Response:**
```typescript
SymbolInformation[] | WorkspaceSymbol[] | null

interface SymbolInformation {
  name: string;
  kind: SymbolKind;
  location: Location;
  containerName?: string;
}

interface Location {
  uri: string;
  range: Range;
}
```

#### 2. textDocument/documentSymbol Request

**Request:**
```typescript
interface DocumentSymbolParams {
  textDocument: TextDocumentIdentifier;
}
```

**Response:**
```typescript
DocumentSymbol[] | SymbolInformation[] | null

interface DocumentSymbol {
  name: string;
  kind: SymbolKind;
  range: Range;
  selectionRange: Range;
  children?: DocumentSymbol[];
}
```

#### 3. textDocument/hover Request (Already Researched)

**Request:**
```typescript
interface HoverParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}
```

**Response:**
```typescript
interface Hover {
  contents: MarkupContent | MarkedString | MarkedString[];
  range?: Range;
}

interface MarkupContent {
  kind: 'plaintext' | 'markdown';
  value: string;
}
```

## Key Implementation Points

### 1. LSP Client Extensions (`src/lsp/client.ts`)

Add new methods to the LSPClient interface and implementation:

```typescript
interface LSPClient {
  // Existing methods...
  
  // New methods for hover feature
  searchWorkspaceSymbols(query: string): Promise<SymbolInformation[]>;
  getDocumentSymbols(filePath: string): Promise<DocumentSymbol[] | SymbolInformation[]>;
  getHover(filePath: string, position: Position): Promise<Hover | null>;
}
```

### 2. LSP Manager Extensions (`src/lsp/manager.ts`)

Add new method to handle hover requests:

```typescript
class LSPManager {
  async getHover(symbolName: string, filePath?: string): Promise<HoverResult> {
    // 1. If filePath provided, use documentSymbol search
    // 2. Otherwise, use workspace/symbol search
    // 3. Find matching symbol(s)
    // 4. For each match, get hover information
    // 5. Return formatted results
  }
}
```

### 3. Daemon Command Handler (`src/daemon.ts`)

Add new case in the switch statement:

```typescript
case 'hover':
  const symbolName = args[0];
  const filePath = args.length > 2 ? args[0] : undefined;
  const actualSymbol = filePath ? args[1] : args[0];
  
  if (!actualSymbol) {
    throw new Error('hover command requires a symbol name');
  }
  
  return await lspManager.getHover(actualSymbol, filePath);
```

### 4. CLI Entry Point (`src/cli.ts`)

Handle the hover command in the client:

```typescript
// Pass hover command to daemon
if (command === 'hover') {
  const result = await runCommand('hover', commandArgs);
  // Format and display hover information
}
```

### 5. Hover Formatter (`src/lsp/formatter.ts`)

Create new formatting functions for hover output:

```typescript
export function formatHoverResult(hover: Hover, symbolName: string): string {
  // Convert MarkupContent to terminal-friendly output
  // Handle markdown formatting
  // Apply syntax highlighting if available
}
```

## Implementation Challenges & Solutions

### Challenge 1: Symbol Ambiguity
**Problem:** Multiple symbols with the same name may exist.
**Solution:** 
- Show all matches with file locations
- Allow user to specify more context (e.g., class.method notation)
- Prioritize symbols in current working directory

### Challenge 2: LSP Server Capabilities
**Problem:** Not all LSP servers support workspace/symbol.
**Solution:**
- Check server capabilities during initialization
- Fall back to file-by-file documentSymbol search
- Cache capabilities per server type

### Challenge 3: Performance
**Problem:** Searching large workspaces can be slow.
**Solution:**
- Implement request timeout (5-10 seconds)
- Cache symbol index per session
- Use progressive search (exact match first, then fuzzy)

### Challenge 4: Hover Content Formatting
**Problem:** Hover returns markdown/plaintext that needs terminal formatting.
**Solution:**
- Parse markdown and convert to ANSI codes
- Strip unnecessary formatting for terminal
- Preserve code blocks with syntax highlighting

## Error Handling

1. **Symbol Not Found**
   - Clear user message: "Symbol 'X' not found in workspace"
   - Suggest similar symbols if available

2. **LSP Server Doesn't Support Feature**
   - Message: "Hover not supported for [language]"
   - Fall back to basic file search if possible

3. **Timeout**
   - Message: "Search timed out. Try narrowing the search with a file path."

4. **File Not Found**
   - Validate file exists before attempting file-scoped search

## Testing Requirements

### Unit Tests
1. Symbol search with exact matches
2. Symbol search with partial matches
3. File-scoped vs global search
4. Multiple symbol matches handling
5. Hover content formatting
6. Error cases (not found, timeout, unsupported)

### Integration Tests
1. Test with TypeScript language server
2. Test with Python (Pyright) language server
3. Test with servers that don't support workspace/symbol
4. Test with large workspaces for performance

### Manual Testing Scenarios
1. Hover over function definition
2. Hover over variable declaration
3. Hover over class method
4. Hover over imported symbol
5. Hover over built-in/library symbols

## Future Enhancements

1. **Fuzzy Symbol Search**
   - Support partial matches and typo correction
   
2. **Context-Aware Search**
   - Use current file context to prioritize results
   
3. **Multiple Language Support**
   - Handle cross-language symbols in polyglot projects
   
4. **Caching Layer**
   - Cache symbol index for faster repeated searches
   
5. **Interactive Mode**
   - When multiple matches found, allow interactive selection

## Dependencies

### Existing Dependencies
- `vscode-jsonrpc`: Already used for LSP communication
- `vscode-languageserver-types`: Already included for type definitions

### No New Dependencies Required
The implementation can be done entirely with existing packages.

## Rollout Plan

### Phase 1: Core Implementation
1. Extend LSP client with new request methods
2. Implement workspace/symbol search
3. Implement textDocument/hover request
4. Basic formatting and output

### Phase 2: Enhanced Features
1. File-scoped search with documentSymbol
2. Improved formatting with markdown parsing
3. Multiple match handling

### Phase 3: Optimization
1. Add caching layer
2. Implement progressive search
3. Performance optimizations

## Success Metrics

1. **Functionality**
   - Successfully retrieves hover information for 90%+ of valid symbols
   - Response time under 2 seconds for typical queries

2. **User Experience**
   - Clear, readable output formatting
   - Helpful error messages
   - Intuitive command syntax

3. **Compatibility**
   - Works with all currently supported LSP servers
   - Graceful degradation for unsupported features

## Summary

The hover command will significantly enhance the CLI LSP client by providing quick access to symbol documentation and type information without needing to open an editor. The implementation leverages existing LSP protocol standards and follows the established patterns in the codebase, ensuring consistency and maintainability.