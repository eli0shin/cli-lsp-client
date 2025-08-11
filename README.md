# lspcli

CLI tool for getting LSP diagnostics. Uses a background daemon to keep LSP servers running.

## Features

- Get diagnostics from LSP servers
- Background daemon for fast repeated requests
- Automatic daemon management

## Installation

```bash
# Install dependencies and build
bun install
bun run build
```

The built executable `./lspcli` is ready to use.

## Usage

### Get Diagnostics

```bash
# Check a TypeScript file
./lspcli diagnostics src/example.ts

# Check any supported file type
./lspcli diagnostics app.py
./lspcli diagnostics main.go
```

Exit codes: 0 for no issues, 2 for issues found.

```bash
$ ./lspcli diagnostics error.ts
ERROR at line 5, column 20:
  Argument of type 'string' is not assignable to parameter of type 'number'.
  Source: typescript
  Code: 2345
```

### Other Commands

```bash
# Check daemon status
./lspcli status

# Stop daemon (it will auto-restart when needed)
./lspcli stop
```

## Supported Languages

| Language | LSP Server | Auto-installed |
|----------|------------|----------------|
| TypeScript/JavaScript | `typescript-language-server` | ✓ (via bunx) |
| Python | `pyright-langserver` | ✓ (via bunx) |

## How It Works

- Daemon starts automatically when needed
- LSP servers spawn based on file type  
- Finds project roots using config files (tsconfig.json, etc.)
- Servers stay running for subsequent requests

## Examples

```bash
# Check all TypeScript files
find src -name "*.ts" -exec ./lspcli diagnostics {} \;

# Pre-commit hook
./lspcli diagnostics "$CURRENT_FILE"
```

## Development

```bash
bun run dev      # Run in development
bun run build    # Build executable
bun run typecheck
```

Add custom LSP servers in `src/lsp/servers.ts`.