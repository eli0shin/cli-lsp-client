import path from 'path';
import type { LSPClient, Diagnostic } from './types.js';
import { createLSPClient } from './client.js';
import { getApplicableServers, getProjectRoot, spawnServer } from './servers.js';
import { log } from '../logger.js';

export class LSPManager {
  private clients = new Map<string, LSPClient>();
  private broken = new Set<string>();

  private getClientKey(serverID: string, root: string): string {
    return `${serverID}:${root}`;
  }

  async getDiagnostics(filePath: string): Promise<Diagnostic[]> {
    log(`=== DIAGNOSTICS REQUEST START ===`);

    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    log(`Diagnostics requested for: ${absolutePath}`);

    // Check if file exists
    if (!await Bun.file(absolutePath).exists()) {
      log(`File does not exist: ${absolutePath}`);
      throw new Error(`File does not exist: ${absolutePath}`);
    }

    const applicableServers = await getApplicableServers(absolutePath);
    log(`Found ${applicableServers.length} applicable servers: ${applicableServers.map(s => s.id).join(', ')}`);

    if (applicableServers.length === 0) {
      log(`No LSP servers for file type, returning empty diagnostics`);
      return []; // No LSP servers for this file type
    }

    const allDiagnostics: Diagnostic[] = [];

    for (const server of applicableServers) {
      const root = await getProjectRoot(absolutePath, server);
      const clientKey = this.getClientKey(server.id, root);
      log(`Processing server: ${server.id} with root: ${root}, key: ${clientKey}`);

      // Skip if this server/root combo is known to be broken
      if (this.broken.has(clientKey)) {
        log(`Skipping broken server: ${clientKey}`);
        continue;
      }

      try {
        let client = this.clients.get(clientKey);

        if (!client) {
          log(`No existing client found for ${clientKey}, creating new client`);
          log(`Creating new LSP client for ${server.id} in ${root}`);
          const serverHandle = await spawnServer(server, root);
          if (!serverHandle) {
            log(`Failed to spawn server for ${server.id}`);
            this.broken.add(clientKey);
            continue;
          }

          client = await createLSPClient(server.id, serverHandle, root);
          this.clients.set(clientKey, client);
          log(`Created and cached new client for ${clientKey}`);
        } else {
          log(`Using existing client for ${clientKey}, age: ${Date.now() - client.createdAt}ms`);
        }

        // Get diagnostics using simplified approach
        try {
          log(`Getting diagnostics for: ${absolutePath}`);
          await client.triggerDiagnostics(absolutePath, 5000);
          log(`Successfully received diagnostics from ${server.id}`);
        } catch (error) {
          log(`Timeout waiting for diagnostics from ${server.id}: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Get diagnostics for this file
        const diagnostics = client.getDiagnostics(absolutePath);
        log(`Retrieved ${diagnostics.length} diagnostics from ${server.id}`);
        allDiagnostics.push(...diagnostics);

        // Close the file to ensure fresh content on next check
        await client.closeFile(absolutePath);

      } catch (error) {
        log(`Error getting diagnostics from ${server.id}: ${error instanceof Error ? error.message : String(error)}`);
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

    log(`=== DIAGNOSTICS REQUEST COMPLETE - Total: ${allDiagnostics.length} diagnostics ===`);
    return allDiagnostics;
  }

  async shutdown(): Promise<void> {
    log('Shutting down LSP manager...');

    const shutdownPromises = Array.from(this.clients.values()).map(async (client) => {
      try {
        await client.shutdown();
      } catch (error) {
        log(`Error shutting down LSP client ${client.serverID}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    await Promise.all(shutdownPromises);
    this.clients.clear();
    this.broken.clear();
  }
}

// Factory function for creating manager instances
export function createLSPManager(): LSPManager {
  return new LSPManager();
}

// Singleton instance for the daemon
export const lspManager = new LSPManager();
