import { test, describe, expect } from 'bun:test';
import { stripAnsi, runHookCommand } from './test-utils.js';

describe('Claude Code Hook', () => {
  test('should handle valid TypeScript file with errors', async () => {
    const input = JSON.stringify({
      tool_input: {
        file_path: 'tests/fixtures/typescript/invalid/type-error.ts',
      },
    });
    const result = await runHookCommand(input);

    expect(result.exitCode).toBe(2);
    expect(stripAnsi(result.stderr))
      .toBe(`[typescript] ERROR at line 3, column 3: Type 'number' is not assignable to type 'string'. [2322]
[typescript] ERROR at line 7, column 9: Type 'number' is not assignable to type 'string'. [2322]
[typescript] HINT at line 1, column 27: 'name' is declared but its value is never read. [6133]
[typescript] HINT at line 7, column 9: 'x' is declared but its value is never read. [6133]`);
  });

  test('should handle valid TypeScript file without errors', async () => {
    const input = JSON.stringify({
      tool_input: {
        file_path: 'tests/fixtures/typescript/valid/simple-function.ts',
      },
    });
    const result = await runHookCommand(input);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  }, 10000); // 10 second timeout

  test('should handle Python file with errors', async () => {
    const input = JSON.stringify({
      tool_input: {
        file_path: 'tests/fixtures/python/invalid/syntax-error.py',
      },
    });
    const result = await runHookCommand(input);

    expect(result.exitCode).toBe(2);
    expect(stripAnsi(result.stderr)).toBe(
      `[Pyright] ERROR at line 2, column 13: Expected ":"`
    );
  });

  test('should ignore unsupported file types', async () => {
    const input = JSON.stringify({ 
      tool_input: { file_path: 'README.txt' } 
    });
    const result = await runHookCommand(input);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  });

  test('should handle non-existent files gracefully', async () => {
    const input = JSON.stringify({ 
      tool_input: { file_path: 'non-existent-file.ts' } 
    });
    const result = await runHookCommand(input);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  });

  test('should handle empty JSON input', async () => {
    const input = JSON.stringify({});
    const result = await runHookCommand(input);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  });

  test('should handle tool_input with content field', async () => {
    const input = JSON.stringify({
      tool_input: {
        file_path: 'tests/fixtures/typescript/invalid/type-error.ts',
        content: 'some content',
      },
    });
    const result = await runHookCommand(input);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('ERROR at line');
  });

  test('should handle empty stdin gracefully', async () => {
    const result = await runHookCommand('');

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  });

  test('should handle malformed JSON gracefully', async () => {
    const input = '{ invalid json }';
    const result = await runHookCommand(input);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  });

  test('should handle all supported file extensions', async () => {
    // Test using existing fixture files instead of creating temporary ones
    const allTestFiles = [
      'tests/fixtures/typescript/valid/simple-function.ts',
      'tests/fixtures/javascript/valid/simple-module.js',
      'tests/fixtures/python/valid/simple-module.py',
      'tests/fixtures/json/valid/test-package.json',
      'tests/fixtures/yaml/valid/docker-compose-example.yml',
      'tests/fixtures/bash/valid/script.sh',
    ];

    // Filter out JSON files in CI environment due to timeout issues
    const testFiles = process.env.CI === 'true'
      ? allTestFiles.filter(file => !file.includes('/json/'))
      : allTestFiles;

    for (const filePath of testFiles) {
      const input = JSON.stringify({
        tool_input: { file_path: filePath }
      });
      const result = await runHookCommand(input);

      // Should process the file (exit code 0 for valid files)
      expect(result.exitCode).toBe(0);
    }
  }, 10000); // 10 second timeout for multiple file processing

  test('should handle valid file in plugin mode', async () => {
    const input = JSON.stringify({
      tool_input: {
        file_path: 'tests/fixtures/typescript/valid/simple-function.ts',
      },
    });
    const result = await runHookCommand(input, { CLAUDE_PLUGIN_ROOT: '/tmp/plugin' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('{}');
  }, 10000); // 10 second timeout

  test('should handle file with diagnostic errors in plugin mode', async () => {
    const input = JSON.stringify({
      tool_input: {
        file_path: 'tests/fixtures/typescript/invalid/type-error.ts',
      },
    });
    const result = await runHookCommand(input, { CLAUDE_PLUGIN_ROOT: '/tmp/plugin' });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(stripAnsi(result.stdout))).toEqual({
      decision: 'block',
      reason: `[typescript] ERROR at line 3, column 3: Type 'number' is not assignable to type 'string'. [2322]
[typescript] ERROR at line 7, column 9: Type 'number' is not assignable to type 'string'. [2322]
[typescript] HINT at line 1, column 27: 'name' is declared but its value is never read. [6133]
[typescript] HINT at line 7, column 9: 'x' is declared but its value is never read. [6133]`
    });
  });

  test('should handle PreToolUse event and return empty output', async () => {
    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_input: {
        file_path: 'tests/fixtures/typescript/valid/simple-function.ts',
      },
    });
    const result = await runHookCommand(input, { CLAUDE_PLUGIN_ROOT: '/tmp/plugin' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('{}');
  }, 10000);

  test('should handle PreToolUse with MultiEdit file extraction', async () => {
    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_input: {
        edits: [
          { file_path: 'tests/fixtures/typescript/valid/simple-function.ts' },
          { file_path: 'tests/fixtures/javascript/valid/simple-module.js' },
        ],
      },
    });
    const result = await runHookCommand(input, { CLAUDE_PLUGIN_ROOT: '/tmp/plugin' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('{}');
  }, 10000);

  test('should handle PreToolUse in non-plugin mode', async () => {
    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_input: {
        file_path: 'tests/fixtures/typescript/valid/simple-function.ts',
      },
    });
    const result = await runHookCommand(input);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  }, 10000);

  test('should handle PreToolUse with no file path', async () => {
    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_input: {},
    });
    const result = await runHookCommand(input, { CLAUDE_PLUGIN_ROOT: '/tmp/plugin' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('{}');
  });
});
