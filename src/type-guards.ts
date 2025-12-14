import type {
  Diagnostic,
  HoverResult,
  DocumentSymbol,
  SymbolInformation,
  Location,
  LocationLink,
  Hover,
  CompletionItem,
  CompletionList,
  SignatureHelp,
  Declaration,
  DeclarationLink,
} from './lsp/types.js';

/**
 * Type guard for checking if an object has a specific property.
 * Narrows unknown to Record<K, unknown> when true.
 */
export function hasProperty<K extends string>(
  value: unknown,
  key: K
): value is Record<K, unknown> {
  return typeof value === 'object' && value !== null && key in value;
}

/**
 * Assertion function for Commander options with configFile.
 * Throws if value is not a valid options object.
 */
export function assertConfigFileOptions(
  value: unknown
): asserts value is { configFile?: string } {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Options must be an object');
  }
}

/**
 * Type predicate for Diagnostic arrays.
 * Used after schema validation to narrow result types.
 * Validates that the array contains objects with the required Diagnostic structure.
 */
export function isDiagnosticsArray(value: unknown): value is Diagnostic[] {
  if (!Array.isArray(value)) return false;
  // Empty arrays are valid (no diagnostics)
  if (value.length === 0) return true;
  // Check first element has Diagnostic shape (range property is required)
  // Access element directly to avoid unsafe assignment from any[]
  return (
    typeof value[0] === 'object' && value[0] !== null && 'range' in value[0]
  );
}

/**
 * Type predicate for HoverResult arrays.
 * Used after schema validation to narrow result types.
 * Validates that the array contains objects with the required HoverResult structure.
 */
export function isHoverResultArray(value: unknown): value is HoverResult[] {
  if (!Array.isArray(value)) return false;
  // Empty arrays are valid (no results)
  if (value.length === 0) return true;
  // Check first element has HoverResult shape (location and hover properties are required)
  // Access element directly to avoid unsafe assignment from any[]
  return (
    typeof value[0] === 'object' &&
    value[0] !== null &&
    'location' in value[0] &&
    'hover' in value[0]
  );
}

/**
 * Type guard for DocumentSymbol vs SymbolInformation arrays.
 * DocumentSymbol has a 'children' property, SymbolInformation doesn't.
 */
export function isDocumentSymbolArray(
  symbols: DocumentSymbol[] | SymbolInformation[]
): symbols is DocumentSymbol[] {
  return symbols.length === 0 || 'children' in symbols[0];
}

/**
 * Type guard for valid severity keys in diagnostic formatting.
 * Validates that a number is a valid key in the severity lookup.
 */
export function isValidSeverityKey(
  value: number,
  lookup: Record<number, unknown>
): value is 1 | 2 | 3 | 4 {
  return value in lookup;
}

// LSP Result Assertion Functions
// These assert the shape of LSP responses. Since LSP is a trusted protocol,
// we use minimal validation - just checking the basic structure.

/**
 * Assertion for documentSymbol result.
 */
export function assertDocumentSymbolResult(
  value: unknown
): asserts value is DocumentSymbol[] | SymbolInformation[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected array for documentSymbol result');
  }
}

/**
 * Assertion for definition/typeDefinition/references result.
 */
export function assertLocationResult(
  value: unknown
): asserts value is Location[] | LocationLink[] | null {
  if (value !== null && !Array.isArray(value)) {
    throw new Error('Expected array or null for location result');
  }
}

/**
 * Assertion for hover result.
 */
export function assertHoverResult(
  value: unknown
): asserts value is Hover | null {
  if (value !== null && typeof value !== 'object') {
    throw new Error('Expected object or null for hover result');
  }
}

/**
 * Assertion for completion result.
 */
export function assertCompletionResult(
  value: unknown
): asserts value is CompletionItem[] | CompletionList | null {
  if (value !== null && typeof value !== 'object') {
    throw new Error('Expected object, array, or null for completion result');
  }
}

/**
 * Assertion for signatureHelp result.
 */
export function assertSignatureHelpResult(
  value: unknown
): asserts value is SignatureHelp | null {
  if (value !== null && typeof value !== 'object') {
    throw new Error('Expected object or null for signatureHelp result');
  }
}

/**
 * Assertion for declaration result.
 */
export function assertDeclarationResult(
  value: unknown
): asserts value is Declaration | DeclarationLink[] | null {
  if (value !== null && typeof value !== 'object' && !Array.isArray(value)) {
    throw new Error('Expected object, array, or null for declaration result');
  }
}
