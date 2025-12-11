#!/bin/bash

# Utility functions for LSP plugin hooks

# Get the appropriate package runner (bunx if Bun is available, otherwise npx)
get_package_runner() {
    if command -v bun >/dev/null 2>&1; then
        echo "bunx"
    else
        echo "npx"
    fi
}
