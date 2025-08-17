# Project Instructions

This is a Bun CLI project that builds a standalone executable.

## Package Management & Runtime

- ALWAYS use `bun` instead of `npm` or `yarn` for all package management
- ALWAYS use `bun run` to execute scripts
- Use `bunx` instead of `npx` for running packages

## Build & Development Commands

- Build standalone executable: `bun run build`
- Run in development: `bun run dev`
- Type checking: `bun run typecheck`
- Install dependencies: `bun install`

## Development Workflow

- **CRITICAL**: After making code changes, ALWAYS run `bun run build` to rebuild the executable
- **CRITICAL**: After rebuilding, ALWAYS run `./cli-lsp-client stop` to stop the daemon before testing
- The daemon runs the compiled executable, not the source files directly
- Changes to source files are not visible until you build and restart the daemon

## Code Style

- This project uses ES modules exclusively
- TypeScript with strict mode enabled
- ALWAYS use Bun standard library APIs (`Bun.file`, `Bun.write`) instead of Node.js fs module
- Prefer native Bun APIs over Node.js equivalents when available
- Main executable entry point uses `import.meta.main` check

## Testing

- Run tests: `bun test`
- Tests use Bun's built-in testing framework with `expect` assertions
- CLI tests use `spawn` to execute the binary and verify exit codes and output
- Use `stripAnsi()` helper from test-utils to remove ANSI color codes from output
- Use `.nothrow()` on Bun shell commands to prevent test failures on non-zero exit codes
- **CRITICAL**: ALWAYS use `expect(...).toBe(...)` with exact string matches, NEVER use `toContain()` for output validation
- All test assertions must use `stripAnsi()` on CLI output before exact string comparison with `toBe()`
