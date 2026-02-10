# cli-lsp-client

## 1.22.1

### Patch Changes

- [#46](https://github.com/eli0shin/cli-lsp-client/pull/46) [`2baa612`](https://github.com/eli0shin/cli-lsp-client/commit/2baa612bb3ae8ca367815faa3f225cdeddd4bce9) Thanks [@eli0shin](https://github.com/eli0shin)! - Fix GitHub releases not being created by running `changeset tag` after npm publish to create git tags and output the `New tag:` marker that changesets/action requires to trigger release creation

## 1.22.0

### Minor Changes

- [#43](https://github.com/eli0shin/cli-lsp-client/pull/43) [`48a3b6d`](https://github.com/eli0shin/cli-lsp-client/commit/48a3b6d59f1807cd48a0ddee6851a4e1dd3ea46e) Thanks [@eli0shin](https://github.com/eli0shin)! - Add GitHub Releases binary publishing, install script for direct binary installation via curl, and auto-update system that checks for new versions in the background and stops all daemons after updating

## 1.21.1

### Patch Changes

- [`18d3495`](https://github.com/eli0shin/cli-lsp-client/commit/18d34954e271c24e4ea3ca9d72f9053383f83984) Thanks [@eli0shin](https://github.com/eli0shin)! - Fix mac arm build publishing by configuring trusted publishing for the darwin-arm64 platform package

## 1.21.0

### Minor Changes

- [#40](https://github.com/eli0shin/cli-lsp-client/pull/40) [`a5f8a06`](https://github.com/eli0shin/cli-lsp-client/commit/a5f8a06e849848b7c0262bfd5c6bb623eb6c34f9) Thanks [@eli0shin](https://github.com/eli0shin)! - Add automated npm release pipeline using changesets for version management and publishing
