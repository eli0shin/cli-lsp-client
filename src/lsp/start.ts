import type { LSPServer } from './types.js';
import { getServerById, spawnServer, getProjectRoot, getConfigLanguageExtensions } from './servers.js';
import { createLSPClient } from './client.js';
import { log } from '../logger.js';
import { lspManager } from './manager.js';

async function hasAnyFile(
  directory: string,
  patterns: string[]
): Promise<boolean> {
  try {
    // Use simple file existence check instead of complex find command
    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        // For glob patterns, use Bun's glob functionality
        const glob = new Bun.Glob(pattern);
        const matches = glob.scan(directory);
        if ((await matches.next()).value) {
          log(`Found files matching ${pattern} in ${directory}`);
          return true;
        }
      } else {
        // For exact file names, check if file exists
        const filePath = `${directory}/${pattern}`;
        if (await Bun.file(filePath).exists()) {
          log(`Found exact file: ${filePath}`);
          return true;
        }
      }
    }
    log(`No files found for patterns: ${patterns.join(', ')} in ${directory}`);
    return false;
  } catch (error) {
    log(`hasAnyFile error: ${error}`);
    return false;
  }
}

export async function detectProjectTypes(
  directory: string
): Promise<LSPServer[]> {
  const detectedServers: LSPServer[] = [];
  const detectionPromises: Promise<void>[] = [];

  log(`Starting detection for directory: ${directory}`);

  // TypeScript/JavaScript
  detectionPromises.push(
    (async () => {
      log('Checking for TypeScript/JavaScript files...');
      if (
        await hasAnyFile(directory, [
          'tsconfig.json',
          'jsconfig.json',
          'package.json',
          '**/*.ts',
          '**/*.tsx',
          '**/*.js',
          '**/*.jsx',
          '**/*.mjs',
          '**/*.cjs',
        ])
      ) {
        log('TypeScript/JavaScript detected');
        const server = getServerById('typescript');
        if (server) detectedServers.push(server);
      } else {
        log('No TypeScript/JavaScript files found');
      }
    })()
  );

  // Python
  detectionPromises.push(
    (async () => {
      log('Checking for Python files...');
      if (
        await hasAnyFile(directory, [
          'pyproject.toml',
          'requirements.txt',
          '**/*.py',
          '**/*.pyi',
        ])
      ) {
        log('Python detected');
        const server = getServerById('pyright');
        if (server) {
          log('Pyright server found, adding to list');
          detectedServers.push(server);
        } else {
          log('WARNING: Pyright server not found in available servers!');
        }
      } else {
        log('No Python files found');
      }
    })()
  );

  // Go
  detectionPromises.push(
    (async () => {
      if (await hasAnyFile(directory, ['go.mod', '**/*.go'])) {
        const server = getServerById('gopls');
        if (server) detectedServers.push(server);
      }
    })()
  );

  // Java
  detectionPromises.push(
    (async () => {
      if (
        await hasAnyFile(directory, [
          'pom.xml',
          'build.gradle',
          'build.gradle.kts',
          '**/*.java',
        ])
      ) {
        const server = getServerById('jdtls');
        if (server) detectedServers.push(server);
      }
    })()
  );

  // Lua
  detectionPromises.push(
    (async () => {
      if (
        await hasAnyFile(directory, ['.luarc.json', '.luarc.jsonc', '**/*.lua'])
      ) {
        const server = getServerById('lua_ls');
        if (server) detectedServers.push(server);
      }
    })()
  );

  // GraphQL
  detectionPromises.push(
    (async () => {
      if (
        await hasAnyFile(directory, [
          '.graphqlrc',
          '.graphqlrc.yml',
          '.graphqlrc.yaml',
          '.graphqlrc.json',
          '**/*.graphql',
          '**/*.gql',
        ])
      ) {
        const server = getServerById('graphql');
        if (server) detectedServers.push(server);
      }
    })()
  );

  // YAML
  detectionPromises.push(
    (async () => {
      if (await hasAnyFile(directory, ['**/*.yml', '**/*.yaml'])) {
        const server = getServerById('yaml');
        if (server) detectedServers.push(server);
      }
    })()
  );

  // Bash
  detectionPromises.push(
    (async () => {
      if (await hasAnyFile(directory, ['**/*.sh', '**/*.bash', '**/*.zsh'])) {
        const server = getServerById('bash');
        if (server) detectedServers.push(server);
      }
    })()
  );

  // JSON
  detectionPromises.push(
    (async () => {
      if (await hasAnyFile(directory, ['**/*.json', '**/*.jsonc'])) {
        const server = getServerById('json');
        if (server) detectedServers.push(server);
      }
    })()
  );

  // CSS/SCSS
  detectionPromises.push(
    (async () => {
      if (
        await hasAnyFile(directory, [
          '**/*.css',
          '**/*.scss',
          '**/*.sass',
          '**/*.less',
        ])
      ) {
        const server = getServerById('css');
        if (server) detectedServers.push(server);
      }
    })()
  );

  // R
  detectionPromises.push(
    (async () => {
      if (
        await hasAnyFile(directory, [
          'DESCRIPTION',
          'NAMESPACE',
          '.Rproj',
          'renv.lock',
          '**/*.r',
          '**/*.R',
          '**/*.rmd',
          '**/*.Rmd',
        ])
      ) {
        const server = getServerById('r_language_server');
        if (server) detectedServers.push(server);
      }
    })()
  );

  // C#
  detectionPromises.push(
    (async () => {
      if (
        await hasAnyFile(directory, [
          '*.sln',
          '*.csproj',
          'project.json',
          'global.json',
          '**/*.cs',
        ])
      ) {
        const server = getServerById('omnisharp');
        if (server) detectedServers.push(server);
      }
    })()
  );

  // Run all detection checks in parallel
  await Promise.all(detectionPromises);

  return detectedServers;
}

export async function executeStart(directory?: string): Promise<string[]> {
  log(`=== START FUNCTION CALLED ===`);
  const targetDir = directory || process.cwd();
  log(`Target directory: ${targetDir}`);

  const projectServers = await detectProjectTypes(targetDir);

  log(
    `Detected ${projectServers.length} servers: ${projectServers.map((s) => s.id).join(', ')}`
  );

  log(`Starting ${projectServers.length} LSP servers for ${targetDir}...`);
  log(`Detected servers: ${projectServers.map((s) => s.id).join(', ')}`);

  const startedServers: string[] = [];

  for (const server of projectServers) {
    try {
      log(`Starting server: ${server.id}`);
      const root = await getProjectRoot(targetDir, server);
      log(`Project root for ${server.id}: ${root}`);

      // Use the same client key format as the manager
      const clientKey = `${server.id}:${root}`;
      log(`Client key: ${clientKey}`);

      // Check if client already exists in manager
      const existingClient = lspManager.getClient(server.id, root);
      if (existingClient) {
        log(`Client already exists for ${clientKey}, skipping start`);
        log(`✓ ${server.id} already started`);
        startedServers.push(server.id);
        continue;
      }

      const serverHandle = await spawnServer(server, root);

      if (!serverHandle) {
        log(`Failed to spawn server: ${server.id}`);
        log(`⚠ ${server.id} failed to spawn`);
        continue;
      }

      log(`Server spawned: ${server.id}`);
      log(`About to call createLSPClient for ${server.id} with root ${root}`);
      log(`ServerHandle process PID: ${serverHandle.process.pid}`);
      const client = await createLSPClient(server.id, serverHandle, root, getConfigLanguageExtensions() || undefined);
      log(`Client created for: ${server.id}`);

      // Store client in manager immediately
      lspManager.setClient(server.id, root, client);
      log(`Stored client in manager with key: ${clientKey}`);
      log(`✓ ${server.id} ready`);
      startedServers.push(server.id);
    } catch (error) {
      log(
        `Start failed for ${server.id}: ${error instanceof Error ? error.message : String(error)}`
      );
      log(
        `⚠ ${server.id} start failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  log('=== START FUNCTION COMPLETED ===');
  log('Start complete');
  return startedServers;
}
