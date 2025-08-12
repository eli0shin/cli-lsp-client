#!/bin/bash

# Simple valid shell script
set -euo pipefail

main() {
    local name="${1:-World}"
    echo "Hello, $name!"
}

main "$@"