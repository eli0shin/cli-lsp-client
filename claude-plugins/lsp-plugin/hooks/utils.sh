#!/bin/bash


NATIVE_BINARY="$HOME/.local/bin/cli-lsp-client"
REPO="eli0shin/cli-lsp-client"

# Install native binary on macOS/Linux if not already present.
# Returns 0 on success, 1 on failure (caller should fall back to bunx/npx).
ensure_native_binary() {
    local os
    os="$(uname -s | tr '[:upper:]' '[:lower:]')"
    case "$os" in
        darwin|linux) ;;
        *) return 1 ;;
    esac

    # Already installed
    if [ -x "$NATIVE_BINARY" ]; then
        return 0
    fi

    local arch
    arch="$(uname -m)"
    case "$arch" in
        x86_64) arch="x64" ;;
        aarch64|arm64) arch="arm64" ;;
        *) return 1 ;;
    esac

    local url="https://github.com/${REPO}/releases/latest/download/cli-lsp-client-${os}-${arch}"

    mkdir -p "$(dirname "$NATIVE_BINARY")" || return 1
    curl -fsSL "$url" -o "$NATIVE_BINARY" || return 1
    chmod +x "$NATIVE_BINARY" || return 1
    return 0
}

# Returns the command to invoke cli-lsp-client.
# On macOS/Linux with native binary: full path to the binary.
# On Windows or if native binary is missing: "bunx cli-lsp-client" or "npx cli-lsp-client".
get_cli_command() {
    if [ -x "$NATIVE_BINARY" ]; then
        echo "$NATIVE_BINARY"
    elif command -v bun >/dev/null 2>&1; then
        echo "bunx cli-lsp-client"
    else
        echo "npx cli-lsp-client"
    fi
}
