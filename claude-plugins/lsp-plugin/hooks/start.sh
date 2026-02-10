#!/bin/bash

# LSP Client hook for Claude Code SessionStart events

# Source shared utilities
source "$(dirname "$0")/utils.sh"

# Install native binary if possible (no-op if already present)
ensure_native_binary

# Start the LSP client
exec $(get_cli_command) start
