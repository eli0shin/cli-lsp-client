export type HoverResult = {
  symbol: string;
  hover: string;
  location: {
    file: string;
    line: number;
    column: number;
  };
};

export interface TestInterface {
  name: string;
  value: number;
}