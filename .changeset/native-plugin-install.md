---
'cli-lsp-client': minor
---

LSP plugin hooks now install the native binary from GitHub Releases on macOS and Linux instead of using bunx/npx, with automatic fallback to bunx/npx on Windows or if the download fails
