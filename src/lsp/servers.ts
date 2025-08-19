import path from 'path';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import type { LSPServer } from './types.js';
import { log } from '../logger.js';
import { loadConfigFile, configServerToLSPServer } from './config.js';
import { bunxCommand, ensurePackageInstalled, getLocalCommandPath } from '../bun/index.js';

async function findProjectRoot(
  fileOrDirPath: string,
  patterns: string[]
): Promise<string> {
  // If LSP_SINGLE_ROOT is set, always use CWD as the root
  // This forces all files to share the same LSP instance per language
  if (process.env.LSP_SINGLE_ROOT === 'true') {
    return process.cwd();
  }

  // Standard behavior: search for root patterns
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

  // Search upward for root patterns
  while (current !== root) {
    for (const pattern of patterns) {
      const configPath = path.join(current, pattern);
      if (await Bun.file(configPath).exists()) {
        return current;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break; // Prevent infinite loop at root
    current = parent;
  }

  // Fallback: Use the current working directory as the project root
  // This ensures that files in the same working directory share the same LSP instance
  return process.cwd();
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
    command: bunxCommand('typescript-language-server', '--stdio'),
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
    command: bunxCommand('pyright-langserver', '--stdio'),
    packageName: 'pyright',
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
    command: bunxCommand('vscode-json-language-server', '--stdio'),
    packageName: 'vscode-langservers-extracted',
    env: { BUN_BE_BUN: '1' },
  },
  {
    id: 'css',
    extensions: ['.css', '.scss', '.sass', '.less'],
    rootPatterns: ['package.json', '.vscode'],
    command: bunxCommand('vscode-css-language-server', '--stdio'),
    packageName: 'vscode-langservers-extracted',
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
    command: bunxCommand('yaml-language-server', '--stdio'),
    env: { BUN_BE_BUN: '1' },
  },
  {
    id: 'bash',
    extensions: ['.sh', '.bash', '.zsh'],
    rootPatterns: ['Makefile', '.shellcheckrc'],
    command: bunxCommand('bash-language-server', 'start'),
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
    command: bunxCommand(
      'graphql-lsp',
      'server',
      '--method',
      'stream'
    ),
    packageName: 'graphql-language-service-cli',
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

// Check if a command is available (for manually installed servers)
async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    const result = Bun.which(command);
    return result !== null;
  } catch {
    return false;
  }
}

// Filter servers based on availability (for manual install servers)
async function getAvailableServers(): Promise<LSPServer[]> {
  const availableServers: LSPServer[] = [];

  for (const server of ALL_SERVERS) {
    const firstCommand = server.command[0];
    
    // Servers that use local package installation are always available
    // They will be installed on-demand when first used
    if (firstCommand.includes('/.lsp-cli-client/packages/node_modules/.bin/')) {
      availableServers.push(server);
      continue;
    }

    // Special handling for OmniSharp - requires DOTNET_ROOT
    if (server.id === 'omnisharp') {
      if (process.env.DOTNET_ROOT && await isCommandAvailable(server.command[0])) {
        availableServers.push(server);
      }
      continue;
    }

    // Check if manually installed servers exist
    if (await isCommandAvailable(server.command[0])) {
      availableServers.push(server);
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
        const existingIndex = ALL_SERVERS.findIndex(
          (s) => s.id === configServer.id
        );
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
    log(
      `Error loading config file: ${error instanceof Error ? error.message : String(error)}`
    );
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

/**
 * Extract the actual command from a package manager invocation
 * @param command The full command array
 * @returns {actualCommand, packageManager} or null if not a package manager command
 */
function extractPackageManagerCommand(command: string[]): { 
  actualCommand: string; 
  packageManager: 'bunx' | 'npx' | null;
} | null {
  if (command.length < 2) return null;
  
  const first = command[0];
  const second = command[1];
  
  // Handle "bunx command" or "bun x command"
  if (first === 'bunx' || (first === 'bun' && second === 'x')) {
    const commandIndex = first === 'bunx' ? 1 : 2;
    // Skip flags like --bun
    let actualIndex = commandIndex;
    while (actualIndex < command.length && command[actualIndex].startsWith('-')) {
      actualIndex++;
    }
    if (actualIndex < command.length) {
      return { actualCommand: command[actualIndex], packageManager: 'bunx' };
    }
  }
  
  // Handle "npx command" or "npm exec command"
  if (first === 'npx' || (first === 'npm' && second === 'exec')) {
    const commandIndex = first === 'npx' ? 1 : 2;
    // Skip flags like -y, --yes, etc.
    let actualIndex = commandIndex;
    while (actualIndex < command.length && command[actualIndex].startsWith('-')) {
      actualIndex++;
    }
    if (actualIndex < command.length) {
      return { actualCommand: command[actualIndex], packageManager: 'npx' };
    }
  }
  
  return null;
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

    // Check if this is a package manager command (bunx, npx, etc.)
    const pmCommand = extractPackageManagerCommand(command);
    
    if (pmCommand && server.packageName) {
      // Only transform package manager commands when packageName is explicitly specified
      // This indicates a command/package name mismatch that needs local installation
      const { actualCommand } = pmCommand;
      
      log(`Installing package '${server.packageName}' for command '${actualCommand}'`);
      const installed = await ensurePackageInstalled(server.packageName);
      
      if (!installed) {
        log(`Failed to install package '${server.packageName}' for ${server.id}`);
        return null;
      }
      
      // Replace the package manager invocation with the local binary
      const localPath = getLocalCommandPath(actualCommand);
      // Find where the actual command is in the array and replace everything before it
      const commandIndex = command.findIndex(c => c === actualCommand);
      if (commandIndex > 0) {
        command = [localPath, ...command.slice(commandIndex + 1)];
      } else {
        command = [localPath];
      }
    } else if (command[0].includes('/.lsp-cli-client/packages/node_modules/.bin/')) {
      // This is already a local command path from bunxCommand()
      const commandName = path.basename(command[0]);
      // Use packageName from server config, otherwise use command name
      const packageName = server.packageName || commandName;
      
      log(`Ensuring package '${packageName}' is installed for command '${commandName}'`);
      const installed = await ensurePackageInstalled(packageName);
      
      if (!installed) {
        log(`Failed to install package '${packageName}' for ${server.id}`);
        return null;
      }
    } else if (server.packageName) {
      // Server has a packageName but no package manager prefix
      // This means we should install the package and use the command as-is
      log(`Installing package '${server.packageName}' for ${server.id}`);
      const installed = await ensurePackageInstalled(server.packageName);
      
      if (!installed) {
        log(`Failed to install package '${server.packageName}' for ${server.id}`);
        // Continue anyway - the command might be globally installed
      }
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
