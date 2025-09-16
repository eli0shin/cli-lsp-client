import { test, describe, expect } from 'bun:test';
import { stripAnsi, runDiagnostics } from '../test-utils.js';

describe('C# Invalid Files', () => {
  test('syntax_errors.cs should exit with code 2 and show exact errors', async () => {
    const filePath = 'tests/fixtures/csharp/invalid/syntax_errors.cs';
    const proc = await runDiagnostics(filePath);
    expect(proc.exitCode).toBe(2);
    expect(stripAnsi(proc.stderr.toString()))
      .toBe(`[csharp] ERROR at line 8, column 39: { or ; or => expected [CS8180]
[csharp] ERROR at line 11, column 16: Method must have a return type [CS1520]
[csharp] ERROR at line 13, column 13: Since 'BadClass.BadClass()' returns void, a return keyword must not be followed by an object expression [CS0127]
[csharp] ERROR at line 23, column 10: } expected [CS1513]
[csharp] ERROR at line 28, column 31: The name 'undefinedVariable' does not exist in the current context [CS0103]
[csharp] ERROR at line 34, column 30: Newline in constant [CS1010]
[csharp] ERROR at line 34, column 47: ; expected [CS1002]
[csharp] ERROR at line 35, column 26: The name 'abc' does not exist in the current context [CS0103]
[csharp] ERROR at line 36, column 10: } expected [CS1513]
[csharp] ERROR at line 36, column 10: } expected [CS1513]
[csharp] WARNING at line 11, column 16: Non-nullable property 'Name' must contain a non-null value when exiting constructor. Consider adding the 'required' modifier or declaring the property as nullable. [CS8618]
[csharp] HINT at line 1, column 1: Unnecessary using directive. [CS8019]
[csharp] HINT at line 1, column 7: The using directive for 'System' appeared previously as global using [CS8933]`);
  }, 15000);
});