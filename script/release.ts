#!/usr/bin/env bun
/* eslint-disable no-console */

import { Command } from '@commander-js/extra-typings';
import { $ } from 'bun';
import pkg from '../package.json';
import { build } from './build.ts';

type BumpType = 'patch' | 'minor' | 'major';

function isBumpType(value: string): value is BumpType {
  return value === 'patch' || value === 'minor' || value === 'major';
}

const program = new Command()
  .name('release')
  .description('Release a new version of cli-lsp-client')
  .version(pkg.version)
  .argument('[bump]', 'version bump type (patch, minor, major)', (value) => {
    if (value && !isBumpType(value)) {
      throw new Error(
        `Invalid bump type: ${value}. Must be patch, minor, or major.`
      );
    }
    return value;
  })
  .option('--skip-tests', 'skip running tests')
  .option('--dry-run', 'perform a dry run without publishing')
  .option(
    '--publish-only',
    'skip version bumping and git operations, just build and publish'
  )
  .parse();

const bumpType = program.args[0];
const options = program.opts();

function bumpVersion(current: string, type: BumpType): string {
  const [major, minor, patch] = current.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
  }
}

async function determineVersion(): Promise<string> {
  const currentVersion = pkg.version;
  console.log(`Current version: ${currentVersion}`);

  // If bump type provided, use it
  if (bumpType && isBumpType(bumpType)) {
    const newVersion = bumpVersion(currentVersion, bumpType);
    console.log(`📦 Bumping ${bumpType}: ${currentVersion} → ${newVersion}`);
    return newVersion;
  }

  // Interactive prompt
  console.log('\nSelect version bump:');
  console.log(
    `  1) patch: ${currentVersion} → ${bumpVersion(currentVersion, 'patch')}`
  );
  console.log(
    `  2) minor: ${currentVersion} → ${bumpVersion(currentVersion, 'minor')}`
  );
  console.log(
    `  3) major: ${currentVersion} → ${bumpVersion(currentVersion, 'major')}`
  );
  console.log('  4) custom');

  const choice = prompt('Enter choice (1-4):');

  if (!choice) {
    console.error('❌ No choice entered');
    process.exit(1);
  }

  switch (choice) {
    case '1':
      return bumpVersion(currentVersion, 'patch');
    case '2':
      return bumpVersion(currentVersion, 'minor');
    case '3':
      return bumpVersion(currentVersion, 'major');
    case '4': {
      const custom = prompt('Enter version (X.Y.Z):');
      if (!custom || !/^\d+\.\d+\.\d+$/.test(custom)) {
        console.error('❌ Invalid version format');
        process.exit(1);
      }
      return custom;
    }
    default:
      console.error('❌ Invalid choice');
      process.exit(1);
  }
}

async function validateGitStatus() {
  console.log('\n🔍 Checking git status...');

  // Check if on main branch
  const branch = await $`git rev-parse --abbrev-ref HEAD`.text();
  if (branch.trim() !== 'main') {
    console.error(
      `❌ Error: Must be on main branch (currently on ${branch.trim()})`
    );
    process.exit(1);
  }

  // Check if working directory is clean
  const status = await $`git status --porcelain`.text();
  if (status.trim()) {
    console.error(
      '❌ Error: Working directory is not clean. Commit or stash changes first:'
    );
    console.error(status);
    process.exit(1);
  }

  console.log('✅ Git status is clean');
}

async function validateNpmAuth() {
  console.log('\n🔑 Checking npm authentication...');

  try {
    await $`npm whoami`.quiet();
    console.log('✅ Authenticated with npm');
  } catch {
    console.error('❌ Error: Not authenticated with npm. Run: npm login');
    process.exit(1);
  }
}

async function runTests() {
  if (options.skipTests) {
    console.log('\n⚠️  Skipping tests (--skip-tests)');
    return;
  }

  console.log('\n🧪 Running tests...');

  try {
    await $`bun test`;
    console.log('✅ All tests passed');
  } catch {
    console.error('❌ Error: Tests failed. Fix tests before publishing.');
    process.exit(1);
  }
}

async function buildBinaries(version: string): Promise<Record<string, string>> {
  console.log('\n🔨 Building platform binaries...');

  try {
    const binaries = await build(version);
    console.log('✅ Built all platform binaries');
    return binaries;
  } catch {
    console.error('❌ Error: Build failed');
    process.exit(1);
  }
}

async function publishPlatformPackages(binaries: Record<string, string>) {
  console.log('\n📤 Publishing platform-specific packages...');

  for (const [name, version] of Object.entries(binaries)) {
    console.log(`  Publishing ${name}@${version}...`);
    try {
      if (options.dryRun) {
        console.log(`  [DRY RUN] Would publish ${name}`);
      } else {
        await $`chmod 755 dist/${name}/bin/* && cd dist/${name} && npm publish --access public`;
        console.log(`  ✅ Published ${name}`);
      }
    } catch (error) {
      console.error(`  ❌ Failed to publish ${name}`);
      throw error;
    }
  }

  console.log('✅ All platform packages published');
}

async function publishMainPackage(
  version: string,
  binaries: Record<string, string>
) {
  console.log('\n📤 Publishing main package...');

  // Create main package directory
  await $`mkdir -p ./dist/${pkg.name}`;
  await $`cp -r ./bin ./dist/${pkg.name}/bin`;
  await $`cp ./script/preinstall.mjs ./dist/${pkg.name}/preinstall.mjs`;
  await $`cp ./script/postinstall.mjs ./dist/${pkg.name}/postinstall.mjs`;

  // Create main package.json with optionalDependencies
  await Bun.file(`./dist/${pkg.name}/package.json`).write(
    JSON.stringify(
      {
        name: pkg.name,
        version,
        description: pkg.description,
        repository: pkg.repository,
        bugs: pkg.bugs,
        homepage: pkg.homepage,
        license: pkg.license,
        bin: {
          [pkg.name]: `./bin/${pkg.name}`,
        },
        scripts: {
          preinstall: 'node ./preinstall.mjs',
          postinstall: 'node ./postinstall.mjs',
        },
        optionalDependencies: binaries,
      },
      null,
      2
    )
  );

  try {
    if (options.dryRun) {
      console.log(`[DRY RUN] Would publish ${pkg.name}@${version}`);
    } else {
      await $`cd ./dist/${pkg.name} && npm publish --access public`;
      console.log(`✅ Published ${pkg.name}@${version}`);
    }
  } catch (error) {
    console.error('❌ Failed to publish main package');
    throw error;
  }
}

async function updatePackageVersion(version: string) {
  console.log('\n📝 Updating package.json version...');

  const packageJson = { ...pkg, version };
  await Bun.file('package.json').write(
    JSON.stringify(packageJson, null, 2) + '\n'
  );

  if (options.dryRun) {
    console.log(`[DRY RUN] Would commit and push version ${version}`);
  } else {
    await $`git add package.json`;
    await $`git commit -m ${version}`;
    await $`git push`;
    console.log(`✅ Updated package.json to ${version} and committed`);
  }
}

async function createGitTag(version: string) {
  console.log('\n🏷️  Creating git tag...');

  try {
    if (options.dryRun) {
      console.log(`[DRY RUN] Would create and push tag v${version}`);
    } else {
      await $`git tag v${version}`;
      await $`git push origin v${version}`;
      console.log(`✅ Created and pushed tag v${version}`);
    }
  } catch (error) {
    console.error('❌ Failed to create git tag');
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting release process...\n');

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be published\n');
  }

  if (options.publishOnly) {
    const version = pkg.version;
    console.log(`📦 Publishing version: ${version}`);

    const binaries = await buildBinaries(version);
    await publishPlatformPackages(binaries);
    await publishMainPackage(version, binaries);

    if (!options.dryRun) {
      // Create git tags and output "New tag:" for changesets/action to detect.
      // The action parses stdout for this pattern, then pushes the tag and creates
      // the GitHub release. See: https://github.com/changesets/action/blob/main/src/run.ts
      await $`bunx changeset tag`;
    }

    if (options.dryRun) {
      console.log(`\n✅ Dry run completed for ${pkg.name}@${version}`);
    } else {
      console.log(`\n✨ Successfully published ${pkg.name}@${version}!`);
      console.log(
        `\n📦 View on npm: https://www.npmjs.com/package/${pkg.name}`
      );
    }
    return;
  }

  const version = await determineVersion();

  console.log(`\n📦 Releasing version: ${version}`);
  if (options.dryRun) {
    console.log('⚠️  Dry run - skipping confirmation');
  } else {
    const confirm = prompt('\nProceed with release? (yes/no):');
    if (confirm?.toLowerCase() !== 'yes') {
      console.log('❌ Release cancelled');
      process.exit(0);
    }
  }

  await validateGitStatus();
  if (!options.dryRun) {
    await validateNpmAuth();
  }
  await runTests();
  const binaries = await buildBinaries(version);
  await publishPlatformPackages(binaries);
  await publishMainPackage(version, binaries);
  await updatePackageVersion(version);
  await createGitTag(version);

  if (options.dryRun) {
    console.log(`\n✅ Dry run completed for ${pkg.name}@${version}`);
  } else {
    console.log(`\n✨ Successfully released ${pkg.name}@${version}!`);
    console.log(`\n📦 View on npm: https://www.npmjs.com/package/${pkg.name}`);
    console.log(
      `🏷️  View tag: https://github.com/${pkg.repository.url.match(/github\.com\/(.+?)\.git/)?.[1]}/releases/tag/v${version}`
    );
  }
}

try {
  await main();
} catch (error) {
  console.error('\n💥 Release failed:', error);
  process.exit(1);
}
