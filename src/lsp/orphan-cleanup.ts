import { execSync } from 'child_process';
import { log } from '../logger.js';

/**
 * Kill orphaned LSP processes from previous daemon instances.
 * This handles cases where the daemon was killed with SIGKILL.
 */
export async function killOrphanedLSPProcesses(): Promise<void> {
  log('Checking for orphaned LSP processes...');
  
  const patterns = [
    'typescript-language-server',
    'pyright-langserver',
    'gopls',
    'bash-language-server',
    'yaml-language-server',
    'vscode-json-language-server',
    'vscode-css-language-server',
    'lua-language-server',
    'jdtls',
    'omnisharp.*--languageserver',
    'R.*--slave.*-e.*languageserver',
    'graphql-lsp',
    'rust-analyzer',
  ];
  
  let killedCount = 0;
  
  for (const pattern of patterns) {
    try {
      if (process.platform === 'win32') {
        // On Windows, use wmic to find and kill processes
        try {
          const pids = execSync(
            `wmic process where "CommandLine like '%${pattern}%'" get ProcessId`,
            { encoding: 'utf8' }
          );
          
          const matches = pids.match(/\d+/g);
          if (matches) {
            for (const pid of matches) {
              try {
                execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
                killedCount++;
              } catch {
                // Process may have already exited
              }
            }
          }
        } catch {
          // No matching processes
        }
      } else {
        // On Unix-like systems, use pkill
        try {
          // First try to find processes
          const result = execSync(`pgrep -f "${pattern}"`, { encoding: 'utf8' });
          const pids = result.trim().split('\n').filter(Boolean);
          
          if (pids.length > 0) {
            // Don't kill our own daemon process
            const ourPid = process.pid.toString();
            const parentPid = process.ppid.toString();
            
            for (const pid of pids) {
              if (pid !== ourPid && pid !== parentPid) {
                try {
                  process.kill(parseInt(pid), 'SIGKILL');
                  killedCount++;
                  log(`Killed orphaned LSP process: ${pid} (${pattern})`);
                } catch {
                  // Process may have already exited
                }
              }
            }
          }
        } catch {
          // No matching processes or pgrep not available
        }
      }
    } catch (error) {
      // Ignore errors for individual patterns
    }
  }
  
  if (killedCount > 0) {
    log(`Killed ${killedCount} orphaned LSP processes`);
  } else {
    log('No orphaned LSP processes found');
  }
}