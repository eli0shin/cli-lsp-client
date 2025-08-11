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

## Claude Code Integration

### Real-time Diagnostics Hook

Get instant TypeScript/Python error feedback as you edit files in Claude Code.

#### Setup

1. Create the hooks directory and script:

```bash
mkdir -p hooks
cat > hooks/get-diagnostics.sh << 'EOF'
#!/bin/bash

# Get the file path from the first argument
FILE_PATH="$1"

# Skip non-code files
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.py)
    # Run diagnostics
    ./lspcli diagnostics "$FILE_PATH" 2>/dev/null
    ;;
esac
EOF

chmod +x hooks/get-diagnostics.sh
```

2. Configure Claude Code settings:

```bash
# Add to your Claude Code settings (⌘+,)
cat >> ~/.claude/settings.json << 'EOF'
{
  "hooks": {
    "postEdit": "bash hooks/get-diagnostics.sh"
  }
}
EOF
```

#### How It Works

- Automatically runs diagnostics after each file edit
- Shows errors, warnings, and hints inline
- Supports TypeScript, JavaScript, and Python files
- Non-blocking - doesn't slow down your editing

#### Example Output

When you save a file with errors, you'll see immediate feedback:

```
Edit operation feedback:
- [bash hooks/get-diagnostics.sh]: 
ERROR at line 3, column 9:
  Type 'number' is not assignable to type 'string'.
  Source: typescript
  Code: 2322
```

## Examples

```bash
# Check all TypeScript files
find src -name "*.ts" -exec ./lspcli diagnostics {} \;

# Check a specific file
./lspcli diagnostics src/main.ts
```

## Development

```bash
bun run dev      # Run in development
bun run build    # Build executable
bun run typecheck
```

Add custom LSP servers in `src/lsp/servers.ts`.