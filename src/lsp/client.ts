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
    console.log(`Received diagnostics for ${filePath} from ${serverID}`);
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

  const openFiles = new Set<string>();

  return {
    serverID,
    root,
    diagnostics,

    async openFile(filePath: string): Promise<void> {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      
      if (openFiles.has(absolutePath)) {
        // Close first if already open
        await connection.sendNotification("textDocument/didClose", {
          textDocument: {
            uri: `file://${absolutePath}`,
          },
        });
      }

      const file = Bun.file(absolutePath);
      const text = await file.text();
      const extension = path.extname(absolutePath);
      const languageId = LANGUAGE_EXTENSIONS[extension] ?? "plaintext";

      await connection.sendNotification("textDocument/didOpen", {
        textDocument: {
          uri: `file://${absolutePath}`,
          languageId,
          version: 0,
          text,
        },
      });

      openFiles.add(absolutePath);
    },

    getDiagnostics(filePath: string): Diagnostic[] {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      return diagnostics.get(absolutePath) || [];
    },

    async waitForDiagnostics(filePath: string, timeoutMs = 3000): Promise<void> {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for diagnostics for ${absolutePath}`));
        }, timeoutMs);

        // Check if we already have diagnostics
        if (diagnostics.has(absolutePath)) {
          clearTimeout(timeout);
          resolve();
          return;
        }

        // Listen for diagnostic events
        const checkDiagnostics = () => {
          if (diagnostics.has(absolutePath)) {
            clearTimeout(timeout);
            resolve();
          } else {
            // Keep checking periodically
            setTimeout(checkDiagnostics, 100);
          }
        };

        setTimeout(checkDiagnostics, 100);
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