# lspcli

CLI tool for getting LSP diagnostics. Uses a background daemon to keep LSP servers running.

## Features

- Get diagnostics from LSP servers
- Background daemon for fast repeated requests
- Built in Claude Code hook to provide feedback on file edit tool calls

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

Configure Claude Code to use the built-in hook command:

```bash
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx -y lspcli claude-code-hook"
          }
        ]
      }
    ]
  }
}
```

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
- [npx -y lspcli claude-code-hook]: 
ERROR at line 3, column 9:
  Type 'number' is not assignable to type 'string'.
  Source: typescript
  Code: 2322
```

## Usage

### Get Diagnostics

```bash
# Check a TypeScript file
npx lspcli diagnostics src/example.ts

# Check any supported file type
npx lspcli diagnostics app.py
npx lspcli diagnostics main.go
```

Exit codes: 0 for no issues, 2 for issues found.

```bash
$ npx lspcli diagnostics error.ts
ERROR at line 5, column 20:
  Argument of type 'string' is not assignable to parameter of type 'number'.
  Source: typescript
  Code: 2345
```

### Other Commands

```bash
# Check daemon status
npx lspcli status

# Stop daemon (it will auto-restart when needed)
npx lspcli stop
```


## Examples

```bash
# Check a specific file
npx lspcli diagnostics src/main.ts
```

## Development

### Installation

```bash
# Install dependencies and build
bun install
bun run build    # Build executable
bun run typecheck
bun test
```

Add new LSP servers in `src/lsp/servers.ts`.
