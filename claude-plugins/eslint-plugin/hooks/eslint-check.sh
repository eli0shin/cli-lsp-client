#!/bin/bash

# ESLint hook for Claude Code (Plugin Mode)
# Checks files with ESLint after edits and outputs JSON format

# Source utilities
source "$(dirname "$0")/utils.sh"

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

# Check if project has local eslint hook override
if has_project_hook_override "$PROJECT_DIR" "eslint"; then
    output_json '{}'
fi

# Check if project has eslint configured
if ! has_eslint_config "$PROJECT_DIR"; then
    output_json '{}'
fi

# Get the appropriate package runner
PKG_RUNNER=$(get_package_runner)

# Run ESLint on the file and capture output
ESLINT_OUTPUT=$(cd "$PROJECT_DIR" && $PKG_RUNNER eslint "$FILE_PATH" 2>&1)
ESLINT_EXIT_CODE=$?

# Filter out "File ignored" errors from ESLint output
if echo "$ESLINT_OUTPUT" | grep -q "File ignored"; then
    output_json '{}'
fi

# Filter out "couldn't find an eslint" errors (no config file found)
if echo "$ESLINT_OUTPUT" | grep -iq "couldn't find an eslint"; then
    output_json '{}'
fi

if [[ $ESLINT_EXIT_CODE -eq 0 ]]; then
    # Success - no errors found
    output_json '{}'
elif [[ $ESLINT_EXIT_CODE -eq 1 ]]; then
    # ESLint exit code 1 means linting issues were found.
    # However, configuration/parsing failures (e.g. unsupported file types like .md)
    # also produce exit code 1 with errors at line 0:0 — these are NOT actionable code issues.
    # Real rule violations appear at actual line numbers (>0) in the file.
    REAL_CODE_ERRORS=$(echo "$ESLINT_OUTPUT" | grep -E "[1-9][0-9]*:[0-9]+[[:space:]]+(error|warning)" || true)

    if [[ -z "$REAL_CODE_ERRORS" ]]; then
        # Only configuration/setup errors (at line 0) - silently ignore as ESLint isn't configured for this file type
        output_json '{}'
    fi

    # Real rule violations - block the agent as they are actionable
    ESCAPED_OUTPUT=$(echo "$ESLINT_OUTPUT" | jq -Rs .)
    output_json "{\"decision\": \"block\", \"reason\": $ESCAPED_OUTPUT}"
elif [[ $ESLINT_EXIT_CODE -eq 2 ]]; then
    # Technical issues (config errors, missing deps, etc.) - don't block but provide feedback
    ERROR_MSG="ESLint encountered a technical issue with $FILE_PATH (exit code 2): $ESLINT_OUTPUT"
    ESCAPED_MSG=$(echo "$ERROR_MSG" | jq -Rs .)
    output_json "{\"hookSpecificOutput\": {\"hookEventName\": \"PostToolUse\", \"additionalContext\": $ESCAPED_MSG}}"
else
    # Unexpected exit code - don't block but provide feedback
    ERROR_MSG="ESLint returned unexpected exit code $ESLINT_EXIT_CODE for $FILE_PATH: $ESLINT_OUTPUT"
    ESCAPED_MSG=$(echo "$ERROR_MSG" | jq -Rs .)
    output_json "{\"hookSpecificOutput\": {\"hookEventName\": \"PostToolUse\", \"additionalContext\": $ESCAPED_MSG}}"
fi
