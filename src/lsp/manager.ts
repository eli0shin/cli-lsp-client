import path from 'path';
import type { LSPClient, Diagnostic, HoverResult, Position, LSPServer, Location, LocationLink } from './types.js';
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

  async getHover(symbolName: string, filePath: string): Promise<HoverResult[]> {
    log(`=== HOVER REQUEST START ===`);
    log(`Symbol: ${symbolName}, File: ${filePath}`);
    
    const results: HoverResult[] = [];
    
    // File-scoped search only
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    
    if (!await Bun.file(absolutePath).exists()) {
      throw new Error(`File does not exist: ${absolutePath}`);
    }
    
    const applicableServers = await getApplicableServers(absolutePath);
    
    for (const server of applicableServers) {
      const root = await getProjectRoot(absolutePath, server);
      const client = await this.getOrCreateClient(server, root);
      
      if (!client) continue;
      
      try {
        // Read file content to find text occurrences
        const fileContent = await Bun.file(absolutePath).text();
        const symbolPositions = this.findSymbolOccurrences(fileContent, symbolName);
        
        // Try hover at each occurrence
        for (const position of symbolPositions) {
          let hoverLocation = position;
          let hoverFile = absolutePath;
          
          // Try to get the type definition for better hover information
          try {
            const typeDefinitions = await client.getTypeDefinition(absolutePath, position);
            if (typeDefinitions && typeDefinitions.length > 0) {
              const firstTypeDef = typeDefinitions[0];
              if ('uri' in firstTypeDef) {
                const location = firstTypeDef as Location;
                const typeDefFile = new URL(location.uri).pathname;
                const typeDefLocation = location.range.start;
                
                // Only use type definition if it's different from original location
                if (typeDefFile !== absolutePath || typeDefLocation.line !== position.line) {
                  hoverFile = typeDefFile;
                  hoverLocation = typeDefLocation;
                  log(`Using type definition at ${hoverFile}:${hoverLocation.line}:${hoverLocation.character}`);
                }
              } else if ('targetUri' in firstTypeDef) {
                const locationLink = firstTypeDef as LocationLink;
                const typeDefFile = new URL(locationLink.targetUri).pathname;
                const typeDefLocation = locationLink.targetSelectionRange?.start || locationLink.targetRange.start;
                
                // Only use type definition if it's different from original location
                if (typeDefFile !== absolutePath || typeDefLocation.line !== position.line) {
                  hoverFile = typeDefFile;
                  hoverLocation = typeDefLocation;
                  log(`Using type definition link at ${hoverFile}:${hoverLocation.line}:${hoverLocation.character}`);
                }
              }
            }
          } catch (error) {
            log(`Type definition lookup failed: ${error}`);
          }
          
          // Get hover at the definition location (or original location if definition failed)
          let hover = await client.getHover(hoverFile, hoverLocation);
          
          if (hover) {
            results.push({
              symbol: symbolName,
              hover: hover,
              location: {
                file: path.relative(process.cwd(), hoverFile),
                line: hoverLocation.line,
                column: hoverLocation.character
              }
            });
            // For now, return first successful result to avoid duplicates
            break;
          }
        }
        
        // If we found results, break to avoid duplicates from other servers
        if (results.length > 0) break;
        
      } catch (error) {
        log(`Error getting hover from ${server.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    log(`=== HOVER REQUEST COMPLETE - Found ${results.length} results ===`);
    return results;
  }

  // Helper method to find text occurrences of symbol name in file content
  private findSymbolOccurrences(fileContent: string, symbolName: string): Position[] {
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
        const afterChar = occurrence + symbolName.length < line.length ? line[occurrence + symbolName.length] : ' ';
        
        const isWordBoundary = 
          !this.isIdentifierChar(beforeChar) && 
          !this.isIdentifierChar(afterChar);
        
        if (isWordBoundary) {
          positions.push({
            line: lineIndex,
            character: occurrence
          });
        }
        
        columnIndex = occurrence + 1;
      }
    }
    
    return positions;
  }
  
  // Helper to check if a character is part of an identifier
  private isIdentifierChar(char: string): boolean {
    return /[a-zA-Z0-9_$]/.test(char);
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
        log(`Creating new LSP client for ${server.id} in ${root}`);
        const serverHandle = await spawnServer(server, root);
        if (!serverHandle) {
          this.broken.add(clientKey);
          return null;
        }
        
        client = await createLSPClient(server.id, serverHandle, root);
        this.clients.set(clientKey, client);
      } catch (error) {
        log(`Failed to create client: ${error instanceof Error ? error.message : String(error)}`);
        this.broken.add(clientKey);
        return null;
      }
    }
    
    return client;
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
