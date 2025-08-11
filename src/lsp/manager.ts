import path from 'path';
import type { LSPClient, Diagnostic } from './types.js';
import { createLSPClient } from './client.js';
import { getApplicableServers, getProjectRoot, spawnServer } from './servers.js';

export class LSPManager {
  private clients = new Map<string, LSPClient>();
  private broken = new Set<string>();

  private getClientKey(serverID: string, root: string): string {
    return `${serverID}:${root}`;
  }

  async getDiagnostics(filePath: string): Promise<Diagnostic[]> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    
    // Check if file exists
    if (!await Bun.file(absolutePath).exists()) {
      throw new Error(`File does not exist: ${absolutePath}`);
    }

    const applicableServers = getApplicableServers(absolutePath);
    if (applicableServers.length === 0) {
      return []; // No LSP servers for this file type
    }

    const allDiagnostics: Diagnostic[] = [];

    for (const server of applicableServers) {
      const root = await getProjectRoot(absolutePath, server);
      const clientKey = this.getClientKey(server.id, root);

      // Skip if this server/root combo is known to be broken
      if (this.broken.has(clientKey)) {
        continue;
      }

      try {
        let client = this.clients.get(clientKey);

        // Create client if it doesn't exist
        if (!client) {
          console.log(`Creating new LSP client for ${server.id} in ${root}`);
          const serverHandle = await spawnServer(server, root);
          if (!serverHandle) {
            this.broken.add(clientKey);
            continue;
          }

          client = await createLSPClient(server.id, serverHandle, root);
          this.clients.set(clientKey, client);
        }

        // Open the file to trigger diagnostics
        await client.openFile(absolutePath);

        // Wait for diagnostics with timeout
        try {
          await client.waitForDiagnostics(absolutePath, 5000);
        } catch (error) {
          console.warn(`Timeout waiting for diagnostics from ${server.id}:`, error);
        }

        // Get diagnostics for this file
        const diagnostics = client.getDiagnostics(absolutePath);
        allDiagnostics.push(...diagnostics);

      } catch (error) {
        console.error(`Error getting diagnostics from ${server.id}:`, error);
        this.broken.add(clientKey);
        
        // Clean up failed client
        const client = this.clients.get(clientKey);
        if (client) {
          try {
            await client.shutdown();
          } catch (e) {
            // Ignore shutdown errors
          }
          this.clients.delete(clientKey);
        }
      }
    }

    return allDiagnostics;
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down LSP manager...');
    
    const shutdownPromises = Array.from(this.clients.values()).map(async (client) => {
      try {
        await client.shutdown();
      } catch (error) {
        console.error(`Error shutting down LSP client ${client.serverID}:`, error);
      }
    });

    await Promise.all(shutdownPromises);
    this.clients.clear();
    this.broken.clear();
  }
}

// Singleton instance for the daemon
export const lspManager = new LSPManager();