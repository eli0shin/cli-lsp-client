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

Simply configure Claude Code to use the built-in hook command:

```bash
# Add to your Claude Code settings (⌘+,)
cat >> ~/.claude/settings.json << 'EOF'
{
  "hooks": {
    "postEdit": "./lspcli claude-code-hook"
  }
}
EOF
```

That's it! No shell scripts needed.

#### How It Works

- Automatically runs diagnostics after each file edit
- Built-in file filtering for TypeScript, JavaScript, and Python files
- Shows errors, warnings, and hints inline
- Graceful error handling - never breaks your editing experience
- Uses the same fast daemon as the regular diagnostics command

#### Example Output

When you save a file with errors, you'll see immediate feedback:

```
Edit operation feedback:
- [./lspcli claude-code-hook]: 
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