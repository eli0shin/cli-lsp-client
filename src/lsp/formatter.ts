import type { Diagnostic } from './types.js';

const SEVERITY_NAMES = {
  1: 'ERROR',
  2: 'WARNING', 
  3: 'INFO',
  4: 'HINT'
};

const SEVERITY_COLORS = {
  1: '\x1b[31m', // Red
  2: '\x1b[33m', // Yellow
  3: '\x1b[34m', // Blue
  4: '\x1b[37m'  // White
};

const RESET_COLOR = '\x1b[0m';

export function formatDiagnostics(filePath: string, diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return '';
  }

  const lines: string[] = [];

  for (const diagnostic of diagnostics) {
    const severity = diagnostic.severity || 1;
    const severityName = SEVERITY_NAMES[severity as keyof typeof SEVERITY_NAMES] || 'UNKNOWN';
    const color = SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || '';
    
    const line = diagnostic.range.start.line + 1; // LSP is 0-based, display is 1-based
    const col = diagnostic.range.start.character + 1;
    
    lines.push('');
    lines.push(`${color}${severityName}${RESET_COLOR} at line ${line}, column ${col}:`);
    lines.push(`  ${diagnostic.message}`);
    
    if (diagnostic.source) {
      lines.push(`  Source: ${diagnostic.source}`);
    }
    
    if (diagnostic.code !== undefined) {
      lines.push(`  Code: ${String(diagnostic.code)}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function formatDiagnosticsPlain(filePath: string, diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return '';
  }

  const lines: string[] = [];

  for (const diagnostic of diagnostics) {
    const severity = diagnostic.severity || 1;
    const severityName = SEVERITY_NAMES[severity as keyof typeof SEVERITY_NAMES] || 'UNKNOWN';
    
    const line = diagnostic.range.start.line + 1; // LSP is 0-based, display is 1-based
    const col = diagnostic.range.start.character + 1;
    
    lines.push('');
    lines.push(`${severityName} at line ${line}, column ${col}:`);
    lines.push(`  ${diagnostic.message}`);
    
    if (diagnostic.source) {
      lines.push(`  Source: ${diagnostic.source}`);
    }
    
    if (diagnostic.code !== undefined) {
      lines.push(`  Code: ${String(diagnostic.code)}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}