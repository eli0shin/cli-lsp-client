// Fixture with multiple symbols of the same name in one file

class GreeterA {
  greet(name: string): string {
    return `Hello, ${name} from A`;
  }
}

class GreeterB {
  greet(name: string): string {
    return `Hello, ${name} from B`;
  }
}

export function use(): void {
  const a = new GreeterA();
  const b = new GreeterB();
  a.greet('Alice');
  b.greet('Bob');
}

