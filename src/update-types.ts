export type Platform = 'darwin' | 'linux';
export type Architecture = 'x64' | 'arm64';
export type UpdateBehavior = 'auto' | 'off';

export type UpdateState = {
  lastCheckedAt: number;
};

export type OperationResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
