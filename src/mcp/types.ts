export type HoverToolInput = {
  file: string;
  symbol: string;
};

export type HoverToolOutput = {
  symbol: string;
  location: string;
  content: string;
  documentation?: string;
};