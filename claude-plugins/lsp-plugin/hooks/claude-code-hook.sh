#!/bin/bash

# LSP Client hook for Claude Code PostToolUse events

# Source shared utilities
source "$(dirname "$0")/../../shared/hooks/utils.sh"

# Get the appropriate package runner
PKG_RUNNER=$(get_package_runner)

# Run cli-lsp-client claude-code-hook with stdin
exec $PKG_RUNNER cli-lsp-client claude-code-hook
