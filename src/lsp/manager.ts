import path from 'path';
import { exec } from 'child_process';
import type {
  LSPClient,
  Diagnostic,
  HoverResult,
  Position,
  LSPServer,
  DocumentSymbol,
  SymbolInformation,
} from './types.js';
import { createLSPClient } from './client.js';
import {
  getApplicableServers,
  getProjectRoot,
  spawnServer,
  getConfigLanguageExtensions,
} from './servers.js';
import { log } from '../logger.js';
import { urlToFilePath } from '../utils.js';
import { LANGUAGE_EXTENSIONS } from './language.js';
import { isDocumentSymbolArray } from '../type-guards.js';

// SymbolKind enum values from LSP spec
const SymbolKind = {
  File: 1,
  Module: 2,
  Namespace: 3,
  Package: 4,
  Class: 5,
  Method: 6,
  Property: 7,
  Field: 8,
  Constructor: 9,
  Enum: 10,
  Interface: 11,
  Function: 12,
  Variable: 13,
  Constant: 14,
  String: 15,
  Number: 16,
  Boolean: 17,
  Array: 18,
  Object: 19,
  Key: 20,
  Null: 21,
  EnumMember: 22,
  Struct: 23,
  Event: 24,
  Operator: 25,
  TypeParameter: 26,
} as const;

// Helper function to categorize symbols based on their SymbolKind
function categorizeSymbol(symbolKind?: number): string {
  if (symbolKind === undefined) {
    return 'Location';
  }

  switch (symbolKind) {
    case SymbolKind.Variable:
    case SymbolKind.Constant:
    case SymbolKind.Function:
    case SymbolKind.Method:
    case SymbolKind.Constructor:
    case SymbolKind.Property:
    case SymbolKind.Field:
      return 'Declaration';

    case SymbolKind.Class:
    case SymbolKind.Interface:
    case SymbolKind.Struct:
    case SymbolKind.Enum:
    case SymbolKind.TypeParameter:
      return 'Type Definition';

    default:
      return 'Location';
  }
}

// Module-scoped state (replaces class fields)
const clients = new Map<string, LSPClient>();
const broken = new Set<string>();
const initializing = new Map<string, Promise<LSPClient | null>>();

// Internal helper function
function getClientKey(serverID: string, root: string): string {
  return `${serverID}:${root}`;
}

// Public exported functions (replaces public methods)
export function hasClient(serverID: string, root: string): boolean {
  const clientKey = getClientKey(serverID, root);
  return clients.has(clientKey);
}

export function getClient(
  serverID: string,
  root: string
): LSPClient | undefined {
  const clientKey = getClientKey(serverID, root);
  return clients.get(clientKey);
}

export function setClient(
  serverID: string,
  root: string,
  client: LSPClient
): void {
  const clientKey = getClientKey(serverID, root);
  clients.set(clientKey, client);
  // Remove from initializing map once client is set
  initializing.delete(clientKey);
}

export function setInitializing(
  serverID: string,
  root: string,
  promise: Promise<LSPClient | null>
): void {
  const clientKey = getClientKey(serverID, root);
  initializing.set(clientKey, promise);
}

export function isInitializing(serverID: string, root: string): boolean {
  const clientKey = getClientKey(serverID, root);
  return initializing.has(clientKey);
}

export async function waitForInitialization(
  serverID: string,
  root: string
): Promise<LSPClient | null> {
  const clientKey = getClientKey(serverID, root);
  const initPromise = initializing.get(clientKey);
  if (initPromise) {
    return await initPromise;
  }
  return clients.get(clientKey) || null;
}

export async function getDiagnostics(filePath: string): Promise<Diagnostic[]> {
  log(`=== DIAGNOSTICS REQUEST START ===`);

  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  log(`Diagnostics requested for: ${absolutePath}`);

  // Check if file exists
  if (!(await Bun.file(absolutePath).exists())) {
    const relativePath = path.relative(process.cwd(), absolutePath);
    log(`File does not exist: ${absolutePath}`);
    throw new Error(`File does not exist: ${relativePath}`);
  }

  const applicableServers = await getApplicableServers(absolutePath);
  log(
    `Found ${applicableServers.length} applicable servers: ${applicableServers.map((s) => s.id).join(', ')}`
  );

  if (applicableServers.length === 0) {
    log(`No LSP servers for file type, returning empty diagnostics`);
    return []; // No LSP servers for this file type
  }

  const allDiagnostics: Diagnostic[] = [];

  for (const server of applicableServers) {
    log(`Starting to process server: ${server.id}`);
    let root;
    try {
      log(`About to call getProjectRoot for ${server.id}`);
      root = await getProjectRoot(absolutePath, server);
      log(`getProjectRoot returned for ${server.id}: ${root}`);
    } catch (error) {
      log(
        `Error getting project root for ${server.id}: ${error instanceof Error ? error.message : String(error)}`
      );
      continue;
    }
    const clientKey = getClientKey(server.id, root);
    log(
      `Processing server: ${server.id} with root: ${root}, key: ${clientKey}`
    );

    // Skip if this server/root combo is known to be broken
    if (broken.has(clientKey)) {
      log(`Skipping broken server: ${clientKey}`);
      continue;
    }

    try {
      let client = clients.get(clientKey);

      // Check if server is still initializing
      if (!client && initializing.has(clientKey)) {
        log(`Server ${clientKey} is still initializing, waiting...`);
        const initResult = await waitForInitialization(server.id, root);
        if (!initResult) {
          log(`Server ${clientKey} failed to initialize`);
          broken.add(clientKey);
          continue;
        }
        client = initResult;
      }

      if (!client) {
        log(`No existing client found for ${clientKey}, creating new client`);
        log(`Creating new LSP client for ${server.id} in ${root}`);
        log(`About to call spawnServer for ${server.id}`);
        const serverHandle = await spawnServer(server, root);
        log(
          `spawnServer returned for ${server.id}: ${serverHandle ? 'success' : 'failed'}`
        );
        if (!serverHandle) {
          log(`Failed to spawn server for ${server.id}`);
          broken.add(clientKey);
          continue;
        }

        log(`About to call createLSPClient for ${server.id}`);
        client = await createLSPClient(
          server.id,
          serverHandle,
          root,
          getConfigLanguageExtensions() || undefined
        );
        log(`createLSPClient returned for ${server.id}`);
        clients.set(clientKey, client);
        log(`Created and cached new client for ${clientKey}`);
      } else {
        log(
          `Using existing client for ${clientKey}, age: ${Date.now() - client.createdAt}ms`
        );
      }

      // Get diagnostics using pull or push approach based on server capabilities
      let diagnostics: Diagnostic[] = [];

      // Check if file was pre-opened by PreToolUse hook
      const fileAlreadyOpen = client.openFiles.has(absolutePath);

      if (fileAlreadyOpen) {
        // File was prepared by PreToolUse - clear stale pre-edit diagnostics
        // and request fresh post-edit diagnostics
        log(`File already open (PreToolUse), clearing stale diagnostics and refreshing`);
        client.diagnostics.delete(absolutePath);
        await client.sendChangeNotification(absolutePath);
        await client.waitForDiagnostics(absolutePath, 3000);
        diagnostics = client.getDiagnostics(absolutePath);
        log(`Retrieved ${diagnostics.length} fresh diagnostics from ${server.id}`);
      } else if (client.serverCapabilities?.diagnosticProvider) {
        // Use pull diagnostics (request/response pattern - no timeout issues!)
        try {
          log(`Using pull diagnostics for: ${absolutePath}`);
          diagnostics = await client.pullDiagnostics(absolutePath);
          log(
            `Retrieved ${diagnostics.length} diagnostics from ${server.id} via pull`
          );
        } catch (error) {
          log(`Pull diagnostics failed, falling back to push: ${error}`);
          // Fall back to push-based diagnostics
          try {
            await client.triggerDiagnostics(absolutePath, 5000);
            diagnostics = client.getDiagnostics(absolutePath);
          } catch (pushError) {
            log(`Push diagnostics also failed: ${pushError}`);
          }
        }
      } else {
        // Use traditional push-based diagnostics
        // 3 second timeout to handle cold starts (Java, C++ need time for initial analysis)
        try {
          log(`Using push diagnostics for: ${absolutePath}`);
          await client.triggerDiagnostics(absolutePath, 3000);
          log(`Successfully received diagnostics from ${server.id}`);
        } catch (error) {
          log(
            `Timeout waiting for diagnostics from ${server.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        diagnostics = client.getDiagnostics(absolutePath);
      }

      log(`Retrieved ${diagnostics.length} diagnostics from ${server.id}`);
      allDiagnostics.push(...diagnostics);

      // Close the file to ensure fresh content on next check
      await client.closeFile(absolutePath);
    } catch (error) {
      log(
        `Error getting diagnostics from ${server.id}: ${error instanceof Error ? error.message : String(error)}`
      );
      broken.add(clientKey);

      // Clean up failed client
      const client = clients.get(clientKey);
      if (client) {
        try {
          await client.shutdown();
        } catch (_e) {
          // Ignore shutdown errors
        }
        clients.delete(clientKey);
      }
    }
  }

  log(
    `=== DIAGNOSTICS REQUEST COMPLETE - Total: ${allDiagnostics.length} diagnostics ===`
  );
  return allDiagnostics;
}

/**
 * Opens a file and waits for initial diagnostics to settle.
 * Used by PreToolUse hook to prepare files before Claude's edit.
 * Does NOT close the file - leaves it open for PostToolUse to handle.
 */
export async function openFile(filePath: string): Promise<void> {
  log(`=== OPEN FILE REQUEST START ===`);

  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  log(`Opening file: ${absolutePath}`);

  // Check if file exists
  if (!(await Bun.file(absolutePath).exists())) {
    log(`File does not exist, skipping: ${absolutePath}`);
    return;
  }

  const applicableServers = await getApplicableServers(absolutePath);
  log(
    `Found ${applicableServers.length} applicable servers: ${applicableServers.map((s) => s.id).join(', ')}`
  );

  if (applicableServers.length === 0) {
    log(`No LSP servers for file type`);
    return;
  }

  for (const server of applicableServers) {
    let root;
    try {
      root = await getProjectRoot(absolutePath, server);
    } catch (error) {
      log(
        `Error getting project root for ${server.id}: ${error instanceof Error ? error.message : String(error)}`
      );
      continue;
    }

    const clientKey = getClientKey(server.id, root);

    // Skip if this server/root combo is known to be broken
    if (broken.has(clientKey)) {
      log(`Skipping broken server: ${clientKey}`);
      continue;
    }

    try {
      const client = await getOrCreateClient(server, root);
      if (!client) continue;

      // Open file (this triggers initial diagnostics via didOpen)
      await client.openFile(absolutePath);

      // Wait 1 second for initial diagnostics to settle
      // We don't care about these diagnostics - they're pre-edit
      await client.waitForDiagnostics(absolutePath, 1000);

      log(`File opened and initial diagnostics received: ${absolutePath}`);
    } catch (error) {
      log(
        `Error opening file with ${server.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  log(`=== OPEN FILE REQUEST COMPLETE ===`);
}

/**
 * Checks if a file is currently open in any LSP client.
 */
export function isFileOpen(filePath: string): boolean {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  for (const client of clients.values()) {
    if (client.openFiles.has(absolutePath)) {
      return true;
    }
  }
  return false;
}

// Internal helper function to retry operations that might fail due to connection issues
async function retryWithConnectionCheck<T>(
  operation: () => Promise<T>,
  serverName: string,
  maxRetries = 2,
  delayMs = 100
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // eslint-disable-next-line for-ai/no-code-after-try-catch
    try {
      return await operation();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // If this is the last attempt, always re-throw
      if (attempt === maxRetries) {
        throw error;
      }

      // If it's a retryable error and not the last attempt, retry
      if (errorMessage.includes('Connection is disposed')) {
        log(
          `${serverName} connection disposed on attempt ${attempt}, retrying in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      // Otherwise, re-throw non-retryable errors immediately
      throw error;
    }
  }
  // Unreachable: all paths above return or throw
  throw new Error('Unexpected: retry loop completed without returning');
}

export async function getHover(
  symbolName: string,
  filePath: string
): Promise<HoverResult[]> {
  log(`=== HOVER REQUEST START ===`);
  log(`Symbol: ${symbolName}, File: ${filePath}`);

  const seen = new Set<string>();

  // File-scoped search only
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  if (!(await Bun.file(absolutePath).exists())) {
    const relativePath = path.relative(process.cwd(), absolutePath);
    throw new Error(`File does not exist: ${relativePath}`);
  }

  const applicableServers = await getApplicableServers(absolutePath);

  // Collect all results with their source positions for deterministic ordering
  type Collected = {
    sourceFile: string;
    sourceLine: number;
    sourceChar: number;
    item: HoverResult;
  };
  const collected: Collected[] = [];

  for (const server of applicableServers) {
    const root = await getProjectRoot(absolutePath, server);
    const client = await getOrCreateClient(server, root);

    if (!client) continue;

    try {
      // Get document symbols to identify symbol types and precise positions
      const documentSymbols = await retryWithConnectionCheck(
        () => client.getDocumentSymbols(absolutePath),
        server.id
      );
      log(`Got ${documentSymbols.length} document symbols`);

      // For GraphQL files, always use text search since document symbols are unreliable
      // (they only return type definitions, not references)
      const fileContent = await Bun.file(absolutePath).text();
      const textPositions = findSymbolOccurrences(fileContent, symbolName);
      log(
        `Text search found ${textPositions.length} positions for "${symbolName}": ${textPositions.map((p) => `${p.line}:${p.character}`).join(', ')}`
      );

      // For non-GraphQL files, prefer document symbols
      let docSymbolPositions: Position[] = [];
      if (
        !absolutePath.endsWith('.graphql') &&
        !absolutePath.endsWith('.gql')
      ) {
        docSymbolPositions = collectSymbolPositionsByName(
          documentSymbols,
          symbolName
        );
      }

      const symbolPositions = (
        absolutePath.endsWith('.graphql') || absolutePath.endsWith('.gql')
          ? textPositions
          : docSymbolPositions.length > 0
            ? docSymbolPositions
            : textPositions
      )
        // Ensure deterministic order: sort by line then character
        .sort((a, b) => a.line - b.line || a.character - b.character);

      // Try hover at each position (collect all, no early break)
      for (const position of symbolPositions) {
        // Find the symbol at this position
        const symbolAtPosition = findSymbolAtPosition(
          documentSymbols,
          symbolName,
          position
        );
        const symbolKind = symbolAtPosition?.kind;

        log(
          `Symbol "${symbolName}" at ${position.line}:${position.character} has kind: ${symbolKind}`
        );

        // Collect hover results from multiple locations for comprehensive information
        const hoverLocations: {
          file: string;
          position: Position;
          description: string;
        }[] = [];

        // Always include the original location with proper categorization
        hoverLocations.push({
          file: absolutePath,
          position: position,
          description: categorizeSymbol(symbolKind),
        });

        // Add type definition location if different and relevant
        const shouldFollowTypeDefinition =
          symbolKind === undefined ||
          (symbolKind !== SymbolKind.Function &&
            symbolKind !== SymbolKind.Method &&
            symbolKind !== SymbolKind.Constructor);

        if (shouldFollowTypeDefinition) {
          try {
            const typeDefinitions = await retryWithConnectionCheck(
              () => client.getTypeDefinition(absolutePath, position),
              server.id
            );
            if (typeDefinitions && typeDefinitions.length > 0) {
              const firstTypeDef = typeDefinitions[0];
              let typeDefFile: string;
              let typeDefLocation: Position;

              if ('uri' in firstTypeDef) {
                const location = firstTypeDef;
                typeDefFile = urlToFilePath(location.uri);
                typeDefLocation = location.range.start;
              } else if ('targetUri' in firstTypeDef) {
                const locationLink = firstTypeDef;
                typeDefFile = urlToFilePath(locationLink.targetUri);
                typeDefLocation = locationLink.targetSelectionRange.start;
              } else {
                typeDefFile = '';
                typeDefLocation = { line: 0, character: 0 };
              }

              // Only add type definition if it's different from original location
              if (
                typeDefFile &&
                (typeDefFile !== absolutePath ||
                  typeDefLocation.line !== position.line)
              ) {
                hoverLocations.push({
                  file: typeDefFile,
                  position: typeDefLocation,
                  description: 'Type Definition',
                });
                log(
                  `Found type definition at ${typeDefFile}:${typeDefLocation.line}:${typeDefLocation.character}`
                );
              }
            }
          } catch (error) {
            log(`Type definition lookup failed: ${error}`);
          }
        }

        // Get comprehensive information for each location (Phase 2: Multi-request pattern)
        for (const location of hoverLocations) {
          // Execute multiple requests concurrently for richer information
          const [hover, signatureHelp] = await Promise.allSettled([
            retryWithConnectionCheck(
              () => client.getHover(location.file, location.position),
              server.id
            ),
            retryWithConnectionCheck(
              () => client.getSignatureHelp(location.file, location.position),
              server.id
            ),
          ]);

          // Extract results from Promise.allSettled
          const hoverResult = hover.status === 'fulfilled' ? hover.value : null;
          const signatureResult =
            signatureHelp.status === 'fulfilled' ? signatureHelp.value : null;

          if (hoverResult) {
            // Get language ID from file extension
            const fileExt = path.extname(location.file);
            const configLanguageExtensions = getConfigLanguageExtensions();
            const languageId =
              configLanguageExtensions?.[fileExt] ||
              LANGUAGE_EXTENSIONS[fileExt] ||
              'plaintext';

            log(
              `Got ${location.description.toLowerCase()} hover info for ${languageId} symbol: ${symbolKind}`
            );

            if (signatureResult?.signatures.length) {
              log(
                `Also got signature help with ${signatureResult.signatures.length} signature(s)`
              );
            }

            // Deduplicate by hover location
            const key = `${location.file}:${location.position.line}:${location.position.character}`;
            if (!seen.has(key)) {
              seen.add(key);
              const resultItem = {
                symbol: symbolName,
                hover: hoverResult,
                signature: signatureResult || undefined,
                location: {
                  file: path.relative(process.cwd(), location.file),
                  line: location.position.line,
                  column: location.position.character,
                },
                description: location.description,
              };
              collected.push({
                sourceFile: absolutePath,
                sourceLine: position.line,
                sourceChar: position.character,
                item: resultItem,
              });
            }
          }
        }
      }
    } catch (error) {
      log(
        `Error getting hover from ${server.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Sort collected results by their source occurrence position to match document order
  collected.sort(
    (a, b) =>
      a.sourceLine - b.sourceLine ||
      a.sourceChar - b.sourceChar ||
      a.item.location.line - b.item.location.line ||
      a.item.location.column - b.item.location.column
  );

  const ordered = collected.map((c) => c.item);
  log(`=== HOVER REQUEST COMPLETE - Found ${ordered.length} results ===`);
  return ordered;
}

// Helper to collect positions of symbols with a specific name
// Internal helper function to collect positions of symbols with a given name
function collectSymbolPositionsByName(
  symbols: DocumentSymbol[] | SymbolInformation[],
  symbolName: string
): Position[] {
  const positions: Position[] = [];

  if (symbols.length === 0) return positions;

  // Hierarchical DocumentSymbol format
  if (isDocumentSymbolArray(symbols)) {
    const walk = (syms: DocumentSymbol[]) => {
      for (const sym of syms) {
        if (sym.name === symbolName) {
          // Prefer the selectionRange (identifier) when available
          const pos = sym.selectionRange.start;
          positions.push(pos);
        }
        if (sym.children && sym.children.length > 0) {
          walk(sym.children);
        }
      }
    };
    walk(symbols);
    return positions;
  }

  // Flat SymbolInformation format
  for (const info of symbols) {
    if (info.name === symbolName) {
      // Without async file IO here, use the start of the symbol range
      positions.push(info.location.range.start);
    }
  }
  return positions;
}

// Internal helper function to find symbol at a specific position
function findSymbolAtPosition(
  symbols: DocumentSymbol[] | SymbolInformation[],
  symbolName: string,
  position: Position
): DocumentSymbol | SymbolInformation | undefined {
  // Handle DocumentSymbol format (hierarchical)
  if (isDocumentSymbolArray(symbols)) {
    const findInDocumentSymbols = (
      syms: DocumentSymbol[]
    ): DocumentSymbol | undefined => {
      for (const sym of syms) {
        if (sym.name === symbolName && positionInRange(position, sym.range)) {
          return sym;
        }
        // Check children recursively
        if (sym.children) {
          const found = findInDocumentSymbols(sym.children);
          if (found) return found;
        }
      }
      return undefined;
    };
    return findInDocumentSymbols(symbols);
  }

  // Handle SymbolInformation format (flat list)
  return symbols.find(
    (sym) =>
      sym.name === symbolName && positionInRange(position, sym.location.range)
  );
}

// Internal helper function to check if a position is within a range
function positionInRange(
  position: Position,
  range: { start: Position; end: Position }
): boolean {
  if (position.line < range.start.line || position.line > range.end.line) {
    return false;
  }
  if (
    position.line === range.start.line &&
    position.character < range.start.character
  ) {
    return false;
  }
  if (
    position.line === range.end.line &&
    position.character > range.end.character
  ) {
    return false;
  }
  return true;
}

// Internal helper function to check if a character is part of an identifier
function isIdentifierChar(char: string): boolean {
  return /[a-zA-Z0-9_$]/.test(char);
}

// Internal helper function to find text occurrences of symbol name in file content
function findSymbolOccurrences(
  fileContent: string,
  symbolName: string
): Position[] {
  const positions: Position[] = [];
  const lines = fileContent.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    let columnIndex = 0;

    while (true) {
      const occurrence = line.indexOf(symbolName, columnIndex);
      if (occurrence === -1) break;

      // Check if this is a whole word occurrence (not part of another identifier)
      const beforeChar = occurrence > 0 ? line[occurrence - 1] : ' ';
      const afterChar =
        occurrence + symbolName.length < line.length
          ? line[occurrence + symbolName.length]
          : ' ';

      const isWordBoundary =
        !isIdentifierChar(beforeChar) && !isIdentifierChar(afterChar);

      if (isWordBoundary) {
        positions.push({
          line: lineIndex,
          character: occurrence,
        });
      }

      columnIndex = occurrence + 1;
    }
  }

  return positions;
}

// Internal helper function to get or create client
async function getOrCreateClient(
  server: LSPServer,
  root: string
): Promise<LSPClient | null> {
  const clientKey = getClientKey(server.id, root);

  if (broken.has(clientKey)) {
    return null;
  }

  let client = clients.get(clientKey);

  // Check if server is still initializing
  if (!client && initializing.has(clientKey)) {
    log(`Server ${clientKey} is still initializing, waiting...`);
    const initResult = await waitForInitialization(server.id, root);
    if (!initResult) {
      log(`Server ${clientKey} failed to initialize`);
      broken.add(clientKey);
      return null;
    }
    return initResult;
  }

  if (!client) {
    try {
      log(`Creating new LSP client for ${server.id} in ${root}`);
      const serverHandle = await spawnServer(server, root);
      if (!serverHandle) {
        broken.add(clientKey);
        return null;
      }

      client = await createLSPClient(
        server.id,
        serverHandle,
        root,
        getConfigLanguageExtensions() || undefined
      );
      clients.set(clientKey, client);
    } catch (error) {
      log(
        `Failed to create client: ${error instanceof Error ? error.message : String(error)}`
      );
      broken.add(clientKey);
      return null;
    }
  }

  return client;
}

// Exported function to get running servers
export function getRunningServers(): {
  serverID: string;
  root: string;
  uptime: number;
}[] {
  return Array.from(clients.values()).map((client) => ({
    serverID: client.serverID,
    root: client.root,
    uptime: Date.now() - client.createdAt,
  }));
}

// Exported function to close all files
export async function closeAllFiles(): Promise<void> {
  log('Closing all files across all clients');
  const closePromises = Array.from(clients.values()).map((client) =>
    client.closeAllFiles()
  );
  await Promise.all(closePromises);
}

// Exported function to shutdown all LSP clients
export async function shutdown(): Promise<void> {
  log('Shutting down LSP manager...');
  log(`Shutting down ${clients.size} LSP clients`);

  const shutdownPromises = Array.from(clients.values()).map(async (client) => {
    try {
      // Add a timeout to prevent hanging on shutdown
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Shutdown timeout')), 5000)
      );

      await Promise.race([client.shutdown(), timeoutPromise]);

      log(`Successfully shut down ${client.serverID}`);
    } catch (error) {
      log(
        `Error shutting down LSP client ${client.serverID}: ${error instanceof Error ? error.message : String(error)}`
      );

      // Force kill if graceful shutdown fails
      if (client.process && !client.process.killed) {
        try {
          if (process.platform === 'win32') {
            await new Promise<void>((resolve) => {
              exec(`taskkill /pid ${client.process!.pid} /T /F`, () => {
                resolve();
              });
            });
          } else {
            // Kill process group forcefully
            try {
              process.kill(-client.process.pid!, 'SIGKILL');
            } catch (e) {
              client.process.kill('SIGKILL');
            }
          }
          log(`Force killed ${client.serverID} process ${client.process.pid}`);
        } catch (killError) {
          log(`Failed to force kill ${client.serverID}: ${killError}`);
        }
      }
    }
  });

  await Promise.all(shutdownPromises);
  clients.clear();
  broken.clear();
  initializing.clear();
  log('LSP manager shutdown complete');
}
