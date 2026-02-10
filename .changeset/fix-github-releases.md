---
'cli-lsp-client': patch
---

Fix GitHub releases not being created by running `changeset tag` after npm publish to create git tags and output the `New tag:` marker that changesets/action requires to trigger release creation
