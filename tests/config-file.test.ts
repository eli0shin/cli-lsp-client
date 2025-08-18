import { test, describe, expect, beforeAll, afterAll } from 'bun:test';
import { runCommandWithArgs, stripAnsi } from './test-utils.js';
import path from 'path';

describe('Config File Support', () => {
  beforeAll(async () => {
    // Stop any running daemon to ensure clean state
    await runCommandWithArgs(['stop']).catch(() => {});
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Clean up daemon after tests
    await runCommandWithArgs(['stop']).catch(() => {});
  });

  test('config file enables custom language server and provides diagnostics', async () => {
    const configPath = path.resolve('tests/fixtures/config/svelte-config.json');
    const svelteFile = path.resolve('tests/fixtures/svelte/Component.svelte');
    
    // Test diagnostics without config (should return no results for .svelte)
    const withoutConfigProc = await runCommandWithArgs(['diagnostics', svelteFile]);
    expect(withoutConfigProc.exitCode).toBe(0);
    expect(stripAnsi(withoutConfigProc.stdout + withoutConfigProc.stderr)).toBe('');
    
    // Test diagnostics with config (should return svelte diagnostics)  
    const withConfigProc = await runCommandWithArgs(['--config-file', configPath, 'diagnostics', svelteFile]);
    expect(withConfigProc.exitCode).toBe(2); // Exit code 2 when diagnostics are found
    const configOutput = stripAnsi(withConfigProc.stdout + withConfigProc.stderr);
    expect(configOutput).toBe("[js] HINT at line 7, column 7: 'result' is declared but its value is never read. [6133]");
    
    // Test switching back to no config (should return no results again)
    const backToNoConfigProc = await runCommandWithArgs(['diagnostics', svelteFile]);
    expect(backToNoConfigProc.exitCode).toBe(0);
    expect(stripAnsi(backToNoConfigProc.stdout + backToNoConfigProc.stderr)).toBe('');
  });

  test('--config-file= format works', async () => {
    const configPath = path.resolve('tests/fixtures/config/svelte-config.json');
    const svelteFile = path.resolve('tests/fixtures/svelte/Component.svelte');
    
    // Test with --config-file=path format
    const proc = await runCommandWithArgs([`--config-file=${configPath}`, 'diagnostics', svelteFile]);
    expect(proc.exitCode).toBe(2); // Exit code 2 when diagnostics are found
    
    const output = stripAnsi(proc.stdout + proc.stderr);
    expect(output).toBe("[js] HINT at line 7, column 7: 'result' is declared but its value is never read. [6133]");
  });

  test('missing --config-file argument shows error', async () => {
    const proc = await runCommandWithArgs(['--config-file']);
    
    expect(proc.exitCode).toBe(1);
    expect(stripAnsi(proc.stderr)).toBe('Error: --config-file requires a path argument');
  });

  test('empty --config-file= should show error', async () => {
    const proc = await runCommandWithArgs(['--config-file=']);
    
    expect(proc.exitCode).toBe(1);
    expect(stripAnsi(proc.stderr)).toBe('Error: --config-file= requires a path after the equals sign');
  });

  test('config file flag should not interfere with other commands', async () => {
    const configPath = path.resolve('tests/fixtures/config/svelte-config.json');
    
    // Test that help command works with config flag (though it shouldn't use it)
    const proc = await runCommandWithArgs(['--config-file', configPath, 'help']);
    
    expect(proc.exitCode).toBe(0);
    expect(stripAnsi(proc.stdout)).toBe('Usage: cli-lsp-client <command> [arguments]\n\nCommands:\n  help                          Show this help message\n  version                       Show version number\n  status                        Show daemon status and memory usage\n  list                          List all running daemons with their working directories\n  diagnostics <file>           Get diagnostics for a file\n  hover <file> <symbol>        Get hover info for a symbol in specific file\n  start [directory]            Start LSP servers for a directory (default: current)\n  logs                         Show the daemon log file path\n  stop                         Stop the daemon\n  stop-all                     Stop all daemons across all directories\n\nExamples:\n  cli-lsp-client help                           # Show this help\n  cli-lsp-client version                        # Show version number\n  cli-lsp-client status                         # Check daemon status\n  cli-lsp-client list                           # List all running daemons\n  cli-lsp-client diagnostics src/main.ts        # Get TypeScript diagnostics\n  cli-lsp-client diagnostics ./script.py       # Get Python diagnostics\n  cli-lsp-client hover src/client.ts runCommand # Get hover info for runCommand function\n  cli-lsp-client hover src/formatter.ts formatHoverResults # Get hover info for formatHoverResults function\n  cli-lsp-client start                          # Start servers for current directory\n  cli-lsp-client start /path/to/project        # Start servers for specific directory\n  cli-lsp-client logs                           # Get log file location\n  cli-lsp-client stop                           # Stop the daemon\n  cli-lsp-client stop-all                       # Stop all daemons (useful after package updates)\n\nThe daemon automatically starts when needed and caches LSP servers for fast diagnostics.\nUse \'cli-lsp-client logs\' to find the log file for debugging.');
  });
});