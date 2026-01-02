#!/usr/bin/env node

import fs from "fs"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Skip postinstall when running from source (dev/CI)
function shouldSkipPostinstall() {
  const packageRoot = path.join(__dirname, "..")
  const srcDir = path.join(packageRoot, "src")
  if (fs.existsSync(srcDir)) {
    console.log("Skipping postinstall (running from source)")
    return true
  }
  return false
}

function detectPlatformAndArch() {
  let platform
  switch (os.platform()) {
    case "darwin":
      platform = "darwin"
      break
    case "linux":
      platform = "linux"
      break
    case "win32":
      platform = "windows"
      break
    default:
      platform = os.platform()
  }

  let arch
  switch (os.arch()) {
    case "x64":
      arch = "x64"
      break
    case "arm64":
      arch = "arm64"
      break
    default:
      arch = os.arch()
  }

  return { platform, arch }
}

function findBinary() {
  const { platform, arch } = detectPlatformAndArch()
  const packageName = `cli-lsp-client-${platform}-${arch}`
  const binary = platform === "windows" ? "cli-lsp-client.exe" : "cli-lsp-client"

  try {
    const packageJsonPath = require.resolve(`${packageName}/package.json`)
    const packageDir = path.dirname(packageJsonPath)
    const binaryPath = path.join(packageDir, "bin", binary)

    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Binary not found at ${binaryPath}`)
    }

    return binaryPath
  } catch (error) {
    throw new Error(`Could not find package ${packageName}: ${error.message}`)
  }
}

async function regenerateWindowsCmdWrappers() {
  console.log("Windows + npm: Rebuilding bin links")

  try {
    const { execSync } = require("child_process")
    const pkgPath = path.join(__dirname, "..")

    const isGlobal = process.env.npm_config_global === "true" || pkgPath.includes(path.join("npm", "node_modules"))

    const cmd = `npm rebuild cli-lsp-client --ignore-scripts${isGlobal ? " -g" : ""}`
    const opts = {
      stdio: "inherit",
      shell: true,
      ...(isGlobal ? {} : { cwd: path.join(pkgPath, "..", "..") }),
    }

    execSync(cmd, opts)
    console.log("Successfully rebuilt npm bin links")
  } catch (error) {
    console.error("Error rebuilding npm links:", error.message)
  }
}

async function stopExistingDaemons() {
  try {
    const { spawn } = require("child_process")
    spawn("cli-lsp-client", ["stop-all"], { stdio: "ignore" })
  } catch {
    // Ignore errors - daemon might not be running
  }
}

async function main() {
  if (shouldSkipPostinstall()) {
    return
  }

  try {
    if (os.platform() === "win32") {
      if (process.env.npm_config_user_agent?.startsWith("npm")) {
        await regenerateWindowsCmdWrappers()
      }
      await stopExistingDaemons()
      return
    }

    const binaryPath = findBinary()
    const binScript = path.join(__dirname, "..", "bin", "cli-lsp-client")

    // Create symlink to actual binary
    if (fs.existsSync(binScript)) {
      fs.unlinkSync(binScript)
    }

    fs.symlinkSync(binaryPath, binScript)
    console.log(`Binary symlinked: ${binScript} -> ${binaryPath}`)

    // Stop existing daemons
    await stopExistingDaemons()
  } catch (error) {
    console.error("Failed to create binary symlink:", error.message)
    process.exit(1)
  }
}

try {
  main()
} catch (error) {
  console.error("Postinstall error:", error.message)
  process.exit(0)
}