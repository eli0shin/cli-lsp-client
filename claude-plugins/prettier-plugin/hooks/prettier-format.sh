#!/bin/bash

# Prettier hook for Claude Code (Plugin Mode)
# Formats files with prettier after edits and outputs JSON format

# Source utilities
source "$(dirname "$0")/../../shared/hooks/utils.sh"

# Helper function to output JSON and exit
output_json() {
    echo "$1"
    exit 0
}

# Read input from stdin
INPUT=$(cat)

# Parse input and extract fields
if ! parse_hook_input "$INPUT"; then
    output_json '{}'
fi

# Check if project has local prettier hook override
if has_project_hook_override "$PROJECT_DIR" "prettier"; then
    output_json '{}'
fi

# Check if project has prettier configured
if ! has_prettier_config "$PROJECT_DIR"; then
    output_json '{}'
fi

# Get the appropriate package runner
PKG_RUNNER=$(get_package_runner)

# Run prettier on the file (always succeed regardless of outcome)
cd "$PROJECT_DIR" && $PKG_RUNNER prettier --write "$FILE_PATH" >/dev/null 2>&1

# Always return empty JSON with success status
output_json '{}'
