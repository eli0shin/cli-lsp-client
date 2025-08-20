import { test, describe, expect } from 'bun:test';
import { runHover, stripAnsi } from '../test-utils.js';

describe('Go Hover Command', () => {
  test('should get hover info for function', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/main-package/simple-function.go',
      'greet'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);

  test('should get hover info for variable', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/main-package/simple-function.go',
      'message'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('message');
  }, 10000);

  test('should get hover info for struct type', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'Person'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('Person');
  }, 10000);

  test('should get hover info for struct field', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'Name'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('Name');
  }, 10000);

  test('should get hover info for method', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'Greet'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('Greet');
  }, 10000);

  test('should get hover info for constructor function', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'NewPerson'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toContain('NewPerson');
  }, 10000);

  test('should expand struct types showing all fields with their types', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/complex-types/complex-struct.go',
      'User'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    // Go shows the full struct definition with all fields
    expect(output)
      .toBe(`Location: tests/fixtures/go/valid/complex-types/complex-struct.go:8:6
\`\`\`go
type User struct {
\tID        int
\tName      string
\tEmail     string
\tAge       int
\tActive    bool
\tCreatedAt time.Time
\tTags      []string
\tMetadata  map[string]interface{}
\tAddress   Address
}
\`\`\`

User represents a user with various fields for testing struct expansion

\`\`\`go
func (u User) AddTag(tag string)
func (u User) SetAddress(street string, city string, country string, zipCode string)
\`\`\`

[complextypes.User on pkg.go.dev](https://pkg.go.dev/test-fixtures/valid/complex-types#User)`);
  }, 10000);

  test('should show nested struct information', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/complex-types/complex-struct.go',
      'Address'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    // Should show the Address struct with its fields
    expect(output)
      .toBe(`Location: tests/fixtures/go/valid/complex-types/complex-struct.go:21:6
\`\`\`go
type Address struct {
\tStreet  string
\tCity    string
\tCountry string
\tZipCode string
}
\`\`\`

Address represents a nested struct


[complextypes.Address on pkg.go.dev](https://pkg.go.dev/test-fixtures/valid/complex-types#Address)`);
  }, 10000);

  test('should show method signatures with receiver and return types', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/complex-types/complex-struct.go',
      'AddTag'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    // Should show the method with receiver and parameters
    expect(output)
      .toBe(`Location: tests/fixtures/go/valid/complex-types/complex-struct.go:41:16
\`\`\`go
func (u *User) AddTag(tag string)
\`\`\`

AddTag adds a tag to the user


[(complextypes.User).AddTag on pkg.go.dev](https://pkg.go.dev/test-fixtures/valid/complex-types#User.AddTag)`);
  }, 10000);

  test('should handle symbol not found gracefully', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/main-package/simple-function.go',
      'NonExistentSymbol'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe('No hover information found for the symbol.');
  }, 10000);
});
