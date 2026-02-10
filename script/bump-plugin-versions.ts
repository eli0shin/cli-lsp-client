#!/usr/bin/env bun
/* eslint-disable no-console */

import { $ } from 'bun';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const PLUGINS_DIR = 'claude-plugins';

function bumpPatch(version: string): string {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

async function discoverPlugins(): Promise<string[]> {
  const entries = await readdir(PLUGINS_DIR, { withFileTypes: true });
  const plugins: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pluginJsonPath = path.join(
      PLUGINS_DIR,
      entry.name,
      '.claude-plugin',
      'plugin.json'
    );
    const file = Bun.file(pluginJsonPath);
    if (await file.exists()) {
      plugins.push(entry.name);
    }
  }

  return plugins;
}

async function getLastReleaseTag(): Promise<string | null> {
  try {
    const tag = await $`git describe --tags --match "v*" --abbrev=0`.text();
    return tag.trim();
  } catch {
    return null;
  }
}

async function getChangedFiles(sinceTag: string): Promise<string[]> {
  const output = await $`git diff --name-only ${sinceTag}...HEAD`.text();
  return output
    .trim()
    .split('\n')
    .filter((f) => f.length > 0);
}

function pluginHasChanges(pluginName: string, changedFiles: string[]): boolean {
  const pluginDir = `${PLUGINS_DIR}/${pluginName}/`;
  const pluginJsonPath = `${pluginDir}.claude-plugin/plugin.json`;

  return changedFiles.some(
    (file) => file.startsWith(pluginDir) && file !== pluginJsonPath
  );
}

async function main() {
  console.log('Checking for plugin version bumps...\n');

  const tag = await getLastReleaseTag();
  if (!tag) {
    console.log('No release tags found, skipping plugin version bumps.');
    return;
  }

  console.log(`Last release tag: ${tag}`);

  const plugins = await discoverPlugins();
  if (plugins.length === 0) {
    console.log('No plugins found.');
    return;
  }

  console.log(`Discovered plugins: ${plugins.join(', ')}\n`);

  const changedFiles = await getChangedFiles(tag);
  let bumped = 0;

  for (const plugin of plugins) {
    if (!pluginHasChanges(plugin, changedFiles)) {
      console.log(`  ${plugin}: no changes, skipping`);
      continue;
    }

    const pluginJsonPath = path.join(
      PLUGINS_DIR,
      plugin,
      '.claude-plugin',
      'plugin.json'
    );
    const file = Bun.file(pluginJsonPath);
    const pluginJson = await file.json();
    const oldVersion = pluginJson.version;
    const newVersion = bumpPatch(oldVersion);

    pluginJson.version = newVersion;
    await Bun.write(file, JSON.stringify(pluginJson, null, 2) + '\n');

    console.log(`  ${plugin}: ${oldVersion} → ${newVersion}`);
    bumped++;
  }

  console.log(
    bumped > 0
      ? `\nBumped ${bumped} plugin(s).`
      : '\nNo plugins needed bumping.'
  );
}

await main();
