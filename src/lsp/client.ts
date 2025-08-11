import path from 'path';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';
import type { LSPClient, Diagnostic } from './types.js';
import type { ServerHandle } from './servers.js';
import { LANGUAGE_EXTENSIONS } from './language.js';

export async function createLSPClient(
  serverID: string, 
  serverHandle: ServerHandle, 
  root: string
): Promise<LSPClient> {
  console.log(`Creating LSP client for ${serverID}`);

  const connection = createMessageConnection(
    new StreamMessageReader(serverHandle.process.stdout),
    new StreamMessageWriter(serverHandle.process.stdin)
  );

  const diagnostics = new Map<string, Diagnostic[]>();

  // Listen for diagnostics
  connection.onNotification("textDocument/publishDiagnostics", (params) => {
    const filePath = new URL(params.uri).pathname;
    diagnostics.set(filePath, params.diagnostics);
  });

  // Handle requests
  connection.onRequest("window/workDoneProgress/create", () => null);
  connection.onRequest("workspace/configuration", () => [{}]);

  connection.listen();

  // Initialize the LSP server
  console.log(`Initializing LSP server ${serverID}`);
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
      },
    },
  });

  await connection.sendNotification("initialized", {});
  console.log(`LSP server ${serverID} initialized`);

  return {
    serverID,
    root,
    diagnostics,

    async openFile(filePath: string): Promise<void> {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      
      
      // Clear any existing diagnostics before opening
      diagnostics.delete(absolutePath);
      
      const file = Bun.file(absolutePath);
      const text = await file.text();
      const extension = path.extname(absolutePath);
      const languageId = LANGUAGE_EXTENSIONS[extension] ?? "plaintext";

      // Always use version 0 for didOpen
      await connection.sendNotification("textDocument/didOpen", {
        textDocument: {
          uri: `file://${absolutePath}`,
          languageId,
          version: 0,
          text,
        },
      });
      
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
    },

    async closeFile(filePath: string): Promise<void> {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      
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

    async shutdown(): Promise<void> {
      console.log(`Shutting down LSP client ${serverID}`);
      connection.end();
      connection.dispose();
      serverHandle.process.kill();
    }
  };
}