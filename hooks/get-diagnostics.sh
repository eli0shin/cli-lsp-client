#!/bin/bash

# Read input from stdin
INPUT=$(cat)

# Extract file_path from JSON input
FILE_PATH=$(echo "$INPUT" | jq -r ".tool_input.file_path // empty" 2>/dev/null)

# Skip if no file path or not a TypeScript file
if [[ -z "$FILE_PATH" ]]; then
    exit 0
fi

# Run diagnostics on the file (use wrapper script in dev)
CLI_PATH="${CLI_LSP_CLIENT_BIN_PATH:-./bin/cli-lsp-client}"
output=$("$CLI_PATH" diagnostics "$FILE_PATH" 2>&1)
exit_code=$?

# Only block on actual errors, not hints/warnings
if [[ $exit_code -ne 0 && "$output" =~ ERROR ]]; then
    # Strip ANSI color codes but preserve newlines
    clean_output=${output//$'\x1b['[0-9;]*m/}
    echo "$clean_output" >&2
    exit 2
fi

exit 0
