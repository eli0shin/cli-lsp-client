import type {
  Diagnostic as VSCodeDiagnostic,
  SymbolInformation,
  DocumentSymbol,
  WorkspaceSymbol,
  Hover,
  Position,
  MarkupContent,
  Location,
  LocationLink,
  MarkedString,
  CompletionItem,
  CompletionList,
  SignatureHelp,
  SignatureInformation,
  ParameterInformation,
  Declaration,
  DeclarationLink,
} from 'vscode-languageserver-types';
import type { MessageConnection } from 'vscode-jsonrpc/node';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { z } from 'zod';

export type Diagnostic = VSCodeDiagnostic;
export type {
  SymbolInformation,
  DocumentSymbol,
  WorkspaceSymbol,
  Hover,
  Position,
  MarkupContent,
  Location,
  LocationLink,
  MarkedString,
  CompletionItem,
  CompletionList,
  SignatureHelp,
  SignatureInformation,
  ParameterInformation,
  Declaration,
  DeclarationLink,
};

export type Request = {
  command: string;
  args?: string[];
};

export type StatusResult = {
  pid: number;
  uptime: number;
  memory: NodeJS.MemoryUsage;
};

export type LSPServer = {
  id: string;
  extensions: string[];
  rootPatterns: string[];
  command: string[];
  packageName?: string; // Optional: npm package name when it differs from command
  env?: Record<string, string>;
  initialization?: Record<string, unknown>;
  dynamicArgs?: (root: string) => string[];
};

export type HoverResult = {
  symbol: string;
  hover: Hover;
  signature?: SignatureHelp;
  location: {
    file: string;
    line: number;
    column: number;
  };
  description: string;
};

// Zod schemas for runtime validation

// Base options schemas
export const WorkDoneProgressOptionsSchema = z.object({
  workDoneProgress: z.boolean().optional(),
});

// Provider options schemas - most extend WorkDoneProgressOptions
export const HoverOptionsSchema = WorkDoneProgressOptionsSchema;
export const DefinitionOptionsSchema = WorkDoneProgressOptionsSchema;
export const TypeDefinitionOptionsSchema = WorkDoneProgressOptionsSchema;
export const DocumentSymbolOptionsSchema = WorkDoneProgressOptionsSchema;
export const WorkspaceSymbolOptionsSchema = WorkDoneProgressOptionsSchema;
export const DeclarationOptionsSchema = WorkDoneProgressOptionsSchema;
export const ReferencesOptionsSchema = WorkDoneProgressOptionsSchema;
export const DocumentHighlightOptionsSchema = WorkDoneProgressOptionsSchema;
export const CallHierarchyOptionsSchema = WorkDoneProgressOptionsSchema;

export const RenameOptionsSchema = z.object({
  prepareProvider: z.boolean().optional(),
  workDoneProgress: z.boolean().optional(),
});

export const CompletionOptionsSchema = z.object({
  triggerCharacters: z.array(z.string()).optional(),
  allCommitCharacters: z.array(z.string()).optional(),
  resolveProvider: z.boolean().optional(),
  workDoneProgress: z.boolean().optional(),
  completionItem: z
    .object({
      labelDetailsSupport: z.boolean().optional(),
    })
    .optional(),
});

export const SignatureHelpOptionsSchema = z.object({
  triggerCharacters: z.array(z.string()).optional(),
  retriggerCharacters: z.array(z.string()).optional(),
  workDoneProgress: z.boolean().optional(),
});

export const CodeActionOptionsSchema = z.object({
  codeActionKinds: z.array(z.string()).optional(),
  workDoneProgress: z.boolean().optional(),
  resolveProvider: z.boolean().optional(),
});

export const ExecuteCommandOptionsSchema = z.object({
  commands: z.array(z.string()),
  workDoneProgress: z.boolean().optional(),
});

export const DiagnosticOptionsSchema = z
  .object({
    interFileDependencies: z.boolean(),
    workspaceDiagnostics: z.boolean(),
    workDoneProgress: z.boolean().optional(),
  })
  .partial();

// Union types for providers (boolean | options)
export const DiagnosticProviderSchema = z.union([
  z.boolean(),
  DiagnosticOptionsSchema,
]);

export const HoverProviderSchema = z.union([z.boolean(), HoverOptionsSchema]);

export const DefinitionProviderSchema = z.union([
  z.boolean(),
  DefinitionOptionsSchema,
]);

export const TypeDefinitionProviderSchema = z.union([
  z.boolean(),
  TypeDefinitionOptionsSchema,
]);

export const DocumentSymbolProviderSchema = z.union([
  z.boolean(),
  DocumentSymbolOptionsSchema,
]);

export const WorkspaceSymbolProviderSchema = z.union([
  z.boolean(),
  WorkspaceSymbolOptionsSchema,
]);

export const DeclarationProviderSchema = z.union([
  z.boolean(),
  DeclarationOptionsSchema,
]);

export const ReferencesProviderSchema = z.union([
  z.boolean(),
  ReferencesOptionsSchema,
]);

export const DocumentHighlightProviderSchema = z.union([
  z.boolean(),
  DocumentHighlightOptionsSchema,
]);

export const RenameProviderSchema = z.union([z.boolean(), RenameOptionsSchema]);

export const CompletionProviderSchema = z.union([
  z.boolean(),
  CompletionOptionsSchema,
]);

export const SignatureHelpProviderSchema = z.union([
  z.boolean(),
  SignatureHelpOptionsSchema,
]);

export const CodeActionProviderSchema = z.union([
  z.boolean(),
  CodeActionOptionsSchema,
]);

export const ExecuteCommandProviderSchema = z.union([
  z.boolean(),
  ExecuteCommandOptionsSchema,
]);

export const CallHierarchyProviderSchema = z.union([
  z.boolean(),
  CallHierarchyOptionsSchema,
]);

export const ServerCapabilitiesSchema = z
  .object({
    // Text synchronization
    textDocumentSync: z
      .union([z.number(), z.object({}).passthrough()])
      .optional(),

    // Language features
    diagnosticProvider: DiagnosticProviderSchema.optional(),
    documentSymbolProvider: DocumentSymbolProviderSchema.optional(),
    definitionProvider: DefinitionProviderSchema.optional(),
    typeDefinitionProvider: TypeDefinitionProviderSchema.optional(),
    declarationProvider: DeclarationProviderSchema.optional(),
    referencesProvider: ReferencesProviderSchema.optional(),
    hoverProvider: HoverProviderSchema.optional(),
    documentHighlightProvider: DocumentHighlightProviderSchema.optional(),
    workspaceSymbolProvider: WorkspaceSymbolProviderSchema.optional(),
    renameProvider: RenameProviderSchema.optional(),
    completionProvider: CompletionProviderSchema.optional(),
    signatureHelpProvider: SignatureHelpProviderSchema.optional(),
    codeActionProvider: CodeActionProviderSchema.optional(),
    executeCommandProvider: ExecuteCommandProviderSchema.optional(),
    callHierarchyProvider: CallHierarchyProviderSchema.optional(),

    // Workspace features
    workspace: z.object({}).passthrough().optional(),
  })
  .passthrough();

export const InitializationResultSchema = z
  .object({
    capabilities: ServerCapabilitiesSchema,
  })
  .passthrough();

export const DiagnosticReportSchema = z.union([
  z.object({
    kind: z.literal('full'),
    items: z.array(z.unknown()).optional(),
  }),
  z.object({
    kind: z.literal('unchanged'),
  }),
]);

export const PublishDiagnosticsSchema = z.object({
  uri: z.string(),
  diagnostics: z.array(z.unknown()).optional(),
});

// Inferred TypeScript types from Zod schemas
export type DiagnosticOptions = z.infer<typeof DiagnosticOptionsSchema>;
export type DiagnosticProvider = z.infer<typeof DiagnosticProviderSchema>;
export type ServerCapabilities = z.infer<typeof ServerCapabilitiesSchema>;
export type InitializationResult = z.infer<typeof InitializationResultSchema>;
export type DiagnosticReport = z.infer<typeof DiagnosticReportSchema>;
export type PublishDiagnosticsParams = z.infer<typeof PublishDiagnosticsSchema>;

export type LSPClient = {
  serverID: string;
  root: string;
  createdAt: number;
  diagnostics: Map<string, Diagnostic[]>;
  openFiles: Set<string>;
  connection?: MessageConnection;
  serverCapabilities?: ServerCapabilities;
  process?: ChildProcessWithoutNullStreams;
  openFile(path: string): Promise<void>;
  closeFile(path: string): Promise<void>;
  closeAllFiles(): Promise<void>;
  sendChangeNotification(path: string): Promise<void>;
  getDiagnostics(path: string): Diagnostic[];
  waitForDiagnostics(path: string, timeoutMs?: number): Promise<void>;
  triggerDiagnostics(path: string, timeoutMs?: number): Promise<void>;
  pullDiagnostics(path: string): Promise<Diagnostic[]>;
  getDocumentSymbols(
    filePath: string
  ): Promise<DocumentSymbol[] | SymbolInformation[]>;
  getDefinition(
    filePath: string,
    position: Position
  ): Promise<Location[] | LocationLink[] | null>;
  getTypeDefinition(
    filePath: string,
    position: Position
  ): Promise<Location[] | LocationLink[] | null>;
  getHover(filePath: string, position: Position): Promise<Hover | null>;
  getCompletion(
    filePath: string,
    position: Position
  ): Promise<CompletionItem[] | CompletionList | null>;
  getSignatureHelp(
    filePath: string,
    position: Position
  ): Promise<SignatureHelp | null>;
  getDeclaration(
    filePath: string,
    position: Position
  ): Promise<Declaration | DeclarationLink[] | null>;
  shutdown(): Promise<void>;
};
