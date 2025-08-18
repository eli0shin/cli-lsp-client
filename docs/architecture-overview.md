# CLI LSP Client – Architecture & Execution Flow

## Overview

`cli-lsp-client` is a CLI tool that provides fast, cross-language LSP-powered diagnostics and hover information. It runs a background daemon per working directory that keeps language servers warm for sub‑second subsequent requests, and exposes management commands to inspect and control those processes.

- Diagnostics: Aggregates LSP diagnostics for a file; exits with code 2 if issues exist.
- Hover: Fetches and nicely formats symbol hover content for a specific file + symbol.
- Daemon: One per directory; manages LSP clients and serves commands over a UNIX socket.
- Management: `status`, `list`, `start`, `stop`, `stop-all`, `logs`.
- Claude Code Hook: Safe, quiet post-edit diagnostics for supported files.
- Extensible Config: Optional JSON config to add/override servers and language IDs.

## High-Level Architecture

CLI (`src/cli.ts`) → Client (`src/client.ts`) → UNIX socket → Daemon (`src/daemon.ts`) → LSP Manager (`src/lsp/manager.ts`) → LSP Client(s) (`src/lsp/client.ts`) → Language Servers (spawned by `src/lsp/servers.ts`).

- CLI: Parses commands. For normal commands, ensures the daemon is running and forwards requests. Handles `help`, `version`, and `claude-code-hook` directly.
- Daemon: Per-directory process bound to a socket in `os.tmpdir()` (name derived from a base36 hash of `cwd`). Routes commands to the LSP manager and returns JSON responses.
- LSP Manager: Caches LSP clients keyed by `serverID:root`, aggregates diagnostics, and resolves hover queries. Avoids retrying server/root combos known to be broken.
- LSP Client: JSON-RPC connection over stdio to each language server. Implements file lifecycle (open/change/close), diagnostics (pull/push), hover, document symbols, definitions, and type definitions.
- Servers: Built-in table of language servers (TS, Python, JSON, CSS, YAML, Bash, GraphQL, R, C#, Go, Java, Lua). Some auto-install via `bunx`; some require manual install.
- Formatter: Deterministic, readable output for diagnostics and hover, including simple markdown rendering.
- Config: Optional `~/.config/cli-lsp-client/settings.json` to add/override servers and language ID mappings.

## Core Features

- Diagnostics across languages with consistent formatting and exit code semantics.
- Hover info for a given file and symbol with markdown-to-terminal rendering.
- Daemon lifecycle and multi-project isolation (one daemon per working directory).
- Auto-detection and warmup of servers via `start`.
- Admin commands to observe and control daemons and server state.

## Execution Flow: Diagnostics

Command: `cli-lsp-client diagnostics <file>`

1. CLI routes to `runCommand()` (src/cli.ts) and calls `ensureDaemonRunning()` (src/utils.ts). If needed, it spawns the daemon by re-executing itself with `LSPCLI_DAEMON_MODE=1`.
2. Client sends `{command:'diagnostics', args:[file]}` to the daemon over the directory-specific UNIX socket (src/client.ts).
3. Daemon handles the request (src/daemon.ts → `handleRequest('diagnostics')`) and calls `lspManager.getDiagnostics(file)`.
4. LSP Manager (src/lsp/manager.ts):
   - Validates the file exists; finds applicable servers by extension (src/lsp/servers.ts → `getApplicableServers`).
   - For each server: locates the project root via root patterns; creates or reuses an LSP client (spawn via `spawnServer()` and connect via `createLSPClient()`).
   - Opens the file and always sends a full-text `didChange` after `didOpen` to force fresh diagnostics (important for servers like Pyright).
   - Prefers pull diagnostics (`textDocument/diagnostic`) if supported; otherwise waits for push (`publishDiagnostics`) with a timeout, then reads cached diagnostics.
   - Closes the file to clear caches for the next request and aggregates diagnostics across servers.
5. Client formats diagnostics (src/lsp/formatter.ts) and exits with code 2 if any diagnostics are present (0 otherwise).

## Execution Flow: Hover

Command: `cli-lsp-client hover <file> <symbol>`

1. CLI ensures daemon and forwards request (src/cli.ts, src/client.ts).
2. Daemon routes to `lspManager.getHover(symbol, file)` (src/daemon.ts).
3. LSP Manager (src/lsp/manager.ts):
   - Resolves the file and finds applicable servers.
   - Spawns/reuses the client and opens the file.
   - Reads file text to find all textual occurrences of the symbol, requests `textDocument/documentSymbol`, and correlates occurrences with symbol ranges (`findSymbolAtPosition`).
   - For non-function kinds, may follow `typeDefinition` to a canonical location; otherwise uses the original location.
   - Requests `textDocument/hover` at the chosen location, returning the first useful result with `{file, line, column}`.
4. Client formats hover result with simple markdown styling for code blocks, inline code, bold/italic (src/lsp/formatter.ts).

## Daemon & Multi-Project Management

- Socket/PID/Log files are stored in `os.tmpdir()` with names derived from a base36 hash of `cwd` (src/utils.ts → `hashPath`, src/daemon.ts, src/logger.ts).
- `status`: Pretty-prints daemon PID, uptime, and running servers with durations.
- `list`: Scans tmp for all `cli-lsp-client-*.sock`/`*.pid` pairs to show daemons across directories.
- `stop`: Stops the current daemon.
- `stop-all`: Attempts graceful stop via each socket; falls back to PID kill; cleans up stale files (src/client.ts).

## Claude Code Integration

- Command: `cli-lsp-client claude-code-hook`
- Reads hook JSON from stdin (zod-validated), extracts `tool_input.file_path`, filters by supported extensions, ensures daemon, and runs diagnostics.
- Exits quietly with code 0 when no issues or unsupported input, code 2 on issues, and code 1 when the daemon fails to start (so the UI can surface a helpful message).

## Why It Feels Fast

- Daemon per project keeps servers warm and reuses connections.
- `start` warms servers ahead of first diagnostics.
- Pull diagnostics used when available for deterministic responses.
- Forced `didChange` after `didOpen` avoids stale caches on servers like Pyright.

## Server Availability & Auto-Install

- Built-in server table: TypeScript/JavaScript, Python, JSON, CSS, YAML (bunx, auto-installable); Bash, GraphQL (bunx); Go, Java, Lua, R, C# (manual installs).
- JSON/CSS use `vscode-langservers-extracted` which is auto-installed via `bun add -g` when missing (src/lsp/servers.ts).

## Configuration

- Optional config at `~/.config/cli-lsp-client/settings.json` (src/lsp/config.ts) with zod validation.
- Add or override servers: `id`, `extensions`, `rootPatterns`, `command`, optional `env`, `initialization`.
- Extend language ID mappings for `didOpen` via `languageExtensions`.
- Config is merged at daemon startup (`initializeServers`), replacing built-ins when IDs clash.

## Key Files

- CLI & Client: `src/cli.ts`, `src/client.ts`
- Daemon & Utils: `src/daemon.ts`, `src/utils.ts`, `src/logger.ts`, `src/constants.ts`
- LSP Orchestration: `src/lsp/manager.ts`, `src/lsp/client.ts`, `src/lsp/servers.ts`, `src/lsp/language.ts`, `src/lsp/formatter.ts`, `src/lsp/config.ts`, `src/lsp/start.ts`

## Troubleshooting & Logs

- Logs: A per-directory log file in `os.tmpdir()` (name derived from hashed `cwd`), written via `src/logger.ts`.
- For cold starts, prefer running `start` in the project root, then `diagnostics`.
- If servers were upgraded or misbehaving, try `stop-all` to terminate stale daemons and let fresh ones spawn.
