import { HoverResult, TestInterface } from './types';

export function processHover(result: HoverResult): TestInterface {
  return {
    name: result.symbol,
    value: result.location.line
  };
}