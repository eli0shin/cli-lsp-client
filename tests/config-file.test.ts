import { test, describe, expect } from 'bun:test';
import { runCommandWithArgs, stripAnsi } from './test-utils.js';
import path from 'path';

describe('Config File Support', () => {
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
  }, 10000);

  test('--config-file= format works', async () => {
    const configPath = path.resolve('tests/fixtures/config/svelte-config.json');
    const svelteFile = path.resolve('tests/fixtures/svelte/Component.svelte');
    
    // Test with --config-file=path format
    const proc = await runCommandWithArgs([`--config-file=${configPath}`, 'diagnostics', svelteFile]);
    expect(proc.exitCode).toBe(2); // Exit code 2 when diagnostics are found
    
    const output = stripAnsi(proc.stdout + proc.stderr);
    expect(output).toBe("[js] HINT at line 7, column 7: 'result' is declared but its value is never read. [6133]");
  }, 10000);

  test('missing --config-file argument shows error', async () => {
    const proc = await runCommandWithArgs(['--config-file']);

    expect(proc.exitCode).toBe(1);
    expect(stripAnsi(proc.stderr)).toBe("error: option '--config-file <path>' argument missing");
  });

  test('empty --config-file= should show help', async () => {
    // Commander treats --config-file= as invalid and shows help
    const proc = await runCommandWithArgs(['--config-file=']);

    expect(proc.exitCode).toBe(1);
    const output = stripAnsi(proc.stderr);
    expect(output).toContain('Usage: cli-lsp-client [options] [command]');
  });

  test('config file flag should not interfere with other commands', async () => {
    const configPath = path.resolve('tests/fixtures/config/svelte-config.json');
    
    // Test that help command works with config flag (though it shouldn't use it)
    const proc = await runCommandWithArgs(['--config-file', configPath, 'help']);
    
    expect(proc.exitCode).toBe(0);
    const output = stripAnsi(proc.stdout);
    expect(output).toContain('Usage: cli-lsp-client [options] [command]');
    expect(output).toContain('Examples:');
    expect(output).toContain('The daemon automatically starts when needed');
  });
});