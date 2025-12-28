import path from 'path';
import { exec } from 'child_process';
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-jsonrpc/node';
import type {
  LSPClient,
  Diagnostic,
  SymbolInformation,
  DocumentSymbol,
  Hover,
  Position,
  Location,
  LocationLink,
  CompletionItem,
  CompletionList,
  SignatureHelp,
  Declaration,
  DeclarationLink,
} from './types.js';
import {
  InitializationResultSchema,
  DiagnosticReportSchema,
  PublishDiagnosticsSchema,
} from './types.js';
import type { ServerHandle } from './servers.js';
import { LANGUAGE_EXTENSIONS } from './language.js';
import { log } from '../logger.js';
import { urlToFilePath } from '../utils.js';
import type { LanguageExtensionMapping } from './config.js';
import {
  assertDocumentSymbolResult,
  assertLocationResult,
  assertHoverResult,
  assertCompletionResult,
  assertSignatureHelpResult,
  assertDeclarationResult,
} from '../type-guards.js';

export async function createLSPClient(
  serverID: string,
  serverHandle: ServerHandle,
  root: string,
  configLanguageExtensions?: LanguageExtensionMapping
): Promise<LSPClient> {
  log(`=== ENTERING createLSPClient for ${serverID} ===`);
  log(`Creating LSP client for ${serverID}`);

  const connection = createMessageConnection(
    new StreamMessageReader(serverHandle.process.stdout),
    new StreamMessageWriter(serverHandle.process.stdin)
  );

  const diagnostics = new Map<string, Diagnostic[]>();

  // Listen for diagnostics
  log('REGISTERING publishDiagnostics handler');
  connection.onNotification('textDocument/publishDiagnostics', (params) => {
    const parseResult = PublishDiagnosticsSchema.safeParse(params);
    if (!parseResult.success) {
      log(
        `Invalid publishDiagnostics params: ${JSON.stringify(parseResult.error.issues)}`
      );
      return;
    }

    const { uri, diagnostics: rawDiagnostics } = parseResult.data;
    const diagnosticsCount = rawDiagnostics?.length || 0;
    log(
      `>>> RECEIVED publishDiagnostics!!! uri: ${uri}, count: ${diagnosticsCount}`
    );

    const filePath = urlToFilePath(uri);
    // Schema validation ensures diagnostics match Diagnostic[] structure
    diagnostics.set(filePath, rawDiagnostics ?? []);
  });
  log('publishDiagnostics handler REGISTERED');

  // Handle requests
  connection.onRequest('window/workDoneProgress/create', () => null);
  connection.onRequest('workspace/configuration', () => [{}]);

  connection.listen();

  // Initialize the LSP server
  log(`Initializing LSP server ${serverID}`);
  const initResult = await connection.sendRequest('initialize', {
    rootUri: 'file://' + root,
    processId: serverHandle.process.pid,
    workspaceFolders: [
      {
        name: 'workspace',
        uri: 'file://' + root,
      },
    ],
    initializationOptions: {
      ...serverHandle.initialization,
      // TypeScript-specific configuration for better hover information
      ...(serverID === 'typescript' && {
        preferences: {
          includeCompletionsForModuleExports: true,
          includeCompletionsWithInsertText: true,
          allowIncompleteCompletions: true,
          maxNodeModuleJsFileSize: 30000,
          // Enhanced hover configuration for rich type information
          maximumHoverLength: 5000,
          verbosityLevel: 2,
          displayPartsForJSDoc: true,
          generateReturnInDocTemplate: true,
          useLabelDetailsInCompletionEntries: true,
        },
        // Advanced verbose/debug options
        logVerbosity: 'verbose',
        trace: 'verbose',
        maxTsServerMemory: 4096,
        useSyntaxServer: 'auto',
        // Enable TypeScript 5.8+ expandable hover if available
        experimentalDecorators: true,
        typescript: {
          experimental: {
            expandableHover: true,
          },
          preferences: {
            includeInlayParameterNameHints: 'none',
            includeInlayParameterNameHintsWhenArgumentMatchesName: false,
            includeInlayFunctionParameterTypeHints: false,
            includeInlayVariableTypeHints: false,
            includeInlayPropertyDeclarationTypeHints: false,
            includeInlayFunctionLikeReturnTypeHints: false,
            includeInlayEnumMemberValueHints: false,
          },
        },
      }),
      // Rust Analyzer hover enhancements
      ...(serverID === 'rust-analyzer' && {
        hover: {
          documentation: {
            enable: true,
            keywords: { enable: true },
            links: { enable: true },
          },
          maxSubstitutionLength: 50,
          show: {
            enumVariants: 10,
            fields: 8,
            traitAssocItems: 5,
          },
          dropGlue: { enable: true },
          memoryLayout: { enable: true },
        },
      }),
      // Go (gopls) hover enhancements
      ...(serverID === 'gopls' && {
        hoverKind: 'FullDocumentation',
        linkTarget: 'pkg.go.dev',
        linksInHover: true,
        // Advanced verbose options
        verboseWorkDoneProgress: true,
        diagnosticsDelay: '500ms',
        diagnosticsTrigger: 'Edit',
        analysisProgressReporting: true,
        semanticTokens: true,
        inlayHints: true,
        codelenses: {
          generate: true,
          test: true,
          tidy: true,
        },
        analyses: {
          unreachable: true,
          unusedparams: true,
          shadow: true,
          simplifycompositelit: true,
        },
        completionBudget: '100ms',
      }),
      // Lua Language Server hover enhancements
      ...(serverID === 'lua_ls' && {
        Lua: {
          runtime: {
            version: 'Lua 5.4',
            path: ['?.lua', '?/init.lua'],
          },
          workspace: {
            library: [],
            ignoreDir: ['.vscode'],
            maxPreload: 5000,
            preloadFileSize: 500,
          },
          diagnostics: {
            enable: true,
            globals: ['vim'],
            severity: {},
          },
          completion: {
            enable: true,
            callSnippet: 'Both',
            keywordSnippet: 'Both',
            displayContext: 6,
            workspaceWord: true,
            postfix: '@',
          },
          hover: {
            enable: true,
            viewNumber: true,
            viewString: true,
            viewStringMax: 1000,
            previewFields: 50,
            enumsLimit: 100,
            expandAlias: true,
            fieldInfer: 1000,
          },
          hint: {
            enable: true,
            paramType: true,
            setType: false,
            paramName: 'All',
            semicolon: 'SameLine',
            arrayIndex: 'Auto',
          },
          semantic: {
            enable: true,
            variable: true,
            annotation: true,
            keyword: false,
          },
        },
      }),
      // Bash Language Server hover enhancements (requires explainshell service)
      ...(serverID === 'bash' && {
        explainshellEndpoint: '', // Empty string disables by default, user can configure
        // Advanced analysis options
        backgroundAnalysisMaxFiles: 500,
        enableSourceErrorDiagnostics: false,
        includeAllWorkspaceSymbols: false,
        globPattern: '**/*@(.sh|.inc|.bash|.command)',
        // ShellCheck integration
        shellcheckPath: 'shellcheck',
        shellcheckArguments: [],
        // shfmt formatting options
        'shfmt.path': 'shfmt',
        'shfmt.ignoreEditorconfig': false,
        'shfmt.languageDialect': 'auto',
        'shfmt.binaryNextLine': false,
        'shfmt.caseIndent': false,
        'shfmt.funcNextLine': false,
        'shfmt.spaceRedirects': false,
        logLevel: 'info',
      }),
      // JDTLS (Java) hover and verbosity enhancements
      ...(serverID === 'jdtls' && {
        settings: {
          java: {
            signatureHelp: {
              enabled: true,
              description: { enabled: true },
            },
            completion: {
              maxResults: 50,
              favoriteStaticMembers: [
                'org.junit.Assert.*',
                'org.junit.jupiter.api.Assertions.*',
                'org.mockito.Mockito.*',
                'java.util.Objects.*',
              ],
              filteredTypes: [],
              includeDecompiledSources: true,
              importOrder: ['java', 'javax', 'com', 'org'],
            },
            references: {
              includeDecompiledSources: true,
            },
            implementationsCodeLens: {
              enabled: true,
            },
            referencesCodeLens: {
              enabled: true,
            },
            format: {
              enabled: true,
              settings: {
                url: null,
              },
            },
            saveActions: {
              organizeImports: true,
            },
            contentProvider: {
              preferred: 'fernflower', // Enhanced decompilation for better hover info
            },
            symbols: {
              includeSourceMethodDeclarations: true,
            },
            configuration: {
              updateBuildConfiguration: 'automatic',
            },
            validateAllOpenBuffersOnChanges: true,
          },
        },
        // Enable verbose server logging for debugging
        trace: {
          server: 'verbose',
        },
      }),
      // Pyright (Python) hover enhancements - limited options
      ...(serverID === 'pyright' && {
        python: {
          analysis: {
            logLevel: 'Trace', // Enhanced from Information
            typeCheckingMode: 'strict', // Enhanced from basic
            autoImportCompletions: true,
            diagnosticMode: 'workspace',
            useLibraryCodeForTypes: true,
            autoSearchPaths: true,
            diagnosticSeverityOverrides: {},
            // Enhanced verbosity options
            stubPath: '',
            venvPath: '',
            pythonPath: '',
          },
        },
        // Enable trace logging
        'basedpyright.analysis.logLevel': 'Trace',
        'basedpyright.disableLanguageServices': false,
        'basedpyright.disableOrganizeImports': false,
        'basedpyright.disableTaggedHints': false,
      }),
      // JSON Language Server enhancements
      ...(serverID === 'json' && {
        json: {
          validate: { enable: true },
          format: { enable: true },
          keepLines: { enable: true },
          schemas: [],
          resultLimit: 5000, // Increased from 1000
          maxItemsComputed: 5000,
          jsonFoldingLimit: 1000,
          jsoncFoldingLimit: 1000,
        },
        http: {
          proxy: '',
          proxyStrictSSL: true,
        },
        // Enable formatter and schema protocols
        provideFormatter: true,
        handledSchemaProtocols: ['file', 'http', 'https'],
        customCapabilities: {
          rangeFormatting: {
            editLimit: 1000,
          },
        },
      }),
      // CSS Language Server enhancements
      ...(serverID === 'css' && {
        css: {
          validate: true,
          hover: {
            documentation: true,
            references: true,
          },
          completion: {
            completePropertyWithSemicolon: true,
            triggerPropertyValueCompletion: true,
          },
          lint: {
            compatibleVendorPrefixes: 'warning',
            vendorPrefix: 'warning',
            duplicateProperties: 'warning',
            emptyRules: 'warning',
            propertyIgnoredDueToDisplay: 'warning',
            important: 'ignore',
            float: 'ignore',
            idSelector: 'ignore',
          },
        },
        scss: {
          validate: true,
          lint: {
            compatibleVendorPrefixes: 'warning',
            vendorPrefix: 'warning',
            duplicateProperties: 'warning',
            emptyRules: 'warning',
          },
        },
        less: {
          validate: true,
          lint: {
            compatibleVendorPrefixes: 'warning',
            vendorPrefix: 'warning',
            duplicateProperties: 'warning',
            emptyRules: 'warning',
          },
        },
      }),
      // YAML Language Server enhancements
      ...(serverID === 'yaml' && {
        yaml: {
          validate: true,
          hover: true,
          completion: true,
          format: {
            enable: true,
            singleQuote: false,
            bracketSpacing: true,
            proseWrap: 'preserve',
            printWidth: 80,
          },
          schemas: {},
          schemaStore: {
            enable: true,
            url: 'https://www.schemastore.org/api/json/catalog.json',
          },
          maxItemsComputed: 5000,
          customTags: [],
          keyOrdering: false,
          yamlVersion: '1.2',
          disableDefaultProperties: false,
          style: {
            flowMapping: 'allow',
            flowSequence: 'allow',
          },
        },
        redhat: {
          telemetry: {
            enabled: false,
          },
        },
      }),
      // GraphQL Language Server enhancements
      ...(serverID === 'graphql' && {
        graphql: {
          useSchemaFileDefinitions: true,
          debug: false,
          // Advanced options
          method: 'stream',
          cacheSchemaFileForLookup: true,
          schemaCacheTTL: 30000,
          enableValidation: true,
          customValidationRules: [],
          customDirectives: [],
          fileExtensions: ['.js', '.ts', '.tsx', '.jsx', '.graphql', '.gql'],
          fillLeafsOnComplete: true,
          extensions: [],
        },
      }),
      // R Language Server enhancements
      ...(serverID === 'r' && {
        r: {
          lsp: {
            debug: true, // Enhanced from false
            log_file: null,
            diagnostics: true,
            rich_documentation: true,
            snippet_support: true,
            max_completions: 200,
            lint_cache: false, // Enhanced for fresh results
            link_file_size_limit: 16384,
            server_capabilities: {},
            args: [],
            path: null,
          },
        },
      }),
      // OmniSharp (C#) enhancements
      ...(serverID === 'omnisharp' && {
        // Verbose logging
        loggingLevel: 'verbose',
        FormattingOptions: {
          EnableEditorConfigSupport: true,
          OrganizeImports: true,
        },
        MsBuild: {
          EnablePackageRestore: true,
          ToolsVersion: null,
          LoadProjectsOnDemand: false,
        },
        RoslynExtensionsOptions: {
          EnableAnalyzersSupport: true,
          EnableImportCompletion: true,
          AnalyzeOpenDocumentsOnly: false,
          EnableDecompilationSupport: true,
          DocumentAnalysisTimeoutMs: 30000,
          InlayHintsOptions: {
            EnableForParameters: true,
            ForLiteralParameters: true,
            ForIndexerParameters: true,
            ForObjectCreationParameters: true,
            ForOtherParameters: true,
            SuppressForParametersThatDifferOnlyBySuffix: true,
            SuppressForParametersThatMatchMethodIntent: true,
            SuppressForParametersThatMatchArgumentName: true,
          },
        },
        FileOptions: {
          SystemExcludeSearchPatterns: [
            '**/node_modules/**/*',
            '**/bin/**/*',
            '**/obj/**/*',
          ],
          ExcludeSearchPatterns: [],
        },
        Sdk: {
          IncludePrereleases: true,
        },
      }),
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
        documentSymbol: {
          dynamicRegistration: false,
          hierarchicalDocumentSymbolSupport: true,
        },
        definition: {
          dynamicRegistration: false,
          linkSupport: true,
        },
        typeDefinition: {
          dynamicRegistration: false,
          linkSupport: true,
        },
        hover: {
          dynamicRegistration: false,
          contentFormat: ['markdown', 'plaintext'],
        },
        completion: {
          dynamicRegistration: false,
          completionItem: {
            snippetSupport: false,
            documentationFormat: ['markdown', 'plaintext'],
            resolveSupport: {
              properties: ['documentation', 'detail'],
            },
          },
        },
        signatureHelp: {
          dynamicRegistration: false,
          signatureInformation: {
            documentationFormat: ['markdown', 'plaintext'],
            parameterInformation: {
              labelOffsetSupport: true,
            },
          },
        },
        declaration: {
          dynamicRegistration: false,
          linkSupport: true,
        },
        diagnostic: {
          dynamicRegistration: false,
        },
      },
    },
  });

  // Log the raw result for debugging pyright issues
  log(
    `Raw initialization result for ${serverID}: ${JSON.stringify(initResult)}`
  );

  const parseResult = InitializationResultSchema.safeParse(initResult);

  if (!parseResult.success) {
    log(
      `Zod validation failed for ${serverID}: ${JSON.stringify(parseResult.error.issues)}`
    );
    log(`Raw init result was: ${JSON.stringify(initResult)}`);
    throw new Error(
      `Invalid initialization result for ${serverID}: ${JSON.stringify(parseResult.error.issues)}`
    );
  }

  const serverCapabilities = parseResult.data.capabilities;
  log(
    `Server capabilities for ${serverID}: ${JSON.stringify(serverCapabilities.diagnosticProvider)}`
  );

  await connection.sendNotification('initialized', {});
  log(`LSP server ${serverID} initialized`);

  async function attemptGracefulShutdown(): Promise<void> {
    try {
      await connection.sendRequest('shutdown');
      await connection.sendNotification('exit');
    } catch (error) {
      log(`Error during graceful shutdown of ${serverID}: ${error}`);
    }
  }

  const client = {
    serverID,
    root,
    createdAt: Date.now(),
    diagnostics,
    openFiles: new Set<string>(),
    connection,
    serverCapabilities,
    process: serverHandle.process,

    async openFile(filePath: string): Promise<void> {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      // Skip if already open
      if (client.openFiles.has(absolutePath)) {
        log(`File already open: ${absolutePath}`);
        return;
      }

      log(`=== OPENING FILE: ${absolutePath} ===`);

      // Clear any existing diagnostics before opening
      diagnostics.delete(absolutePath);

      const file = Bun.file(absolutePath);
      const text = await file.text();
      const extension = path.extname(absolutePath);
      // Use config language extensions if available, otherwise fall back to defaults
      const languageId =
        configLanguageExtensions?.[extension] ||
        LANGUAGE_EXTENSIONS[extension] ||
        'plaintext';

      log(`Sending didOpen for ${absolutePath} (${languageId})`);
      // Always use version 0 for didOpen
      await connection.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri: `file://${absolutePath}`,
          languageId,
          version: 0,
          text,
        },
      });

      // Track as open
      client.openFiles.add(absolutePath);
      log(`=== FILE OPENED: ${absolutePath} ===`);
    },

    async closeFile(filePath: string): Promise<void> {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      // Skip if not open
      if (!client.openFiles.has(absolutePath)) {
        log(`File not open, skipping close: ${absolutePath}`);
        return;
      }

      // Clear diagnostics for this file when closing
      diagnostics.delete(absolutePath);

      await connection.sendNotification('textDocument/didClose', {
        textDocument: {
          uri: `file://${absolutePath}`,
        },
      });

      // Remove from tracking
      client.openFiles.delete(absolutePath);
      log(`File closed: ${absolutePath}`);
    },

    async closeAllFiles(): Promise<void> {
      log(`Closing all open files: ${client.openFiles.size} files`);
      const closePromises = Array.from(client.openFiles).map(client.closeFile);
      await Promise.all(closePromises);
      log('All files closed');
    },

    async sendChangeNotification(filePath: string): Promise<void> {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      log(`Sending didChange for diagnostics: ${absolutePath}`);

      // Read current file content
      const file = Bun.file(absolutePath);
      const text = await file.text();

      // Send didChange notification to force fresh diagnostics
      // Some LSP servers (e.g., Pyright) cache diagnostics and won't re-send them
      // when a file is reopened with the same content. This ensures fresh diagnostics.
      await connection.sendNotification('textDocument/didChange', {
        textDocument: {
          uri: `file://${absolutePath}`,
          version: 1,
        },
        contentChanges: [{ text }],
      });
    },

    getDiagnostics(filePath: string): Diagnostic[] {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);
      return diagnostics.get(absolutePath) || [];
    },

    async waitForDiagnostics(
      filePath: string,
      timeoutMs = 3000
    ): Promise<void> {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      return new Promise((resolve, _reject) => {
        let checkInterval: NodeJS.Timeout | undefined = undefined;

        const timeout = setTimeout(() => {
          if (checkInterval) clearInterval(checkInterval);

          // Instead of rejecting, assume no diagnostics (empty array) for valid files
          // This handles servers that don't send empty diagnostics notifications
          if (!diagnostics.has(absolutePath)) {
            log(
              `No diagnostics received after ${timeoutMs}ms, assuming valid file`
            );
            diagnostics.set(absolutePath, []);
          }
          resolve();
        }, timeoutMs);

        // Check if we already have diagnostics
        if (diagnostics.has(absolutePath)) {
          clearTimeout(timeout);
          resolve();
          return;
        }

        // Check periodically for diagnostics
        checkInterval = setInterval(() => {
          if (diagnostics.has(absolutePath)) {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    },

    async triggerDiagnostics(
      filePath: string,
      timeoutMs = 5000
    ): Promise<void> {
      log(`Getting diagnostics for ${filePath} with ${timeoutMs}ms timeout`);

      // Open the file to trigger diagnostics
      await this.openFile(filePath);

      // Send change notification to force fresh diagnostics
      await this.sendChangeNotification(filePath);

      // Wait for diagnostics
      await this.waitForDiagnostics(filePath, timeoutMs);
    },

    async getDocumentSymbols(
      filePath: string
    ): Promise<DocumentSymbol[] | SymbolInformation[]> {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);
      log(`Getting document symbols for: ${absolutePath}`);

      // Ensure file is open
      await this.openFile(absolutePath);

      try {
        const result = await connection.sendRequest(
          'textDocument/documentSymbol',
          {
            textDocument: {
              uri: `file://${absolutePath}`,
            },
          }
        );
        assertDocumentSymbolResult(result);
        return result;
      } catch (error) {
        log(`documentSymbol not supported or failed: ${error}`);
        return [];
      }
    },

    async getDefinition(
      filePath: string,
      position: Position
    ): Promise<Location[] | LocationLink[] | null> {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);
      log(
        `Getting definition for ${absolutePath} at ${position.line}:${position.character}`
      );

      // Ensure file is open
      await this.openFile(absolutePath);

      try {
        const result = await connection.sendRequest('textDocument/definition', {
          textDocument: {
            uri: `file://${absolutePath}`,
          },
          position: position,
        });
        assertLocationResult(result);
        return result;
      } catch (error) {
        log(`definition request failed: ${error}`);
        return null;
      }
    },

    async getTypeDefinition(
      filePath: string,
      position: Position
    ): Promise<Location[] | LocationLink[] | null> {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);
      log(
        `Getting type definition for ${absolutePath} at ${position.line}:${position.character}`
      );

      // Ensure file is open
      await this.openFile(absolutePath);

      try {
        const result = await connection.sendRequest(
          'textDocument/typeDefinition',
          {
            textDocument: {
              uri: `file://${absolutePath}`,
            },
            position: position,
          }
        );
        assertLocationResult(result);
        return result;
      } catch (error) {
        log(`typeDefinition request failed: ${error}`);
        return null;
      }
    },

    async getHover(
      filePath: string,
      position: Position
    ): Promise<Hover | null> {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);
      log(
        `Getting hover for ${absolutePath} at ${position.line}:${position.character}`
      );

      // Ensure file is open
      await this.openFile(absolutePath);

      try {
        const result = await connection.sendRequest('textDocument/hover', {
          textDocument: {
            uri: `file://${absolutePath}`,
          },
          position: position,
        });
        assertHoverResult(result);
        return result;
      } catch (error) {
        log(`hover request failed: ${error}`);
        return null;
      }
    },

    async getCompletion(
      filePath: string,
      position: Position
    ): Promise<CompletionItem[] | CompletionList | null> {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);
      log(
        `Getting completion for ${absolutePath} at ${position.line}:${position.character}`
      );

      // Ensure file is open
      await this.openFile(absolutePath);

      try {
        const result = await connection.sendRequest('textDocument/completion', {
          textDocument: {
            uri: `file://${absolutePath}`,
          },
          position: position,
        });
        assertCompletionResult(result);
        return result;
      } catch (error) {
        log(`completion request failed: ${error}`);
        return null;
      }
    },

    async getSignatureHelp(
      filePath: string,
      position: Position
    ): Promise<SignatureHelp | null> {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);
      log(
        `Getting signature help for ${absolutePath} at ${position.line}:${position.character}`
      );

      // Ensure file is open
      await this.openFile(absolutePath);

      try {
        const result = await connection.sendRequest(
          'textDocument/signatureHelp',
          {
            textDocument: {
              uri: `file://${absolutePath}`,
            },
            position: position,
          }
        );
        assertSignatureHelpResult(result);
        return result;
      } catch (error) {
        log(`signatureHelp request failed: ${error}`);
        return null;
      }
    },

    async getDeclaration(
      filePath: string,
      position: Position
    ): Promise<Declaration | DeclarationLink[] | null> {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);
      log(
        `Getting declaration for ${absolutePath} at ${position.line}:${position.character}`
      );

      // Ensure file is open
      await this.openFile(absolutePath);

      try {
        const result = await connection.sendRequest(
          'textDocument/declaration',
          {
            textDocument: {
              uri: `file://${absolutePath}`,
            },
            position: position,
          }
        );
        assertDeclarationResult(result);
        return result;
      } catch (error) {
        log(`declaration request failed: ${error}`);
        return null;
      }
    },

    async pullDiagnostics(filePath: string): Promise<Diagnostic[]> {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);
      log(`Pulling diagnostics for ${absolutePath}`);

      // Ensure file is open
      await this.openFile(absolutePath);

      try {
        const result = await connection.sendRequest('textDocument/diagnostic', {
          textDocument: {
            uri: `file://${absolutePath}`,
          },
        });

        // Handle the response based on LSP spec
        const parseResult = DiagnosticReportSchema.safeParse(result);
        if (!parseResult.success) {
          log(
            `Invalid diagnostic report: ${JSON.stringify(parseResult.error.issues)}`
          );
          return [];
        }

        const diagnosticReport = parseResult.data;
        if (diagnosticReport.kind === 'full') {
          return diagnosticReport.items ?? [];
        } else {
          // Return previously cached diagnostics
          return this.getDiagnostics(absolutePath);
        }
      } catch (error) {
        log(`textDocument/diagnostic not supported or failed: ${error}`);
        throw error;
      }
    },

    async shutdown(): Promise<void> {
      log(`Shutting down LSP client ${serverID}`);

      // Try to gracefully shut down the LSP server first
      await attemptGracefulShutdown();

      // Close the connection
      connection.end();
      connection.dispose();

      // Kill the process and all its children
      const proc = serverHandle.process;
      if (!proc.killed) {
        try {
          if (process.platform === 'win32') {
            // On Windows, use taskkill to kill the process tree
            await new Promise<void>((resolve) => {
              if (proc.pid) {
                exec(`taskkill /pid ${proc.pid} /T /F`, (error) => {
                  if (error) {
                    log(`Error killing process tree on Windows: ${error}`);
                  }
                  resolve();
                });
              } else {
                proc.kill('SIGTERM');
                resolve();
              }
            });
          } else {
            // On Unix-like systems, kill the process group
            // First try SIGTERM for graceful shutdown
            try {
              if (proc.pid) {
                process.kill(-proc.pid, 'SIGTERM');
              } else {
                proc.kill('SIGTERM');
              }
            } catch (_e) {
              // If process group doesn't exist, kill individual process
              proc.kill('SIGTERM');
            }

            // Wait a bit for graceful shutdown
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Force kill if still alive
            {
              try {
                if (proc.pid) {
                  process.kill(-proc.pid, 'SIGKILL');
                } else {
                  proc.kill('SIGKILL');
                }
              } catch (_e) {
                // If process group doesn't exist, kill individual process
                proc.kill('SIGKILL');
              }
            }
          }
        } catch (error) {
          log(`Error killing process ${proc.pid ?? 'unknown'}: ${error}`);
        }
      }
    },
  };

  return client;
}
