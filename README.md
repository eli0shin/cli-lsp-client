# lspcli

CLI tool for getting LSP diagnostics. Uses a background daemon to keep LSP servers running.

## Features

- Get diagnostics from LSP servers
- Background daemon for fast repeated requests
- Built in Claude Code hook to provide feedback on file edit tool calls

## Supported Languages

| Language | LSP Server | Auto-installed | Notes |
|----------|------------|----------------|-------|
| TypeScript/JavaScript | `typescript-language-server` | ✓ (via bunx) | `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts` |
| Python | `pyright-langserver` | ✓ (via bunx) | `.py`, `.pyi` |
| JSON | `vscode-json-language-server` | ✓ (via vscode-langservers-extracted) | `.json`, `.jsonc` - includes schema validation |
| CSS | `vscode-css-language-server` | ✓ (via vscode-langservers-extracted) | `.css`, `.scss`, `.sass`, `.less` |
| YAML | `yaml-language-server` | ✓ (via bunx) | `.yaml`, `.yml` - includes schema validation |
| Bash/Shell | `bash-language-server` | ✓ (via bunx) | `.sh`, `.bash`, `.zsh` - **requires shellcheck** (`brew install shellcheck`) |
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

Get instant diagnostic feedback for TypeScript, Python, Go, JSON, CSS, YAML, Bash, Java, and Lua files as you edit in Claude Code.

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
- Built-in file filtering for all supported languages (11 file types)
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
