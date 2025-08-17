# cli-lsp-client

CLI tool for getting LSP diagnostics. Uses a background daemon to keep LSP servers running.

## Features

- Get diagnostics from LSP servers
- Get hover information for symbols (functions, variables, types)
- Background daemon for fast repeated requests
- Built in Claude Code hook to provide feedback on file edit tool calls
- Comprehensive daemon management (`list`, `stop-all` commands)
- Multi-project support with isolated daemon instances per directory

## Supported Languages

| Language | LSP Server | Auto-installed | Notes |
|----------|------------|----------------|-------|
| TypeScript/JavaScript | `typescript-language-server` | ✓ (via bunx) | `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts` |
| Python | `pyright-langserver` | ✓ (via bunx) | `.py`, `.pyi` |
| JSON | `vscode-json-language-server` | ✓ (via vscode-langservers-extracted) | `.json`, `.jsonc` - includes schema validation |
| CSS | `vscode-css-language-server` | ✓ (via vscode-langservers-extracted) | `.css`, `.scss`, `.sass`, `.less` |
| YAML | `yaml-language-server` | ✓ (via bunx) | `.yaml`, `.yml` - includes schema validation |
| Bash/Shell | `bash-language-server` | ✓ (via bunx) | `.sh`, `.bash`, `.zsh` - **requires shellcheck** (`brew install shellcheck`) |
| GraphQL | `graphql-language-service-cli` | ✓ (via bunx) | `.graphql`, `.gql` |
| Go | `gopls` | ✗ | Requires manual install: `go install golang.org/x/tools/gopls@latest` |
| Java | `jdtls` (Eclipse JDT) | ✗ | `.java` - see [Java Installation](#java-installation-guide) below |
| Lua | `lua-language-server` | ✗ | `.lua` - requires manual install via package manager (brew, scoop) or from [releases](https://github.com/LuaLS/lua-language-server/releases) |


## How It Works

- Daemon starts automatically when needed
- LSP servers spawn based on file type  
- Finds project roots using config files (tsconfig.json, etc.)
- Servers stay running for subsequent requests

## Claude Code Integration

### Real-time Diagnostics Hook

Get instant diagnostic feedback for TypeScript, Python, JSON, CSS, YAML, Bash, GraphQL, Go, Java, and Lua files as you edit in Claude Code.

#### Setup

Configure Claude Code to use the built-in hook command:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "npx -y cli-lsp-client start"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx -y cli-lsp-client claude-code-hook"
          }
        ]
      }
    ]
  }
}
```

#### How It Works

- **SessionStart**: Automatically starts LSP servers when Claude Code starts for faster initial diagnostics
- **PostToolUse**: Runs diagnostics after each file edit (Edit, MultiEdit, Write tools)
- Built-in file filtering for all supported languages (14 file types)
- Shows errors, warnings, and hints inline
- Graceful error handling - never breaks your editing experience
- Uses the same fast daemon as the regular diagnostics command

#### Example Output

When you save a file with errors, you'll see immediate feedback:

```
Edit operation feedback:
- [npx -y cli-lsp-client claude-code-hook]: 
ERROR at line 3, column 9:
  Type 'number' is not assignable to type 'string'.
  Source: typescript
  Code: 2322
```

## Usage

### Get Diagnostics

```bash
# Check a TypeScript file
npx cli-lsp-client diagnostics src/example.ts

# Check any supported file type
npx cli-lsp-client diagnostics app.py
npx cli-lsp-client diagnostics main.go
```

Exit codes: 0 for no issues, 2 for issues found.

```bash
$ npx cli-lsp-client diagnostics error.ts
ERROR at line 5, column 20:
  Argument of type 'string' is not assignable to parameter of type 'number'.
  Source: typescript
  Code: 2345
```

### Get Hover Information

```bash
# Get hover info for a function
npx cli-lsp-client hover src/main.ts myFunction

# Get hover info for a variable or type
npx cli-lsp-client hover app.py MyClass
```

```bash
$ npx cli-lsp-client hover src/client.ts runCommand
Location: src/client.ts:370:17
```typescript
export function runCommand(command: string, commandArgs: string[]): Promise<void>
```
```

### Daemon Management

```bash
# Check daemon status with uptime and running language servers
npx cli-lsp-client status

# List all running daemons across directories
npx cli-lsp-client list

# Stop current directory's daemon
npx cli-lsp-client stop

# Stop all daemons across all directories (useful after package updates)
npx cli-lsp-client stop-all

# Show version
npx cli-lsp-client --version

# Show help
npx cli-lsp-client help
```

The `status` command shows the current daemon's uptime and running language servers:

```bash
$ npx cli-lsp-client status
LSP Daemon Status
================
PID: 33502
Uptime: 1m 38s

Language Servers:
- typescript (.) - running 1m 33s
- pyright (.) - running 1m 10s

Total: 2 language servers running
```

The `list` command shows all running daemon instances with their working directories, PIDs, and status:

```bash
$ npx cli-lsp-client list

Running Daemons:
================
Hash   | PID   | Status    | Working Directory             
----------------------------------------------------------
h0gx9u | 12345 | ● Running | /Users/user/project-a
94yi9w | 12346 | ● Running | /Users/user/project-b

2/2 daemon(s) running
```

Use `stop-all` when updating the CLI package to ensure all old daemon processes are terminated and fresh ones spawn with the updated code.

## Java Installation Guide

Eclipse JDT Language Server requires Java 17+ and manual setup:

### Installation Steps

1. **Download**: Get the latest server from [Eclipse JDT.LS downloads](http://download.eclipse.org/jdtls/snapshots/)
2. **Extract**: Unpack to your preferred location (e.g., `/opt/jdtls/`)
3. **Create wrapper script** named `jdtls` in your PATH:

```bash
#!/bin/bash
java -Declipse.application=org.eclipse.jdt.ls.core.id1 \
     -Dosgi.bundles.defaultStartLevel=4 \
     -Declipse.product=org.eclipse.jdt.ls.core.product \
     -Xms1g -Xmx2G \
     -jar /opt/jdtls/plugins/org.eclipse.equinox.launcher_*.jar \
     -configuration /opt/jdtls/config_linux \
     -data "${1:-$HOME/workspace}" \
     --add-modules=ALL-SYSTEM \
     --add-opens java.base/java.util=ALL-UNNAMED \
     --add-opens java.base/java.lang=ALL-UNNAMED "$@"
```

4. **Make executable**: `chmod +x /usr/local/bin/jdtls`

### Alternative Installation Methods

**Homebrew (macOS/Linux)**:
```bash
brew install jdtls
```

**Arch Linux**:
```bash
pacman -S jdtls
```

### Configuration Notes

- Replace `config_linux` with `config_mac` on macOS or `config_win` on Windows
- Adjust the `-data` workspace path as needed
- Requires Java 17 or higher to run

For detailed setup instructions, see the [official Eclipse JDT.LS documentation](https://github.com/eclipse-jdtls/eclipse.jdt.ls).

### Additional Commands

```bash
# Start LSP servers for current directory (faster subsequent requests)
npx cli-lsp-client start

# Start servers for specific directory
npx cli-lsp-client start /path/to/project

# View daemon logs
npx cli-lsp-client logs
```

## Examples

```bash
# Check a specific file
npx cli-lsp-client diagnostics src/main.ts

# Get hover info for a symbol
npx cli-lsp-client hover src/main.ts myFunction

# List all daemon instances
npx cli-lsp-client list

# Stop all daemons after package update
npx cli-lsp-client stop-all
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
