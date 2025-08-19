# cli-lsp-client

CLI tool for getting LSP diagnostics. Uses a background daemon to keep LSP servers running.

## Features

- Get diagnostics from LSP servers
- Get hover information for symbols (functions, variables, types)
- Background daemon for fast repeated requests
- Built in Claude Code hook to provide feedback on file edit tool calls
- Comprehensive daemon management (`list`, `stop-all` commands)
- Multi-project support with isolated daemon instances per directory
- [Custom language server support via config files](#custom-language-servers-config-file)

## Supported Languages

| Language              | LSP Server                     | Auto-installed                       | Notes                                                                                                                                        |
| --------------------- | ------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript/JavaScript | `typescript-language-server`   | ✓ (via bunx)                         | `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`                                                                                 |
| Python                | `pyright-langserver`           | ✓ (via bunx)                         | `.py`, `.pyi`                                                                                                                                |
| JSON                  | `vscode-json-language-server`  | ✓ (via vscode-langservers-extracted) | `.json`, `.jsonc` - includes schema validation                                                                                               |
| CSS                   | `vscode-css-language-server`   | ✓ (via vscode-langservers-extracted) | `.css`, `.scss`, `.sass`, `.less`                                                                                                            |
| YAML                  | `yaml-language-server`         | ✓ (via bunx)                         | `.yaml`, `.yml` - includes schema validation                                                                                                 |
| Bash/Shell            | `bash-language-server`         | ✓ (via bunx)                         | `.sh`, `.bash`, `.zsh` - **requires shellcheck** (`brew install shellcheck`)                                                                 |
| GraphQL               | `graphql-language-service-cli` | ✓ (via bunx)                         | `.graphql`, `.gql`                                                                                                                           |
| **R**                 | **R languageserver**           | **✗**                                | **`.r`, `.R`, `.rmd`, `.Rmd` - see [R Installation](#r-installation-guide) below**                                                           |
| **C#**                | **OmniSharp-Roslyn**           | **✗**                                | **`.cs` - see [C# Installation](#c-installation-guide) below**                                                                               |
| **Swift**             | **SourceKit-LSP**              | **✗**                                | **`.swift` - see [Swift Configuration](#swift-configuration) below**                                                                         |
| Go                    | `gopls`                        | ✗                                    | Requires manual install: `go install golang.org/x/tools/gopls@latest`                                                                        |
| Java                  | `jdtls` (Eclipse JDT)          | ✗                                    | `.java` - see [Java Installation](#java-installation-guide) below                                                                            |
| Lua                   | `lua-language-server`          | ✗                                    | `.lua` - requires manual install via package manager (brew, scoop) or from [releases](https://github.com/LuaLS/lua-language-server/releases) |

## How It Works

- Daemon starts automatically when needed
- LSP servers spawn based on file type
- Finds project roots using config files (tsconfig.json, etc.)
- Servers stay running for subsequent requests

## Claude Code Integration

### Real-time Diagnostics Hook

Get instant diagnostic feedback for TypeScript, Python, JSON, CSS, YAML, Bash, GraphQL, R, C#, Swift, Go, Java, and Lua files as you edit in Claude Code.

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
- Built-in file filtering for all supported languages (16 file types)
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

## Custom Language Servers (Config File)

You can extend the built-in language servers by creating a custom configuration file. This allows you to add support for any LSP server not included by default.

### Configuration File

Create a config file at `~/.config/cli-lsp-client/settings.json` (default location) or use `--config-file` to specify a custom path:

```json
{
  "servers": [
    {
      "id": "svelte",
      "extensions": [".svelte"],
      "rootPatterns": ["svelte.config.js", "package.json"],
      "command": ["bunx", "svelte-language-server", "--stdio"],
      "env": {
        "NODE_ENV": "development"
      },
      "initialization": {
        "settings": {
          "svelte": {
            "compilerWarnings": true
          }
        }
      }
    }
  ],
  "languageExtensions": {
    ".svelte": "svelte"
  }
}
```

### Using Custom Config

**Default config file location:**

```bash
# Uses ~/.config/cli-lsp-client/settings.json automatically
npx cli-lsp-client diagnostics Component.svelte
```

**Custom config file location:**

```bash
# Specify custom config file path
npx cli-lsp-client --config-file ./my-config.json diagnostics Component.svelte
npx cli-lsp-client --config-file ./my-config.json hover Component.svelte myFunction
npx cli-lsp-client --config-file ./my-config.json status
```

**Important:** When using `--config-file`, you must include it on every command. The CLI automatically restarts the daemon when switching between different config files to ensure the correct language servers are loaded.

### Config File Schema

- `servers`: Array of custom language server definitions
  - `id`: Unique identifier for the server
  - `extensions`: File extensions this server handles (e.g. `[".svelte"]`)
  - `rootPatterns`: Files/patterns used to detect project root (e.g. `["package.json"]`)
  - `command`: Command array to start the LSP server (e.g. `["bunx", "svelte-language-server", "--stdio"]`)
  - `env`: Optional environment variables for the server process
  - `initialization`: Optional LSP initialization parameters

- `languageExtensions`: Maps file extensions to LSP language identifiers

## Usage

### Get Diagnostics

```bash
# Check a TypeScript file
npx cli-lsp-client diagnostics src/example.ts

# Check any supported file type
npx cli-lsp-client diagnostics app.py
npx cli-lsp-client diagnostics main.go
npx cli-lsp-client diagnostics analysis.R
npx cli-lsp-client diagnostics Program.cs

# Check Swift files (requires config file)
npx cli-lsp-client diagnostics Sources/App/main.swift
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
npx cli-lsp-client hover analysis.R mean
npx cli-lsp-client hover Program.cs Console

# Get hover info for Swift symbols (requires config file)
npx cli-lsp-client hover Sources/App/main.swift greetUser
```

````bash
$ npx cli-lsp-client hover src/client.ts runCommand
Location: src/client.ts:370:17
```typescript
export function runCommand(command: string, commandArgs: string[]): Promise<void>
````

````

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
````

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

## R Installation Guide

The R language server requires R runtime and the `languageserver` package:

### Installation Steps

1. **Install R**: Download and install R from [CRAN](https://cran.r-project.org/) or use a package manager:

   **macOS (Homebrew)**:

   ```bash
   brew install r
   ```

   **Ubuntu/Debian**:

   ```bash
   sudo apt-get update
   sudo apt-get install r-base
   ```

   **Windows**: Download installer from [CRAN Windows](https://cran.r-project.org/bin/windows/base/)

2. **Install R languageserver package**: Open R and run:

   ```r
   install.packages("languageserver")
   ```

   Or from command line:

   ```bash
   R --slave -e 'install.packages("languageserver", repos="https://cran.rstudio.com/")'
   ```

### Verification

Test that the language server works:

```bash
R --slave -e 'languageserver::run()'
```

### Project Detection

The R LSP automatically detects R projects based on these files:

- `DESCRIPTION` (R packages)
- `NAMESPACE` (R packages)
- `.Rproj` (RStudio projects)
- `renv.lock` (renv dependency management)
- Any `.r`, `.R`, `.rmd`, `.Rmd` files

For more information, see the [R languageserver documentation](https://github.com/REditorSupport/languageserver).

## C# Installation Guide

The C# language server requires .NET SDK and OmniSharp-Roslyn:

### Installation Steps

1. **Install .NET SDK**: Download .NET 6.0+ from [Microsoft .NET](https://dotnet.microsoft.com/download) or use a package manager:

   **macOS (Homebrew)**:

   ```bash
   brew install dotnet
   ```

   **Ubuntu/Debian**:

   ```bash
   # Add Microsoft package repository
   wget https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
   sudo dpkg -i packages-microsoft-prod.deb
   sudo apt-get update
   sudo apt-get install -y dotnet-sdk-8.0
   ```

   **Windows**: Download installer from [.NET Downloads](https://dotnet.microsoft.com/download)

2. **Install OmniSharp-Roslyn**: Download the latest release from [OmniSharp releases](https://github.com/OmniSharp/omnisharp-roslyn/releases):

   **Automatic script** (recommended):

   ```bash
   # Download and extract OmniSharp to ~/.omnisharp/
   mkdir -p ~/.omnisharp
   curl -L https://github.com/OmniSharp/omnisharp-roslyn/releases/latest/download/omnisharp-osx-arm64-net6.0.tar.gz | tar -xz -C ~/.omnisharp/

   # Create symlink to make omnisharp available in PATH
   sudo ln -sf ~/.omnisharp/OmniSharp /usr/local/bin/omnisharp
   ```

   **Manual installation**:
   - Download the appropriate release for your platform (Windows: `omnisharp-win-x64-net6.0.zip`, Linux: `omnisharp-linux-x64-net6.0.tar.gz`)
   - Extract to a directory (e.g., `~/.omnisharp/`)
   - Add the executable to your PATH or create a symlink

3. **Set environment variables**:

   **Fish shell**:

   ```bash
   set -Ux DOTNET_ROOT ~/.dotnet
   ```

   **Bash/Zsh**:

   ```bash
   echo 'export DOTNET_ROOT=~/.dotnet' >> ~/.bashrc  # or ~/.zshrc
   source ~/.bashrc  # or ~/.zshrc
   ```

   **Note**: `DOTNET_ROOT` must be set in your shell environment for the C# language server to work. The CLI will only load OmniSharp if this environment variable is defined. Restart your terminal after setting the environment variable to ensure it's available.

### Verification

Test that OmniSharp works:

```bash
# Verify DOTNET_ROOT is set
echo $DOTNET_ROOT

# Test OmniSharp command
omnisharp --help
```

### Project Detection

The C# LSP automatically detects C# projects based on these files:

- `*.sln` (Solution files)
- `*.csproj` (Project files)
- `project.json` (Legacy project files)
- `global.json` (.NET global configuration)
- Any `.cs` files

For more information, see the [OmniSharp documentation](https://github.com/OmniSharp/omnisharp-roslyn).

## Swift Configuration

Swift language support is available through SourceKit-LSP, which is included with Xcode Command Line Tools. Support for swift and other LSPs can be added via a config file.

### Prerequisites

**macOS (with Xcode Command Line Tools)**:

```bash
# Check if SourceKit-LSP is available
xcrun --find sourcekit-lsp
```

**Alternative toolchains**: If using Swift toolchains from swift.org, SourceKit-LSP is included and can be run with:

```bash
xcrun --toolchain swift sourcekit-lsp
```

### Configuration

Create a config file at `~/.config/cli-lsp-client/settings.json`:

```json
{
  "servers": [
    {
      "id": "sourcekit_lsp",
      "extensions": [".swift"],
      "rootPatterns": ["Package.swift", ".xcodeproj", ".xcworkspace"],
      "command": ["xcrun", "sourcekit-lsp"],
      "env": {}
    }
  ],
  "languageExtensions": {
    ".swift": "swift"
  }
}
```

For more information about SourceKit-LSP, see the [official documentation](https://github.com/swiftlang/sourcekit-lsp).

### Additional Commands

```bash
# Start LSP servers for current directory (faster subsequent requests)
npx cli-lsp-client start

# Start servers for specific directory
npx cli-lsp-client start /path/to/project

# View daemon log file path
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
