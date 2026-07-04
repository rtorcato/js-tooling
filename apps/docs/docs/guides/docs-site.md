---
title: Docs site that stays in sync
description: Shared Docusaurus + TypeDoc setup so a library's docs and README track every release with no manual edits.
---

# Docs site that stays in sync

The `@rtorcato/*` libraries publish a Docusaurus site whose **API reference is
generated from source JSDoc** and which **redeploys on every release** — so
shipping a module or cutting a version updates the docs with no manual step.
This guide is the canonical setup; each repo's `CONTRIBUTING.md` links here and
adds only its own module list.

## How it stays current

- **API reference** — `docusaurus-plugin-typedoc` regenerates `docs/api/<mod>`
  from each module's source on every build. Document the code, not the docs.
- **Version badge** — the README uses a shields.io npm badge
  (`https://img.shields.io/npm/v/<pkg>.svg`), which reflects npm automatically.
- **Deploy on release** — the docs workflow rebuilds on `release: published`
  and on `src/**` / `package.json` / `README.md` changes, not just edits under
  `apps/docs/`.

## 1. TypeDoc plugins

Install the TypeDoc deps in the docs app:

```sh
pnpm --filter <docs-pkg> add -D docusaurus-plugin-typedoc typedoc typedoc-plugin-markdown
```

Wire the plugins with the shared helper — one instance per subpath module,
generated from `src/<mod>/index.ts`:

```ts
// apps/docs/docusaurus.config.ts
import { getTypedocPlugins } from '@rtorcato/js-tooling/docusaurus'

const MODULES = ['errors', 'env', 'kv'] // add a module here when it ships

const config: Config = {
  // ...
  plugins: [
    ...getTypedocPlugins(MODULES),
    // ...other plugins
  ] as Config['plugins'],
}
```

Add each module to the sidebar's API Reference category:

```ts
// apps/docs/sidebars.ts
{ type: 'doc', id: 'api/kv/index', label: 'kv' }
```

`docs/api/` is generated — gitignore it, and have biome ignore it (enable
`vcs.useIgnoreFile` in your root `biome.jsonc` so it isn't linted).

## 2. Deploy workflow

Call the reusable workflow instead of copying the build/deploy steps:

```yaml
# .github/workflows/docs.yml
name: Deploy Docs
on:
  push:
    branches: [main]
    paths: ['apps/docs/**', 'src/**', 'package.json', 'README.md', '.github/workflows/docs.yml']
  release:
    types: [published]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  docs:
    uses: rtorcato/js-tooling/.github/workflows/docs-deploy.yml@main
    with:
      build-filter: '@rtorcato/<pkg>-docs'
```

Enable GitHub Pages with **GitHub Actions** as the source
(`gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`).

## 3. Shipping a module (per-repo checklist)

Each repo's `CONTRIBUTING.md` should spell out: add the module to `MODULES` +
the sidebar, add a row to the README modules table and the docs Status table,
tick the roadmap, and commit `feat(<mod>): …`. The release and docs deploy run
on merge.
