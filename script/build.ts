#!/usr/bin/env bun

import { $ } from 'bun';
import pkg from '../package.json';

// Platform targets to build
const targets = [
  ['windows', 'x64'],
  ['linux', 'arm64'],
  ['linux', 'x64'],
  ['darwin', 'x64'],
  ['darwin', 'arm64'],
] as const;

export async function build(version: string): Promise<Record<string, string>> {
  await $`rm -rf dist`;

  const binaries: Record<string, string> = {};

  for (const [os, arch] of targets) {
    process.stdout.write(`Building ${os}-${arch}\n`);
    const name = `${pkg.name}-${os}-${arch}`;
    await $`mkdir -p dist/${name}/bin`;

    const binaryName = `${pkg.name}${os === 'windows' ? '.exe' : ''}`;
    const outfile = `dist/${name}/bin/${binaryName}`;
    const target = `bun-${os}-${arch}`;

    // Build standalone binary using CLI
    await $`bun build src/cli.ts --compile --target ${target} --outfile ${outfile}`;

    // Create package.json for platform-specific package
    await Bun.file(`dist/${name}/package.json`).write(
      JSON.stringify(
        {
          name,
          version,
          os: [os === 'windows' ? 'win32' : os],
          cpu: [arch],
        },
        null,
        2
      )
    );

    binaries[name] = version;
  }

  return binaries;
}

// Support both direct execution (CLI build) and programmatic usage (release script)
if (import.meta.main) {
  await build(pkg.version);
}
