import { test, describe, expect } from 'bun:test';
import { spawn } from 'child_process';
import { CLI_PATH, stripAnsi } from './test-utils.js';

async function runHookCommand(
  input: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(CLI_PATH, ['claude-code-hook'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.stdin?.write(input);
    proc.stdin?.end();

    proc.on('error', reject);

    proc.on('close', (code) => {
      resolve({ exitCode: code ?? 0, stdout, stderr });
    });
  });
}

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
    const testFiles = [
      'tests/fixtures/typescript/valid/simple-function.ts',
      'tests/fixtures/javascript/valid/simple-module.js',
      'tests/fixtures/python/valid/simple-module.py',
      'tests/fixtures/json/valid/package.json',
      'tests/fixtures/yaml/valid/docker-compose.yml',
      'tests/fixtures/bash/valid/script.sh',
    ];

    for (const filePath of testFiles) {
      const input = JSON.stringify({ 
        tool_input: { file_path: filePath } 
      });
      const result = await runHookCommand(input);

      // Should process the file (exit code 0 for valid files)
      expect(result.exitCode).toBe(0);
    }
  }, 10000); // 10 second timeout for multiple file processing
});
