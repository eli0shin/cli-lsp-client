import path from 'path';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import type { LSPServer } from './types.js';

async function findProjectRoot(filePath: string, patterns: string[]): Promise<string> {
  let current = path.dirname(filePath);
  const root = path.parse(current).root;
  
  while (current !== root) {
    for (const pattern of patterns) {
      const configPath = path.join(current, pattern);
      if (await Bun.file(configPath).exists()) {
        return current;
      }
    }
    current = path.dirname(current);
  }
  
  return path.dirname(filePath); // fallback to file directory
}

export interface ServerHandle {
  process: ChildProcessWithoutNullStreams;
  initialization?: Record<string, any>;
}

export const BUILTIN_SERVERS: LSPServer[] = [
  {
    id: "typescript",
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"],
    rootPatterns: ["tsconfig.json", "package.json", "jsconfig.json"],
    command: ["bunx", "typescript-language-server", "--stdio"],
    env: { BUN_BE_BUN: "1" }
  },
  {
    id: "pyright", 
    extensions: [".py", ".pyi"],
    rootPatterns: ["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt", "Pipfile", "pyrightconfig.json"],
    command: ["bunx", "pyright-langserver", "--stdio"],
    env: { BUN_BE_BUN: "1" }
  }
];

export function getApplicableServers(filePath: string): LSPServer[] {
  const ext = path.extname(filePath);
  return BUILTIN_SERVERS.filter(server => 
    server.extensions.includes(ext)
  );
}

export async function getProjectRoot(filePath: string, server: LSPServer): Promise<string> {
  return await findProjectRoot(filePath, server.rootPatterns);
}

export async function spawnServer(server: LSPServer, root: string): Promise<ServerHandle | null> {
  try {
    const childProcess = spawn(server.command[0], server.command.slice(1), {
      cwd: root,
      env: {
        ...process.env,
        ...server.env
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Basic error handling
    childProcess.on('error', (error) => {
      console.error(`LSP server ${server.id} failed to start:`, error);
    });

    return {
      process: childProcess,
      initialization: server.initialization
    };
  } catch (error) {
    console.error(`Failed to spawn LSP server ${server.id}:`, error);
    return null;
  }
}