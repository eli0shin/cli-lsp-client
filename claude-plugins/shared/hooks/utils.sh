#!/bin/bash

# Shared utility functions for Claude Code hooks

# Get the appropriate package runner (bunx if Bun is available, otherwise npx)
get_package_runner() {
    if command -v bun >/dev/null 2>&1; then
        echo "bunx"
    else
        echo "npx"
    fi
}

# Parse JSON input from stdin and extract fields
parse_hook_input() {
    local input="$1"
    
    # Extract project_dir and file_path
    PROJECT_DIR=$(echo "$input" | jq -r ".cwd // empty" 2>/dev/null)
    FILE_PATH=$(echo "$input" | jq -r ".tool_input.file_path // empty" 2>/dev/null)
    
    # Validate we have required fields
    if [[ -z "$PROJECT_DIR" || -z "$FILE_PATH" ]]; then
        return 1
    fi
    
    return 0
}

# Check if project has local hook override for a tool
has_project_hook_override() {
    local project_dir="$1"
    local tool="$2"
    
    local project_settings="$project_dir/.claude/settings.json"
    
    # Check if project has .claude/settings.json
    if [[ ! -f "$project_settings" ]]; then
        return 1
    fi
    
    # Check if settings has PostToolUse hooks with our tool
    if jq -e ".hooks.PostToolUse[]?.hooks[]?.command | select(test(\"$tool\"; \"i\"))" "$project_settings" >/dev/null 2>&1; then
        return 0
    fi
    
    return 1
}

# Check if prettier is configured in the project
has_prettier_config() {
    local project_dir="$1"

    # Check for any file with "prettier" in the name (including hidden files)
    if find "$project_dir" -maxdepth 1 -name "*prettier*" -print -quit | grep -q .; then
        return 0
    fi

    # Check for prettier field in package.json
    if [[ -f "$project_dir/package.json" ]]; then
        if jq -e ".prettier" "$project_dir/package.json" >/dev/null 2>&1; then
            return 0
        fi
    fi

    return 1
}

# Check if eslint is configured in the project
has_eslint_config() {
    local project_dir="$1"
    
    # Check for any file with "eslint" in the name
    if ls "$project_dir"/*eslint* >/dev/null 2>&1; then
        return 0
    fi
    
    # Check for eslintConfig field in package.json
    if [[ -f "$project_dir/package.json" ]]; then
        if jq -e ".eslintConfig" "$project_dir/package.json" >/dev/null 2>&1; then
            return 0
        fi
    fi
    
    return 1
}

# Check if file matches supported extensions
file_matches_extensions() {
    local file_path="$1"
    shift
    local extensions=("$@")
    
    for ext in "${extensions[@]}"; do
        if [[ "$file_path" =~ \.$ext$ ]]; then
            return 0
        fi
    done
    
    return 1
}