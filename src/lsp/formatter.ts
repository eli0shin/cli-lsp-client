import { z } from 'zod';
import type { Diagnostic, HoverResult, Hover, MarkedString, SignatureHelp } from './types.js';

const SEVERITY_NAMES = {
  1: 'ERROR',
  2: 'WARNING',
  3: 'INFO',
  4: 'HINT',
};

const SEVERITY_COLORS = {
  1: '\x1b[31m', // Red
  2: '\x1b[33m', // Yellow
  3: '\x1b[34m', // Blue
  4: '\x1b[37m', // White
};

const RESET_COLOR = '\x1b[0m';

function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((a, b) => {
    // Sort by severity (errors first: 1, warnings: 2, info: 3, hints: 4)
    const severityA = a.severity || 1;
    const severityB = b.severity || 1;
    if (severityA !== severityB) {
      return severityA - severityB;
    }

    // Then by line number
    const lineA = a.range.start.line;
    const lineB = b.range.start.line;
    if (lineA !== lineB) {
      return lineA - lineB;
    }

    // Then by column number
    const colA = a.range.start.character;
    const colB = b.range.start.character;
    if (colA !== colB) {
      return colA - colB;
    }

    // Finally by message for deterministic ordering
    return a.message.localeCompare(b.message);
  });
}

export function formatDiagnostics(
  _filePath: string,
  diagnostics: Diagnostic[]
): string {
  if (diagnostics.length === 0) {
    return '';
  }

  const sortedDiagnostics = sortDiagnostics(diagnostics);
  const lines: string[] = [];

  for (const diagnostic of sortedDiagnostics) {
    const severity = diagnostic.severity || 1;
    const severityName =
      SEVERITY_NAMES[severity as keyof typeof SEVERITY_NAMES] || 'UNKNOWN';
    const color =
      SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || '';

    const line = diagnostic.range.start.line + 1; // LSP is 0-based, display is 1-based
    const col = diagnostic.range.start.character + 1;

    const source = diagnostic.source || 'unknown';
    const codeStr =
      diagnostic.code !== undefined ? ` [${String(diagnostic.code)}]` : '';

    lines.push(
      `[${source}] ${color}${severityName}${RESET_COLOR} at line ${line}, column ${col}: ${diagnostic.message}${codeStr}`
    );
  }

  return lines.join('\n');
}

export function formatDiagnosticsPlain(
  _filePath: string,
  diagnostics: Diagnostic[]
): string {
  if (diagnostics.length === 0) {
    return '';
  }

  const sortedDiagnostics = sortDiagnostics(diagnostics);
  const lines: string[] = [];

  for (const diagnostic of sortedDiagnostics) {
    const severity = diagnostic.severity || 1;
    const severityName =
      SEVERITY_NAMES[severity as keyof typeof SEVERITY_NAMES] || 'UNKNOWN';

    const line = diagnostic.range.start.line + 1; // LSP is 0-based, display is 1-based
    const col = diagnostic.range.start.character + 1;

    const source = diagnostic.source || 'unknown';
    const codeStr =
      diagnostic.code !== undefined ? ` [${String(diagnostic.code)}]` : '';

    lines.push(
      `[${source}] ${severityName} at line ${line}, column ${col}: ${diagnostic.message}${codeStr}`
    );
  }

  return lines.join('\n');
}

// Colors for hover formatting
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const ITALIC = '\x1b[3m';

export async function formatHoverResults(
  results: HoverResult[]
): Promise<string> {
  if (results.length === 0) {
    return 'No hover information found for the symbol.';
  }

  const output: string[] = [];

  results.forEach((result, index) => {
    // Format hover content and append directly to location line
    const content = formatHoverContent(result.hover).replace(/^\n+/, '');
    
    // Add context label for multiple results
    let locationLabel = `${CYAN}Location:${RESET_COLOR}`;
    if (results.length > 1) {
      // Try to determine the type of result based on content
      const hoverContent = formatHoverContent(result.hover);
      if (hoverContent.includes('const ') || hoverContent.includes('let ') || hoverContent.includes('var ')) {
        locationLabel = `${CYAN}Declaration:${RESET_COLOR}`;
      } else if (hoverContent.includes('class ') || hoverContent.includes('interface ') || hoverContent.includes('type ')) {
        locationLabel = `${YELLOW}Type Definition:${RESET_COLOR}`;
      }
    }
    
    let resultContent = `${locationLabel} ${result.location.file}:${result.location.line + 1}:${result.location.column + 1}\n${content}`;
    
    // Add enhanced signature information if available (Phase 2 enhancement)
    if (result.signature?.signatures?.length) {
      const signatureInfo = formatSignatureHelp(result.signature);
      if (signatureInfo) {
        resultContent += `\n\n${GRAY}${BOLD}Signature Details:${RESET_COLOR}\n${signatureInfo}`;
      }
    }
    
    output.push(resultContent);

    // Add a blank line between results, but not after the last one
    if (index < results.length - 1) {
      output.push('');
    }
  });

  return output.join('\n');
}

function formatHoverContent(hover: Hover): string {
  if (!hover.contents) {
    return 'No documentation available.';
  }

  let content = '';

  if (typeof hover.contents === 'string') {
    content = hover.contents;
  } else if (Array.isArray(hover.contents)) {
    content = hover.contents
      .map((c: string | MarkedString) => (typeof c === 'string' ? c : c.value))
      .join('\n\n');
  } else if ('kind' in hover.contents) {
    content = hover.contents.value;
  }

  // Simple markdown to terminal formatting
  content = content
    // Remove markdown horizontal rules (---) that gopls adds
    .split('\n')
    .filter(line => line.trim() !== '---')
    .join('\n')
    // Clean up any resulting triple blank lines
    .replace(/\n\n\n+/g, '\n\n')
    // Code blocks
    .replace(/\n?```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      // Safely parse the code parameter
      const safeCode = z.string().safeParse(code);
      const codeText = safeCode.success
        ? safeCode.data.trim()
        : String(code).trim();

      return (
        GRAY +
        '```' +
        (lang ? YELLOW + lang : '') +
        RESET_COLOR +
        '\n' +
        GREEN +
        codeText +
        RESET_COLOR +
        '\n' +
        GRAY +
        '```' +
        RESET_COLOR
      );
    })
    // Inline code (avoid matching code block backticks by requiring non-backtick boundaries)
    .replace(/(?<!`)`([^`]+)`(?!`)/g, (_, code) => GREEN + code + RESET_COLOR)
    // Bold text
    .replace(/\*\*([^*]+)\*\*/g, (_, text) => BOLD + text + RESET_COLOR)
    // Italic text
    .replace(/\*([^*]+)\*/g, (_, text) => ITALIC + text + RESET_COLOR);

  return content.trim();
}

function formatSignatureHelp(signatureHelp: SignatureHelp): string {
  if (!signatureHelp.signatures?.length) {
    return '';
  }

  const signature = signatureHelp.signatures[0]; // Use the first signature
  if (!signature) {
    return '';
  }

  let result = '';
  
  // Format the signature label
  if (signature.label) {
    result += `${GREEN}${signature.label}${RESET_COLOR}`;
  }
  
  // Add signature documentation if available
  if (signature.documentation) {
    const doc = typeof signature.documentation === 'string' 
      ? signature.documentation 
      : signature.documentation.value;
    if (doc.trim()) {
      result += `\n${doc.trim()}`;
    }
  }
  
  // Add parameter information
  if (signature.parameters?.length) {
    result += '\n\n' + signature.parameters
      .map(param => {
        let paramLine = `${CYAN}${param.label}${RESET_COLOR}`;
        if (param.documentation) {
          const paramDoc = typeof param.documentation === 'string' 
            ? param.documentation 
            : param.documentation.value;
          if (paramDoc.trim()) {
            paramLine += ` — ${paramDoc.trim()}`;
          }
        }
        return paramLine;
      })
      .join('\n');
  }
  
  return result.trim();
}
