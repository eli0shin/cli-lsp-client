import { exec, type ChildProcessWithoutNullStreams } from 'child_process';
import { log } from './logger.js';

// Global registry of all spawned LSP processes
const lspProcesses = new Set<ChildProcessWithoutNullStreams>();

export function registerLSPProcess(
  process: ChildProcessWithoutNullStreams
): void {
  lspProcesses.add(process);
  log(
    `Registered LSP process ${process.pid} for cleanup (total: ${lspProcesses.size})`
  );

  // Remove from registry when process exits
  process.on('exit', () => {
    lspProcesses.delete(process);
    log(
      `LSP process ${process.pid} exited, removed from registry (remaining: ${lspProcesses.size})`
    );
  });
}

// Kill all registered LSP processes
export async function killAllLSPProcesses(): Promise<void> {
  log(`Killing ${lspProcesses.size} registered LSP processes`);

  const killPromises = Array.from(lspProcesses).map(async (proc) => {
    if (!proc.killed) {
      try {
        if (process.platform === 'win32') {
          // On Windows, use taskkill to kill the process tree
          await new Promise<void>((resolve) => {
            exec(`taskkill /pid ${proc.pid} /T /F`, (error) => {
              if (error) {
                log(`Error killing process tree on Windows: ${error}`);
              }
              resolve();
            });
          });
        } else {
          // On Unix-like systems, kill the process group
          try {
            process.kill(-proc.pid!, 'SIGKILL');
            log(`Killed process group -${proc.pid}`);
          } catch (e) {
            // If process group doesn't exist, kill individual process
            proc.kill('SIGKILL');
            log(`Killed individual process ${proc.pid}`);
          }
        }
      } catch (error) {
        log(`Error killing process ${proc.pid}: ${error}`);
      }
    }
  });

  await Promise.all(killPromises);
  lspProcesses.clear();
  log('All LSP processes killed and registry cleared');
}
