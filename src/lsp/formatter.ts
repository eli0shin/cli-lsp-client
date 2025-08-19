import { z } from 'zod';
import type { Diagnostic, HoverResult, Hover, MarkedString } from './types.js';

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

  for (const result of results) {
    // Format hover content and append directly to location line
    const content = formatHoverContent(result.hover).replace(/^\n+/, '');
    output.push(
      `${CYAN}Location:${RESET_COLOR} ${result.location.file}:${result.location.line + 1}:${result.location.column + 1}\n${content}`
    );

    if (results.length > 1) {
      output.push(GRAY + '─'.repeat(60) + RESET_COLOR);
    }
  }

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
