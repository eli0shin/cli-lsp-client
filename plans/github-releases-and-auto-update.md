# Implementation Plan: GitHub Releases & Auto-Update

## Overview

Add GitHub Releases binary publishing alongside existing npm publishing, an `install.sh` script for direct binary installation, and an auto-update system that silently keeps the binary current and restarts all daemons after updates.

---

## Phase 1: Shared Types & Update State Persistence

### 1.1 Create `src/update-types.ts`

New file defining shared types used across all update modules.

```ts
export type Platform = 'darwin' | 'linux';
export type Architecture = 'x64' | 'arm64';

export type OperationResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type UpdateBehavior = 'auto' | 'off';

export type UpdateState = {
  lastCheckedAt: number;
};
```

**Design notes:**

- Only two update behaviors: `auto` (default) and `off`. No `notify` mode — simpler than repos.
- `OperationResult` is a discriminated union for typed error handling without exceptions.
- `UpdateState` only tracks `lastCheckedAt` — no `pendingNotification` since there's no `notify` mode.

### 1.2 Create `tests/update-types.test.ts`

Validates the type narrowing works correctly at runtime:

- Test `OperationResult` success path has `.data`
- Test `OperationResult` failure path has `.error`

(These are type-level sanity checks, minimal.)

### 1.3 Create `src/update-state.ts`

Functions for persisting and reading the update check timestamp. Adapted from `repos/src/update-state.ts`.

```ts
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { OperationResult, UpdateState } from './update-types.ts';

export function getUpdateStatePath(): string {
  const xdgStateHome = process.env.XDG_STATE_HOME;
  if (xdgStateHome) {
    return join(xdgStateHome, 'cli-lsp-client-update-state');
  }
  return join(homedir(), '.cli-lsp-client-update-state');
}

function isRecord(value: unknown): value is Record<string, unknown> { ... }
function isUpdateState(value: unknown): value is UpdateState { ... }

export async function readUpdateState(
  statePath?: string
): Promise<OperationResult<UpdateState | null>> { ... }

export async function writeUpdateState(
  statePath: string,
  state: UpdateState
): Promise<OperationResult> { ... }

export function shouldCheckForUpdate(
  state: UpdateState | null,
  intervalHours?: number // default 24
): boolean { ... }
```

**Key differences from repos:**

- State file named `cli-lsp-client-update-state` instead of `repos-update-state`
- No `pendingNotification` field since no `notify` mode
- `statePath` parameter injectable for testing

### 1.4 Create `tests/update-state.test.ts`

Test cases (all use temp directories, mock filesystem via temp files):

| Test                                                          | What it covers                      |
| ------------------------------------------------------------- | ----------------------------------- |
| `getUpdateStatePath returns XDG path when XDG_STATE_HOME set` | Set env var, verify path            |
| `getUpdateStatePath returns home dotfile when no XDG`         | Clear env var, verify fallback      |
| `readUpdateState returns null for missing file`               | Point at nonexistent path           |
| `readUpdateState returns null for invalid JSON`               | Write garbage to temp file          |
| `readUpdateState returns state for valid file`                | Write valid JSON, read back         |
| `writeUpdateState creates file`                               | Write to temp path, verify contents |
| `shouldCheckForUpdate returns true when state is null`        | Null input                          |
| `shouldCheckForUpdate returns true when cooldown expired`     | State with old timestamp            |
| `shouldCheckForUpdate returns false when within cooldown`     | State with recent timestamp         |

**Mocking strategy:** Use `Bun.write` to create temp files in `os.tmpdir()`. Mock `Date.now()` for time-dependent tests.

---

## Phase 2: Core Update Functions

### 2.1 Create `src/update.ts`

Core functions for checking versions and downloading binaries. Adapted from `repos/src/update.ts`.

```ts
import { platform, arch } from 'node:os';
import { join } from 'node:path';
import { chmod, rename, unlink } from 'node:fs/promises';
import type { OperationResult, Platform, Architecture } from './update-types.ts';

const GITHUB_REPO = 'eli0shin/cli-lsp-client';

type GitHubRelease = {
  tag_name: string;
};

function isGitHubRelease(data: unknown): data is GitHubRelease { ... }

export function getBinaryName(p: Platform, a: Architecture): string {
  return `cli-lsp-client-${p}-${a}`;
}

export function isNewerVersion(current: string, latest: string): boolean { ... }

export function getPlatform(): OperationResult<Platform> { ... }

export function getArchitecture(): OperationResult<Architecture> { ... }

export async function fetchLatestVersion(): Promise<
  OperationResult<{ version: string; downloadUrl: string }>
> { ... }

export async function downloadBinary(
  url: string,
  targetDir: string
): Promise<OperationResult<string>> { ... }

export async function replaceBinary(
  tempPath: string,
  targetPath: string
): Promise<OperationResult> { ... }
```

**Key differences from repos:**

- `GITHUB_REPO` is `'eli0shin/cli-lsp-client'`
- `getBinaryName` returns `cli-lsp-client-{os}-{arch}` (flat naming, no subdirectories)
- No `isPrerelease` function — we skip prereleases in the worker instead (or we can include it as a simple utility, same as repos)
- Download URL pattern: `https://github.com/eli0shin/cli-lsp-client/releases/latest/download/cli-lsp-client-{os}-{arch}`
- Temp file naming: `.cli-lsp-client-update-{timestamp}`

### 2.2 Create `tests/update.test.ts`

| Test                                       | Mocks                   | What it covers                                 |
| ------------------------------------------ | ----------------------- | ---------------------------------------------- |
| `getBinaryName formats correctly`          | None                    | Pure function                                  |
| `isNewerVersion detects newer major`       | None                    | `1.0.0` vs `2.0.0`                             |
| `isNewerVersion detects newer minor`       | None                    | `1.0.0` vs `1.1.0`                             |
| `isNewerVersion detects newer patch`       | None                    | `1.0.0` vs `1.0.1`                             |
| `isNewerVersion returns false for same`    | None                    | `1.0.0` vs `1.0.0`                             |
| `isNewerVersion returns false for older`   | None                    | `2.0.0` vs `1.0.0`                             |
| `getPlatform returns platform`             | None (runs on host)     | Verify it returns a valid result               |
| `getArchitecture returns architecture`     | None (runs on host)     | Verify it returns a valid result               |
| `fetchLatestVersion success`               | `fetch`                 | Mock GitHub API response                       |
| `fetchLatestVersion handles 404`           | `fetch`                 | Mock 404 response                              |
| `fetchLatestVersion handles network error` | `fetch`                 | Mock fetch rejection                           |
| `downloadBinary success`                   | `fetch`                 | Mock binary download, verify temp file created |
| `downloadBinary handles 404`               | `fetch`                 | Mock 404                                       |
| `replaceBinary success`                    | filesystem (temp files) | Create temp file, rename                       |
| `replaceBinary cleans up on failure`       | filesystem              | Force rename failure                           |

**Mocking strategy:** Mock `global.fetch` for network calls. Use real temp files for download/replace tests.

---

## Phase 3: Config Integration

### 3.1 Modify `src/lsp/config.ts`

Add `updateBehavior` to the existing config schema. This extends the config file at `~/.config/cli-lsp-client/settings.json`.

**Changes to `ConfigFileSchema`:**

```ts
// Add to existing schema
export const ConfigFileSchema = z.object({
  servers: z.array(ConfigLSPServerSchema).default([]),
  languageExtensions: LanguageExtensionMappingSchema.optional(),
  updateBehavior: z.enum(['auto', 'off']).optional(), // NEW
});
```

**Add helper function:**

```ts
export function getUpdateBehavior(config: ConfigFile | null): UpdateBehavior {
  return config?.updateBehavior ?? 'auto';
}
```

**Import `UpdateBehavior` from `./update-types.ts`** (note: this is an import from a sibling of `src/lsp/`, so the path is `../update-types.js`).

### 3.2 Update `tests/config-file.test.ts` (or add new unit tests)

Add unit tests for the config schema changes:

| Test                                                  | What it covers    |
| ----------------------------------------------------- | ----------------- |
| `config with updateBehavior auto parses correctly`    | Schema validation |
| `config with updateBehavior off parses correctly`     | Schema validation |
| `config without updateBehavior defaults to auto`      | Default behavior  |
| `config with invalid updateBehavior fails validation` | Rejection         |
| `getUpdateBehavior returns auto when config is null`  | Null config       |
| `getUpdateBehavior returns config value when set`     | Explicit value    |

These should be unit tests (not CLI integration tests), so create `tests/config-schema.test.ts` for these.

---

## Phase 4: Auto-Update Orchestrator & Worker

### 4.1 Create `src/auto-update.ts`

Decides when to check for updates and spawns the detached worker. Adapted from `repos/src/auto-update.ts`.

```ts
import {
  readUpdateState,
  shouldCheckForUpdate,
  getUpdateStatePath,
} from './update-state.ts';
import type { UpdateBehavior } from './update-types.ts';

type SpawnFn = (args: string[]) => void;

function defaultSpawn(args: string[]): void {
  const proc = Bun.spawn(args, {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  proc.unref();
}

export async function handleAutoUpdate(
  currentVersion: string,
  updateBehavior: UpdateBehavior,
  checkIntervalHours?: number, // default 24
  statePath?: string, // default getUpdateStatePath()
  spawnFn?: SpawnFn // default defaultSpawn, injectable for testing
): Promise<void> {
  if (updateBehavior === 'off') return;

  const resolvedStatePath = statePath ?? getUpdateStatePath();
  const stateResult = await readUpdateState(resolvedStatePath);
  const state = stateResult.success ? stateResult.data : null;

  if (!shouldCheckForUpdate(state, checkIntervalHours)) return;

  const binaryPath = process.execPath;
  const resolvedSpawnFn = spawnFn ?? defaultSpawn;
  resolvedSpawnFn([binaryPath, '--update-worker', currentVersion, binaryPath]);
}
```

**Key differences from repos:**

- No `notify` mode — no message returned, no `pendingNotification` handling
- Returns `void` instead of `{ message }` since there's nothing to display
- Only passes `currentVersion` and `binaryPath` to worker (no behavior arg needed — worker always does auto mode)
- `SpawnFn` injectable for testing (same pattern as repos)

### 4.2 Create `src/updater-worker.ts`

Background worker that checks for updates, downloads, replaces binary, and stops all daemons. Adapted from `repos/src/updater-worker.ts`.

```ts
import { dirname } from 'node:path';
import {
  fetchLatestVersion,
  isNewerVersion,
  downloadBinary,
  replaceBinary,
} from './update.ts';
import { getUpdateStatePath, writeUpdateState } from './update-state.ts';
import { stopAllDaemons } from './client.ts';
import type { UpdateState } from './update-types.ts';

export async function runUpdaterWorker(): Promise<void> {
  const [currentVersion, binaryPath] = process.argv.slice(3);

  if (!currentVersion || !binaryPath) return;

  const statePath = getUpdateStatePath();

  try {
    const releaseResult = await fetchLatestVersion();
    if (!releaseResult.success) return; // Don't update timestamp — retry sooner

    const { version: latestVersion, downloadUrl } = releaseResult.data;

    if (!isNewerVersion(currentVersion, latestVersion)) {
      await updateTimestamp(statePath);
      return;
    }

    // Download new binary
    const binaryDir = dirname(binaryPath);
    const downloadResult = await downloadBinary(downloadUrl, binaryDir);
    if (!downloadResult.success) {
      await updateTimestamp(statePath);
      return;
    }

    // Replace binary
    const replaceResult = await replaceBinary(downloadResult.data, binaryPath);
    if (!replaceResult.success) {
      await updateTimestamp(statePath);
      return;
    }

    // Stop all daemons so they restart with new binary
    await stopAllDaemons();

    await updateTimestamp(statePath);
  } catch {
    // Don't update timestamp on errors — retry sooner
  }
}

async function updateTimestamp(statePath: string): Promise<void> {
  const state: UpdateState = { lastCheckedAt: Date.now() };
  await writeUpdateState(statePath, state);
}
```

**Key differences from repos:**

- No `behaviorArg` parsing — the worker always does `auto` (download + replace)
- No `isPrerelease` check — GitHub releases from changesets won't have prerelease tags
- **Calls `stopAllDaemons()`** after replacing the binary — this is the critical lspcli-specific addition
- `stopAllDaemons()` imported from `src/client.ts` (already exists, already exported)

**Important consideration about `stopAllDaemons` in worker context:**
The `stopAllDaemons()` function writes to `process.stdout`. In the worker context, stdio is `['ignore', 'ignore', 'ignore']`, so these writes will silently fail. This is acceptable — the function still performs the actual stopping logic (sending stop commands to sockets and killing PIDs). No changes needed to `stopAllDaemons()`.

### 4.3 Create `tests/auto-update.test.ts`

| Test                                                   | Mocks               | What it covers                                                      |
| ------------------------------------------------------ | ------------------- | ------------------------------------------------------------------- |
| `handleAutoUpdate does nothing when behavior is off`   | spawnFn             | Verify spawn never called                                           |
| `handleAutoUpdate does nothing within cooldown`        | spawnFn, state file | Write recent state, verify no spawn                                 |
| `handleAutoUpdate spawns worker when cooldown expired` | spawnFn, state file | Write old state, verify spawn called with correct args              |
| `handleAutoUpdate spawns worker when no state exists`  | spawnFn             | No state file, verify spawn called                                  |
| `handleAutoUpdate passes correct args to worker`       | spawnFn             | Verify args array: [execPath, --update-worker, version, binaryPath] |

**Mocking strategy:** Inject `spawnFn` (a mock function that records calls). Use temp state files.

### 4.4 Create `tests/updater-worker.test.ts`

| Test                                                           | Mocks                             | What it covers                                 |
| -------------------------------------------------------------- | --------------------------------- | ---------------------------------------------- |
| `runUpdaterWorker exits early with missing args`               | process.argv                      | Set insufficient argv                          |
| `runUpdaterWorker updates timestamp when already on latest`    | fetch, state file                 | Mock fetchLatestVersion returning same version |
| `runUpdaterWorker downloads and replaces when newer available` | fetch, filesystem, stopAllDaemons | Full happy path                                |
| `runUpdaterWorker calls stopAllDaemons after replace`          | fetch, filesystem, stopAllDaemons | Verify order of operations                     |
| `runUpdaterWorker updates timestamp on download failure`       | fetch                             | Mock download 404                              |
| `runUpdaterWorker does NOT update timestamp on fetch failure`  | fetch                             | Mock network error                             |

**Mocking strategy:** Mock `global.fetch`, mock `stopAllDaemons` import (use `bun:test` mock module), use temp files. Set `process.argv` in test setup.

---

## Phase 5: Manual Update Command

### 5.1 Create `src/commands/update.ts`

Commander subcommand for manual update. Adapted from `repos/src/commands/update.ts`.

```ts
import type { Command } from '@commander-js/extra-typings';
import { dirname } from 'node:path';
import packageJson from '../../package.json' with { type: 'json' };
import {
  fetchLatestVersion,
  isNewerVersion,
  downloadBinary,
  replaceBinary,
} from '../update.ts';
import { stopAllDaemons } from '../client.ts';

export function registerUpdateCommand(program: Command) {
  program
    .command('update')
    .description('Update cli-lsp-client to the latest version')
    .action(async () => {
      process.stdout.write(`Current version: ${packageJson.version}\n`);
      process.stdout.write('Checking for updates...\n');

      const releaseResult = await fetchLatestVersion();
      if (!releaseResult.success) {
        process.stderr.write(
          `Error checking for updates: ${releaseResult.error}\n`
        );
        process.exit(1);
      }

      const { version: latestVersion, downloadUrl } = releaseResult.data;

      if (!isNewerVersion(packageJson.version, latestVersion)) {
        process.stdout.write(
          `Already on latest version (v${packageJson.version})\n`
        );
        return;
      }

      process.stdout.write(`Updating to v${latestVersion}...\n`);

      const binaryPath = process.execPath;
      const binaryDir = dirname(binaryPath);

      const downloadResult = await downloadBinary(downloadUrl, binaryDir);
      if (!downloadResult.success) {
        process.stderr.write(
          `Error downloading update: ${downloadResult.error}\n`
        );
        process.exit(1);
      }

      const replaceResult = await replaceBinary(
        downloadResult.data,
        binaryPath
      );
      if (!replaceResult.success) {
        process.stderr.write(
          `Error installing update: ${replaceResult.error}\n`
        );
        process.exit(1);
      }

      // Stop all daemons so they restart with new binary
      await stopAllDaemons();

      process.stdout.write(`Updated to v${latestVersion}\n`);
    });
}
```

**Design notes:**

- Uses `process.stdout.write` / `process.stderr.write` consistent with all other lspcli commands
- Calls `stopAllDaemons()` after successful update (same as worker)
- Uses `process.execPath` to find the current binary location
- Follows same `registerXxxCommand(program)` pattern as all other commands

### 5.2 Integration test `tests/update-command.test.ts`

This is harder to test as a CLI integration test since it makes real network calls. Options:

| Test                                    | Strategy                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `update command prints current version` | Could test against real CLI if mocking is complex. Alternatively, test the pure functions in `update.ts` and trust the wiring. |

For TDD, the important logic is tested in `update.ts` tests. The command itself is thin wiring. A basic integration test could verify the command exists:

```ts
test('update command is registered', async () => {
  const proc = await runCommandWithArgs(['update', '--help']);
  expect(proc.exitCode).toBe(0);
  expect(stripAnsi(proc.stdout)).toContain('Update cli-lsp-client');
});
```

---

## Phase 6: CLI Integration

### 6.1 Modify `src/cli.ts`

Three changes:

**1. Early `--update-worker` detection (before Commander):**

```ts
// Add at top of file, after imports
import { runUpdaterWorker } from './updater-worker.js';
import { handleAutoUpdate } from './auto-update.js';
import { loadConfigFile, getUpdateBehavior } from './lsp/config.js';
import { registerUpdateCommand } from './commands/update.js';

// Handle update worker mode early (before Commander parses)
if (process.argv[2] === '--update-worker') {
  await runUpdaterWorker();
  process.exit(0);
}
```

This goes right after the imports, before the `run()` function definition. It must be at module top-level (using top-level await) so it executes before any Commander setup.

**2. Non-blocking auto-update check:**

Inside `run()`, before Commander setup but after the daemon mode check:

```ts
async function run(): Promise<void> {
  // Check if we're being invoked to run as daemon
  if (process.env.LSPCLI_DAEMON_MODE === '1') {
    await startDaemon();
    return;
  }

  // Non-blocking auto-update check
  const config = await loadConfigFile().catch(() => null);
  const updateBehavior = getUpdateBehavior(config);
  handleAutoUpdate(packageJson.version, updateBehavior).catch(() => {});

  // ... rest of Commander setup
```

**Important:** `handleAutoUpdate` is intentionally not awaited for the spawn part — we just fire-and-forget the worker spawn. But the function itself is async because it reads the state file. We await the result to know if we should spawn, then the spawn itself is detached. Actually, looking at the repos pattern, `handleAutoUpdate` is awaited (it's fast — just reads a file and maybe spawns a detached process). We should await it too:

```ts
await handleAutoUpdate(packageJson.version, updateBehavior).catch(() => {});
```

This is fast (< 1ms for file read + spawn) and won't noticeably delay CLI startup.

**3. Register update command:**

```ts
registerUpdateCommand(program);
```

Add this alongside the other `registerXxxCommand` calls.

### 6.2 Complete modified `src/cli.ts`

```ts
#!/usr/bin/env bun

import { Command } from '@commander-js/extra-typings';
import { startDaemon } from './daemon.js';
import packageJson from '../package.json' with { type: 'json' };
import { registerVersionCommand } from './commands/version.js';
import { registerStatusCommand } from './commands/status.js';
import { registerListCommand } from './commands/list.js';
import { registerDiagnosticsCommand } from './commands/diagnostics.js';
import { registerHoverCommand } from './commands/hover.js';
import { registerStartCommand } from './commands/start.js';
import { registerLogsCommand } from './commands/logs.js';
import { registerStopCommand } from './commands/stop.js';
import { registerStopAllCommand } from './commands/stop-all.js';
import { registerMcpServerCommand } from './commands/mcp-server.js';
import { registerClaudeCodeHookCommand } from './commands/claude-code-hook.js';
import { registerUpdateCommand } from './commands/update.js';
import { runUpdaterWorker } from './updater-worker.js';
import { handleAutoUpdate } from './auto-update.js';
import { loadConfigFile, getUpdateBehavior } from './lsp/config.js';

// Handle update worker mode early (before Commander parses)
if (process.argv[2] === '--update-worker') {
  await runUpdaterWorker();
  process.exit(0);
}

async function run(): Promise<void> {
  // Check if we're being invoked to run as daemon
  if (process.env.LSPCLI_DAEMON_MODE === '1') {
    await startDaemon();
    return;
  }

  // Non-blocking auto-update check (fast: reads state file, maybe spawns detached worker)
  const config = await loadConfigFile().catch(() => null);
  const updateBehavior = getUpdateBehavior(config);
  await handleAutoUpdate(packageJson.version, updateBehavior).catch(() => {});

  const program = new Command()
    .name('cli-lsp-client')
    .description('CLI tool for fast LSP diagnostics with background daemon')
    .version(packageJson.version)
    .option('--config-file <path>', 'path to configuration file')
    .addHelpText(
      'after',
      `
Examples:
  cli-lsp-client status                         # Check daemon status
  cli-lsp-client list                           # List all running daemons
  cli-lsp-client diagnostics src/main.ts        # Get TypeScript diagnostics
  cli-lsp-client diagnostics ./script.py        # Get Python diagnostics
  cli-lsp-client hover src/client.ts runCommand # Get hover info for runCommand function
  cli-lsp-client start                          # Start servers for current directory
  cli-lsp-client start /path/to/project         # Start servers for specific directory
  cli-lsp-client logs                           # Get log file location
  cli-lsp-client stop                           # Stop the daemon
  cli-lsp-client stop-all                       # Stop all daemons (useful after package updates)
  cli-lsp-client update                         # Update to latest version
  cli-lsp-client mcp-server                     # Start MCP server

The daemon automatically starts when needed and caches LSP servers for fast diagnostics.
Use 'cli-lsp-client logs' to find the log file for debugging.
`
    );

  // Register all commands
  registerVersionCommand(program);
  registerStatusCommand(program);
  registerListCommand(program);
  registerDiagnosticsCommand(program);
  registerHoverCommand(program);
  registerStartCommand(program);
  registerLogsCommand(program);
  registerStopCommand(program);
  registerStopAllCommand(program);
  registerMcpServerCommand(program);
  registerClaudeCodeHookCommand(program);
  registerUpdateCommand(program);

  // Set default command to status
  if (process.argv.length === 2) {
    process.argv.push('status');
  }

  await program.parseAsync(process.argv);
}

if (import.meta.main) {
  run();
}
```

---

## Phase 7: GitHub Releases in CI

### 7.1 Modify `.github/workflows/version.yml`

Add steps after the changesets action to build flat binaries and upload them to the GitHub release. The changesets action with `createGithubReleases: true` creates a release with 0 assets — we check for this and upload.

```yaml
name: Version

on:
  workflow_run:
    workflows: ['Test']
    branches: [main]
    types: [completed]

jobs:
  version:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: bun install

      - name: Create Release Pull Request or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          version: bunx changeset version
          publish: bun run release --publish-only
          title: 'chore: version packages'
          createGithubReleases: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_CONFIG_PROVENANCE: true

      - name: Check if release needs binaries
        id: check-release
        run: |
          VERSION="v$(jq -r .version package.json)"
          if gh release view "$VERSION" &>/dev/null; then
            ASSET_COUNT=$(gh release view "$VERSION" --json assets --jq '.assets | length')
            if [ "$ASSET_COUNT" -eq 0 ]; then
              echo "Release exists with no binaries, will upload"
              echo "needs_binaries=true" >> $GITHUB_OUTPUT
              echo "version=$VERSION" >> $GITHUB_OUTPUT
            else
              echo "Release already has $ASSET_COUNT assets, skipping"
              echo "needs_binaries=false" >> $GITHUB_OUTPUT
            fi
          else
            echo "No release found for $VERSION"
            echo "needs_binaries=false" >> $GITHUB_OUTPUT
          fi
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Build linux-x64
        if: steps.check-release.outputs.needs_binaries == 'true'
        run: bun build src/cli.ts --compile --target=bun-linux-x64 --outfile cli-lsp-client-linux-x64

      - name: Build linux-arm64
        if: steps.check-release.outputs.needs_binaries == 'true'
        run: bun build src/cli.ts --compile --target=bun-linux-arm64 --outfile cli-lsp-client-linux-arm64

      - name: Build darwin-x64
        if: steps.check-release.outputs.needs_binaries == 'true'
        run: bun build src/cli.ts --compile --target=bun-darwin-x64 --outfile cli-lsp-client-darwin-x64

      - name: Build darwin-arm64
        if: steps.check-release.outputs.needs_binaries == 'true'
        run: bun build src/cli.ts --compile --target=bun-darwin-arm64 --outfile cli-lsp-client-darwin-arm64

      - name: Upload binaries to release
        if: steps.check-release.outputs.needs_binaries == 'true'
        run: |
          gh release upload "${{ steps.check-release.outputs.version }}" \
            cli-lsp-client-linux-x64 \
            cli-lsp-client-linux-arm64 \
            cli-lsp-client-darwin-x64 \
            cli-lsp-client-darwin-arm64 \
            --clobber
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Design notes:**

- No Windows binary in GitHub releases — Windows users use npm. The auto-update system also only supports darwin/linux (same as repos).
- Binaries are built as flat files: `cli-lsp-client-darwin-arm64` (not in subdirectories).
- The `--clobber` flag ensures idempotency if the workflow runs twice.
- This runs **after** the npm publish (`bun run release --publish-only`), so npm always gets published first.
- The npm build in `script/build.ts` creates 5 platform packages in `dist/`. The GitHub release build creates 4 flat binaries in the workspace root. These are separate build steps — the npm build happens inside the `publish:` command, while the GitHub release build happens in explicit workflow steps.

---

## Phase 8: Install Script

### 8.1 Create `install.sh`

```bash
#!/bin/bash
set -euo pipefail

REPO="eli0shin/cli-lsp-client"
INSTALL_DIR="${HOME}/.local/bin"
BINARY_NAME="cli-lsp-client"

# Detect OS
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$OS" in
  darwin) OS="darwin" ;;
  linux) OS="linux" ;;
  *)
    echo "Unsupported OS: $OS"
    exit 1
    ;;
esac

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

ARTIFACT="${BINARY_NAME}-${OS}-${ARCH}"

echo "Detected: ${OS}-${ARCH}"
echo "Installing to: ${INSTALL_DIR}/${BINARY_NAME}"

# Create install directory
mkdir -p "$INSTALL_DIR"

# Download latest release
DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${ARTIFACT}"
echo "Downloading from: ${DOWNLOAD_URL}"

curl -fsSL "$DOWNLOAD_URL" -o "${INSTALL_DIR}/${BINARY_NAME}"
chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

echo "Installed ${BINARY_NAME} to ${INSTALL_DIR}/${BINARY_NAME}"

# Check if install dir is in PATH
if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
  echo ""
  echo "Add this to your shell profile to use cli-lsp-client:"
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
fi
```

**Usage:** `curl -fsSL https://raw.githubusercontent.com/eli0shin/cli-lsp-client/main/install.sh | bash`

---

## Implementation Order & Dependencies

```
Phase 1: Types & State       (no dependencies)
  ├── src/update-types.ts
  ├── src/update-state.ts
  ├── tests/update-state.test.ts
  │
Phase 2: Core Update         (depends on Phase 1)
  ├── src/update.ts
  ├── tests/update.test.ts
  │
Phase 3: Config Integration  (depends on Phase 1 for UpdateBehavior type)
  ├── src/lsp/config.ts (modify)
  ├── tests/config-schema.test.ts
  │
Phase 4: Worker & Orchestrator (depends on Phases 1, 2, 3)
  ├── src/auto-update.ts
  ├── src/updater-worker.ts
  ├── tests/auto-update.test.ts
  ├── tests/updater-worker.test.ts
  │
Phase 5: Update Command      (depends on Phase 2)
  ├── src/commands/update.ts
  ├── tests/update-command.test.ts
  │
Phase 6: CLI Integration     (depends on Phases 3, 4, 5)
  ├── src/cli.ts (modify)
  │
Phase 7: CI Workflow          (independent, can be done anytime)
  ├── .github/workflows/version.yml (modify)
  │
Phase 8: Install Script       (independent, can be done anytime)
  └── install.sh
```

---

## File Summary

### New Files (10)

| File                         | Purpose                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `src/update-types.ts`        | Shared types: Platform, Architecture, OperationResult, UpdateBehavior, UpdateState |
| `src/update-state.ts`        | Read/write update check timestamp state file                                       |
| `src/update.ts`              | Core update functions: fetch version, download binary, replace binary              |
| `src/auto-update.ts`         | Orchestrator: check cooldown, spawn detached worker                                |
| `src/updater-worker.ts`      | Background worker: check → download → replace → stop daemons                       |
| `src/commands/update.ts`     | Manual `update` command                                                            |
| `install.sh`                 | Bash installer for direct binary download                                          |
| `tests/update-state.test.ts` | Tests for state persistence                                                        |
| `tests/update.test.ts`       | Tests for core update functions                                                    |
| `tests/auto-update.test.ts`  | Tests for auto-update orchestrator                                                 |

### Modified Files (3)

| File                            | Changes                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `src/lsp/config.ts`             | Add `updateBehavior` to schema, add `getUpdateBehavior()` helper                  |
| `src/cli.ts`                    | Add `--update-worker` early detection, auto-update check, register update command |
| `.github/workflows/version.yml` | Add binary build + upload steps after changesets publish                          |

### Optional Test Files (3)

| File                           | Purpose                                                |
| ------------------------------ | ------------------------------------------------------ |
| `tests/config-schema.test.ts`  | Unit tests for config schema changes                   |
| `tests/updater-worker.test.ts` | Tests for background worker logic                      |
| `tests/update-command.test.ts` | Basic integration test for update command registration |

---

## Behavioral Flow Summary

### Auto-update flow (every CLI invocation)

```
User runs: cli-lsp-client diagnostics src/foo.ts
  │
  ├── Is argv[2] === '--update-worker'? → No, continue
  ├── Is LSPCLI_DAEMON_MODE=1? → No, continue
  ├── Read config file → get updateBehavior (default: 'auto')
  ├── handleAutoUpdate():
  │     ├── behavior === 'off'? → return (do nothing)
  │     ├── Read state file → get lastCheckedAt
  │     ├── Within 24h cooldown? → return (do nothing)
  │     └── Spawn detached: cli-lsp-client --update-worker <version> <binaryPath>
  │           │
  │           └── (detached process, parent continues immediately)
  │                 ├── fetchLatestVersion() → GitHub API
  │                 ├── isNewerVersion()? → No → update timestamp, exit
  │                 │                     → Yes → continue
  │                 ├── downloadBinary() → temp file
  │                 ├── replaceBinary() → atomic rename
  │                 ├── stopAllDaemons() → stop all lspcli daemons
  │                 └── updateTimestamp() → write state file
  │
  ├── Commander parses, runs diagnostics command normally
  └── Exit
```

### Manual update flow

```
User runs: cli-lsp-client update
  │
  ├── Print current version
  ├── fetchLatestVersion() → GitHub API
  ├── isNewerVersion()? → No → "Already on latest", exit
  │                     → Yes → continue
  ├── Print "Updating to vX.Y.Z..."
  ├── downloadBinary() → temp file
  ├── replaceBinary() → atomic rename
  ├── stopAllDaemons() → stop all lspcli daemons
  └── Print "Updated to vX.Y.Z"
```

### Install flow

```
User runs: curl -fsSL .../install.sh | bash
  │
  ├── Detect OS (darwin/linux)
  ├── Detect arch (x64/arm64)
  ├── Download cli-lsp-client-{os}-{arch} from GitHub releases
  ├── Install to ~/.local/bin/cli-lsp-client
  └── Suggest PATH addition if needed
```

### CI release flow

```
Push to main → Test workflow passes → Version workflow triggers
  │
  ├── changesets/action:
  │     ├── If changesets pending → Create/update PR
  │     └── If PR merged → Publish:
  │           ├── bun run release --publish-only (npm publish, existing flow)
  │           └── createGithubReleases: true (create GH release with 0 assets)
  │
  ├── Check if release needs binaries:
  │     └── gh release view → 0 assets? → needs_binaries=true
  │
  └── If needs_binaries:
        ├── Build 4 flat binaries (darwin-x64, darwin-arm64, linux-x64, linux-arm64)
        └── Upload to GitHub release
```
