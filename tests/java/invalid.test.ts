import { test, describe, expect } from 'bun:test';
import { stripAnsi, runDiagnostics } from '../test-utils.js';

describe('Java Invalid Files', () => {
  test('syntax-error.java should exit with code 2 and show exact errors', async () => {
    const filePath =
      'tests/fixtures/java/invalid/src/main/java/com/example/syntax-error.java';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stderr.toString()))
      .toBe(`[Java] ERROR at line 3, column 14: The public type SyntaxError must be defined in its own file [16777541]
[Java] ERROR at line 7, column 42: Syntax error on token ")", { expected after this token [1610612967]
[Java] ERROR at line 8, column 35: Syntax error, insert ";" to complete BlockStatements [1610612976]
[Java] ERROR at line 11, column 28: undefinedVariable cannot be resolved to a variable [33554515]
[Java] ERROR at line 14, column 22: Type mismatch: cannot convert from String to int [16777233]
[Java] ERROR at line 22, column 9: The method nonExistentMethod() is undefined for the type SyntaxError [67108964]
[Java] ERROR at line 23, column 5: Syntax error, insert "}" to complete MethodBody [1610612976]
[Java] ERROR at line 23, column 5: Syntax error, insert "else Statement" to complete IfStatement [1610612976]
[Java] ERROR at line 27, column 9: Void methods cannot return a value [67108969]
[Java] ERROR at line 28, column 5: Syntax error, insert "}" to complete ClassBody [1610612976]`);
  }, 15000);
});
