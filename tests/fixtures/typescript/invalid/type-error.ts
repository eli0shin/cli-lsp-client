export function typeError(name: string): string {
  // Type error: trying to return number instead of string
  return 42;
}

export function anotherError(): void {
  const x: string = 123; // Type error: number assigned to string
}