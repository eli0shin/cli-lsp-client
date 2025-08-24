import type {
  LSPClient,
  Hover,
  Position,
  CompletionItem,
  SignatureHelp,
  MarkupContent,
  DocumentSymbol,
  SymbolInformation,
} from './types.js';
import { SymbolKind } from 'vscode-languageserver-types';
import { log } from '../logger.js';

export type EnhancedHover = {
  hover: Hover;
  expandedType?: string;
  functionSignature?: SignatureHelp;
  completionInfo?: CompletionItem[];
};

type LanguageStrategy = {
  shouldExpandType: (hoverContent: string) => boolean;
  extractTypeFromCompletion: (items: CompletionItem[]) => string | null;
  formatExpandedType: (original: string, expanded: string) => string;
};

const TRUNCATION_MARKERS = [
  '...',
  'more ...',
  '... more',
  '...;',
  '{ ... }',
  '... }',
];

function containsTruncation(content: string): boolean {
  return TRUNCATION_MARKERS.some((marker) => content.includes(marker));
}

function extractHoverContent(hover: Hover): string {
  if (!hover.contents) return '';
  
  if (typeof hover.contents === 'string') {
    return hover.contents;
  }
  
  if (Array.isArray(hover.contents)) {
    return hover.contents
      .map((c) => (typeof c === 'string' ? c : c.value))
      .join('\n');
  }
  
  const markupContent = hover.contents as MarkupContent;
  return markupContent.value || '';
}

const languageStrategies: Record<string, LanguageStrategy> = {
  typescript: {
    shouldExpandType: (content) => {
      // TypeScript specific truncation patterns
      return (
        containsTruncation(content) ||
        // Interface without properties shown
        /^interface \w+$/m.test(content) ||
        // Class without structure shown
        /^class \w+$/m.test(content) ||
        // Type alias that's just a name
        /^type \w+ = \w+$/m.test(content) ||
        // Variable with just type name (not expanded)
        /^(const|let|var) \w+: [A-Z]\w+$/m.test(content)
      );
    },
    extractTypeFromCompletion: (items) => {
      // Extract type information from completion items
      const typeInfo = new Map<string, string>();
      
      for (const item of items) {
        if (item.detail) {
          // Parse property signatures from detail
          const match = item.detail.match(/^(\w+):\s*(.+)$/);
          if (match) {
            typeInfo.set(match[1], match[2]);
          }
        }
      }
      
      if (typeInfo.size === 0) return null;
      
      // Build expanded type structure
      const properties = Array.from(typeInfo.entries())
        .map(([key, type]) => `  ${key}: ${type}`)
        .join(';\n');
      
      return `{\n${properties};\n}`;
    },
    formatExpandedType: (original, expanded) => {
      // Replace interface without structure with expanded version
      if (/^interface \w+$/m.test(original)) {
        // If expanded already contains "interface", use it as-is
        if (expanded.startsWith('interface ')) {
          return `\`\`\`typescript\n${expanded}\n\`\`\``;
        }
        const interfaceName = original.match(/^interface (\w+)$/m)?.[1] || '';
        return `\`\`\`typescript\ninterface ${interfaceName} ${expanded}\n\`\`\``;
      }
      // Replace class without structure with expanded version
      if (/^class \w+$/m.test(original)) {
        // If expanded already contains "class", use it as-is
        if (expanded.startsWith('class ')) {
          return `\`\`\`typescript\n${expanded}\n\`\`\``;
        }
        const className = original.match(/^class (\w+)$/m)?.[1] || '';
        return `\`\`\`typescript\nclass ${className} ${expanded}\n\`\`\``;
      }
      // Replace truncated parts with expanded version
      if (original.includes('...')) {
        return original.replace(/\{[^}]*\.\.\.[^}]*\}/g, expanded);
      }
      // For simple type references, append the expansion
      if (/^(const|let|var) \w+: [A-Z]\w+$/.test(original)) {
        return `${original}\n// Expanded:\n${expanded}`;
      }
      return original;
    },
  },
  
  javascript: {
    // Similar to TypeScript but without type annotations
    shouldExpandType: (content) => containsTruncation(content),
    extractTypeFromCompletion: (items) => {
      const properties = items
        .filter((item) => item.kind === 5) // Property kind
        .map((item) => item.label)
        .slice(0, 20); // Limit to prevent huge outputs
      
      if (properties.length === 0) return null;
      
      return `{ ${properties.join(', ')} }`;
    },
    formatExpandedType: (original, expanded) => {
      return `${original}\n// Properties: ${expanded}`;
    },
  },
  
  python: {
    shouldExpandType: (content) => {
      return (
        containsTruncation(content) ||
        // Class without shown methods
        /^class \w+:?$/m.test(content) ||
        // Type hint that's just a name
        /: [A-Z]\w+(\[|$)/m.test(content)
      );
    },
    extractTypeFromCompletion: (items) => {
      const methods = items
        .filter((item) => item.kind === 2) // Method kind
        .map((item) => item.label);
      
      const attributes = items
        .filter((item) => item.kind === 5) // Property kind
        .map((item) => item.label);
      
      if (methods.length === 0 && attributes.length === 0) return null;
      
      const parts = [];
      if (attributes.length > 0) {
        parts.push(`Attributes: ${attributes.slice(0, 10).join(', ')}`);
      }
      if (methods.length > 0) {
        parts.push(`Methods: ${methods.slice(0, 10).join(', ')}`);
      }
      
      return parts.join('\n');
    },
    formatExpandedType: (original, expanded) => {
      return `${original}\n\n${expanded}`;
    },
  },
  
  go: {
    shouldExpandType: (content) => {
      return (
        containsTruncation(content) ||
        // Struct without fields
        /^type \w+ struct$/m.test(content) ||
        // Interface without methods
        /^type \w+ interface$/m.test(content)
      );
    },
    extractTypeFromCompletion: (items) => {
      const fields = items
        .filter((item) => item.kind === 5) // Field kind
        .map((item) => {
          const detail = item.detail || item.label;
          return `  ${detail}`;
        })
        .slice(0, 20);
      
      if (fields.length === 0) return null;
      
      return `struct {\n${fields.join('\n')}\n}`;
    },
    formatExpandedType: (original, expanded) => {
      if (original.includes('struct') && !original.includes('{')) {
        return original.replace('struct', `struct ${expanded}`);
      }
      return `${original}\n// Expanded:\n${expanded}`;
    },
  },
};

// Default strategy for unknown languages
const defaultStrategy: LanguageStrategy = {
  shouldExpandType: (content) => containsTruncation(content),
  extractTypeFromCompletion: (items) => {
    const labels = items.map((item) => item.label).slice(0, 20);
    return labels.length > 0 ? labels.join(', ') : null;
  },
  formatExpandedType: (original, expanded) => {
    return `${original}\n// Expanded: ${expanded}`;
  },
};

export class TypeEnhancer {
  constructor(private readonly client: LSPClient) {}

  private async extractInterfaceFromSymbols(
    filePath: string,
    interfaceName: string
  ): Promise<string | null> {
    try {
      const symbols = await this.client.getDocumentSymbols(filePath);
      
      // Find the interface symbol
      const findInterface = (syms: (DocumentSymbol | SymbolInformation)[]): DocumentSymbol | null => {
        for (const sym of syms) {
          if ('children' in sym) {
            // DocumentSymbol
            if (sym.name === interfaceName && sym.kind === SymbolKind.Interface) {
              return sym;
            }
            // Recursively search children
            const found = findInterface(sym.children || []);
            if (found) return found;
          }
        }
        return null;
      };
      
      const interfaceSymbol = findInterface(symbols as DocumentSymbol[]);
      if (!interfaceSymbol || !('children' in interfaceSymbol)) {
        return null;
      }
      
      // Extract properties from children with actual types via hover
      const propertyPromises = (interfaceSymbol.children || [])
        .filter((child: DocumentSymbol) => 
          child.kind === SymbolKind.Property || 
          child.kind === SymbolKind.Method
        )
        .map(async (child: DocumentSymbol) => {
          // Try to get actual type via hover on the property position
          let type = 'any';
          
          if ('range' in child && child.range) {
            try {
              const hover = await this.client.getHover(filePath, child.range.start);
              if (hover) {
                const hoverContent = extractHoverContent(hover);
                // Extract type from hover content like "(property) InterfaceName.propName: type"
                // Handle multi-line types (e.g., nested objects)
                const colonIndex = hoverContent.indexOf(':');
                if (colonIndex !== -1) {
                  // Get everything after the colon
                  type = hoverContent.substring(colonIndex + 1).trim();
                  
                  // Remove the property prefix if it exists (e.g., "(property) Person.address: ")
                  if (type.startsWith('(property)')) {
                    const nextColon = type.indexOf(':');
                    if (nextColon !== -1) {
                      type = type.substring(nextColon + 1).trim();
                    }
                  }
                  
                  // Clean up the type (remove backticks)
                  type = type.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
                  
                  // If it's a code block, extract just the type
                  const codeBlockMatch = type.match(/^[\w]+\n(.+)$/s);
                  if (codeBlockMatch) {
                    type = codeBlockMatch[1].trim();
                  }
                  
                  // Remove any leading/trailing backticks
                  type = type.replace(/^`|`$/g, '').trim();
                }
              }
            } catch (error) {
              log(`Failed to get hover for property ${child.name}: ${error}`);
            }
          }
          
          // Fallback to detail if hover didn't work
          if (type === 'any' && child.detail) {
            type = child.detail;
          }
          
          return `  ${child.name}: ${type}`;
        });
      
      const properties = await Promise.all(propertyPromises);
      
      if (properties.length === 0) {
        return null;
      }
      
      // Format properties with proper semicolons
      const formattedProperties = properties.map((prop, index) => {
        // Don't add semicolon if the property type ends with }
        const needsSemicolon = !prop.trim().endsWith('}');
        const isLast = index === properties.length - 1;
        return needsSemicolon && !isLast ? `${prop};` : prop;
      });
      
      // Return just the body structure without "interface Name"
      return `{\n${formattedProperties.join('\n')}\n}`;
    } catch (error) {
      log(`Failed to extract interface from symbols: ${error}`);
      return null;
    }
  }

  private async extractClassFromSymbols(
    filePath: string,
    className: string
  ): Promise<string | null> {
    try {
      const symbols = await this.client.getDocumentSymbols(filePath);
      
      // Find the class symbol
      const findClass = (syms: (DocumentSymbol | SymbolInformation)[]): DocumentSymbol | null => {
        for (const sym of syms) {
          if ('children' in sym) {
            // DocumentSymbol
            if (sym.name === className && sym.kind === SymbolKind.Class) {
              return sym;
            }
            // Recursively search children
            const found = findClass(sym.children || []);
            if (found) return found;
          }
        }
        return null;
      };
      
      const classSymbol = findClass(symbols as DocumentSymbol[]);
      if (!classSymbol || !('children' in classSymbol)) {
        return null;
      }
      
      // Categorize class members
      const properties: string[] = [];
      let constructorInfo: string | null = null;
      const methods: string[] = [];
      
      // Process each class member
      for (const child of classSymbol.children || []) {
        const memberInfo = await this.extractMemberInfo(filePath, child);
        
        if (child.kind === SymbolKind.Property || child.kind === SymbolKind.Field) {
          properties.push(memberInfo);
        } else if (child.kind === SymbolKind.Constructor) {
          constructorInfo = memberInfo;
        } else if (child.kind === SymbolKind.Method) {
          methods.push(memberInfo);
        }
        // Ignore other symbol kinds for class members
      }
      
      // Format the class structure
      return this.formatClassStructure(className, properties, constructorInfo, methods);
    } catch (error) {
      log(`Failed to extract class from symbols: ${error}`);
      return null;
    }
  }

  private async extractMemberInfo(
    filePath: string, 
    member: DocumentSymbol
  ): Promise<string> {
    // Get hover information for accurate type
    let typeInfo = 'any';
    
    if ('range' in member && member.range) {
      try {
        const hover = await this.client.getHover(filePath, member.range.start);
        if (hover) {
          const hoverContent = extractHoverContent(hover);
          typeInfo = this.parseTypeFromHover(hoverContent, member.name, member.kind);
        }
      } catch (error) {
        log(`Failed to get hover for member ${member.name}: ${error}`);
      }
    }
    
    // Fallback to detail if hover didn't work
    if (typeInfo === 'any' && member.detail) {
      typeInfo = member.detail;
    }
    
    // Format based on member kind
    const visibility = this.extractVisibility(member.detail || '');
    return this.formatMember(member.name, typeInfo, member.kind, visibility);
  }

  private parseTypeFromHover(hoverContent: string, memberName: string, memberKind: SymbolKind): string {
    if (!hoverContent) return 'any';
    
    // Handle different hover content patterns
    if (memberKind === SymbolKind.Method || memberKind === SymbolKind.Constructor) {
      // For methods/constructors, extract the full signature
      const methodMatch = hoverContent.match(/\(method\)\s+[^:]+:\s*(.+)$/m) ||
                         hoverContent.match(/\(constructor\)\s+[^:]+:\s*(.+)$/m) ||
                         hoverContent.match(/^(.+)$/m);
      if (methodMatch) {
        return this.cleanTypeString(methodMatch[1]);
      }
    } else {
      // For properties, extract type after colon
      const propMatch = hoverContent.match(/\(property\)\s+[^:]+:\s*(.+)$/m) ||
                       hoverContent.match(new RegExp(`${memberName}:\\s*(.+)$`, 'm')) ||
                       hoverContent.match(/:\s*(.+)$/m);
      if (propMatch) {
        return this.cleanTypeString(propMatch[1]);
      }
    }
    
    return 'any';
  }

  private cleanTypeString(type: string): string {
    // Remove markdown code blocks and clean up type string
    return type
      .replace(/^```[\w]*\n?/, '')
      .replace(/\n?```$/, '')
      .replace(/^`|`$/g, '')
      .trim();
  }

  private extractVisibility(detail: string): string {
    // Extract visibility modifiers from detail string
    const visibilityMatch = detail.match(/^(public|private|protected|readonly)\s+/);
    return visibilityMatch ? visibilityMatch[1] + ' ' : '';
  }

  private formatMember(name: string, type: string, kind: SymbolKind, visibility: string): string {
    if (kind === SymbolKind.Constructor) {
      return `${visibility}constructor${type.startsWith('(') ? type : `(${type})`}`;
    } else if (kind === SymbolKind.Method) {
      if (type.includes('(') && type.includes(')')) {
        return `${visibility}${name}${type}`;
      }
      return `${visibility}${name}(): ${type}`;
    } else if (kind === SymbolKind.Property || kind === SymbolKind.Field) {
      return `${visibility}${name}: ${type}`;
    } else {
      // Fallback for any other symbol kinds
      return `${visibility}${name}: ${type}`;
    }
  }

  private formatClassStructure(
    className: string,
    properties: string[],
    constructor: string | null,
    methods: string[]
  ): string {
    const parts: string[] = [`class ${className} {`];
    
    // Add properties
    if (properties.length > 0) {
      parts.push(...properties.map(p => `  ${p};`));
    }
    
    // Add constructor
    if (constructor) {
      if (properties.length > 0) parts.push('');
      parts.push(`  ${constructor};`);
    }
    
    // Add methods (limit to prevent overwhelming output)
    if (methods.length > 0) {
      if (properties.length > 0 || constructor) parts.push('');
      const limitedMethods = methods.slice(0, 15); // Show first 15 methods
      parts.push(...limitedMethods.map(m => `  ${m};`));
      
      if (methods.length > 15) {
        parts.push(`  // ... ${methods.length - 15} more methods`);
      }
    }
    
    parts.push('}');
    return parts.join('\n');
  }

  async enhanceHover(
    filePath: string,
    position: Position,
    hover: Hover,
    symbolKind?: SymbolKind,
    languageId?: string
  ): Promise<EnhancedHover> {
    const result: EnhancedHover = { hover };
    
    // Get language-specific strategy
    const strategy = languageStrategies[languageId || ''] || defaultStrategy;
    
    // Extract hover content
    const hoverContent = extractHoverContent(hover);
    log(`Original hover content: ${hoverContent.substring(0, 200)}`);
    
    // Check if we should expand the type
    if (!strategy.shouldExpandType(hoverContent)) {
      log('No type expansion needed');
      return result;
    }
    
    log('Type expansion needed, fetching additional information...');
    
    // Special handling for interfaces shown without structure
    const interfaceMatch = hoverContent.match(/^interface\s+(\w+)$/m);
    if (interfaceMatch && languageId === 'typescript') {
      const interfaceName = interfaceMatch[1];
      log(`Detected interface ${interfaceName} without structure, extracting from symbols`);
      
      const extractedInterface = await this.extractInterfaceFromSymbols(filePath, interfaceName);
      if (extractedInterface) {
        result.expandedType = extractedInterface;
        log(`Extracted interface structure from symbols`);
        return result;
      }
    }
    
    // Special handling for classes shown without structure
    const classMatch = hoverContent.match(/^class\s+(\w+)$/m);
    if (classMatch && languageId === 'typescript') {
      const className = classMatch[1];
      log(`Detected class ${className} without structure, extracting from symbols`);
      
      const extractedClass = await this.extractClassFromSymbols(filePath, className);
      if (extractedClass) {
        result.expandedType = extractedClass;
        log(`Extracted class structure from symbols`);
        return result;
      }
    }
    
    // For functions, try to get signature help
    if (
      symbolKind === SymbolKind.Function ||
      symbolKind === SymbolKind.Method ||
      symbolKind === SymbolKind.Constructor
    ) {
      try {
        const signatureHelp = await this.client.getSignatureHelp(
          filePath,
          position
        );
        if (signatureHelp && signatureHelp.signatures.length > 0) {
          result.functionSignature = signatureHelp;
          log('Got signature help with signatures');
        }
      } catch (error) {
        log(`Failed to get signature help: ${error}`);
      }
    }
    
    // Try to get completion items for more details
    try {
      const completion = await this.client.getCompletion(filePath, position);
      log(`Completion response: ${completion ? 'received' : 'null'}`);
      
      if (completion) {
        const items: CompletionItem[] = Array.isArray(completion)
          ? completion
          : completion.items;
        
        log(`Completion items: ${items ? items.length : 'none'}`);
        
        if (items && items.length > 0) {
          result.completionInfo = items;
          log(`Got ${items.length} completion items`);
          
          // Log first few items for debugging
          items.slice(0, 3).forEach((item: CompletionItem, i: number) => {
            log(`  Item ${i}: label='${item.label}', kind=${item.kind}, detail='${item.detail || 'none'}'`);
          });
          
          // Extract type information from completion
          const expandedType = strategy.extractTypeFromCompletion(items);
          if (expandedType) {
            result.expandedType = expandedType;
            log(`Extracted expanded type: ${expandedType.substring(0, 200)}`);
          } else {
            log('No expanded type extracted from completion items');
          }
        }
      } else {
        log('Completion returned null');
      }
    } catch (error) {
      log(`Failed to get completion: ${error}`);
    }
    
    // Try declaration as a fallback for type information
    if (!result.expandedType && !result.functionSignature) {
      try {
        const declaration = await this.client.getDeclaration(
          filePath,
          position
        );
        if (declaration) {
          log('Got declaration information');
          // Process declaration to extract additional type info
          // This would require reading the file at the declaration location
          // which we'll implement in the integration phase
        }
      } catch (error) {
        log(`Failed to get declaration: ${error}`);
      }
    }
    
    return result;
  }

  formatEnhancedHover(
    enhanced: EnhancedHover,
    languageId?: string
  ): string {
    const strategy = languageStrategies[languageId || ''] || defaultStrategy;
    const originalContent = extractHoverContent(enhanced.hover);
    
    let result = originalContent;
    
    // Add expanded type information
    if (enhanced.expandedType) {
      result = strategy.formatExpandedType(originalContent, enhanced.expandedType);
    }
    
    // Add function signature information
    if (enhanced.functionSignature) {
      const signatures = enhanced.functionSignature.signatures
        .map((sig) => {
          const params = sig.parameters
            ?.map((p) => {
              const label = typeof p.label === 'string' 
                ? p.label 
                : `param${p.label[0]}`;
              return label;
            })
            .join(', ') || '';
          
          const sigLabel = typeof sig.label === 'string'
            ? sig.label
            : `function(${params})`;
          
          return sigLabel;
        })
        .join('\n');
      
      if (signatures && !result.includes(signatures)) {
        result = `${result}\n\nSignatures:\n${signatures}`;
      }
    }
    
    return result;
  }
}