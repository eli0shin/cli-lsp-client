import type { Diagnostic as VSCodeDiagnostic } from "vscode-languageserver-types";
import type { MessageConnection } from 'vscode-jsonrpc/node';

export type Diagnostic = VSCodeDiagnostic;

export type Request = {
  command: string;
  args?: string[];
};

export type StatusResult = {
  pid: number;
  uptime: number;
  memory: NodeJS.MemoryUsage;
};

export interface LSPServer {
  id: string;
  extensions: string[];
  rootPatterns: string[];
  command: string[];
  env?: Record<string, string>;
  initialization?: Record<string, any>;
  dynamicArgs?: (root: string) => string[];
}

export interface LSPClient {
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
  shutdown(): Promise<void>;
}