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

## Code Style
- This project uses ES modules exclusively
- TypeScript with strict mode enabled
- ALWAYS use Bun standard library APIs (`Bun.file`, `Bun.write`) instead of Node.js fs module
- Prefer native Bun APIs over Node.js equivalents when available
- Main executable entry point uses `import.meta.main` check

## Testing
- When testing the CLI, use the built executable `./lspcli` 
- Test all daemon commands: hello, add, status, stop, daemon