/**
 * Adds two numbers together
 * @param a The first number
 * @param b The second number
 * @returns The sum of a and b
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Greets a person by name
 * @param name The name of the person to greet
 * @returns A greeting message
 */
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export const PI = 3.14159;

/**
 * Fetches data asynchronously from a remote source
 * @returns A promise that resolves to a string containing the fetched data
 */
export async function fetchData(): Promise<string> {
  return "Fetched data successfully";
}

// Type alias examples
export type UserID = string;
export type UserData = { id: UserID; name: string; age: number };

// Interface
export interface User {
  id: string;
  name: string;
  email: string;
}

// Variable with explicit type annotation
export const myUser: User = {
  id: "123",
  name: "John",
  email: "john@example.com"
};

// Variable with type alias annotation
export const userId: UserID = "user-456";

// Variable with inferred type
export const config = {
  apiUrl: "https://api.example.com",
  timeout: 5000
};

// Imported type usage (importing from TypeScript lib)
export const myPromise: Promise<number> = Promise.resolve(42);

// Function with type alias return type
export function getUserId(): UserID {
  return "user-789";
}