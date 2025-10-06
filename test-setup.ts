// Global test setup that runs before all tests
import { spawn } from 'bun';

const CLI_PATH = process.env.CLI_LSP_CLIENT_BIN_PATH || './bin/cli-lsp-client';

console.log('Running global test setup...');

try {
  // Build the latest binary first
  console.log('Building latest binary...');
  await spawn(['bun', 'run', 'build']).exited;

  // Stop any existing daemons to ensure clean state
  console.log('Stopping any existing daemons...');
  await spawn([CLI_PATH, 'stop']).exited;

  // Run start to ensure daemon is ready
  console.log('Starting daemon...');
  await spawn([CLI_PATH, 'start']).exited;

  // Wait for daemon to be fully ready after start
  console.log('Waiting for daemon to be ready...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log('Global test setup complete');
} catch (error) {
  console.log('Global test setup error (may be expected):', error);
}
