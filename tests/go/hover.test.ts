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
    expect(output).toBe(`Location: tests/fixtures/go/valid/main-package/simple-function.go:10:2
\`\`\`go
var message string
\`\`\`

Location: tests/fixtures/go/valid/main-package/simple-function.go:11:14
\`\`\`go
var message string
\`\`\`

Signature Details:
Println(a ...any) (n int, err error)
Println formats using the default formats for its operands and writes to standard output. Spaces are always added between operands and a newline is appended. It returns the number of bytes written and any write error encountered.

a ...any`);
  }, 10000);

  test('should get hover info for struct type', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'Person'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe(`Type Definition: tests/fixtures/go/valid/person-package/struct-example.go:5:6
\`\`\`go
type Person struct { // size=24 (0x18)
\tName string
\tAge  int
}
\`\`\`
\`\`\`go
func (p Person) Greet() string
\`\`\`

[person.Person on pkg.go.dev](https://pkg.go.dev/test-fixtures/valid/person-package#Person)`);
  }, 10000);

  test('should get hover info for struct field', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'Name'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe(`Declaration: tests/fixtures/go/valid/person-package/struct-example.go:6:2
\`\`\`go
field Name string // size=16 (0x10), offset=0
\`\`\`

[(person.Person).Name on pkg.go.dev](https://pkg.go.dev/test-fixtures/valid/person-package#Person.Name)`);
  }, 10000);

  test('should get hover info for method', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'Greet'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe(`Location: tests/fixtures/go/valid/person-package/struct-example.go:10:17
\`\`\`go
func (p Person) Greet() string
\`\`\`

[(person.Person).Greet on pkg.go.dev](https://pkg.go.dev/test-fixtures/valid/person-package#Person.Greet)`);
  }, 10000);

  test('should get hover info for constructor function', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/person-package/struct-example.go',
      'NewPerson'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    expect(output).toBe(`Declaration: tests/fixtures/go/valid/person-package/struct-example.go:14:6
\`\`\`go
func NewPerson(name string, age int) Person
\`\`\`

[person.NewPerson on pkg.go.dev](https://pkg.go.dev/test-fixtures/valid/person-package#NewPerson)`);
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
      .toBe(`Type Definition: tests/fixtures/go/valid/complex-types/complex-struct.go:8:6
\`\`\`go
type User struct { // size=176 (0xb0)
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

[complextypes.User on pkg.go.dev](https://pkg.go.dev/test-fixtures/valid/complex-types#User)

Declaration: tests/fixtures/go/valid/complex-types/complex-struct.go:64:3
\`\`\`go
field User string // size=16 (0x10), offset=40 (0x28)
\`\`\``);
  }, 10000);

  test('should show nested struct information', async () => {
    const result = await runHover(
      'tests/fixtures/go/valid/complex-types/complex-struct.go',
      'Address'
    );

    expect(result.exitCode).toBe(0);
    const output = stripAnsi(result.stdout.toString());
    // Should show both field declaration and Address struct definition
    expect(output).toBe(`Declaration: tests/fixtures/go/valid/complex-types/complex-struct.go:17:2
\`\`\`go
field Address Address // size=64 (0x40), offset=112 (0x70)
\`\`\`

[(complextypes.User).Address on pkg.go.dev](https://pkg.go.dev/test-fixtures/valid/complex-types#User.Address)

Type Definition: tests/fixtures/go/valid/complex-types/complex-struct.go:21:6
\`\`\`go
type Address struct { // size=64 (0x40)
	Street  string
	City    string
	Country string
	ZipCode string
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
