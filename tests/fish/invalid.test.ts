import { test, describe, expect } from 'bun:test';
import { runDiagnostics, stripAnsi } from '../test-utils.js';

describe('Fish Invalid Files', () => {

  test('invalid.fish should exit with code 2 and show exact errors', async () => {
    const filePath = 'tests/fish/invalid.fish';
    const proc = await runDiagnostics(filePath);
    
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stdout.toString())).toBe(`ERROR at line 11, column 7:
  missing closing token
  Source: fish-lsp
  Code: 1001

ERROR at line 11, column 7:
  missing closing token
  Source: fish-lsp
  Code: 1001`);
  });

});