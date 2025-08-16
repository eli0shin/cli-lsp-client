import type { 
  Diagnostic as VSCodeDiagnostic,
  SymbolInformation,
  DocumentSymbol,
  WorkspaceSymbol,
  Hover,
  Position,
  MarkupContent,
  Location,
  LocationLink
} from "vscode-languageserver-types";
import type { MessageConnection } from 'vscode-jsonrpc/node';

export type Diagnostic = VSCodeDiagnostic;
export type { 
  SymbolInformation, 
  DocumentSymbol, 
  WorkspaceSymbol,
  Hover,
  Position,
  MarkupContent,
  Location,
  LocationLink
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
  env?: Record<string, string>;
  initialization?: Record<string, any>;
  dynamicArgs?: (root: string) => string[];
}

export type HoverResult = {
  symbol: string;
  hover: Hover;
  location: {
    file: string;
    line: number;
    column: number;
  };
}

export type LSPClient = {
  serverID: string;
  root: string;
  createdAt: number;
  diagnostics: Map<string, Diagnostic[]>;
  connection?: MessageConnection;
  openFile(path: string): Promise<void>;
  closeFile(path: string): Promise<void>;
  getDiagnostics(path: string): Diagnostic[];
  waitForDiagnostics(path: string, timeoutMs?: number): Promise<void>;
  triggerDiagnostics(path: string, timeoutMs?: number): Promise<void>;
  getDocumentSymbols(filePath: string): Promise<DocumentSymbol[] | SymbolInformation[]>;
  getDefinition(filePath: string, position: Position): Promise<Location[] | LocationLink[] | null>;
  getTypeDefinition(filePath: string, position: Position): Promise<Location[] | LocationLink[] | null>;
  getHover(filePath: string, position: Position): Promise<Hover | null>;
  shutdown(): Promise<void>;
}