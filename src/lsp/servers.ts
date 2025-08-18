import path from 'path';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import type { LSPServer } from './types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { log } from '../logger.js';
import { loadConfigFile, configServerToLSPServer } from './config.js';

const execAsync = promisify(exec);

async function findProjectRoot(
  fileOrDirPath: string,
  patterns: string[]
): Promise<string> {
  // Determine if it's a file or directory
  let current: string;

  // Check if path exists and if it's a directory
  try {
    const fs = await import('fs/promises');
    const stats = await fs.stat(fileOrDirPath);
    if (stats.isDirectory()) {
      current = fileOrDirPath;
    } else {
      current = path.dirname(fileOrDirPath);
    }
  } catch {
    // If stat fails, assume it's a file path and use its directory
    current = path.dirname(fileOrDirPath);
  }

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

  // Fallback: if it's a directory, return it; if it's a file, return its directory
  try {
    const fs = await import('fs/promises');
    const stats = await fs.stat(fileOrDirPath);
    return stats.isDirectory() ? fileOrDirPath : path.dirname(fileOrDirPath);
  } catch {
    return path.dirname(fileOrDirPath);
  }
}

export type ServerHandle = {
  process: ChildProcessWithoutNullStreams;
  initialization?: Record<string, unknown>;
};

const ALL_SERVERS: LSPServer[] = [
  {
    id: 'typescript',
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'],
    rootPatterns: ['tsconfig.json', 'package.json', 'jsconfig.json'],
    command: ['bunx', 'typescript-language-server', '--stdio'],
    env: { BUN_BE_BUN: '1' },
  },
  {
    id: 'pyright',
    extensions: ['.py', '.pyi'],
    rootPatterns: [
      'pyproject.toml',
      'setup.py',
      'setup.cfg',
      'requirements.txt',
      'Pipfile',
      'pyrightconfig.json',
    ],
    command: ['bunx', 'pyright-langserver', '--stdio'],
    env: { BUN_BE_BUN: '1' },
  },
  {
    id: 'gopls',
    extensions: ['.go'],
    rootPatterns: ['go.work', 'go.mod', 'go.sum'],
    command: ['gopls'],
    env: {},
  },
  {
    id: 'json',
    extensions: ['.json', '.jsonc'],
    rootPatterns: ['package.json', 'tsconfig.json', '.vscode'],
    command: ['bunx', 'vscode-json-language-server', '--stdio'],
    env: { BUN_BE_BUN: '1' },
  },
  {
    id: 'css',
    extensions: ['.css', '.scss', '.sass', '.less'],
    rootPatterns: ['package.json', '.vscode'],
    command: ['bunx', 'vscode-css-language-server', '--stdio'],
    env: { BUN_BE_BUN: '1' },
  },
  {
    id: 'yaml',
    extensions: ['.yaml', '.yml'],
    rootPatterns: [
      '.yamllint',
      'docker-compose.yml',
      'docker-compose.yaml',
      '.github',
      'k8s',
      'kubernetes',
    ],
    command: ['bunx', 'yaml-language-server', '--stdio'],
    env: { BUN_BE_BUN: '1' },
  },
  {
    id: 'bash',
    extensions: ['.sh', '.bash', '.zsh'],
    rootPatterns: ['Makefile', '.shellcheckrc'],
    command: ['bunx', 'bash-language-server', 'start'],
    env: { BUN_BE_BUN: '1' },
  },
  {
    id: 'jdtls',
    extensions: ['.java'],
    rootPatterns: [
      'pom.xml',
      'build.gradle',
      'build.gradle.kts',
      '.project',
      'src/main/java',
    ],
    command: ['jdtls'],
    env: {},
    dynamicArgs: (root: string) => [
      '-data',
      `/tmp/jdtls-workspace-${Buffer.from(root).toString('base64').replace(/[/+=]/g, '_')}`,
    ],
  },
  {
    id: 'lua_ls',
    extensions: ['.lua'],
    rootPatterns: [
      '.luarc.json',
      '.luarc.jsonc',
      '.luacheckrc',
      'stylua.toml',
      'init.lua',
      'main.lua',
    ],
    command: ['lua-language-server'],
    env: {},
  },
  {
    id: 'graphql',
    extensions: ['.graphql', '.gql'],
    rootPatterns: [
      '.graphqlrc.yml',
      '.graphqlrc.yaml',
      '.graphqlrc.json',
      'graphql.config.js',
      'graphql.config.ts',
      'schema.graphql',
      'package.json',
    ],
    command: [
      'bunx',
      'graphql-language-service-cli',
      'server',
      '--method',
      'stream',
    ],
    env: { BUN_BE_BUN: '1' },
  },
  {
    id: 'r_language_server',
    extensions: ['.r', '.R', '.rmd', '.Rmd'],
    rootPatterns: [
      'DESCRIPTION',
      'NAMESPACE',
      '.Rproj',
      'renv.lock',
      'packrat/packrat.lock',
      '.here',
    ],
    command: ['R', '--slave', '-e', 'languageserver::run()'],
    env: {},
  },
  {
    id: 'omnisharp',
    extensions: ['.cs'],
    rootPatterns: [
      '*.sln',
      '*.csproj',
      'project.json',
      'global.json',
      'Directory.Build.props',
      'Directory.Build.targets',
    ],
    command: ['omnisharp', '--languageserver'],
    env: {},
    dynamicArgs: (root: string) => ['--source', root],
  },
];

// Ensure vscode-langservers-extracted is installed globally
async function ensureVscodeExtracted(): Promise<boolean> {
  try {
    // Check if already installed by trying to run one of the servers
    await execAsync('bunx vscode-css-language-server --help', {
      timeout: 5000,
    });
    return true;
  } catch {
    // Try to install it
    try {
      log('Installing vscode-langservers-extracted...');
      await execAsync('bun add -g vscode-langservers-extracted', {
        timeout: 30000,
      });
      return true;
    } catch (error) {
      log(`Failed to install vscode-langservers-extracted: ${error}`);
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
    if (server.command[0] === 'bunx') {
      availableServers.push(server);
      continue;
    }

    // Special handling for OmniSharp - requires DOTNET_ROOT
    if (server.id === 'omnisharp') {
      if (process.env.DOTNET_ROOT) {
        try {
          const result = Bun.which(server.command[0]);
          if (result) {
            availableServers.push(server);
          }
        } catch {
          // OmniSharp not found in PATH, skip it
        }
      }
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

// Initialize servers by loading config file and merging with built-in servers
// This should be called once at daemon startup
export async function initializeServers(): Promise<void> {
  try {
    const configFile = await loadConfigFile();
    
    if (configFile?.servers) {
      log(`Loading ${configFile.servers.length} servers from config file`);
      const configServers = configFile.servers.map(configServerToLSPServer);
      
      // Check for ID conflicts and handle them
      for (const configServer of configServers) {
        const existingIndex = ALL_SERVERS.findIndex(s => s.id === configServer.id);
        if (existingIndex >= 0) {
          log(`Config server '${configServer.id}' overrides built-in server`);
          ALL_SERVERS[existingIndex] = configServer; // Replace built-in with config
        } else {
          log(`Adding new server '${configServer.id}' from config`);
          ALL_SERVERS.push(configServer);
        }
      }
    } else {
      log('No config file found, using built-in servers only');
    }
  } catch (error) {
    log(`Error loading config file: ${error instanceof Error ? error.message : String(error)}`);
    log('Continuing with built-in servers only');
  }
}

export async function getApplicableServers(
  filePath: string
): Promise<LSPServer[]> {
  if (!cachedServers) {
    cachedServers = await getAvailableServers();
  }

  const ext = path.extname(filePath);
  return cachedServers.filter((server) => server.extensions.includes(ext));
}

export async function getAllAvailableServers(): Promise<LSPServer[]> {
  if (!cachedServers) {
    cachedServers = await getAvailableServers();
  }
  return cachedServers;
}

export function getServerById(id: string): LSPServer | null {
  return ALL_SERVERS.find((server) => server.id === id) || null;
}

export async function getProjectRoot(
  fileOrDirPath: string,
  server: LSPServer
): Promise<string> {
  return await findProjectRoot(fileOrDirPath, server.rootPatterns);
}

export async function spawnServer(
  server: LSPServer,
  root: string
): Promise<ServerHandle | null> {
  try {
    // Build command with dynamic args if provided
    let command = [...server.command];
    if (server.dynamicArgs) {
      command = [...command, ...server.dynamicArgs(root)];
    }

    log(`Spawning ${server.id} with command: ${command.join(' ')} in ${root}`);

    const childProcess = spawn(command[0], command.slice(1), {
      cwd: root,
      env: {
        ...process.env,
        ...server.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Basic error handling
    childProcess.on('error', (error) => {
      log(`LSP server ${server.id} failed to start: ${error}`);
    });

    childProcess.on('exit', (code, signal) => {
      log(`LSP server ${server.id} exited with code ${code}, signal ${signal}`);
    });

    childProcess.stderr.on('data', (data: Buffer) => {
      log(`LSP server ${server.id} stderr: ${data.toString()}`);
    });

    return {
      process: childProcess,
      initialization: server.initialization,
    };
  } catch (error) {
    log(`Failed to spawn LSP server ${server.id}: ${error}`);
    return null;
  }
}
