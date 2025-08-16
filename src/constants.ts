export const HELP_MESSAGE = `Usage: cli-lsp-client <command> [arguments]

Commands:
  help                          Show this help message
  version                       Show version number
  status                        Show daemon status and memory usage
  list                          List all running daemons with their working directories
  diagnostics <file>           Get diagnostics for a file
  hover <file> <symbol>        Get hover info for a symbol in specific file
  start [directory]            Start LSP servers for a directory (default: current)
  logs                         Show the daemon log file path
  stop                         Stop the daemon
  stop-all                     Stop all daemons across all directories

Examples:
  cli-lsp-client help                           # Show this help
  cli-lsp-client version                        # Show version number
  cli-lsp-client status                         # Check daemon status
  cli-lsp-client list                           # List all running daemons
  cli-lsp-client diagnostics src/main.ts        # Get TypeScript diagnostics
  cli-lsp-client diagnostics ./script.py       # Get Python diagnostics
  cli-lsp-client hover src/client.ts runCommand # Get hover info for runCommand function
  cli-lsp-client hover src/formatter.ts formatHoverResults # Get hover info for formatHoverResults function
  cli-lsp-client start                          # Start servers for current directory
  cli-lsp-client start /path/to/project        # Start servers for specific directory
  cli-lsp-client logs                           # Get log file location
  cli-lsp-client stop                           # Stop the daemon
  cli-lsp-client stop-all                       # Stop all daemons (useful after package updates)

The daemon automatically starts when needed and caches LSP servers for fast diagnostics.
Use 'cli-lsp-client logs' to find the log file for debugging.`;