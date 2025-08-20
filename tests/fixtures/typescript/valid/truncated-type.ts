// Test file for truncated type expansion enhancement

/**
 * A large type that might get truncated by the language server
 */
type ServerCapabilities = {
  textDocumentSync?: number | { 
    openClose?: boolean;
    change?: number;
    willSave?: boolean;
    willSaveWaitUntil?: boolean;
    save?: boolean | { includeText?: boolean };
  };
  diagnosticProvider?: boolean | {
    interFileDependencies?: boolean;
    workspaceDiagnostics?: boolean;
    workDoneProgress?: boolean;
  };
  completionProvider?: {
    triggerCharacters?: string[];
    allCommitCharacters?: string[];
    resolveProvider?: boolean;
    completionItem?: {
      labelDetailsSupport?: boolean;
    };
  };
  hoverProvider?: boolean | {
    workDoneProgress?: boolean;
  };
  signatureHelpProvider?: {
    triggerCharacters?: string[];
    retriggerCharacters?: string[];
    workDoneProgress?: boolean;
  };
  definitionProvider?: boolean | {
    workDoneProgress?: boolean;
  };
  typeDefinitionProvider?: boolean | {
    workDoneProgress?: boolean;
  };
  implementationProvider?: boolean | {
    workDoneProgress?: boolean;
  };
  referencesProvider?: boolean | {
    workDoneProgress?: boolean;
  };
  documentHighlightProvider?: boolean | {
    workDoneProgress?: boolean;
  };
  documentSymbolProvider?: boolean | {
    workDoneProgress?: boolean;
    label?: string;
  };
  codeActionProvider?: boolean | {
    codeActionKinds?: string[];
    workDoneProgress?: boolean;
    resolveProvider?: boolean;
  };
  codeLensProvider?: {
    resolveProvider?: boolean;
    workDoneProgress?: boolean;
  };
  documentLinkProvider?: {
    resolveProvider?: boolean;
    workDoneProgress?: boolean;
  };
  colorProvider?: boolean | {
    workDoneProgress?: boolean;
  };
  documentFormattingProvider?: boolean | {
    workDoneProgress?: boolean;
  };
  documentRangeFormattingProvider?: boolean | {
    workDoneProgress?: boolean;
  };
  renameProvider?: boolean | {
    prepareProvider?: boolean;
    workDoneProgress?: boolean;
  };
  foldingRangeProvider?: boolean | {
    workDoneProgress?: boolean;
  };
  selectionRangeProvider?: boolean | {
    workDoneProgress?: boolean;
  };
  executeCommandProvider?: {
    commands: string[];
    workDoneProgress?: boolean;
  };
  workspace?: {
    workspaceFolders?: {
      supported?: boolean;
      changeNotifications?: string | boolean;
    };
    fileOperations?: {
      didCreate?: { filters: Array<{ glob: string; matches?: string }> };
      willCreate?: { filters: Array<{ glob: string; matches?: string }> };
      didRename?: { filters: Array<{ glob: string; matches?: string }> };
      willRename?: { filters: Array<{ glob: string; matches?: string }> };
      didDelete?: { filters: Array<{ glob: string; matches?: string }> };
      willDelete?: { filters: Array<{ glob: string; matches?: string }> };
    };
  };
};

const capabilities: ServerCapabilities = {
  textDocumentSync: 2,
  hoverProvider: true,
  completionProvider: {
    triggerCharacters: ['.', '"', "'", '/'],
    resolveProvider: true,
  },
  definitionProvider: true,
  typeDefinitionProvider: true,
};

// Export to avoid unused variable warnings
export { capabilities, ServerCapabilities };