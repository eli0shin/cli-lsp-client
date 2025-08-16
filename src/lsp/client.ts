import path from 'path';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';
import type { LSPClient, Diagnostic, SymbolInformation, DocumentSymbol, Hover, Position, Location, LocationLink } from './types.js';
import type { ServerHandle } from './servers.js';
import { LANGUAGE_EXTENSIONS } from './language.js';
import { log } from '../logger.js';

export async function createLSPClient(
  serverID: string, 
  serverHandle: ServerHandle, 
  root: string
): Promise<LSPClient> {
  log(`=== ENTERING createLSPClient for ${serverID} ===`);
  log(`Creating LSP client for ${serverID}`);

  const connection = createMessageConnection(
    new StreamMessageReader(serverHandle.process.stdout),
    new StreamMessageWriter(serverHandle.process.stdin)
  );

  const diagnostics = new Map<string, Diagnostic[]>();

  // Listen for diagnostics
  log('REGISTERING publishDiagnostics handler');
  connection.onNotification("textDocument/publishDiagnostics", (params) => {
    log(`>>> RECEIVED publishDiagnostics!!! uri: ${params.uri}, count: ${params.diagnostics?.length || 0}`);
    const filePath = new URL(params.uri).pathname;
    diagnostics.set(filePath, params.diagnostics);
  });
  log('publishDiagnostics handler REGISTERED');

  // Handle requests
  connection.onRequest("window/workDoneProgress/create", () => null);
  connection.onRequest("workspace/configuration", () => [{}]);

  connection.listen();

  // Initialize the LSP server
  log(`Initializing LSP server ${serverID}`);
  await connection.sendRequest("initialize", {
    rootUri: "file://" + root,
    processId: serverHandle.process.pid,
    workspaceFolders: [
      {
        name: "workspace",
        uri: "file://" + root,
      },
    ],
    initializationOptions: {
      ...serverHandle.initialization,
    },
    capabilities: {
      window: {
        workDoneProgress: true,
      },
      workspace: {
        configuration: true,
      },
      textDocument: {
        synchronization: {
          didOpen: true,
          didChange: true,
        },
        publishDiagnostics: {
          versionSupport: true,
        },
        documentSymbol: {
          dynamicRegistration: false,
          hierarchicalDocumentSymbolSupport: true
        },
        definition: {
          dynamicRegistration: false,
          linkSupport: true
        },
        typeDefinition: {
          dynamicRegistration: false,
          linkSupport: true
        },
        hover: {
          dynamicRegistration: false,
          contentFormat: ["markdown", "plaintext"]
        },
      },
    },
  });

  await connection.sendNotification("initialized", {});
  log(`LSP server ${serverID} initialized`);

  const client: LSPClient = {
    serverID,
    root,
    createdAt: Date.now(),
    diagnostics,
    connection,

    async openFile(filePath: string): Promise<void> {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      
      log(`=== OPENING FILE: ${absolutePath} ===`);
      
      // Clear any existing diagnostics before opening
      diagnostics.delete(absolutePath);
      
      const file = Bun.file(absolutePath);
      const text = await file.text();
      const extension = path.extname(absolutePath);
      const languageId = LANGUAGE_EXTENSIONS[extension] ?? "plaintext";

      log(`Sending didOpen for ${absolutePath} (${languageId})`);
      // Always use version 0 for didOpen
      await connection.sendNotification("textDocument/didOpen", {
        textDocument: {
          uri: `file://${absolutePath}`,
          languageId,
          version: 0,
          text,
        },
      });
      
      log(`Sending didChange for ${absolutePath}`);
      // CRITICAL: Send a dummy change notification to force diagnostics
      // Some LSP servers (e.g., Pyright) cache diagnostics and won't re-send them
      // when a file is reopened with the same content. This ensures fresh diagnostics.
      await connection.sendNotification("textDocument/didChange", {
        textDocument: {
          uri: `file://${absolutePath}`,
          version: 1,
        },
        contentChanges: [{
          text: text,
        }],
      });
      log(`=== FILE OPEN SEQUENCE COMPLETE: ${absolutePath} ===`);
    },

    async closeFile(filePath: string): Promise<void> {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      
      // Clear diagnostics for this file when closing
      diagnostics.delete(absolutePath);
      
      await connection.sendNotification("textDocument/didClose", {
        textDocument: {
          uri: `file://${absolutePath}`,
        },
      });
    },

    getDiagnostics(filePath: string): Diagnostic[] {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      return diagnostics.get(absolutePath) || [];
    },

    async waitForDiagnostics(filePath: string, timeoutMs = 3000): Promise<void> {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      
      return new Promise((resolve, reject) => {
        let checkInterval: any;
        
        const timeout = setTimeout(() => {
          if (checkInterval) clearInterval(checkInterval);
          reject(new Error(`Timeout waiting for diagnostics for ${absolutePath}`));
        }, timeoutMs);

        // Check if we already have diagnostics
        if (diagnostics.has(absolutePath)) {
          clearTimeout(timeout);
          resolve();
          return;
        }

        // Check periodically for diagnostics
        checkInterval = setInterval(() => {
          if (diagnostics.has(absolutePath)) {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    },

    async triggerDiagnostics(filePath: string, timeoutMs: number = 5000): Promise<void> {
      log(`Getting diagnostics for ${filePath} with ${timeoutMs}ms timeout`);

      // Open the file to trigger diagnostics
      await this.openFile(filePath);

      // Wait for diagnostics
      await this.waitForDiagnostics(filePath, timeoutMs);
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
        return (result as DocumentSymbol[] | SymbolInformation[]) || [];
      } catch (error) {
        log(`documentSymbol not supported or failed: ${error}`);
        return [];
      }
    },

    async getDefinition(filePath: string, position: Position): Promise<Location[] | LocationLink[] | null> {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      log(`Getting definition for ${absolutePath} at ${position.line}:${position.character}`);
      
      // Ensure file is open
      await this.openFile(absolutePath);
      
      try {
        const result = await connection.sendRequest("textDocument/definition", {
          textDocument: {
            uri: `file://${absolutePath}`
          },
          position: position
        });
        return (result as Location[] | LocationLink[] | null);
      } catch (error) {
        log(`definition request failed: ${error}`);
        return null;
      }
    },

    async getTypeDefinition(filePath: string, position: Position): Promise<Location[] | LocationLink[] | null> {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      log(`Getting type definition for ${absolutePath} at ${position.line}:${position.character}`);
      
      // Ensure file is open
      await this.openFile(absolutePath);
      
      try {
        const result = await connection.sendRequest("textDocument/typeDefinition", {
          textDocument: {
            uri: `file://${absolutePath}`
          },
          position: position
        });
        return (result as Location[] | LocationLink[] | null);
      } catch (error) {
        log(`typeDefinition request failed: ${error}`);
        return null;
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
        return (result as Hover | null);
      } catch (error) {
        log(`hover request failed: ${error}`);
        return null;
      }
    },

    async shutdown(): Promise<void> {
      log(`Shutting down LSP client ${serverID}`);
      connection.end();
      connection.dispose();
      serverHandle.process.kill();
    }
  };

  return client;
}