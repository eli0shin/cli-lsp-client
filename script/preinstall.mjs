#!/usr/bin/env node

import fs from "fs"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function main() {
  if (os.platform() !== "win32") {
    console.log("Non-Windows platform, skipping preinstall")
    return
  }

  console.log("Windows: Modifying package.json bin entry")

  const packageJsonPath = path.join(__dirname, "..", "package.json")
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))

  // Point to .cmd file on Windows
  packageJson.bin = {
    "cli-lsp-client": "./bin/cli-lsp-client.cmd",
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
  console.log("Updated package.json bin to use cli-lsp-client.cmd")

  // Remove Unix script
  const unixScript = path.join(__dirname, "..", "bin", "cli-lsp-client")
  if (fs.existsSync(unixScript)) {
    fs.unlinkSync(unixScript)
  }
}

try {
  main()
} catch (error) {
  console.error("Preinstall error:", error.message)
  process.exit(0)
}