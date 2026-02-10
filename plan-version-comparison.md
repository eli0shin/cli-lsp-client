# Version Comparison Refactoring Plan

## Decision: Use `semver` npm package

**Rationale**: The `semver` package is the de facto standard for SemVer parsing in the Node ecosystem. It handles all edge cases (prerelease identifiers, build metadata, malformed inputs returning `null`). Writing a custom parser would replicate ~200 lines of well-tested code for no benefit. Since this project compiles to a single binary via Bun, adding `semver` as a devDependency has zero runtime cost — it gets bundled in.

## Files to Change

### 1. `package.json` — Add `semver` dependency

```
bun add -d semver @types/semver
```

This adds `semver` and its types as devDependencies only.

### 2. `src/update.ts` — Replace `isNewerVersion` and `isPrerelease`

#### `isPrerelease` — Replace with `semver.prerelease()`

Current implementation:

```typescript
export function isPrerelease(version: string): boolean {
  return version.includes('-');
}
```

**Problem**: While this technically works for well-formed semver strings (the `-` separates prerelease identifiers per the spec), it would give a false positive for garbage strings containing `-`. More importantly, consistency — if we're using `semver` elsewhere, we should use it here too.

New implementation:

```typescript
import { prerelease, gt, valid } from 'semver';

export function isPrerelease(version: string): boolean {
  const result = prerelease(version);
  return result !== null && result.length > 0;
}
```

`semver.prerelease("1.2.3-beta.1")` returns `["beta", 1]`. `semver.prerelease("1.2.3")` returns `null`. `semver.prerelease("garbage")` returns `null`. This correctly handles all three cases.

#### `isNewerVersion` — Replace with `semver.gt()` + validation

Current implementation has three bugs:

1. Prerelease suffix causes `NaN` from `Number("1-beta")`
2. Malformed strings silently produce wrong results
3. No prerelease ordering

New implementation:

```typescript
export function isNewerVersion(current: string, latest: string): boolean {
  if (!valid(current) || !valid(latest)) return false;
  return gt(latest, current);
}
```

**Behavior**:

- `isNewerVersion("1.0.0", "2.0.0")` → `true` (basic version comparison)
- `isNewerVersion("2.0.0", "2.0.1-beta.1")` → `true` (`2.0.1-beta.1 > 2.0.0` per semver spec — prereleases of a higher version are still higher)
- `isNewerVersion("2.0.1-beta.1", "2.0.1-beta.2")` → `true` (prerelease ordering works)
- `isNewerVersion("2.0.1-beta.1", "2.0.1")` → `true` (release > prerelease of same version)
- `isNewerVersion("garbage", "1.0.0")` → `false` (invalid input, safe default)
- `isNewerVersion("1.0.0", "garbage")` → `false` (invalid input, safe default)
- `isNewerVersion("1.0.0", "1.0.0")` → `false` (same version, not newer)

**Note on `valid()`**: `semver.valid()` returns the cleaned version string or `null`. It handles coercion-free strict parsing. Strings like `"garbage"`, `""`, or `"1.0"` (missing patch) return `null`.

### 3. `src/updater-worker.ts` — No changes needed

The current flow at lines 50-58 is:

```typescript
if (isPrerelease(latestVersion)) {
  await updateTimestamp(statePath, deps);
  return;
}

if (!isNewerVersion(currentVersion, latestVersion)) {
  await updateTimestamp(statePath, deps);
  return;
}
```

This flow remains correct:

- `isPrerelease` now properly validates the version string before checking for prerelease identifiers (garbage → `false`, so it falls through to `isNewerVersion` which also returns `false` for garbage — correct behavior, no update on bad data)
- `isNewerVersion` now handles prerelease suffixes, but the `isPrerelease` guard above ensures we never auto-update to a prerelease

No changes needed.

### 4. `src/commands/update.ts` — No changes needed

The current code at line 30:

```typescript
if (!isNewerVersion(packageJson.version, latestVersion)) {
```

This calls `isNewerVersion` directly without an `isPrerelease` guard. This is intentional — the `update` command is user-initiated and should be willing to update to any newer version (including prereleases if GitHub's latest release happens to be one). The `fetchLatestVersion` function already hits the `/releases/latest` endpoint which GitHub filters to non-prerelease anyway.

The new `isNewerVersion` correctly handles the case where `latestVersion` has a prerelease suffix (no more NaN). If `packageJson.version` is somehow malformed, it returns `false` — safe default.

No changes needed.

### 5. `tests/update.test.ts` — Expand test coverage

#### Existing tests to keep (all still pass with new implementation):

- `isPrerelease` — all 3 existing tests remain valid
- `isNewerVersion` — all 6 existing tests remain valid
- All other test groups unchanged

#### New tests to add for `isPrerelease`:

```typescript
test('returns false for invalid version string', () => {
  expect(isPrerelease('garbage')).toBe(false);
});

test('returns false for empty string', () => {
  expect(isPrerelease('')).toBe(false);
});

test('returns true for alpha version', () => {
  expect(isPrerelease('1.0.0-alpha.0')).toBe(true);
});
```

#### New tests to add for `isNewerVersion`:

```typescript
// Prerelease handling
test('returns true when latest is prerelease of higher version', () => {
  expect(isNewerVersion('2.0.0', '2.0.1-beta.1')).toBe(true);
});

test('returns true when latest is release and current is prerelease of same version', () => {
  expect(isNewerVersion('2.0.0-beta.1', '2.0.0')).toBe(true);
});

test('returns true when latest is higher prerelease of same base version', () => {
  expect(isNewerVersion('2.0.0-beta.1', '2.0.0-beta.2')).toBe(true);
});

test('returns false when latest is lower prerelease of same base version', () => {
  expect(isNewerVersion('2.0.0-beta.2', '2.0.0-beta.1')).toBe(false);
});

test('returns false when both are same prerelease', () => {
  expect(isNewerVersion('2.0.0-beta.1', '2.0.0-beta.1')).toBe(false);
});

// Invalid input handling
test('returns false when current version is invalid', () => {
  expect(isNewerVersion('garbage', '1.0.0')).toBe(false);
});

test('returns false when latest version is invalid', () => {
  expect(isNewerVersion('1.0.0', 'garbage')).toBe(false);
});

test('returns false when both versions are invalid', () => {
  expect(isNewerVersion('garbage', 'trash')).toBe(false);
});

test('returns false when current is empty string', () => {
  expect(isNewerVersion('', '1.0.0')).toBe(false);
});

test('returns false when latest is empty string', () => {
  expect(isNewerVersion('1.0.0', '')).toBe(false);
});
```

## Implementation Order (TDD)

1. **Install semver**: `bun add -d semver @types/semver`
2. **Write new tests first** in `tests/update.test.ts` (they will fail against current implementation)
3. **Update `src/update.ts`** — replace `isPrerelease` and `isNewerVersion` with semver-based implementations
4. **Run tests** — verify all pass (old + new)
5. **Run `bun run build`** to verify semver gets bundled correctly
6. **Run `bun run typecheck`** to verify no type errors

## Risk Assessment

- **Low risk**: `semver.gt()` is a drop-in replacement for the comparison logic. All existing callers pass the same arguments and expect the same return type (`boolean`).
- **Behavioral change**: `isPrerelease("string-with-dash")` currently returns `true`. After the change, it returns `false` for non-semver strings. This is strictly better — we don't want to treat garbage as a prerelease.
- **No consumer changes**: Both `updater-worker.ts` and `commands/update.ts` continue to work without modification.
