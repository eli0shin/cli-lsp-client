#!/bin/bash

# LSP Client hook for Claude Code PreToolUse/PostToolUse events

# Source shared utilities
source "$(dirname "$0")/utils.sh"

# Run cli-lsp-client claude-code-hook with stdin
exec $(get_cli_command) claude-code-hook
