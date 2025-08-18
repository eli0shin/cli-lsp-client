import { z } from 'zod';
import type { LSPServer } from './types.js';

// Zod schema for user-defined LSP server configuration
// Note: dynamicArgs is excluded from config file format for simplicity
// Users can work around this by including full command with args
export const ConfigLSPServerSchema = z.object({
  id: z.string().min(1, 'Server ID is required'),
  extensions: z.array(z.string().min(1)).min(1, 'At least one extension is required'),
  rootPatterns: z.array(z.string().min(1)).min(1, 'At least one root pattern is required'),
  command: z.array(z.string().min(1)).min(1, 'Command must have at least one element'),
  env: z.record(z.string(), z.string()).optional(),
  initialization: z.record(z.string(), z.unknown()).optional(),
});

// Schema for language extension mappings (file extension -> LSP language ID)
export const LanguageExtensionMappingSchema = z.record(
  z.string().startsWith('.', 'Extensions must start with a dot'),
  z.string().min(1, 'Language ID cannot be empty')
);

// Main config file schema
export const ConfigFileSchema = z.object({
  servers: z.array(ConfigLSPServerSchema).default([]),
  languageExtensions: LanguageExtensionMappingSchema.optional(),
});

// TypeScript types inferred from schemas
export type ConfigLSPServer = z.infer<typeof ConfigLSPServerSchema>;
export type LanguageExtensionMapping = z.infer<typeof LanguageExtensionMappingSchema>;
export type ConfigFile = z.infer<typeof ConfigFileSchema>;

// Function to convert config server to LSPServer type
export function configServerToLSPServer(configServer: ConfigLSPServer): LSPServer {
  return {
    id: configServer.id,
    extensions: configServer.extensions,
    rootPatterns: configServer.rootPatterns,
    command: configServer.command,
    env: configServer.env,
    initialization: configServer.initialization,
    // dynamicArgs is not supported in config files
  };
}

// Validation function for config file
export function validateConfigFile(data: unknown): ConfigFile {
  try {
    return ConfigFileSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => {
        const path = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
        return `${issue.message}${path}`;
      }).join('\n');
      throw new Error(`Config file validation failed:\n${issues}`);
    }
    throw error;
  }
}

// Default config file path
export const DEFAULT_CONFIG_PATH = '~/.config/cli-lsp-client/settings.json';

// Function to resolve home directory path
function resolveConfigPath(configPath: string): string {
  if (configPath.startsWith('~/')) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    return configPath.replace('~', homeDir);
  }
  return configPath;
}

// Function to load config file from filesystem
export async function loadConfigFile(configPath?: string): Promise<ConfigFile | null> {
  // Use provided path, or environment variable, or default path
  const actualConfigPath = configPath || process.env.LSPCLI_CONFIG_FILE || DEFAULT_CONFIG_PATH;
  try {
    const resolvedPath = resolveConfigPath(actualConfigPath);
    const configFile = Bun.file(resolvedPath);
    
    if (!(await configFile.exists())) {
      return null; // Config file doesn't exist, use defaults
    }
    
    const configText = await configFile.text();
    const configData: unknown = JSON.parse(configText);
    
    return validateConfigFile(configData);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Config file contains invalid JSON: ${error.message}`);
    }
    throw error;
  }
}

// Function to create config directory if it doesn't exist
export async function ensureConfigDirectory(configPath: string = DEFAULT_CONFIG_PATH): Promise<void> {
  const resolvedPath = resolveConfigPath(configPath);
  const configDir = resolvedPath.substring(0, resolvedPath.lastIndexOf('/'));
  
  try {
    await Bun.write(Bun.file(configDir + '/.keep'), '');
  } catch (error) {
    // Directory creation via write will create parent directories
    // If it fails, the directory might already exist, which is fine
    // We only care if we can't write to the directory when needed
  }
}

// Example config file content for documentation
export const EXAMPLE_CONFIG: ConfigFile = {
  servers: [
    {
      id: 'custom-typescript',
      extensions: ['.ts', '.tsx'],
      rootPatterns: ['tsconfig.json', 'package.json'],
      command: ['bunx', 'typescript-language-server', '--stdio'],
      env: {
        'NODE_ENV': 'development'
      },
      initialization: {
        preferences: {
          includeCompletionsForModuleExports: true
        }
      }
    },
    {
      id: 'rust-analyzer',
      extensions: ['.rs'],
      rootPatterns: ['Cargo.toml', 'Cargo.lock'],
      command: ['rust-analyzer'],
      env: {
        'RUST_LOG': 'error'
      }
    }
  ],
  languageExtensions: {
    '.rs': 'rust',
    '.toml': 'toml'
  }
};