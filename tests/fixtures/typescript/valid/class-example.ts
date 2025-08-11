export class Calculator {
  private history: number[] = [];

  add(a: number, b: number): number {
    const result = a + b;
    this.history.push(result);
    return result;
  }

  getHistory(): readonly number[] {
    return this.history;
  }

  clear(): void {
    this.history = [];
  }
}