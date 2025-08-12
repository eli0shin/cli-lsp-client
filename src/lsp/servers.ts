import path from 'path';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import type { LSPServer } from './types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

const ALL_SERVERS: LSPServer[] = [
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
  },
  {
    id: "gopls",
    extensions: [".go"],
    rootPatterns: ["go.work", "go.mod", "go.sum"],
    command: ["gopls"],
    env: {}
  },
  {
    id: "json",
    extensions: [".json", ".jsonc"],
    rootPatterns: ["package.json", "tsconfig.json", ".vscode"],
    command: ["bunx", "vscode-json-language-server", "--stdio"],
    env: { BUN_BE_BUN: "1" }
  },
  {
    id: "css",
    extensions: [".css", ".scss", ".sass", ".less"],
    rootPatterns: ["package.json", ".vscode"],
    command: ["bunx", "vscode-css-language-server", "--stdio"],
    env: { BUN_BE_BUN: "1" }
  },
  {
    id: "yaml",
    extensions: [".yaml", ".yml"],
    rootPatterns: [".yamllint", "docker-compose.yml", "docker-compose.yaml", ".github", "k8s", "kubernetes"],
    command: ["bunx", "yaml-language-server", "--stdio"],
    env: { BUN_BE_BUN: "1" }
  },
  {
    id: "bash",
    extensions: [".sh", ".bash", ".zsh"],
    rootPatterns: ["Makefile", ".shellcheckrc"],
    command: ["bunx", "bash-language-server", "start"],
    env: { BUN_BE_BUN: "1" }
  },
  {
    id: "jdtls",
    extensions: [".java"],
    rootPatterns: ["pom.xml", "build.gradle", "build.gradle.kts", ".project", "src/main/java"],
    command: ["jdtls"],
    env: {}
  },
  {
    id: "lua_ls",
    extensions: [".lua"],
    rootPatterns: [".luarc.json", ".luarc.jsonc", ".luacheckrc", "stylua.toml", "init.lua", "main.lua"],
    command: ["lua-language-server"],
    env: {}
  },
  {
    id: "graphql",
    extensions: [".graphql", ".gql"],
    rootPatterns: [".graphqlrc.yml", ".graphqlrc.yaml", ".graphqlrc.json", "graphql.config.js", "graphql.config.ts", "schema.graphql", "package.json"],
    command: ["bunx", "graphql-language-service-cli", "server", "--method", "stream"],
    env: { BUN_BE_BUN: "1" }
  }
];

// Ensure vscode-langservers-extracted is installed globally
async function ensureVscodeExtracted(): Promise<boolean> {
  try {
    // Check if already installed by trying to run one of the servers
    await execAsync('bunx vscode-css-language-server --help', { timeout: 5000 });
    return true;
  } catch {
    // Try to install it
    try {
      console.log('Installing vscode-langservers-extracted...');
      await execAsync('bun add -g vscode-langservers-extracted', { timeout: 30000 });
      return true;
    } catch (error) {
      console.error('Failed to install vscode-langservers-extracted:', error);
      return false;
    }
  }
}

// Filter servers based on availability (for manual install servers)
async function getAvailableServers(): Promise<LSPServer[]> {
  const availableServers: LSPServer[] = [];
  
  for (const server of ALL_SERVERS) {
    // Handle vscode-langservers-extracted servers specially
    if (server.command.includes('vscode-css-language-server')) {
      const isAvailable = await ensureVscodeExtracted();
      if (isAvailable) {
        availableServers.push(server);
      }
      continue;
    }
    
    // Auto-installable servers (via bunx) are always available
    if (server.command[0] === "bunx") {
      availableServers.push(server);
      continue;
    }
    
    // Check if manually installed servers exist
    try {
      const result = Bun.which(server.command[0]);
      if (result) {
        availableServers.push(server);
      }
    } catch {
      // Server not found, skip it
    }
  }
  
  return availableServers;
}

let cachedServers: LSPServer[] | null = null;

export async function getApplicableServers(filePath: string): Promise<LSPServer[]> {
  if (!cachedServers) {
    cachedServers = await getAvailableServers();
  }
  
  const ext = path.extname(filePath);
  return cachedServers.filter(server => 
    server.extensions.includes(ext)
  );
}

export async function getAllAvailableServers(): Promise<LSPServer[]> {
  if (!cachedServers) {
    cachedServers = await getAvailableServers();
  }
  return cachedServers;
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