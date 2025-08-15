# LSP Startup Optimization Design Document

## Table of Contents
1. [Problem Statement](#problem-statement)
2. [Current Architecture](#current-architecture)
3. [Root Cause Analysis](#root-cause-analysis)
4. [Proposed Solution](#proposed-solution)
5. [Implementation Details](#implementation-details)
6. [API Changes](#api-changes)

## Problem Statement

### Symptoms
- **"First empty read" condition**: When running `cli-lsp-client diagnostics` for the first time, especially with TypeScript projects, diagnostics are often empty or incomplete
- **Inconsistent behavior**: Subsequent runs typically work correctly, suggesting a timing/initialization issue
- **npx amplification**: Problem is more pronounced when running via `npx` due to additional package resolution overhead
- **User experience degradation**: Users need to run commands multiple times to get reliable results

### Impact
- Poor developer experience requiring multiple command invocations
- Unreliable CI/CD integration where diagnostics may be missed
- Reduced confidence in the tool's reliability
- Integration challenges with IDEs and development workflows

## Current Architecture

### Component Overview
```
CLI Client (client.ts)
    ↓ Unix Socket
Daemon (daemon.ts)
    ↓ Function Call
LSP Manager (manager.ts)
    ↓ Process Management
LSP Clients (client.ts)
    ↓ JSON-RPC
LSP Servers (TypeScript, Python, etc.)
```

### Current Flow
1. **Client startup**: Check daemon status, start if needed (up to 5s timeout)
2. **Command forwarding**: Send request via Unix socket to daemon
3. **Server discovery**: Find applicable LSP servers for file type
4. **Client management**: Create or reuse LSP client for server/project combination
5. **LSP protocol**: Initialize server, open file, wait for diagnostics (5s timeout)
6. **Response**: Return aggregated diagnostics from all applicable servers

### Timing Constraints
- Daemon startup: 50 attempts × 100ms = 5 seconds maximum
- LSP client initialization: Immediate after process spawn
- Diagnostic timeout: 5 seconds per server
- No distinction between cold and warm starts

## Root Cause Analysis

### Primary Issue: Race Condition in LSP Server Readiness

The core problem is assuming LSP servers are immediately ready to provide diagnostics after completing the initialization handshake. In reality, many LSP servers (particularly TypeScript) require additional time for:

1. **Project analysis**: Scanning source files, dependency resolution
2. **Type checking**: Building internal type representations
3. **Index building**: Creating searchable indexes for fast responses
4. **Configuration processing**: Loading and applying project-specific settings

### Contributing Factors

1. **npx overhead**: Additional time for package download and setup
2. **Cold daemon start**: Fresh daemon process requires full initialization chain
3. **TypeScript complexity**: TypeScript projects have particularly long analysis phases
4. **Insufficient timeout**: 5-second timeout often inadequate for cold starts
5. **No readiness detection**: System assumes server is ready after basic initialization

### Timing Analysis

**Cold start with npx (worst case)**:
- npx package resolution: 2-5 seconds
- Daemon startup: 0-5 seconds
- LSP server spawn: 0.5-1 seconds
- LSP initialization handshake: 0.5-2 seconds
- Project analysis: **5-15 seconds** (not accounted for)
- **Total**: 8-28 seconds vs 5-second timeout

**Warm start (existing daemon)**:
- Command forwarding: <100ms
- LSP client reuse: <100ms
- Diagnostic retrieval: 0.1-2 seconds
- **Total**: <3 seconds (reliable)

## Proposed Solution

### Hybrid Approach: Extended Timeouts + Proactive Warmup

Combine two strategies to eliminate timing issues:

1. **Extended timeout strategy**: Intelligent timeout handling based on client age and readiness
2. **Proactive warmup command**: Allow pre-initialization of LSP servers before diagnostic requests

### Key Benefits
- **Backward compatibility**: All existing functionality preserved
- **Graceful degradation**: Extended timeouts provide safety net for cold starts
- **Performance optimization**: Warmup enables sub-second response times
- **Integration flexibility**: Can be adopted incrementally

## Implementation Details

### 1. Enhanced LSPClient Type

```typescript
type LSPClient = {
  serverID: string;
  root: string;
  createdAt: number;        // NEW: Creation timestamp
  isReady: boolean;         // NEW: Readiness state
  diagnostics: Map<string, Diagnostic[]>;
  
  // Existing methods
  openFile(path: string): Promise<void>;
  closeFile(path: string): Promise<void>;
  getDiagnostics(path: string): Diagnostic[];
  waitForDiagnostics(path: string, timeoutMs?: number): Promise<void>;
  shutdown(): Promise<void>;
}
```

### 2. State-Based Timeout Strategy

**Two-Phase Timeout Approach**:
```typescript
const READINESS_TIMEOUT = 30000; // 30 seconds for server to become ready (user commands only)
const DIAGNOSTICS_TIMEOUT = 5000; // 5 seconds for ready server to provide diagnostics

async function getDiagnosticsWithStateBasedTimeout(
  client: LSPClient, 
  connection: MessageConnection, 
  filePath: string
): Promise<void> {
  // Phase 1: Ensure server readiness (separate timeout)
  if (!client.isReady) {
    await ensureReady(client, connection, READINESS_TIMEOUT);
  }
  
  // Phase 2: Request diagnostics from ready server (short timeout)  
  await client.waitForDiagnostics(filePath, DIAGNOSTICS_TIMEOUT);
}
```

**Implementation in manager.ts**:
```typescript
// In getDiagnostics method
await client.openFile(absolutePath);

// NEW: Two-phase approach - readiness then diagnostics
await getDiagnosticsWithStateBasedTimeout(client, connection, absolutePath);
```

### 3. Server Readiness Detection

**Project Entry Point Detection**:
```typescript
async function findProjectEntryPoint(root: string, serverID: string): Promise<string | null> {
  // Server-specific entry point candidates
  const candidatesByServer: Record<string, string[]> = {
    typescript: [
      'package.json',     // Check package.json "main" field
      'tsconfig.json',    // TypeScript config
      'src/index.ts',     // Common TS entry
      'src/index.js',     // Common JS entry
      'index.ts',
      'index.js',
    ],
    pyright: [
      '__main__.py',
      'main.py',
      'app.py',
      'setup.py',
      '__init__.py',
    ],
    gopls: [
      'main.go',
      'go.mod',
    ],
    jdtls: [
      'src/main/java/Main.java',
      'src/main/java/App.java',
      'pom.xml',
      'build.gradle',
    ],
    lua_ls: [
      'init.lua',
      'main.lua',
      '.luarc.json',
    ],
    graphql: [
      'schema.graphql',
      'schema.gql',
      '.graphqlrc.json',
    ],
    yaml: [
      'docker-compose.yml',
      'docker-compose.yaml',
      '.github/workflows/main.yml',
      'k8s/deployment.yaml',
    ],
    bash: [
      'Makefile',
      'setup.sh',
      'install.sh',
      'build.sh',
    ],
    json: [
      'package.json',
      'tsconfig.json',
      'settings.json',
    ],
    css: [
      'styles.css',
      'index.css',
      'main.scss',
      'app.css',
    ],
  };
  
  const candidates = candidatesByServer[serverID] || [];
  
  for (const candidate of candidates) {
    const fullPath = path.join(root, candidate);
    if (await Bun.file(fullPath).exists()) {
      // For package.json, try to read the "main" field
      if (candidate === 'package.json' && serverID === 'typescript') {
        try {
          const pkg = await Bun.file(fullPath).json();
          if (pkg.main) {
            const mainPath = path.join(root, pkg.main);
            if (await Bun.file(mainPath).exists()) {
              return mainPath;
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
      return fullPath;
    }
  }
  
  return null;
}
```

**Hybrid Readiness Check Function**:
```typescript
async function ensureReady(
  client: LSPClient, 
  connection: MessageConnection, 
  timeoutMs?: number // Optional timeout - only for user commands
): Promise<void> {
  if (client.isReady) return;
  
  const readinessChecks = {
    receivedFirstDiagnostic: false,
    canProvideSymbols: false,
  };
  
  // Monitor for first diagnostic notification (even if empty)
  let diagnosticHandler: any;
  const diagnosticPromise = new Promise<void>((resolve) => {
    diagnosticHandler = () => {
      readinessChecks.receivedFirstDiagnostic = true;
      resolve();
    };
    connection.onNotification("textDocument/publishDiagnostics", diagnosticHandler);
  });
  
  // Try opening a project file
  const entryPoint = await findProjectEntryPoint(client.root, client.serverID);
  if (entryPoint) {
    await client.openFile(entryPoint);
    
    // For warmup (no timeout): wait indefinitely for diagnostic or up to 30s, whichever comes first
    // For user commands (with timeout): respect the timeout
    const waitPromises = [diagnosticPromise];
    if (timeoutMs) {
      waitPromises.push(new Promise(resolve => setTimeout(resolve, Math.min(timeoutMs, 10000))));
    } else {
      // Warmup: reasonable upper bound but no hard timeout
      waitPromises.push(new Promise(resolve => setTimeout(resolve, 30000)));
    }
    
    await Promise.race(waitPromises);
    
    // Test if server can provide document symbols (indicates parsing complete)
    if (!readinessChecks.receivedFirstDiagnostic) {
      try {
        const symbolTimeout = timeoutMs ? Math.min(timeoutMs - 10000, 5000) : 10000;
        await connection.sendRequest("textDocument/documentSymbol", {
          textDocument: { uri: `file://${entryPoint}` }
        }, symbolTimeout);
        readinessChecks.canProvideSymbols = true;
      } catch {
        // Server not ready for analysis yet
      }
    }
    
    await client.closeFile(entryPoint);
  }
  
  // Clean up diagnostic handler
  if (diagnosticHandler) {
    connection.off("textDocument/publishDiagnostics", diagnosticHandler);
  }
  
  // Consider ready if we have any positive signal
  client.isReady = readinessChecks.receivedFirstDiagnostic || 
                   readinessChecks.canProvideSymbols;
  
  if (client.isReady) {
    console.log(`LSP server ${client.serverID} is ready`);
  } else {
    // Never mark as ready if we couldn't confirm readiness
    const message = `LSP server ${client.serverID} failed to become ready`;
    if (timeoutMs) {
      throw new Error(`${message} within ${timeoutMs}ms`);
    } else {
      // Warmup: still throw error, but don't impose timeout constraint
      throw new Error(`${message} - server may not be properly configured`);
    }
  }
}
```

### 4. Warmup Command Implementation

**New CLI Command**: `cli-lsp-client warmup [directory]`

**Project Detection Logic**:
```typescript
async function hasAnyFile(directory: string, patterns: string[]): Promise<boolean> {
  try {
    // Build find command with multiple -name patterns joined by -o (OR)
    // Example: find . \( -name "*.css" -o -name "tsconfig.json" \) -type f -print -quit
    const namePatterns = patterns.map(pattern => `-name "${pattern}"`).join(' -o ');
    const { stdout } = await Bun.$`find ${directory} \( ${namePatterns} \) -type f -print -quit 2>/dev/null`.quiet();
    return stdout.toString().trim().length > 0;
  } catch {
    return false;
  }
}

async function detectProjectTypes(directory: string): Promise<LSPServer[]> {
  const detectedServers: LSPServer[] = [];
  const detectionPromises: Promise<void>[] = [];
  
  // TypeScript/JavaScript
  detectionPromises.push(
    (async () => {
      if (await hasAnyFile(directory, ['tsconfig.json', 'jsconfig.json', 'package.json', '*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs'])) {
        detectedServers.push(getServerById('typescript'));
      }
    })()
  );
  
  // Python
  detectionPromises.push(
    (async () => {
      if (await hasAnyFile(directory, ['pyproject.toml', 'requirements.txt', '*.py', '*.pyi'])) {
        detectedServers.push(getServerById('pyright'));
      }
    })()
  );
  
  // Go
  detectionPromises.push(
    (async () => {
      if (await hasAnyFile(directory, ['go.mod', '*.go'])) {
        detectedServers.push(getServerById('gopls'));
      }
    })()
  );
  
  // Java
  detectionPromises.push(
    (async () => {
      if (await hasAnyFile(directory, ['pom.xml', 'build.gradle', 'build.gradle.kts', '*.java'])) {
        detectedServers.push(getServerById('jdtls'));
      }
    })()
  );
  
  // Lua
  detectionPromises.push(
    (async () => {
      if (await hasAnyFile(directory, ['.luarc.json', '.luarc.jsonc', '*.lua'])) {
        detectedServers.push(getServerById('lua_ls'));
      }
    })()
  );
  
  // GraphQL
  detectionPromises.push(
    (async () => {
      if (await hasAnyFile(directory, ['.graphqlrc', '.graphqlrc.yml', '.graphqlrc.yaml', '.graphqlrc.json', '*.graphql', '*.gql'])) {
        detectedServers.push(getServerById('graphql'));
      }
    })()
  );
  
  // YAML
  detectionPromises.push(
    (async () => {
      if (await hasAnyFile(directory, ['*.yml', '*.yaml'])) {
        detectedServers.push(getServerById('yaml'));
      }
    })()
  );
  
  // Bash
  detectionPromises.push(
    (async () => {
      if (await hasAnyFile(directory, ['*.sh', '*.bash', '*.zsh'])) {
        detectedServers.push(getServerById('bash'));
      }
    })()
  );
  
  // JSON (but not if TypeScript already detected)
  detectionPromises.push(
    (async () => {
      if (await hasAnyFile(directory, ['*.json', '*.jsonc'])) {
        if (!detectedServers.some(s => s.id === 'typescript')) {
          detectedServers.push(getServerById('json'));
        }
      }
    })()
  );
  
  // CSS/SCSS
  detectionPromises.push(
    (async () => {
      if (await hasAnyFile(directory, ['*.css', '*.scss', '*.sass', '*.less'])) {
        detectedServers.push(getServerById('css'));
      }
    })()
  );
  
  // Run all detection checks in parallel
  await Promise.all(detectionPromises);
  
  return detectedServers;
}
```

**Warmup Flow**:
```typescript
async function executeWarmup(directory?: string): Promise<void> {
  const targetDir = directory || process.cwd();
  const projectServers = await detectProjectTypes(targetDir);
  
  console.log(`Warming up ${projectServers.length} LSP servers...`);
  
  for (const server of projectServers) {
    try {
      const root = await getProjectRoot(targetDir, server);
      const serverHandle = await spawnServer(server, root);
      const client = await createLSPClient(server.id, serverHandle, root);
      
      // Wait for readiness (no timeout for warmup)
      await ensureReady(client, connection);
      
      console.log(`✓ ${server.id} ready`);
    } catch (error) {
      console.warn(`⚠ ${server.id} warmup failed: ${error.message}`);
    }
  }
  
  console.log('Warmup complete');
}
```

### 5. Manager Integration

**Updated getDiagnostics method**:
```typescript
async getDiagnostics(filePath: string): Promise<Diagnostic[]> {
  // ... existing validation logic
  
  for (const server of applicableServers) {
    try {
      let client = this.clients.get(clientKey);
      
      if (!client) {
        // Create new client
        client = await createLSPClient(server.id, serverHandle, root);
        this.clients.set(clientKey, client);
      }
      
      await client.openFile(absolutePath);
      
      // NEW: Two-phase approach - readiness then diagnostics
      await getDiagnosticsWithStateBasedTimeout(client, connection, absolutePath);
      
      // ... rest of existing logic
    } catch (error) {
      // ... existing error handling
    }
  }
  
  return allDiagnostics;
}
```

## API Changes

### New CLI Commands

**Warmup Command**:
```bash
# Warm up LSP servers for current directory
cli-lsp-client warmup

# Warm up LSP servers for specific directory
cli-lsp-client warmup /path/to/project
```

### Backward Compatibility

- All existing commands work unchanged
- No breaking changes to current API
- Default behavior improved without user intervention
- Optional warmup provides performance benefits