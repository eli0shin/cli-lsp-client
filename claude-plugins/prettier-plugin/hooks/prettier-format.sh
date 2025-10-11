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

# Run prettier on the file
PRETTIER_OUTPUT=$(cd "$PROJECT_DIR" && $PKG_RUNNER prettier --write "$FILE_PATH" 2>&1)
PRETTIER_EXIT_CODE=$?

if [[ $PRETTIER_EXIT_CODE -eq 0 ]]; then
    # Success
    output_json '{}'
else
    # Check if it's just an unsupported file type (no parser)
    if echo "$PRETTIER_OUTPUT" | grep -q "No parser could be inferred"; then
        # Silently skip unsupported file types
        output_json '{}'
    else
        # Technical issues (missing deps, config problems, syntax errors) - don't block but provide feedback
        # Syntax errors will be caught by eslint/LSP, so this is just informational
        ERROR_MSG="Prettier encountered an issue with $FILE_PATH (exit code $PRETTIER_EXIT_CODE): $PRETTIER_OUTPUT"
        ESCAPED_MSG=$(echo "$ERROR_MSG" | jq -Rs .)
        output_json "{\"hookSpecificOutput\": {\"hookEventName\": \"PostToolUse\", \"additionalContext\": $ESCAPED_MSG}}"
    fi
fi
