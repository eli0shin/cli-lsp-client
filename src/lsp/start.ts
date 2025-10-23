import type { LSPServer } from './types.js';
import {
  getServerById,
  spawnServer,
  getProjectRoot,
  getConfigLanguageExtensions,
} from './servers.js';
import { createLSPClient } from './client.js';
import { log } from '../logger.js';
import {
  getClient,
  isInitializing,
  waitForInitialization,
  setClient,
  setInitializing,
} from './manager.js';

function expandDepthLimitedPattern(pattern: string, maxDepth = 3): string[] {
  // If pattern doesn't contain **/, return as-is
  if (!pattern.includes('**/')) {
    return [pattern];
  }

  // Extract the file pattern after **/
  const filePattern = pattern.replace('**/', '');
  const expandedPatterns: string[] = [];

  // Add pattern for root directory
  expandedPatterns.push(filePattern);

  // Add patterns for each depth level
  for (let depth = 1; depth <= maxDepth; depth++) {
    const depthPattern = '*/'.repeat(depth) + filePattern;
    expandedPatterns.push(depthPattern);
  }

  return expandedPatterns;
}

async function hasAnyFile(
  directory: string,
  patterns: string[]
): Promise<boolean> {
  try {
    // Check if we're in a git repository
    const isGitRepo = await Bun.file(`${directory}/.git/HEAD`).exists();

    if (isGitRepo) {
      // Separate exact files from glob patterns
      const exactFiles: string[] = [];
      const globPatterns: string[] = [];

      for (const pattern of patterns) {
        if (pattern.includes('*')) {
          globPatterns.push(pattern);
        } else {
          exactFiles.push(pattern);
        }
      }

      // Check exact files first (very fast)
      for (const file of exactFiles) {
        const filePath = `${directory}/${file}`;
        if (await Bun.file(filePath).exists()) {
          log(`Found exact file: ${filePath}`);
          return true;
        }
      }

      // If we have glob patterns, batch them into a single git ls-files call
      if (globPatterns.length > 0) {
        // Expand patterns with depth limit
        const expandedPatterns: string[] = [];
        for (const pattern of globPatterns) {
          const expanded = expandDepthLimitedPattern(pattern, 3);
          expandedPatterns.push(...expanded);
        }

        // Execute single git ls-files with all patterns
        const proc = Bun.spawn(
          [
            'git',
            'ls-files',
            '-z', // Use null terminator for safety
            ...expandedPatterns,
          ],
          {
            cwd: directory,
            stdout: 'pipe',
            stderr: 'pipe',
          }
        );

        // Read just enough to know if any files exist
        const reader = proc.stdout.getReader();
        const { value } = await reader.read();

        // Kill the process as soon as we find a match
        proc.kill();
        await proc.exited;

        if (value && value.length > 0) {
          log(`Found tracked files matching patterns in ${directory}`);
          return true;
        }
      }
    } else {
      // Not a git repo, use original Bun.Glob logic with depth limit
      for (const pattern of patterns) {
        if (pattern.includes('*')) {
          // Apply depth limiting to glob patterns
          const expandedPatterns = expandDepthLimitedPattern(pattern, 3);

          for (const expandedPattern of expandedPatterns) {
            const glob = new Bun.Glob(expandedPattern);
            const matches = glob.scan(directory);
            if ((await matches.next()).value) {
              log(`Found files matching ${expandedPattern} in ${directory}`);
              return true;
            }
          }
        } else {
          const filePath = `${directory}/${pattern}`;
          if (await Bun.file(filePath).exists()) {
            log(`Found exact file: ${filePath}`);
            return true;
          }
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

async function detectAllFileTypesOptimized(
  directory: string
): Promise<Set<string>> {
  const detectedTypes = new Set<string>();

  try {
    // Check if we're in a git repository
    const isGitRepo = await Bun.file(`${directory}/.git/HEAD`).exists();

    if (!isGitRepo) {
      // Fall back to individual hasAnyFile checks for non-git repos
      return detectedTypes;
    }

    // First check exact files (config files)
    const exactFiles = {
      typescript: ['tsconfig.json', 'jsconfig.json', 'package.json'],
      python: ['pyproject.toml', 'requirements.txt'],
      go: ['go.mod'],
      java: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
      lua: ['.luarc.json', '.luarc.jsonc'],
      graphql: [
        '.graphqlrc',
        '.graphqlrc.yml',
        '.graphqlrc.yaml',
        '.graphqlrc.json',
      ],
      r: ['DESCRIPTION', 'NAMESPACE', '.Rproj', 'renv.lock'],
      csharp: ['project.json', 'global.json'],
    };

    // Check exact files directly
    for (const [language, files] of Object.entries(exactFiles)) {
      for (const file of files) {
        const filePath = `${directory}/${file}`;
        if (await Bun.file(filePath).exists()) {
          detectedTypes.add(language);
          break; // One config file is enough to detect the language
        }
      }
    }

    // Use a targeted approach: check for source files with specific extensions
    // This limits the output size while still being efficient
    const sourcePatterns = [
      '*.ts',
      '*.tsx',
      '*.js',
      '*.jsx',
      '*.mjs',
      '*.cjs', // JS/TS
      '*.py',
      '*.pyi', // Python
      '*.go', // Go
      '*.java', // Java
      '*.lua', // Lua
      '*.graphql',
      '*.gql', // GraphQL
      '*.yml',
      '*.yaml', // YAML
      '*.sh',
      '*.bash',
      '*.zsh', // Bash
      '*.json',
      '*.jsonc', // JSON
      '*.css',
      '*.scss',
      '*.sass',
      '*.less', // CSS
      '*.r',
      '*.R',
      '*.rmd',
      '*.Rmd', // R
      '*.cs',
      '*.sln',
      '*.csproj', // C#
    ];

    const proc = Bun.spawn(['git', 'ls-files', ...sourcePatterns], {
      cwd: directory,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    if (output.trim()) {
      const files = output.trim().split('\n');

      // Process the filtered list of source files
      for (const file of files) {
        const fileName = file.split('/').pop() || file;
        const lowerFile = fileName.toLowerCase();

        // Since we already filtered by extension, just categorize
        if (
          lowerFile.endsWith('.ts') ||
          lowerFile.endsWith('.tsx') ||
          lowerFile.endsWith('.js') ||
          lowerFile.endsWith('.jsx') ||
          lowerFile.endsWith('.mjs') ||
          lowerFile.endsWith('.cjs')
        ) {
          detectedTypes.add('typescript');
        }
        if (lowerFile.endsWith('.py') || lowerFile.endsWith('.pyi')) {
          detectedTypes.add('python');
        }
        if (lowerFile.endsWith('.go')) {
          detectedTypes.add('go');
        }
        if (lowerFile.endsWith('.java')) {
          detectedTypes.add('java');
        }
        if (lowerFile.endsWith('.lua')) {
          detectedTypes.add('lua');
        }
        if (lowerFile.endsWith('.graphql') || lowerFile.endsWith('.gql')) {
          detectedTypes.add('graphql');
        }
        if (lowerFile.endsWith('.yml') || lowerFile.endsWith('.yaml')) {
          detectedTypes.add('yaml');
        }
        if (
          lowerFile.endsWith('.sh') ||
          lowerFile.endsWith('.bash') ||
          lowerFile.endsWith('.zsh')
        ) {
          detectedTypes.add('bash');
        }
        if (lowerFile.endsWith('.json') || lowerFile.endsWith('.jsonc')) {
          detectedTypes.add('json');
        }
        if (
          lowerFile.endsWith('.css') ||
          lowerFile.endsWith('.scss') ||
          lowerFile.endsWith('.sass') ||
          lowerFile.endsWith('.less')
        ) {
          detectedTypes.add('css');
        }
        if (
          lowerFile.endsWith('.r') ||
          lowerFile === 'description' ||
          lowerFile === 'namespace' ||
          lowerFile.endsWith('.rmd')
        ) {
          detectedTypes.add('r');
        }
        if (
          lowerFile.endsWith('.cs') ||
          lowerFile.endsWith('.sln') ||
          lowerFile.endsWith('.csproj')
        ) {
          detectedTypes.add('csharp');
        }

        // Early termination if we've detected all languages
        if (detectedTypes.size === 12) break;
      }
    }

    return detectedTypes;
  } catch (error) {
    log(`detectAllFileTypesOptimized error: ${error}`);
    return detectedTypes;
  }
}

export async function detectProjectTypes(
  directory: string
): Promise<LSPServer[]> {
  const detectedServers: LSPServer[] = [];
  const detectionPromises: Promise<void>[] = [];

  log(`Starting detection for directory: ${directory}`);

  // Try optimized batch detection first
  const optimizedTypes = await detectAllFileTypesOptimized(directory);

  if (optimizedTypes.size > 0) {
    // Use optimized results
    const languageToServerId: Record<string, string> = {
      typescript: 'typescript',
      python: 'pyright',
      go: 'gopls',
      java: 'jdtls',
      lua: 'lua_ls',
      graphql: 'graphql',
      yaml: 'yaml',
      bash: 'bash',
      json: 'json',
      css: 'css',
      r: 'r_language_server',
      csharp: 'omnisharp',
    };

    for (const language of optimizedTypes) {
      const serverId = languageToServerId[language];
      if (serverId) {
        const server = getServerById(serverId);
        if (server) {
          detectedServers.push(server);
        }
      }
    }

    return detectedServers;
  }

  // Fall back to original detection for non-git repos
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

export async function initializeDetectedServers(
  projectServers: LSPServer[],
  targetDir: string
): Promise<string[]> {
  log(`Starting ${projectServers.length} LSP servers for ${targetDir}...`);
  log(`Detected servers: ${projectServers.map((s) => s.id).join(', ')}`);

  // Start all servers in parallel using Promise.allSettled
  const serverPromises = projectServers.map(async (server) => {
    const root = await getProjectRoot(targetDir, server);
    const clientKey = `${server.id}:${root}`;

    // Check if client already exists or is initializing
    const existingClient = getClient(server.id, root);
    if (existingClient) {
      log(`Client already exists for ${clientKey}, skipping start`);
      log(`✓ ${server.id} already started`);
      return { success: true, serverId: server.id };
    }

    if (isInitializing(server.id, root)) {
      log(`Client is already initializing for ${clientKey}, waiting...`);
      const client = await waitForInitialization(server.id, root);
      return { success: !!client, serverId: server.id };
    }

    // Create initialization promise and track it
    const initPromise = (async () => {
      try {
        log(`Starting server: ${server.id}`);
        log(`Project root for ${server.id}: ${root}`);
        log(`Client key: ${clientKey}`);

        const serverHandle = await spawnServer(server, root);

        if (!serverHandle) {
          log(`Failed to spawn server: ${server.id}`);
          log(`⚠ ${server.id} failed to spawn`);
          return null;
        }

        log(`Server spawned: ${server.id}`);
        log(`About to call createLSPClient for ${server.id} with root ${root}`);
        log(`ServerHandle process PID: ${serverHandle.process.pid}`);
        const client = await createLSPClient(
          server.id,
          serverHandle,
          root,
          getConfigLanguageExtensions() || undefined
        );
        log(`Client created for: ${server.id}`);

        // Store client in manager immediately
        setClient(server.id, root, client);
        log(`Stored client in manager with key: ${clientKey}`);
        log(`✓ ${server.id} ready`);
        return client;
      } catch (error) {
        log(
          `Start failed for ${server.id}: ${error instanceof Error ? error.message : String(error)}`
        );
        log(
          `⚠ ${server.id} start failed: ${error instanceof Error ? error.message : String(error)}`
        );
        return null;
      }
    })();

    // Track the initialization promise
    setInitializing(server.id, root, initPromise);

    const client = await initPromise;
    return { success: !!client, serverId: server.id };
  });

  // Wait for all servers to complete initialization
  const results = await Promise.allSettled(serverPromises);

  // Collect successfully started servers
  const startedServers: string[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.success) {
      startedServers.push(result.value.serverId);
    }
  }

  log('=== START FUNCTION COMPLETED ===');
  log('Start complete');
  return startedServers;
}
