import { test, describe, expect } from 'bun:test';
import { stripAnsi, runDiagnostics } from '../test-utils.js';

describe('Java Invalid Files', () => {

  test('syntax-error.java should exit with code 2 and show exact errors', async () => {
    const filePath = 'tests/fixtures/java/invalid/src/main/java/com/example/syntax-error.java';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stdout.toString())).toBe(`ERROR at line 3, column 14:
  The public type SyntaxError must be defined in its own file
  Source: Java
  Code: 16777541

ERROR at line 7, column 42:
  Syntax error on token ")", { expected after this token
  Source: Java
  Code: 1610612967

ERROR at line 8, column 35:
  Syntax error, insert ";" to complete BlockStatements
  Source: Java
  Code: 1610612976

ERROR at line 11, column 28:
  undefinedVariable cannot be resolved to a variable
  Source: Java
  Code: 33554515

ERROR at line 14, column 22:
  Type mismatch: cannot convert from String to int
  Source: Java
  Code: 16777233

ERROR at line 22, column 9:
  The method nonExistentMethod() is undefined for the type SyntaxError
  Source: Java
  Code: 67108964

ERROR at line 23, column 5:
  Syntax error, insert "else Statement" to complete IfStatement
  Source: Java
  Code: 1610612976

ERROR at line 23, column 5:
  Syntax error, insert "}" to complete MethodBody
  Source: Java
  Code: 1610612976

ERROR at line 27, column 9:
  Void methods cannot return a value
  Source: Java
  Code: 67108969

ERROR at line 28, column 5:
  Syntax error, insert "}" to complete ClassBody
  Source: Java
  Code: 1610612976`);
  });
});